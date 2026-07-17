# Flujo de Check-in — Arraigo

> Actualizado: 2026-07-02

## Tipos de verificación

### 1. Verificación programada
- `pg_cron` corre `create_scheduled_checkins()` cada 15 min: crea checkins `pending` según `checkin_times` (jsonb, ej. `["08:00","14:00","20:00"]`) dentro de la ventana `checkin_window_min`, en timezone del caso (America/Bogota).
- El imputado ve los horarios en su home y recibe **notificaciones locales** (ver abajo).

### 2. Verificación sorpresa
- La dispara el operador/juzgado desde el panel web → botón ⚡
- El imputado la detecta por **polling cada 15 s** en el home (requiere app abierta; push APNS = Fase 2).
- Al completar el check-in, `surprise_verifications.status` → `completed` (lo hace `resultado.tsx` con el `surpriseVerificationId` del store).

## Notificaciones (implementado 2026-07-02)
- **Locales programadas** — `useCheckinNotifications` (`src/hooks/usePushNotifications.ts`), conectado en el home del imputado.
- Por cada `checkin_time`: aviso diario "inicia en 5 minutos" + aviso "🔔 ventana abierta".
- Funcionan con la app cerrada, sin servidor. Se reprograman si cambian los horarios.
- Las sorpresas NO tienen push con app cerrada todavía (Fase 2: APNS).

## Pasos del check-in

### Paso 1: Rostro (`/checkin/selfie`) — bifurcado por toggle FaceTec
`selfie.tsx` es un dispatcher según `facetecEnabled` (override org → default global `EXPO_PUBLIC_FACETEC_DEFAULT`):

**Toggle OFF — liveness por acelerómetro:**
- Challenge de inclinación izquierda/derecha en orden aleatorio, con zona neutral entre pasos.
- Captura automática al completar. Guarda base64 en `checkinStore`.
- Limitación conocida: NO detecta foto impresa (solo mide movimiento del teléfono).

**Toggle ON — FaceTec (liveness 3D certificado):**
- `facetecAuthenticate(profile.id)` → UI nativa FaceTec → liveness + match 3D:3D contra el FaceMap del enrolamiento.
- Requiere enrolamiento previo del mismo imputado (onboarding del técnico).
- No se sube selfie a Storage (el FaceMap lo procesa FaceTec).
- Resultado (`livenessPassed`, `matchScore`) va al store y luego a `process-checkin`.

### Paso 2: GPS (`/checkin/gps`)
- Auto-captura al montar. Detecta `isMocked` (anti-spoofing).
- Guarda `{lat, lng, accuracyM, isMock}` en store.

### Paso 3: Escena (`/checkin/escena`)
- Carga un checkpoint aleatorio **activo** del caso (tabla `checkpoints`).
- Instrucción: "Apunta la cámara a: [label]". Captura base64 + `checkpointId`.

### Paso 4: Resultado (`/checkin/resultado`)
1. Sube fotos a Storage (bucket privado `checkin-evidence`; `uploadPhoto` retorna **path**, no URL). En modo FaceTec no hay selfie.
2. Llama `process-checkin` con GPS + paths + checkpoint + campos FaceTec (`livenessMethod`, `facetecLivenessPassed`, `facetecMatchScore`).
3. Muestra ✅ Aprobado / ❌ Fallido (con motivo) / Error (con reintento).
4. Si era sorpresa, marca la `surprise_verification` como `completed`.

## Edge Function `process-checkin` (v. producción actual)

1. **Auth**: valida JWT del imputado; verifica que el checkin pertenece a su caso.
2. **GPS**: Haversine vs `cases.location` (PostGIS GeoJSON), pasa si ≤ `geofence_radius_m`. `gpsIsMock` ⇒ falla + alerta `critical`.
3. **Escena (IA)**: genera signed URLs (60 s) de la foto tomada y la del checkpoint (`checkpoints.photo_url`, normalizado URL→path) y pregunta a **GPT-4o-mini Vision** si es el mismo espacio → `{match, score}`. **Si la verificación falla por cualquier motivo, el check-in FALLA** (no pasa por defecto). Solo se salta si no hay `OPENAI_API_KEY` o no hay checkpoint.
4. **Cara**: con FaceTec valida `livenessPassed && matchScore ≥ 80`; sin FaceTec, placeholder (siempre pasa — pendiente verificación server-side).
5. **Score**: GPS 50 % + Escena 30 % + Cara 20 %. `overall_passed` = las tres pasan.
6. Actualiza `checkins` (incl. `liveness_method`) y crea `alerts` si falló GPS.

### Nota de seguridad (Milestone 2 pendiente)
En Managed Testing la app reporta el resultado de FaceTec — NO confiable para producción. Con la Server Key, el veredicto de match debe verificarse **server-side** (middleware/FaceTec Server), nunca en el cliente.

## Estados en DB
- `checkins.status`: `pending` | `completed` (el resultado va en `overall_passed`).
- `checkins.liveness_method`: `accelerometer` | `facetec`.
- `surprise_verifications.status`: `pending` | `completed` | `expired`.

## Actualizaciones (jul 2026)
- **Milestone 2 vía proxy** (`facetec-proxy`): la app manda los blobs FaceTec a nuestro Edge Function, que los reenvía a FaceTec y registra el veredicto en `facetec_sessions` (RLS solo service role). `process-checkin` aprueba la cara solo si existe sesión `auth` válida atada al `checkin_id` — ignora lo que reporte el teléfono. Anti-suplantación: `auth` exige refID=usuario; `enroll` exige rol técnico + caso de su org.
- **Tolerancia GPS**: `gpsPassed = distancia ≤ radio + min(gps_accuracy_m, 150)`. Evita falsas violaciones por ruido del GPS; sigue fallando si sale de verdad.
- **Escena — re-fotografía**: el prompt detecta foto-de-foto/pantalla (moiré, bordes, reflejos) como criterio duro; los cambios de iluminación (día/noche) NO penalizan.
- **Ventana unificada a 15 min** (default DB + función SQL + notificaciones).
- **Idempotencia + captura de errores**: "already completed" responde 200 (no error rojo en reintentos). Cada salida non-2xx se registra en la tabla `checkin_errors` (los logs del edge runtime expiran en plan free).
- **Refresco de sesión** (`ensureFreshSession` en `supabase.ts`): AppState inicia/detiene auto-refresh + refresca el token si expira en <60s antes del check-in. Arregla el 401 intermitente tras estar la app en segundo plano.

## Manejo de fallo facial (2026-07-13)
- **App corta el flujo si FaceTec no pasa**: `FacetecSelfie` revisa `result.livenessPassed`; si falla/cancela → muestra "no se completó" con **Reintentar / Cancelar**, NO avanza a GPS/escena. Cancelar → el check-in queda `pending` (se maneja por expiración de ventana, pendiente job de "missed check-in").
- **Alertas por cualquier verificación fallida**: `process-checkin` genera `alerts` no solo por GPS. Tipos: `mock_gps` (critical), `gps_out` (warning), `face_fail` (critical, FaceTec completó en el teléfono pero el servidor no validó → posible suplantación), `scene_fail` (warning). `alerts.type` es TEXT libre; `severity` enum info/warning/critical.

## Vencimiento de verificaciones (2026-07-13)
`pg_cron` → `expire_missed_verifications()` cada 15 min:
- Check-in programado `pending` con `window_closes_at < now()` → status `missed` + alerta `missed` (warning).
- Sorpresa `pending` con `expires_at < now()` → status `expired` + alerta `surprise_missed` (critical).
- Enum `checkin_status`: pending | completed | failed | missed | excused.
- **OJO — bug corregido:** la tabla `alerts` NO tiene `organization_id` (se deriva del caso vía RLS). `process-checkin` insertaba alertas con ese campo → fallaban en silencio (nunca se creaban). Corregido: los inserts de alerta usan solo `case_id, checkin_id, severity, type, message`.

## Escalas numéricas (OJO)
- `face_score`, `scene_score`: `NUMERIC(4,3)` → escala 0-1. `process-checkin` guarda `scene_score/100`.
- `gps_distance_m`, `gps_accuracy_m`: `NUMERIC(12,2)` (ensanchadas; un salto de GPS desbordaba `NUMERIC(8,2)` → 500).
