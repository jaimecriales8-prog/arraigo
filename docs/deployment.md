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

## App móvil → Android (nativo, sin Play Store por ahora)

Ver detalle completo (incluyendo problemas de entorno resueltos) en
`docs/app-movil.md` → "Entorno de desarrollo Android".

```bash
cd /Users/jaimecriales/Sites/arraigo
yarn install   # reaplica patches de node automáticamente

# Copiar el .aar de FaceTec (no versionado en git):
mkdir -p apps/mobile/android/app/libs
cp ~/Downloads/FaceTecSDK-android-10.1.9/facetec-sdk-10.1.9.aar apps/mobile/android/app/libs/

cd apps/mobile/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
./gradlew :app:assembleDebug
```

APK debug en `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (~195MB, sin firmar) — **requiere Metro corriendo** (`npx expo start`) en la misma red, si no da "Unable to load script". Para probar suelto en el teléfono de alguien más, usar release en su lugar:

```bash
./gradlew :app:assembleRelease
```

APK release en `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (~115MB) — JS empaquetado adentro, no depende de Metro. Firmado con el keystore de debug como temporal (válido para pruebas, no sirve para Play Store). Se distribuye enviando el archivo directo — el que lo recibe debe permitir "instalar de fuentes desconocidas" al abrirlo. Sin Google Play Console todavía (pendiente decidir si se sube ahí más adelante).

## Edge Functions → Supabase

### Deploy
```bash
source ~/.nvm/nvm.sh
cd /Users/jaimecriales/Sites/arraigo
SUPABASE_ACCESS_TOKEN=<pat> npx supabase functions deploy trigger-surprise --project-ref shusqumfugjkwhuwyyvf
```

### Funciones desplegadas
- `trigger-surprise` — Dispara verificación sorpresa y envía push notification
- `send-message` — Envía mensaje libre al imputado (push + persistido en `case_messages`)

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
- `send-message` — mensaje libre al imputado (push APNs + persistido en `case_messages`). Mismo patrón que `trigger-surprise`.
- `facetec-proxy` — reenvía blobs FaceTec a la Testing API y registra veredicto server-side.
- `schedule-checkins` — (SQL `create_scheduled_checkins()` vía pg_cron cada 15 min, no Edge Function).

### Nota sobre permisos del CLI
El login de `supabase login` puede no tener rol suficiente en la organización para `functions deploy` (403 "Your account does not have the necessary privileges") aunque el proyecto sea visible en el Dashboard. Alternativas: (a) exportar `SUPABASE_ACCESS_TOKEN` de una cuenta con más privilegios solo para esa sesión de shell, o (b) pegar el código directo en Dashboard → Edge Functions → editor.

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

**Push en TestFlight:** TestFlight usa APNs de PRODUCCIÓN. Para que las sorpresas lleguen, el secret `APNS_ENV` debe estar en `production` (el entitlement pasa a production solo al archivar para distribución). Con `sandbox`, en TestFlight las sorpresas solo se detectan por polling (app abierta) — este fue exactamente el síntoma que se dio el 2026-07-28 (push no llegaba con la app cerrada) y se confirmó `APNS_ENV=production` como el fix. **`APNS_ENV=production` ya está seteado en el proyecto** — si en otra sesión el push deja de llegar con la app cerrada en TestFlight, verificar esto primero antes de asumir otra causa (ej. token vencido, permisos del dispositivo).

## Seguridad
Ver [seguridad.md](seguridad.md). Auditoría 2026-07-02 (commit dd40d77): cerradas 5 vulns (escena self-compare, checkpoint sin validar, trigger-surprise IDOR, auto-completar sorpresa, replay FaceTec). Pendientes bajos: rate limiting, CORS `*`, GPS spoofing.

## Checklist de go-live

- [x] Variables de entorno en Vercel + Root Directory `apps/web` (auto-deploy)
- [x] Edge Functions desplegadas (process-checkin, trigger-surprise, facetec-proxy)
- [x] Bucket `checkin-evidence` + RLS en todas las tablas
- [x] Push APNs de sorpresas (sandbox) — probado
- [x] FaceTec liveness 3D E2E con veredicto server-side (proxy)
- [x] Auditoría de seguridad — críticos/altos cerrados
- [x] Build TestFlight subido (build number 4, 2026-07-27) — pendiente confirmar tester interno instalado y probando
- [ ] `APNS_ENV=production` al pasar a TestFlight/App Store
- [ ] Licencia FaceTec Server (producción real con presos)
- [ ] Rate limiting en Edge Functions
- [x] Android — build release compilando (`BUILD SUCCESSFUL`), puente FaceTec integrado y compilando, APK release (no debug) entregado a un tester externo, reconstruido con sitio de trabajo + datos adicionales del onboarding + género
- [ ] Android — probar flujo real de FaceTec (enroll/authenticate) en runtime
- [ ] Android — push remoto (FCM/Firebase), hoy degrada a polling
- [ ] Dominio personalizado (app.arraigo.co)
