# Panel Web — Arraigo

## Stack

- **Next.js 15** + App Router + TypeScript
- **Tailwind CSS v4**
- **@supabase/ssr** para auth server-side
- **Middleware** de protección de rutas

## Estructura

```
apps/web/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Redirect a /dashboard o /login
│   ├── login/
│   │   └── page.tsx             # Login para funcionarios
│   ├── dashboard/               # Panel officer / org_admin
│   │   ├── page.tsx             # Lista de casos + alertas activas
│   │   ├── casos/
│   │   │   ├── page.tsx         # Lista de casos
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Detalle del caso
│   │   │       └── historial/
│   │   │           └── page.tsx # Historial de check-ins
│   │   └── alertas/
│   │       └── page.tsx         # Gestión de alertas
│   ├── supervisor/              # Panel juez / fiscal
│   │   └── page.tsx
│   └── admin/                   # Panel org_admin
│       ├── casos/
│       ├── usuarios/
│       └── configuracion/
├── lib/
│   └── supabase/
│       ├── server.ts            # createClient() para Server Components
│       └── client.ts            # createClient() para Client Components
└── middleware.ts                # Guard de auth global
```

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

El `service_role` **solo** se usa en route handlers del servidor para operaciones de sistema (crear alertas, scheduler). Nunca se expone al cliente.

## Auth y redirección por rol

`middleware.ts` intercepta todas las rutas (excepto `/login` y `/auth`):
- Sin sesión → redirect `/login`
- Con sesión → pasa al layout que detecta el rol y muestra el panel correcto

## Correr en desarrollo

```bash
cd apps/web
npm run dev        # http://localhost:3000
```

## Paneles por rol

### `org_admin` y `officer` → `/dashboard`
- Lista de todos los casos de la organización
- Alertas activas en tiempo real (Supabase Realtime)
- Detalle de caso: historial de check-ins, scores, fotos de evidencia
- Resolución de alertas con nota

### `supervisor` → `/supervisor`
- Solo los casos donde `cases.supervisor_id = auth.uid()`
- Historial de check-ins de sus casos
- Recibe notificaciones de alertas críticas

### `org_admin` → `/admin`
- Gestión de usuarios de la organización
- Creación y configuración de casos
- Asignación de técnico y supervisor por caso

## Tiempo real

Las alertas y el estado de los check-ins se actualizan en tiempo real usando **Supabase Realtime**:

```typescript
supabase
  .channel('alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'alerts',
    filter: `organization_id=eq.${orgId}`,
  }, (payload) => {
    // Mostrar notificación en el panel
  })
  .subscribe()
```

## Próximos pasos (Fase 3)

- [ ] Dashboard con mapa de casos (Mapbox o Google Maps)
- [ ] Galería de evidencias por check-in
- [ ] Exportación de reportes PDF firmados digitalmente
- [ ] Notificaciones por email/SMS al supervisor en alertas críticas
- [ ] Onboarding del técnico (captura de checkpoints)
