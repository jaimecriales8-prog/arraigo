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

### POST /api/usuarios/crear
Crea un usuario en Supabase Auth + perfil en `profiles`.
Requiere sesión activa con rol `admin` o `judicial`.

Body: `{ full_name, email, role }`

## Componentes clave
- `Sidebar.tsx` — navegación lateral
- `SorpresaButton.tsx` — botón de verificación sorpresa (client component)
- `CrearUsuarioForm.tsx` — formulario de creación de usuarios

## Deploy
```bash
source ~/.nvm/nvm.sh
cd apps/web
npx vercel --prod --yes --scope jaime-criales-projects
```
