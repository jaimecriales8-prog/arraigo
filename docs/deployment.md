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

## Checklist de go-live

- [x] Variables de entorno en Vercel
- [x] GitHub conectado a Vercel
- [x] Edge Function `trigger-surprise` desplegada
- [x] Bucket `checkin-evidence` creado
- [x] RLS en todas las tablas
- [x] App instalada en dispositivo de prueba
- [x] Usuario admin creado (admin@arraigo.co)
- [ ] Dominio personalizado (app.arraigo.co)
- [ ] Edge Function `process-checkin` (Fase 2)
- [ ] Verificación facial con AWS Rekognition (Fase 2)
- [ ] CLIP embeddings para escena (Fase 4)
- [ ] Build TestFlight para distribución
- [ ] Push notifications en producción (APNS certificates)
