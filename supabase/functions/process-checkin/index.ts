import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Haversine: distancia en metros entre dos coordenadas
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  // Autenticar al imputado
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response('Unauthorized', { status: 401 })

  const {
    checkinId,
    selfieUrl,
    sceneUrl,
    sceneCheckpointId,
    gpsLat,
    gpsLng,
    gpsAccuracyM,
    gpsIsMock,
    appVersion,
    osVersion,
  } = await req.json()

  if (!checkinId || !selfieUrl || !sceneUrl || gpsLat == null || gpsLng == null) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Cargar checkin + caso con geofence
  const { data: checkin, error: checkinError } = await supabase
    .from('checkins')
    .select('id, case_id, status')
    .eq('id', checkinId)
    .single()

  if (checkinError || !checkin) {
    return new Response('Checkin not found', { status: 404 })
  }

  if (checkin.status === 'completed') {
    return new Response(JSON.stringify({ error: 'Checkin already completed' }), { status: 409 })
  }

  const { data: caso } = await supabase
    .from('cases')
    .select('id, organization_id, imputado_id, geofence_radius_m, face_threshold, scene_threshold, location')
    .eq('id', checkin.case_id)
    .single()

  if (!caso) return new Response('Case not found', { status: 404 })

  // Verificar que el checkin pertenece al imputado autenticado
  if (caso.imputado_id !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── 1. VERIFICACIÓN GPS ──────────────────────────────────────────────────
  let gpsDistanceM: number | null = null
  let gpsPassed = false
  const failReasons: string[] = []

  if (gpsIsMock) {
    failReasons.push('GPS simulado detectado')
  } else if (caso.location) {
    // location viene como GeoJSON desde PostGIS
    const coords = caso.location.coordinates // [lng, lat]
    gpsDistanceM = distanceMeters(gpsLat, gpsLng, coords[1], coords[0])
    gpsPassed = gpsDistanceM <= caso.geofence_radius_m

    if (!gpsPassed) {
      failReasons.push(`GPS fuera del domicilio (${Math.round(gpsDistanceM)}m, máx ${caso.geofence_radius_m}m)`)
    }
  } else {
    // Sin geofence configurado: pasa por defecto
    gpsPassed = true
  }

  // ── 2. VERIFICACIÓN FACIAL (placeholder → Fase 2: AWS Rekognition) ──────
  const faceScore = 0.95  // placeholder
  const facePassed = true // placeholder

  // ── 3. VERIFICACIÓN DE ESCENA (placeholder → Fase 2: CLIP embeddings) ───
  const sceneScore = 0.92  // placeholder
  const scenePassed = true // placeholder

  // ── 4. SCORE CONSOLIDADO ─────────────────────────────────────────────────
  // GPS: 50% | Cara: 30% | Escena: 20%
  const gpsWeight = 0.5
  const faceWeight = 0.3
  const sceneWeight = 0.2

  const gpsContrib = gpsPassed ? 100 * gpsWeight : 0
  const faceContrib = facePassed ? 100 * faceWeight : 0
  const sceneContrib = scenePassed ? 100 * sceneWeight : 0
  const overallScore = gpsContrib + faceContrib + sceneContrib

  const overallPassed = gpsPassed && facePassed && scenePassed
  const failureReason = failReasons.length > 0 ? failReasons.join('. ') : null

  // ── 5. ACTUALIZAR CHECKIN ────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('checkins')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),

      face_score: faceScore,
      face_passed: facePassed,
      face_photo_url: selfieUrl,

      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_accuracy_m: gpsAccuracyM,
      gps_passed: gpsPassed,
      gps_distance_m: gpsDistanceM,
      gps_is_mock: gpsIsMock,

      scene_checkpoint_id: sceneCheckpointId ?? null,
      scene_score: sceneScore,
      scene_passed: scenePassed,
      scene_photo_url: sceneUrl,

      overall_score: overallScore,
      overall_passed: overallPassed,
      failure_reason: failureReason,

      app_version: appVersion ?? null,
      os_version: osVersion ?? null,
    })
    .eq('id', checkinId)

  if (updateError) {
    console.error('Error updating checkin:', updateError)
    return new Response(JSON.stringify({ error: 'Failed to save checkin' }), { status: 500 })
  }

  // ── 6. ALERTA SI FALLÓ GPS ───────────────────────────────────────────────
  if (!gpsPassed || gpsIsMock) {
    await supabase.from('alerts').insert({
      organization_id: caso.organization_id,
      case_id: checkin.case_id,
      checkin_id: checkinId,
      severity: gpsIsMock ? 'critical' : 'warning',
      type: gpsIsMock ? 'mock_gps' : 'gps_out',
      message: failureReason ?? 'GPS fuera del domicilio',
    })
  }

  return new Response(
    JSON.stringify({ overall_passed: overallPassed, overall_score: overallScore, failure_reason: failureReason }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
})
