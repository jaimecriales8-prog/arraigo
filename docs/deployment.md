# Deployment — Arraigo

## Panel web → Vercel

### URL producción
https://arraigo-ten.vercel.app

### Deploy
```bash
source ~/.nvm/nvm.sh
cd apps/web
npx vercel --prod --yes --scope jaime-criales-projects
```

### Variables de entorno (ya configuradas en Vercel)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## App móvil → Xcode (iOS)

### Requisitos
- Xcode instalado en `/Applications/Xcode.app`
- CocoaPods: `brew install cocoapods`
- iPhone con Modo Desarrollador activo (Configuración → Privacidad y Seguridad → Modo Desarrollador)
- iPhone conectado por USB

### Build y deploy al dispositivo
```bash
source ~/.nvm/nvm.sh
cd apps/mobile

# 1. Generar bundle JS
npx expo export:embed --platform ios --bundle-output ios/Arraigo/main.jsbundle --assets-dest ios/Arraigo --dev false

# 2. Build e instalar en iPhone
npx expo run:ios --device --configuration Release
```

> **Nota hotel/red restringida:** usar `--configuration Release` con bundle embebido elimina la necesidad de Metro server, funciona sin red local.

### Cuando hay cambios JS (sin cambios nativos)
Solo regenerar el bundle y rebuildar:
```bash
npx expo export:embed --platform ios --bundle-output ios/Arraigo/main.jsbundle --assets-dest ios/Arraigo --dev false
npx expo run:ios --device --configuration Release
```

### Cuando hay cambios nativos (nuevos plugins, permisos)
Ejecutar prebuild primero:
```bash
npx expo prebuild --platform ios --clean
npx expo run:ios --device --configuration Release
```

## Edge Functions → Supabase

### Deploy
```bash
source ~/.nvm/nvm.sh
cd /Users/jaimecriales/Sites/arraigo
SUPABASE_ACCESS_TOKEN=<pat> npx supabase functions deploy trigger-surprise --project-ref shusqumfugjkwhuwyyvf
```

### Funciones desplegadas
- `trigger-surprise` — Dispara verificación sorpresa y envía push notification

## Supabase

### Proyecto
- URL: https://shusqumfugjkwhuwyyvf.supabase.co
- Ref: shusqumfugjkwhuwyyvf

### Migraciones
Aplicar en Dashboard → SQL Editor (IPv6 no disponible en este Mac).

### Buckets Storage
- `checkin-evidence` — fotos de check-ins (privado)

## GitHub
- Repo: https://github.com/jaimecriales8-prog/arraigo
- Branch principal: `main`
- Deploy automático: cada push a `main` → Vercel redespliega

## Edge Functions (desplegadas)
- `process-checkin` — verifica GPS + escena (GPT-4o-mini) + cara (FaceTec vía facetec_sessions). No confía en rutas/ids del cliente.
- `trigger-surprise` — crea sorpresa + push APNs directo (JWT ES256). Control de acceso por rol + org.
- `facetec-proxy` — reenvía blobs FaceTec a la Testing API y registra veredicto server-side.
- `schedule-checkins` — (SQL `create_scheduled_checkins()` vía pg_cron cada 15 min, no Edge Function).

### Secrets configurados
`OPENAI_API_KEY`, `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC=co.arraigo.app`, `APNS_ENV` (sandbox|production), `FACETEC_UPSTREAM` (opcional).

Aplicar migraciones vía Management API (evita IPv6):
```
curl -X POST https://api.supabase.com/v1/projects/shusqumfugjkwhuwyyvf/database/query \
  -H "Authorization: Bearer <PAT arraigo>" -H "Content-Type: application/json" \
  --data "$(jq -n --arg q "$SQL" '{query:$q}')"
```

## Distribución móvil — TestFlight

Build nativo (Xcode), NO EAS. Bundle ID `co.arraigo.app`, Team `325CA3VJ5P`.

1. Xcode → destino **Any iOS Device (arm64)** → **Product → Archive**.
2. Organizer → **Distribute App → TestFlight** → Upload.
3. App Store Connect → TestFlight → **Internal Testing**: agregar tester (Apple ID) en Users and Access; instala vía app TestFlight.

**Push en TestFlight:** TestFlight usa APNs de PRODUCCIÓN. Para que las sorpresas lleguen, cambiar secret `APNS_ENV=production` (el entitlement pasa a production solo al archivar para distribución). Con `sandbox`, en TestFlight las sorpresas solo se detectan por polling (app abierta).

## Seguridad
Ver [seguridad.md](seguridad.md). Auditoría 2026-07-02 (commit dd40d77): cerradas 5 vulns (escena self-compare, checkpoint sin validar, trigger-surprise IDOR, auto-completar sorpresa, replay FaceTec). Pendientes bajos: rate limiting, CORS `*`, GPS spoofing.

## Checklist de go-live

- [x] Variables de entorno en Vercel + Root Directory `apps/web` (auto-deploy)
- [x] Edge Functions desplegadas (process-checkin, trigger-surprise, facetec-proxy)
- [x] Bucket `checkin-evidence` + RLS en todas las tablas
- [x] Push APNs de sorpresas (sandbox) — probado
- [x] FaceTec liveness 3D E2E con veredicto server-side (proxy)
- [x] Auditoría de seguridad — críticos/altos cerrados
- [ ] Build TestFlight subido + tester interno
- [ ] `APNS_ENV=production` al pasar a TestFlight/App Store
- [ ] Licencia FaceTec Server (producción real con presos)
- [ ] Rate limiting en Edge Functions
- [ ] Android (puente FaceTec + FCM)
- [ ] Dominio personalizado (app.arraigo.co)
