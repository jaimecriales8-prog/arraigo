# Panel Web — Arraigo

## URL producción
https://arraigo-ten.vercel.app

## Stack
- Next.js (App Router) — `apps/web`
- Supabase SSR para auth y data
- Leaflet + react-leaflet (mapa de ubicaciones, tiles OpenStreetMap — sin API key)
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

### /dashboard/casos
Tabla de todos los casos con:
- Expediente, imputado, estado, total check-ins, último check-in
- Link a detalle de cada caso

### /dashboard/casos/[id]
Detalle del caso con:
- Info del caso (expediente, imputado, frecuencia, ubicación, radio)
- Estadísticas (total / aprobados / fallidos)
- **Botón ⚡ Verificación sorpresa** — dispara notificación push al imputado con 15 min de plazo
- **Mapa de ubicaciones** (`UbicacionMapa.tsx`, Leaflet + OpenStreetMap, sin API key) — geocerca del domicilio (círculo con el radio permitido) + cada check-in con GPS registrado como punto verde (dentro del radio) o rojo (fuera), con popup de fecha/distancia. Carga con `dynamic(..., {ssr:false})` vía `UbicacionMapaCliente.tsx` (esta versión de Next.js exige que el `ssr:false` viva en un Client Component).
- **Ver fotos** (`FotosViewer.tsx`) — modal con selfie / escena capturada / foto de referencia, vía URLs firmadas de `GET /api/checkins/[id]/fotos`. Disponible en check-ins normales y en sorpresas (por el `checkin_id` enlazado en `surprise_verifications`).
- **Excusar** (`ExcusarCheckin.tsx`, solo judicial/super_admin) — en check-ins `missed`/`failed`/`completed` fallido: modal con nota → pasa a `excused` y resuelve las alertas asociadas. Ya no cuenta como incumplimiento (estadísticas ni streak de escalamiento).
- **Gestionar caso** (`EditarCaso.tsx`, solo judicial/super_admin) — cambiar estado (activo/suspendido/cerrado), horarios de check-in y radio del geofence, junto al bloque de reasignar técnico.
- Historial de check-ins con scores de cara, escena y estado GPS (paginado)

### /dashboard/alertas
Lista de alertas sin resolver (críticas, advertencias) con expediente/imputado enlazado y botón para marcar como resuelta. Paginado (12/página).

### /dashboard/usuarios
Módulo de gestión de usuarios de la organización:
- Lista de usuarios (admin, judicial, técnico)
- Formulario para crear nuevos usuarios → envía email de invitación vía Supabase Auth

## API Routes
Todas las escrituras privilegiadas usan un cliente service-role **puro** (`createClient` sin cookies). OJO: `createServerClient` con cookies adjunta el JWT del usuario y RLS aplica como él → causaba "new row violates RLS policy".

### POST /api/usuarios/crear
Crea usuario en Auth + perfil. Rol requerido: `judicial`/`super_admin`. **No envía correo** — devuelve `{ email, temp_password }` para entregar (imputado se loguea en la app con eso). Rollback: si falla el perfil, borra el usuario auth (evita huérfanos que bloquean el email).

### POST /api/casos/crear
Registra un caso (rol judicial/super_admin). Valida imputado de la misma org sin caso activo, y técnico opcional. El caso nace en `onboarding`.

### POST /api/casos/reasignar-tecnico
Cambia `technician_id` de un caso (rol judicial/super_admin, mismo org).

### GET /api/checkins/[id]/fotos
Genera signed URLs (5 min TTL) para `face_photo_url`, `scene_photo_url` del checkin y `photo_url` del checkpoint de referencia (bucket privado `checkin-evidence`). Verifica que el checkin pertenezca a un caso de la organización del usuario (o `super_admin`). Normaliza paths viejos guardados como URL pública completa.

### POST /api/checkins/excusar
Marca un check-in (`missed`/`failed`/`completed` fallido) como `excused` con nota (rol judicial/super_admin, mismo org). Resuelve automáticamente las alertas con ese `checkin_id`.

### POST /api/casos/editar
Actualiza `status` (active/suspended/closed), `checkin_times` (array HH:MM) y/o `geofence_radius_m` de un caso (rol judicial/super_admin, mismo org). Campos opcionales — solo se actualiza lo enviado.

## Pantallas
- **Casos** (`/dashboard/casos`) — lista + botón "Nuevo caso" (solo judicial/super_admin).
- **Nuevo caso** (`/dashboard/casos/nuevo`) — formulario: imputado, técnico, expediente, dirección, horarios, geocerca.
- **Detalle** (`/dashboard/casos/[id]`) — info + reasignar técnico + gestionar caso (estado/horarios/radio) + mapa de ubicaciones + historial paginado (8/página) con botones "Excusar"/"Ver fotos" + botón sorpresa.
- **Alertas** (`/dashboard/alertas`) — alertas sin resolver, paginado (12/página).
- **Usuarios** — crear usuario (oculto para operador).

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

## Deploy
**Root Directory `apps/web` ya configurado → auto-deploy en cada push a main.** Manual (respaldo): `npx vercel --prod` desde la raíz del repo (NO desde apps/web, o duplica la ruta).
