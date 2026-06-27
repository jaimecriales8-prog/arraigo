# Flujo de Check-in — Arraigo

## Tipos de verificación

### 1. Verificación programada
- Se activa según `checkin_frequency_hours` del caso
- El imputado ve los horarios en su home (ej: 08:00, 14:00, 20:00)
- Disponible durante la ventana `checkin_window_minutes`

### 2. Verificación sorpresa
- La dispara el juzgado desde el panel web → botón ⚡
- El imputado recibe push notification inmediata
- Tiene 15 minutos para completarla
- Si no responde → `status: expired` + alerta al juzgado

## Pasos del check-in

### Paso 1: Selfie (`/checkin/selfie`)
- CameraView facing="front"
- Overlay oval como guía
- Captura foto base64
- Guarda en `checkinStore.selfieBase64`

### Paso 2: GPS (`/checkin/gps`)
- Auto-captura al montar la pantalla
- Detecta `isMocked` (anti-spoofing Android)
- Muestra advertencia si GPS es falso
- Guarda `{lat, lng, accuracyM, isMock}` en store

### Paso 3: Escena (`/checkin/escena`)
- Carga checkpoint aleatorio activo de la DB
- CameraView facing="back"
- Muestra instrucción: "Apunta la cámara a: [label]"
- Captura foto base64 del punto de referencia

### Paso 4: Resultado (`/checkin/resultado`)
1. Sube selfie a Storage: `{org_id}/{case_id}/selfie_{timestamp}.jpg`
2. Sube foto de escena: `{org_id}/{case_id}/scene_{timestamp}.jpg`
3. Llama Edge Function `process-checkin` con:
   - `case_id`, `checkin_id`
   - GPS data
   - URLs de fotos
   - `checkpoint_id`
4. Muestra resultado: ✅ Aprobado / ❌ Fallido / Error

## Criterios de aprobación (Fase 2+)
| Verificación | Umbral | Tecnología |
|---|---|---|
| GPS en radio | ≤ home_radius_m | Haversine |
| GPS no falso | isMocked = false | expo-location |
| Cara reconocida | score ≥ 0.80 | AWS Rekognition |
| Escena correcta | cosine_similarity ≥ 0.82 | CLIP + pgvector |

## Fase actual (Fase 1)
- GPS capturado y validado ✅
- Selfie capturada y subida ✅
- Escena capturada y subida ✅
- Verificación facial: pendiente (Fase 2)
- Verificación de escena con CLIP: pendiente (Fase 4)

## Edge Functions

### trigger-surprise
Dispara verificación sorpresa:
- Crea registro en `surprise_verifications`
- Envía push notification via Expo Push API
- Retorna `verification_id` y `expires_at`

### process-checkin (pendiente Fase 2)
Procesa el check-in:
- Verifica GPS vs home_lat/home_lng
- Llama AWS Rekognition para comparar selfie vs foto referencia
- Calcula similitud de embedding de escena
- Actualiza `checkins.status`, `face_score`, `scene_score`
- Registra en `audit_log`
