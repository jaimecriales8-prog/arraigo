# Panel Web — Arraigo

## URL producción
https://arraigo-ten.vercel.app

## Stack
- Next.js (App Router) — `apps/web`
- Supabase SSR para auth y data
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
- Historial de check-ins con scores de cara, escena y estado GPS

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

## Pantallas
- **Casos** (`/dashboard/casos`) — lista + botón "Nuevo caso" (solo judicial/super_admin).
- **Nuevo caso** (`/dashboard/casos/nuevo`) — formulario: imputado, técnico, expediente, dirección, horarios, geocerca.
- **Detalle** (`/dashboard/casos/[id]`) — info + reasignar técnico + historial paginado (30 check-ins / 20 sorpresas visibles) + botón sorpresa.
- **Usuarios** — crear usuario (oculto para operador).

## Responsive móvil (2026-07-12)
Panel responsivo vía CSS en `globals.css` (media query 768px): barra lateral → barra superior horizontal, tablas anchas con `.table-scroll`, rejillas se apilan. Nav filtra "Usuarios" para operador. Verificado a 375px. Estilos inline no permiten media queries → se usan clases (`app-shell`, `dash-sidebar`, `dash-nav`, `table-scroll`, `detail-grid`).

## Componentes clave
- `Sidebar.tsx` — nav (barra lateral/superior), filtra items por rol
- `SorpresaButton.tsx` — botón de verificación sorpresa
- `CrearUsuarioForm.tsx` — crear usuario (muestra credenciales, no invitación)
- `casos/nuevo/CrearCasoForm.tsx` — crear caso
- `casos/[id]/ReasignarTecnico.tsx` — reasignar técnico

## Deploy
**Root Directory `apps/web` ya configurado → auto-deploy en cada push a main.** Manual (respaldo): `npx vercel --prod` desde la raíz del repo (NO desde apps/web, o duplica la ruta).
