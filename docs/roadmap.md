# Roadmap — Arraigo

Backlog priorizado de mejoras al MVP. Actualizado 2026-07-26.

## ✅ Hecho

### 1. Mapa de ubicaciones (panel)
Mapa Leaflet + OpenStreetMap en el detalle del caso: domicilio + geocerca (círculo con el radio permitido) + cada punto de check-in (verde dentro del radio, rojo fuera), con distancia al centro. Da visión real de dónde estuvo el imputado y patrones de evasión.
→ `apps/web/src/app/dashboard/casos/[id]/UbicacionMapa.tsx`

### 2. Ver evidencia fotográfica (panel)
Modal con selfie / escena capturada / foto de referencia por check-in, vía signed URLs del bucket privado `checkin-evidence`. Verificación visual + evidencia con cadena de custodia.
→ `apps/web/src/app/api/checkins/[id]/fotos/route.ts`, `FotosViewer.tsx`

### 6. Escalamiento de alertas (backend)
Trigger en `checkins` que detecta 3 incumplimientos consecutivos (missed/failed/completed con overall_passed=false — `excused` no cuenta) y crea una alerta `escalation` con severidad crítica, visible de inmediato en `/dashboard/alertas`. **Decisión:** solo alerta en el panel por ahora — no hay proveedor de email/SMS configurado en el proyecto para notificar al juez fuera de él (se puede agregar después con Resend u otro si se define).
→ `supabase/migrations/20260725_010_escalamiento_alertas.sql` (⚠️ pendiente de aplicar en el Dashboard de Supabase — no hay CLI linkeado en este entorno)

### 3. Gestionar check-ins (panel + backend)
- **Excusar una ausencia justificada** con nota → pasa a `checkin_status = 'excused'`, ya no cuenta como incumplimiento (ni para estadísticas ni para el streak de escalamiento) y resuelve automáticamente las alertas asociadas a ese check-in.
- **Suspender / cerrar el caso, cambiar horarios o el radio** desde un bloque "Gestionar caso" en el detalle, junto a Reasignar técnico.
→ `apps/web/src/app/api/checkins/excusar/route.ts`, `apps/web/src/app/api/casos/editar/route.ts`, `ExcusarCheckin.tsx`, `EditarCaso.tsx`

### 7. Reporte de cumplimiento exportable (panel)
Botón "📄 Descargar reporte" en el detalle del caso → genera un PDF (vía `@react-pdf/renderer`, server-side) con info del caso, resumen de cumplimiento (% aprobados sobre check-ins no excusados), todos los incidentes (alertas) y el historial completo de check-ins con motivo de fallo/excusa. Para anexar al expediente judicial.
→ `apps/web/src/app/api/casos/[id]/reporte/route.tsx`

### 5. Dispositivo apagado / desinstalado / sin señal (app + backend)
`profiles.last_seen_at` actualizado por la app (al abrir + cada 15 min en foreground) y por `process-checkin` server-side en cada verificación. Cron cada 30 min crea alerta crítica `device_silent` si un imputado con caso activo lleva más de 12h sin reportar (dedup: no repite mientras la ventana de silencio siga vigente). "Última actividad del dispositivo" visible en el detalle del caso y en el reporte PDF.
**Limitación conocida (documentada en la migración y en el código):** la señal solo se actualiza mientras la app está en primer plano o al completar un check-in — no hay tarea en segundo plano registrada, así que apagar el teléfono o forzar el cierre de la app deja de generar señal, que es justo lo que se quiere detectar. Complementa (no reemplaza) las alertas de check-in no realizado.
→ `supabase/migrations/20260725_011_heartbeat_dispositivo.sql`, `apps/mobile/src/hooks/usePushNotifications.ts` (`useHeartbeat`), `supabase/functions/process-checkin/index.ts`

### 4. Mensajería al preso (panel + backend + app)
Tabla `case_messages` (texto libre, no requiere verificación de presencia — para eso está la sorpresa) + Edge Function `send-message` (mismo patrón APNs de `trigger-surprise`, control de acceso por rol/org). Panel: botón "💬 Enviar mensaje" en el detalle del caso + historial con estado leído/no leído. App: modal bloqueante "📢 Mensaje del funcionario" con botón "Entendido" (marca `read_at`), por push si hay token o por polling cada 15s como respaldo.
→ `supabase/migrations/20260725_012_mensajeria_preso.sql`, `supabase/functions/send-message/index.ts`, `apps/web/src/components/EnviarMensaje.tsx`, `apps/mobile/app/(imputado)/home.tsx`
**Nota:** requiere el build de TestFlight con el heartbeat (punto 5) para que la app reciba/marque mensajes — mismo ciclo de compilación, se agrupó en el mismo build.

### 8. Alertas agrupadas por caso (panel)
`/dashboard/alertas` ya no es una lista plana: agrupa las alertas sin resolver por caso, con los casos con más alertas primero (empate → alerta más reciente). Cada grupo es un bloque plegable (expediente, imputado, contador, criticidad, link al caso) con las alertas dentro; grupos de más de 3 alertas empiezan colapsados y dentro de un grupo se muestran las primeras 5 con "Mostrar N más". Paginado por caso (8/página).
→ `apps/web/src/app/dashboard/alertas/AlertasLista.tsx`

### 9. Reporte PDF por rango de fechas (panel)
El botón "📄 Descargar reporte" ahora tiene un selector (todo el historial / último día / última semana / último mes) antes de generar el PDF. El rango se pasa como `?rango=` a la API, que filtra check-ins y alertas por `created_at` (info del caso y estadísticas de cumplimiento se calculan solo sobre lo filtrado); el PDF muestra el periodo elegido en el encabezado.
→ `apps/web/src/app/dashboard/casos/[id]/DescargarReporte.tsx`, `apps/web/src/app/api/casos/[id]/reporte/route.tsx`

### 10. Reporte consolidado en PDF (panel)
Botón "📄 Reporte consolidado" en el Dashboard con selector de periodo (todo / último día / último mes / último año). Genera un PDF con métricas agregadas de toda la organización (casos totales/activos, check-ins del periodo, % cumplimiento, alertas críticas/sin resolver) y una tabla con todos los casos (expediente, imputado, ubicación, peligrosidad, estado, check-ins, cumplimiento) — sin el detalle de cada verificación, para eso está el reporte por caso.
→ `apps/web/src/app/dashboard/DescargarConsolidado.tsx`, `apps/web/src/app/api/reportes/consolidado/route.tsx`

### 11. Auditoría de acciones del staff (panel)
Nueva pantalla `/dashboard/auditoria` (judicial/operador/super_admin) con la cadena de custodia de acciones: casos creados/editados, técnico reasignado, check-in excusado, usuario creado, contraseña restablecida, alerta resuelta. Cada acción queda con quién (funcionario + rol), cuándo, sobre qué caso y el detalle específico. La tabla `audit_log` ya existía en el esquema original (con RLS de solo lectura) pero nada escribía en ella — se agregó el helper `logAudit()` y se llama desde cada ruta de mutación. La resolución de alertas se movió de un `update` directo desde el cliente a `POST /api/alertas/resolver`, único punto donde se podía enganchar la auditoría.
→ `apps/web/src/lib/auditLog.ts`, `apps/web/src/app/dashboard/auditoria/`, `apps/web/src/app/api/alertas/resolver/route.ts`
**Pendiente de aplicar en Supabase:** `supabase/migrations/20260726_014_audit_log_judicial_policy.sql` (agrega política RLS de lectura para el rol `judicial`, que no existía por un desfase entre el enum original y los roles reales de la app — el panel lee por service-role así que funciona igual sin aplicarla, pero conviene tenerla por defensa en profundidad).

### 12. Restablecer contraseña — staff e imputado (panel)
Botón "🔑 Restablecer contraseña" en `/dashboard/usuarios` (por usuario) y en el detalle del caso, sección "Acceso del imputado". Genera una contraseña temporal nueva (`supabase.auth.admin.updateUserById`) y la muestra en un modal para entregarla por un canal seguro — mismo patrón que la creación de usuarios (no hay SMTP/proveedor de email configurado, así que no se envía automáticamente). Sin esto, un imputado que perdía el acceso a su cuenta no tenía forma de recuperarlo.
→ `apps/web/src/app/dashboard/usuarios/RestablecerPassword.tsx`, `apps/web/src/app/api/usuarios/restablecer-password/route.ts`

### 13. Notas de seguimiento por caso (panel)
Botón "📝 Agregar nota" en el detalle del caso — observaciones internas del staff (habló con la familia, pendiente audiencia, etc.), separadas de la mensajería porque esas sí llegan al imputado. Tabla `case_notes` nueva, RLS solo para staff (judicial/operador/tecnico/super_admin); registra auditoría (`case.note_added`).
→ `apps/web/src/app/dashboard/casos/[id]/AgregarNota.tsx`, `apps/web/src/app/api/casos/notas/route.ts`, `supabase/migrations/20260726_015_notas_seguimiento.sql`

### 15. Selects de departamento/municipio en Nuevo caso (panel)
El formulario de creación de caso tenía inputs de texto libre para ciudad/departamento — un typo rompía silenciosamente los filtros del mapa general (que comparan strings exactos). Ahora son selects encadenados (elegir departamento filtra el select de municipio) con el dataset completo DIVIPOLA (33 departamentos, 1110 municipios).
→ `apps/web/src/lib/colombia.ts`, `apps/web/src/app/dashboard/casos/nuevo/CrearCasoForm.tsx`

## 🔨 En progreso

### 14. App Android — build funcionando, falta probar en runtime
Proyecto nativo generado (`apps/mobile/android/`) con la config que ya traía `app.json`. El grueso de la app (check-ins, mapa, mensajería, notas, heartbeat) ya es cross-platform vía Expo, sin trabajo extra. Puente nativo de FaceTec para Android portado desde iOS con integración real (SDK v10.1.9, `.aar` en `android/app/libs/`, no versionado en git). **`./gradlew :app:assembleDebug` → BUILD SUCCESSFUL** — primer APK debug generado (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, ~195MB) y entregado al usuario para instalar en el teléfono de un tercero de prueba. En el camino hubo que resolver varios problemas de entorno (Android Studio sin PATH a `node`, Yarn 4 borrando `node_modules` en modo PnP, Gradle 9.3.1 incompatible con un plugin) — documentados en detalle en `docs/app-movil.md` → "Entorno de desarrollo Android — problemas resueltos", para no tener que redescubrirlos.
→ `apps/mobile/android/app/src/main/java/co/arraigo/app/facetec/`, `.yarnrc.yml`, `/patches/*.patch` (raíz del monorepo)

**Pendiente dentro de este punto:**
- Probar el flujo real de FaceTec (enroll/authenticate) en runtime — nunca se ha ejecutado, solo compilado.
- Push remoto en Android (Firebase/FCM) — degrada a polling por ahora, sin romper nada.
- Firma de release / decidir distribución (APK directo vs Google Play).

### 16. Escala a 50.000 casos activos — en curso
Revisión de código (2026-07-27) identificó 8 riesgos concretos de escala: `schedule-checkins` con dedup N+1 síncrono por caso/horario, `check_device_silence()` y `expire_missed_verifications()` con loops PL/pgSQL fila por fila, falta de índices compuestos, mapa/reporte consolidado trayendo datos sin límite (todos los check-ins anidados de todos los casos), sin política de retención de fotos en `checkin-evidence`, y `/dashboard/auditoria` con límite fijo de 500 sin paginar. Prioridad acordada: 1) `schedule-checkins` (rompe primero, en miles de casos), 2) mapa + reporte consolidado (uso diario), 3) retención de fotos (costo/legal — pendiente definir requisito legal de retención antes de tocar código).
**Hecho:**
- Índices compuestos (`idx_checkins_case_created`, `idx_alerts_case_resolved`, `idx_alerts_case_type_created`, `idx_audit_log_org_created`) — riesgo nulo, ya aplicado.
  → `supabase/migrations/20260727_016_indices_escala.sql`
- `create_scheduled_checkins()` reescrita a SQL set-based (una query con CTEs en vez de un round-trip a la BD por caso × horario). Se descubrió al aplicar la migración que la función **ya vivía en producción** aplicada directo en el Dashboard (con un cron `schedule-checkins` duplicado corriendo en paralelo al `create-scheduled-checkins` nuevo) — se limpió el duplicado. Validado con datos reales.
  → `supabase/migrations/20260727_017_schedule_checkins_set_based.sql`, `supabase/functions/schedule-checkins/index.ts` (ahora un wrapper delgado)
- Mapa y reporte consolidado movidos a agregación SQL: vista `mapa_casos` (último check-in por caso vía LATERAL join, antes traía el historial completo anidado) y función `reporte_consolidado_stats()` (suma por caso en Postgres, antes traía cada check-in/alerta cruda al servidor). De paso se detectó que el enum `checkin_status` no tiene el valor `'passed'` que el código JS comparaba defensivamente (solo existe `'completed')` — la comparación SQL estricta lo reveló. Verificado en navegador: mapa y PDF consolidado con datos correctos tras el cambio.
  → `supabase/migrations/20260727_018_agregaciones_escala.sql`, `apps/web/src/app/dashboard/mapa/page.tsx`, `apps/web/src/app/api/reportes/consolidado/route.tsx`
- `check_device_silence()` y `expire_missed_verifications()` reescritas a SQL set-based (mismo patrón: loops PL/pgSQL fila por fila con un INSERT por caso → una sola query con `NOT EXISTS`/CTEs). Validado con `SELECT ...()` sin error en ambas.
  → `supabase/migrations/20260727_019_device_silence_set_based.sql`, `supabase/migrations/20260727_020_expire_missed_set_based.sql`

- `/dashboard/auditoria` con paginación real server-side (antes traía hasta 500 filas fijas y filtraba/paginaba en memoria en el cliente). Nuevo `/api/auditoria` con filtro por acción + búsqueda por funcionario/expediente + `.range()` + count exacto. Verificado en navegador.
  → `apps/web/src/app/api/auditoria/route.ts`, `apps/web/src/app/dashboard/auditoria/`

**Único punto pendiente:** política de retención de evidencia fotográfica (`checkin-evidence`) — no se toca hasta que se defina el requisito legal de cuánto tiempo hay obligación de guardar esa evidencia (borrar mal es irreversible y es cadena de custodia judicial).

**Pendiente:** `check_device_silence()` y `expire_missed_verifications()` a lógica set-based; definir política de retención de evidencia fotográfica.

**Nota importante para sesiones futuras:** al menos una función (`create_scheduled_checkins`) estaba en producción sin migración local que la respaldara — el repo de migraciones puede no reflejar 100% el estado real de la BD. Antes de asumir que algo "no existe" porque no aparece en `supabase/migrations/`, verificar directo contra la BD (ej. `SELECT proname FROM pg_proc WHERE proname ILIKE '%algo%';` o `SELECT jobname, command FROM cron.job;`).

## ⏸️ Diferido

_(vacío)_
