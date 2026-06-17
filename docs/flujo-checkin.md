# Flujo de Check-in — Arraigo

## Ciclo completo

```
Scheduler crea checkin (status=pending)
        ↓
Push notification al imputado
        ↓
Imputado abre la app → ve botón activo
        ↓
┌─── Paso 1: Selfie ──────────────────────────────┐
│  Cámara frontal → foto → base64                  │
│  Guía oval en pantalla para encuadrar la cara    │
└─────────────────────────────────────────────────┘
        ↓
┌─── Paso 2: GPS ─────────────────────────────────┐
│  expo-location → lat/lng/accuracy                │
│  isMocked check (Android)                        │
│  Si mock: se registra gps_is_mock=true           │
└─────────────────────────────────────────────────┘
        ↓
┌─── Paso 3: Escena ──────────────────────────────┐
│  Checkpoint aleatorio del domicilio              │
│  "Apunta la cámara hacia: Ventana sala"          │
│  Cámara trasera → foto → base64                  │
└─────────────────────────────────────────────────┘
        ↓
┌─── Envío a Edge Function ───────────────────────┐
│  1. Sube selfie y foto escena a Storage          │
│  2. POST /functions/v1/process-checkin           │
│     ├── Verificación facial (AWS Rekognition)    │
│     ├── Verificación GPS (PostGIS ST_Distance)   │
│     └── Verificación escena (CLIP cosine sim)    │
│  3. Calcula overall_score (0-100)                │
│  4. UPDATE checkins SET status, scores, ...      │
│  5. Si falla → INSERT alerts                     │
│  6. INSERT audit_log                             │
└─────────────────────────────────────────────────┘
        ↓
Pantalla de resultado (✓ exitoso / ! fallido)
```

## Ventana de tiempo

- El scheduler crea check-ins con `scheduled_at` y `window_closes_at`
- `window_closes_at = scheduled_at + checkin_window_min` (default 30 min)
- Si el imputado no abre la app antes de `window_closes_at`, el check-in pasa a `missed`
- Un `missed` genera alerta `critical` automáticamente

## Score consolidado

```
overall_score = (face_score × 40) + (gps_score × 35) + (scene_score × 25)
```

| Componente | Peso | Umbral de aprobación |
|---|---|---|
| Verificación facial | 40% | face_threshold (default 0.80) |
| GPS en geofence | 35% | dentro de geofence_radius_m |
| Verificación de escena | 25% | scene_threshold (default 0.82) |

`overall_passed = true` solo si los 3 componentes pasan individualmente.

## Generación de alertas

| Condición | Tipo | Severidad |
|---|---|---|
| `window_closes_at` sin completar | `missed_checkin` | critical |
| `gps_distance_m > geofence_radius_m` | `gps_out_of_range` | critical |
| `gps_is_mock = true` | `mock_gps_detected` | critical |
| `face_passed = false` | `face_verification_failed` | warning |
| `scene_passed = false` | `scene_verification_failed` | warning |
| 3+ fallos consecutivos | `multiple_failures` | critical |

Las alertas `critical` envían SMS y email al supervisor (juez/fiscal) y al officer asignado.

## Onboarding del domicilio (técnico)

El técnico realiza el onboarding presencialmente en el domicilio:

1. Abre la app como `technician`
2. Accede al caso asignado
3. Captura 4-6 fotos de puntos de referencia únicos del domicilio
4. Por cada foto: la app la sube a Storage y llama a la Edge Function `generate-embedding` que computa el CLIP embedding y lo guarda en `checkpoints.embedding`
5. Marca el onboarding como completo → `cases.onboarding_done_at`
6. El caso pasa a `status=active` y el scheduler comienza a crear check-ins

## Datos almacenados por check-in

Cada check-in genera evidencia inmutable para el expediente judicial:
- Selfie del imputado (Storage, privado)
- Foto de la escena (Storage, privado)
- Coordenadas GPS con precisión
- Score de cada verificación
- Timestamp exacto
- Versión de la app y OS
- Flag de GPS mock
- Registro en audit_log
