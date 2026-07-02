import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const body = await req.json()
    const {
      checkinId, selfieUrl, sceneUrl, gpsLat, gpsLng, gpsAccuracyM, gpsIsMock,
      sceneCheckpointId, appVersion, osVersion,
      livenessMethod, facetecLivenessPassed, facetecMatchScore, facetecSessionId,
    } = body

    const isFacetec = livenessMethod === 'facetec'
    // En modo FaceTec no se sube selfie a Storage (el FaceMap lo procesa FaceTec)
    if (!checkinId || !sceneUrl || gpsLat == null || gpsLng == null || (!isFacetec && !selfieUrl)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const { data: checkin } = await supabase
      .from('checkins')
      .select('id, case_id, status')
      .eq('id', checkinId)
      .single()

    if (!checkin) {
      return new Response(JSON.stringify({ error: 'Checkin not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    if (checkin.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Already completed' }), { status: 409, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const { data: caso } = await supabase
      .from('cases')
      .select('id, organization_id, imputado_id, geofence_radius_m, location')
      .eq('id', checkin.case_id)
      .single()

    if (!caso || caso.imputado_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // GPS
    let gpsDistanceM: number | null = null
    let gpsPassed = true
    const failReasons: string[] = []

    if (gpsIsMock) {
      gpsPassed = false
      failReasons.push('GPS simulado detectado')
    } else if (caso.location) {
      const coords = caso.location.coordinates
      gpsDistanceM = distanceMeters(gpsLat, gpsLng, coords[1], coords[0])
      gpsPassed = gpsDistanceM <= (caso.geofence_radius_m ?? 200)
      if (!gpsPassed) failReasons.push(`GPS fuera del domicilio (${Math.round(gpsDistanceM)}m)`)
    }

    // ESCENA — comparar foto actual con checkpoint de referencia usando OpenAI
    let sceneScore = 80
    let scenePassed = true
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    if (openaiKey && sceneCheckpointId) {
      try {
        // Cargar checkpoint de referencia
        const { data: checkpoint } = await supabase
          .from('checkpoints')
          .select('photo_url')
          .eq('id', sceneCheckpointId)
          .single()

        if (checkpoint?.photo_url) {
          // Normalizar: el photo_url puede venir como URL pública completa (datos viejos)
          // o como path relativo (datos nuevos). createSignedUrl requiere el path.
          const toPath = (u: string) => {
            const marker = '/checkin-evidence/'
            const i = u.indexOf(marker)
            return i >= 0 ? u.slice(i + marker.length) : u
          }
          const refPath = toPath(checkpoint.photo_url)
          const scenePath = toPath(sceneUrl)

          // Generar signed URLs (60 segundos es suficiente para la llamada a OpenAI)
          const [sceneRes, refRes] = await Promise.all([
            supabase.storage.from('checkin-evidence').createSignedUrl(scenePath, 60),
            supabase.storage.from('checkin-evidence').createSignedUrl(refPath, 60),
          ])
          const signedScene = sceneRes.data
          const signedRef = refRes.data

          if (signedScene?.signedUrl && signedRef?.signedUrl) {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 50,
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Compare these two photos of interior spaces. The first is a live photo, the second is the reference. Are they the same room or space? Reply with ONLY a JSON object: {"match": true/false, "score": 0-100}' },
                    { type: 'image_url', image_url: { url: signedScene.signedUrl, detail: 'low' } },
                    { type: 'image_url', image_url: { url: signedRef.signedUrl, detail: 'low' } },
                  ],
                }],
              }),
            })

            if (aiRes.ok) {
              const aiJson = await aiRes.json()
              const content = aiJson.choices?.[0]?.message?.content ?? ''
              const parsed = JSON.parse(content.match(/\{[^}]+\}/)?.[0] ?? '{}')
              if (typeof parsed.score === 'number') sceneScore = parsed.score
              if (typeof parsed.match === 'boolean') scenePassed = parsed.match
              if (!scenePassed) failReasons.push(`La foto no coincide con el punto de referencia solicitado`)
            } else {
              const errBody = await aiRes.text()
              console.error(`OpenAI ${aiRes.status}: ${errBody.slice(0, 300)}`)
              scenePassed = false
              sceneScore = 0
              failReasons.push('No se pudo verificar la escena')
            }
          } else {
            console.error(`Signed URL fail — scene:${sceneRes.error?.message ?? 'ok'} ref:${refRes.error?.message ?? 'ok'} refPath:${refPath}`)
            scenePassed = false
            sceneScore = 0
            failReasons.push('No se pudo verificar la escena')
          }
        }
      } catch (e: any) {
        console.error(`Scene verification error: ${e?.message ?? String(e)}`)
        scenePassed = false
        sceneScore = 0
        failReasons.push('No se pudo verificar la escena')
      }
    }

    // CARA — con FaceTec el veredicto se lee de facetec_sessions (registrado
    // server-side por facetec-proxy). Lo que reporte el teléfono se IGNORA:
    // un cliente comprometido no puede fabricar una sesión válida.
    let faceScore = 0.95
    let facePassed = true
    if (isFacetec) {
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: session } = await supabase
        .from('facetec_sessions')
        .select('id, was_processed, error, created_at')
        .eq('imputado_id', user.id)
        .eq('kind', 'auth')
        .eq('was_processed', true)
        .is('error', null)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      facePassed = !!session
      faceScore = facePassed ? 1.0 : 0
      if (!facePassed) {
        failReasons.push('Verificación facial no registrada en el servidor')
      }
    }

    const overallPassed = gpsPassed && scenePassed && facePassed
    const overallScore = (gpsPassed ? 50 : 0) + (scenePassed ? 30 : 0) + (facePassed ? 20 : 0)
    const failureReason = failReasons.length > 0 ? failReasons.join('. ') : null

    await supabase.from('checkins').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      liveness_method: isFacetec ? 'facetec' : 'accelerometer',
      face_score: faceScore,
      face_passed: facePassed,
      face_photo_url: selfieUrl ?? null,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_accuracy_m: gpsAccuracyM ?? null,
      gps_passed: gpsPassed,
      gps_distance_m: gpsDistanceM,
      gps_is_mock: gpsIsMock ?? false,
      scene_checkpoint_id: sceneCheckpointId ?? null,
      scene_score: sceneScore,
      scene_passed: scenePassed,
      scene_photo_url: sceneUrl,
      overall_score: overallScore,
      overall_passed: overallPassed,
      failure_reason: failureReason,
      app_version: appVersion ?? null,
      os_version: osVersion ?? null,
    }).eq('id', checkinId)

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
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: err?.message ?? String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
