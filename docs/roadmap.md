# Roadmap — Arraigo

Backlog priorizado de mejoras al MVP. Actualizado 2026-07-25.

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

## 🔨 En progreso

### 14. App Android
Proyecto nativo generado (`apps/mobile/android/`) con la config que ya traía `app.json`. El grueso de la app (check-ins, mapa, mensajería, notas, heartbeat) ya es cross-platform vía Expo, sin trabajo extra. Puente nativo de FaceTec para Android generado como stub (`FacetecModule.kt`) — pendiente el SDK real de FaceTec y Android Studio instalado localmente para compilar y probar. Push remoto en Android necesitará Firebase (FCM) más adelante; mientras tanto degrada a polling sin romper nada. Detalle en `docs/app-movil.md` y `apps/mobile/android/FACETEC_SETUP_ANDROID.md`.

## ⏸️ Diferido

_(vacío)_
