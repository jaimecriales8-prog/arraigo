# Deployment — Arraigo

## Panel web → Vercel

### Primera vez

```bash
source ~/.nvm/nvm.sh
cd apps/web
npx vercel --prod
```

Seleccionar:
- Framework: Next.js
- Root directory: `apps/web`
- Build command: `npm run build`
- Output: `.next`

### Variables de entorno en Vercel

En el dashboard de Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL        → Production + Preview
NEXT_PUBLIC_SUPABASE_ANON_KEY   → Production + Preview
SUPABASE_SERVICE_ROLE_KEY       → Production ONLY
```

### Deploys subsiguientes

```bash
cd apps/web && npx vercel --prod
```

O conectar el repo a Vercel para deploys automáticos en cada push a `main`.

## App móvil → EAS Build (Expo)

### Requisitos previos

- Cuenta Apple Developer ($99/año) — para iOS
- Cuenta Google Play Console ($25 único) — para Android
- `npm install -g eas-cli`

### Configurar EAS

```bash
cd apps/mobile
eas login
eas build:configure
```

Esto crea `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### Build de prueba (APK para Android)

```bash
eas build --platform android --profile preview
```

Genera un APK instalable directamente sin necesidad de Play Store.

### Build de producción

```bash
# Android (AAB para Play Store)
eas build --platform android --profile production

# iOS (IPA para App Store)
eas build --platform ios --profile production
```

### Publicar actualizaciones OTA (sin nueva build)

Para cambios que no tocan código nativo (JS/TS solo):

```bash
eas update --branch production --message "Fix: descripción del cambio"
```

Los usuarios reciben la actualización automáticamente al abrir la app.

## Supabase — producción

### Edge Functions

```bash
source ~/.nvm/nvm.sh
SUPABASE_ACCESS_TOKEN=<pat> npx supabase functions deploy process-checkin \
  --project-ref shusqumfugjkwhuwyyvf \
  --no-verify-jwt
```

### Secrets de Edge Functions

```bash
SUPABASE_ACCESS_TOKEN=<pat> npx supabase secrets set \
  AWS_ACCESS_KEY_ID=<key> \
  AWS_SECRET_ACCESS_KEY=<secret> \
  AWS_REGION=us-east-1 \
  --project-ref shusqumfugjkwhuwyyvf
```

### Backup de base de datos

Supabase realiza backups diarios automáticos (plan Pro). Para backup manual:

```bash
pg_dump "postgresql://postgres:<password>@db.shusqumfugjkwhuwyyvf.supabase.co:5432/postgres" \
  --no-owner -f backup_$(date +%Y%m%d).sql
```

## Dominios sugeridos

| Servicio | Dominio |
|---|---|
| Panel web | app.arraigo.co |
| API (Supabase) | api.arraigo.co (proxy opcional) |
| App móvil | Deep link: arraigo:// |

## Checklist de go-live

- [ ] Variables de entorno en Vercel (Production)
- [ ] Dominio personalizado en Vercel
- [ ] Edge Functions desplegadas
- [ ] Secrets de AWS Rekognition configurados
- [ ] Bucket `checkin-evidence` en Storage (privado)
- [ ] RLS verificado con queries de prueba por cada rol
- [ ] Build de app en TestFlight (iOS) / Play Store interno (Android)
- [ ] Usuario de prueba end-to-end antes de entregar a la entidad
- [ ] Templates de email en Supabase Auth en español
- [ ] Límites de rate limiting configurados en Edge Functions
