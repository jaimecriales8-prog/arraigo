# Panel Web — Arraigo

## URL producción
https://arraigo-ten.vercel.app

## Stack
- Next.js (App Router) — `apps/web`
- Supabase SSR para auth y data
- Leaflet + react-leaflet (mapa de ubicaciones, tiles OpenStreetMap — sin API key)
- @react-pdf/renderer (generación de PDF server-side para el reporte de cumplimiento)
- Deploy: Vercel (proyecto `arraigo`, team `jaime-criales-projects`)

## Credenciales de acceso
- **Admin:** admin@arraigo.co / Admin2026!

## Módulos implementados

### /login
Pantalla de login con diseño oscuro (#0a1628). Redirige a `/dashboard` si hay sesión activa.

### /dashboard
Resumen operativo con 3 tarjetas:
- Casos activos
- Check-ins del día
- Alertas pendientes (checkins fallidos)

**Reporte consolidado** (`DescargarConsolidado.tsx`) — selector de periodo (todo / último día / último mes / último año) + botón que genera un PDF vía `GET /api/reportes/consolidado?rango=...` con métricas agregadas de toda la organización (casos totales/activos, check-ins del periodo, aprobados/fallidos, % cumplimiento, alertas críticas/sin resolver) y una tabla con todos los casos (expediente, imputado, ubicación, peligrosidad, estado, check-ins, cumplimiento). No incluye el detalle de cada verificación — para eso está el reporte por caso.

### /dashboard/casos
Tabla de todos los casos con:
- Expediente, imputado, estado, total check-ins, último check-in
- Link a detalle de cada caso

### /dashboard/casos/[id]
Detalle del caso con:
- Info del caso (expediente, imputado, frecuencia, ubicación, radio)
- Estadísticas (total / aprobados / fallidos)
- **Botón ⚡ Verificación sorpresa** — dispara notificación push al imputado con 15 min de plazo
- **Botón 📄 Descargar reporte** (`DescargarReporte.tsx`) — selector de periodo (todo / último día / última semana / último mes) + genera un PDF vía `GET /api/casos/[id]/reporte?rango=...` con info del caso, resumen de cumplimiento, incidentes e historial acotados al periodo elegido, para anexar al expediente judicial.
- **Mapa de ubicaciones** (`UbicacionMapa.tsx`, Leaflet + OpenStreetMap, sin API key) — geocerca del domicilio (círculo con el radio permitido) + cada check-in con GPS registrado como punto verde (dentro del radio) o rojo (fuera), con popup de fecha/distancia. Carga con `dynamic(..., {ssr:false})` vía `UbicacionMapaCliente.tsx` (esta versión de Next.js exige que el `ssr:false` viva en un Client Component).
- **Ver fotos** (`FotosViewer.tsx`) — modal con selfie / escena capturada / foto de referencia, vía URLs firmadas de `GET /api/checkins/[id]/fotos`. Disponible en check-ins normales y en sorpresas (por el `checkin_id` enlazado en `surprise_verifications`).
- **Excusar** (`ExcusarCheckin.tsx`, solo judicial/super_admin) — en check-ins `missed`/`failed`/`completed` fallido: modal con nota → pasa a `excused` y resuelve las alertas asociadas. Ya no cuenta como incumplimiento (estadísticas ni streak de escalamiento).
- **Gestionar caso** (`EditarCaso.tsx`, solo judicial/super_admin) — cambiar estado (activo/suspendido/cerrado), horarios de check-in y radio del geofence, junto al bloque de reasignar técnico.
- **Última actividad del dispositivo** — `profiles.last_seen_at` del imputado, coloreado (verde <4h, ámbar <12h, rojo >12h o "Sin reportar aún"). Ver heartbeat abajo.
- **Mensajes al imputado** (`EnviarMensaje.tsx`) — botón "💬 Enviar mensaje" (texto libre, no exige verificación de presencia) + historial con estado leído/no leído. Ver mensajería abajo.
- **Nivel de peligrosidad** — badge 1-5 (escala de color verde→rojo, ver `src/lib/danger.ts`), editable en "Gestionar caso".
- Historial de check-ins con scores de cara, escena y estado GPS (paginado)

### /dashboard/casos (filtros)
Además de la tabla, filtro por nivel de peligrosidad + búsqueda por nombre/expediente, client-side sobre el dataset ya cargado (`CasosLista.tsx`).

### /dashboard/mapa
Mapa Leaflet con todos los casos de la org (relleno del marcador = cumplimiento: verde al día, ámbar pendiente/sin check-ins, rojo en mora/fallido, gris inactivo; anillo = nivel de peligrosidad, radio también escala con el nivel). Filtros por departamento, municipio (acotado al departamento elegido) y nivel de peligrosidad + búsqueda por nombre/expediente, todo client-side. Popup por marcador con link al detalle del caso.
→ `apps/web/src/app/dashboard/mapa/page.tsx` (server, RLS filtra por org) + `MapaCasos.tsx`/`MapaCasosCliente.tsx`

### /dashboard/alertas
Alertas sin resolver agrupadas por caso, con los casos con más alertas primero (empate → alerta más reciente primero). Cada grupo muestra un encabezado (expediente, imputado, contador, link al caso) plegable, con las alertas dentro (severidad, tipo, mensaje, fecha, botón resolver); grupos con más de 3 alertas empiezan colapsados, y dentro de un grupo se muestran las primeras 5 con un "Mostrar N más". Paginado por caso (8 casos/página). → `AlertasLista.tsx`

### /dashboard/usuarios
Módulo de gestión de usuarios de la organización:
- Lista de usuarios (admin, judicial, técnico) con botón **🔑 Restablecer** por fila (`RestablecerPassword.tsx`) — genera una contraseña temporal nueva y la muestra en un modal para entregarla por un canal seguro (no se envía por correo, no hay SMTP configurado).
- Formulario para crear nuevos usuarios → **no envía correo**, devuelve `{ email, temp_password }` para entregar manualmente.

### /dashboard/auditoria
Cadena de custodia de acciones del staff (rol judicial/operador/super_admin) — casos creados/editados, técnico reasignado, check-ins excusados, usuarios creados, contraseñas restablecidas, alertas resueltas. Filtro por tipo de acción + búsqueda por funcionario/expediente, paginado (15/página). Cada fila: fecha, acción, funcionario (+ rol), caso (link), detalle específico de la acción.
→ `apps/web/src/app/dashboard/auditoria/page.tsx`, `AuditoriaLista.tsx`, tabla `audit_log` (ya existía en el esquema original, solo faltaba escribir en ella — ver `apps/web/src/lib/auditLog.ts`).

## API Routes
Todas las escrituras privilegiadas usan un cliente service-role **puro** (`createClient` sin cookies). OJO: `createServerClient` con cookies adjunta el JWT del usuario y RLS aplica como él → causaba "new row violates RLS policy".

Las rutas que modifican datos (crear/editar caso, reasignar técnico, excusar check-in, crear usuario, restablecer contraseña, resolver alerta) registran un evento en `audit_log` vía `logAudit()` (`apps/web/src/lib/auditLog.ts`) — visible en `/dashboard/auditoria`.

### POST /api/usuarios/crear
Crea usuario en Auth + perfil. Rol requerido: `judicial`/`super_admin`. **No envía correo** — devuelve `{ email, temp_password }` para entregar (imputado se loguea en la app con eso). Rollback: si falla el perfil, borra el usuario auth (evita huérfanos que bloquean el email).

### POST /api/usuarios/restablecer-password
Genera una contraseña temporal nueva para un usuario existente (`supabase.auth.admin.updateUserById`) y la devuelve en `{ email, temp_password }` para entregarla manualmente — mismo patrón que la creación de usuarios, sin envío de correo. Rol requerido: `judicial`/`super_admin`, mismo org (o cualquiera si `super_admin`). Usado tanto en `/dashboard/usuarios` (staff) como en el detalle del caso, sección "Acceso del imputado".

### POST /api/alertas/resolver
Marca una alerta como resuelta (antes se hacía directo desde el cliente con `createBrowserClient`, sin auditoría posible por RLS). Rol requerido: `judicial`/`operador`/`super_admin`, mismo org (o cualquiera si `super_admin`).

### POST /api/casos/crear
Registra un caso (rol judicial/super_admin). Valida imputado de la misma org sin caso activo, y técnico opcional. El caso nace en `onboarding`. Acepta `danger_level` (1-5, default 3 si se omite).

### POST /api/casos/reasignar-tecnico
Cambia `technician_id` de un caso (rol judicial/super_admin, mismo org).

### GET /api/checkins/[id]/fotos
Genera signed URLs (5 min TTL) para `face_photo_url`, `scene_photo_url` del checkin y `photo_url` del checkpoint de referencia (bucket privado `checkin-evidence`). Verifica que el checkin pertenezca a un caso de la organización del usuario (o `super_admin`). Normaliza paths viejos guardados como URL pública completa.

### POST /api/checkins/excusar
Marca un check-in (`missed`/`failed`/`completed` fallido) como `excused` con nota (rol judicial/super_admin, mismo org). Resuelve automáticamente las alertas con ese `checkin_id`.

### POST /api/casos/editar
Actualiza `status` (active/suspended/closed), `checkin_times` (array HH:MM), `geofence_radius_m` y/o `danger_level` (1-5) de un caso (rol judicial/super_admin, mismo org). Campos opcionales — solo se actualiza lo enviado.

### GET /api/casos/[id]/reporte
Genera un PDF (`@react-pdf/renderer`, `runtime = 'nodejs'`) con info del caso, resumen de cumplimiento (aprobados / fallidos / excusados / % sobre check-ins no excusados), todas las alertas y el historial de check-ins con motivo. Query param `rango` (`all` default, `day`/`week`/`month`) filtra check-ins y alertas por `created_at`; el periodo elegido queda impreso en el encabezado del PDF. Requiere estar autenticado y ser de la misma organización (o `super_admin`). Devuelve `Content-Type: application/pdf` con `Content-Disposition: attachment`.

### GET /api/reportes/consolidado
Genera un PDF (`@react-pdf/renderer`, `runtime = 'nodejs'`) con métricas agregadas de todos los casos de la organización (o de todas si `super_admin`) y una tabla resumen por caso — sin el detalle check-in a check-in. Query param `rango` (`all` default, `day`/`month`/`year`) filtra check-ins por `created_at` para las métricas del periodo (las alertas sin resolver siempre son las vigentes, no filtran por rango). Devuelve `Content-Type: application/pdf` con `Content-Disposition: attachment`.

## Pantallas
- **Casos** (`/dashboard/casos`) — lista + botón "Nuevo caso" (solo judicial/super_admin).
- **Nuevo caso** (`/dashboard/casos/nuevo`) — formulario: imputado, técnico, expediente, dirección, horarios, geocerca.
- **Detalle** (`/dashboard/casos/[id]`) — info + reasignar técnico + gestionar caso (estado/horarios/radio/peligrosidad) + restablecer contraseña del imputado + mapa de ubicaciones + historial paginado (8/página) con botones "Excusar"/"Ver fotos" + botón sorpresa + descargar reporte PDF + mensajería.
- **Mapa** (`/dashboard/mapa`) — todos los casos en un mapa, filtro depto/municipio/peligrosidad + búsqueda por nombre/expediente.
- **Alertas** (`/dashboard/alertas`) — alertas sin resolver agrupadas por caso (más alertas primero), paginado por caso (8/página).
- **Usuarios** — crear usuario + restablecer contraseña (oculto para operador).
- **Auditoría** (`/dashboard/auditoria`, oculto para técnico) — cadena de custodia de acciones del staff.

## Responsive móvil (2026-07-12)
Panel responsivo vía CSS en `globals.css` (media query 768px): barra lateral → barra superior horizontal, tablas anchas con `.table-scroll`, rejillas se apilan. Nav filtra "Usuarios" para operador. Verificado a 375px. Estilos inline no permiten media queries → se usan clases (`app-shell`, `dash-sidebar`, `dash-nav`, `table-scroll`, `detail-grid`).

## Componentes clave
- `Sidebar.tsx` — nav (barra lateral/superior), filtra items por rol
- `SorpresaButton.tsx` — botón de verificación sorpresa
- `CrearUsuarioForm.tsx` — crear usuario (muestra credenciales, no invitación)
- `casos/nuevo/CrearCasoForm.tsx` — crear caso
- `casos/[id]/ReasignarTecnico.tsx` — reasignar técnico
- `casos/[id]/EditarCaso.tsx` — cambiar estado/horarios/radio del caso
- `casos/[id]/UbicacionMapa.tsx` + `UbicacionMapaCliente.tsx` — mapa Leaflet de geocerca + check-ins
- `casos/[id]/FotosViewer.tsx` — modal de evidencia fotográfica (selfie/escena/referencia)
- `casos/[id]/ExcusarCheckin.tsx` — modal para excusar una ausencia con nota
- `casos/[id]/HistorialTabla.tsx` — tabla paginada de check-ins/sorpresas, con acciones de excusar/fotos
- `casos/CasosLista.tsx` — tabla de casos con filtro por peligrosidad + búsqueda
- `lib/danger.ts` — escala de color/etiqueta para nivel de peligrosidad (1-5), reutilizada en lista, mapa, detalle y reporte PDF

## Heartbeat de dispositivo (2026-07-25)
`profiles.last_seen_at` se actualiza desde dos fuentes: la app móvil en foreground (`useHeartbeat`, cada 15 min + al abrir/reactivar) y `process-checkin` server-side en cada verificación (señal más confiable). Un cron cada 30 min (`check_device_silence()`) crea alerta crítica `device_silent` si un imputado con caso activo lleva >12h sin reportar, con dedup para no repetir mientras la ventana de silencio siga vigente. **Limitación:** no hay tarea en segundo plano — apagar el teléfono o forzar cierre de la app deja de generar señal (justo lo que se detecta), pero tampoco hay forma de refrescar `last_seen_at` mientras eso ocurre. Ver `supabase/migrations/20260725_011_heartbeat_dispositivo.sql`.

## Mensajería al preso (2026-07-25)
Tabla `case_messages` (mensaje libre + `push_sent` + `read_at`) y Edge Function `send-message` (mismo patrón APNs directo de `trigger-surprise`; control de acceso por rol judicial/operador/super_admin + misma org). El panel llama la función directamente desde el cliente (como `SorpresaButton`), no vía API route de Next. La app muestra el mensaje en un modal bloqueante ("Entendido" marca `read_at`), por push si hay `push_token` o por polling cada 15s como respaldo si el push falla o llega con la app cerrada.

## Deploy
**Root Directory `apps/web` ya configurado → auto-deploy en cada push a main.** Manual (respaldo): `npx vercel --prod` desde la raíz del repo (NO desde apps/web, o duplica la ruta).
