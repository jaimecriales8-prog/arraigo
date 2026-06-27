# App Móvil — Arraigo

## Stack
- Expo SDK 56 + Expo Router v4
- React Native (iOS first)
- Supabase JS client con SecureStore

## Estructura de archivos
```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root layout con auth check
│   ├── index.tsx                # Redirect → /(auth)/login
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx            # Pantalla de login
│   └── (imputado)/
│       ├── _layout.tsx
│       ├── home.tsx             # Home del imputado
│       └── checkin/
│           ├── selfie.tsx       # Captura selfie (cámara frontal)
│           ├── gps.tsx          # Captura GPS con anti-spoofing
│           ├── escena.tsx       # Verificación de escena (cámara trasera)
│           ├── resultado.tsx    # Resultado del check-in
│           └── sorpresa.tsx     # Pantalla verificación sorpresa con countdown
├── src/
│   ├── hooks/
│   │   ├── useAuth.ts           # Hook de autenticación Supabase
│   │   ├── useCheckinStore.ts   # Zustand store para estado del check-in
│   │   └── usePushNotifications.ts  # Registro y manejo de push notifications
│   └── lib/
│       ├── supabase.ts          # Cliente Supabase con SecureStore
│       ├── gps.ts               # getCurrentLocation, haversineDistanceM
│       └── storage.ts           # uploadPhoto a Supabase Storage
├── index.ts                     # Entry point → expo-router/entry
└── app.json                     # Config Expo con plugins
```

## Flujo de navegación
```
/ → /(auth)/login
      ↓ (login exitoso)
/(imputado)/home
      ↓ (ventana de check-in abierta)
/(imputado)/checkin/selfie → gps → escena → resultado
      ↓ (notificación sorpresa)
/(imputado)/checkin/sorpresa (countdown 15 min) → selfie → ...
```

## Verificación sorpresa
- El panel web dispara `trigger-surprise` Edge Function
- La función envía push notification via Expo Push API
- La app muestra pantalla `sorpresa.tsx` con contador regresivo de 15 minutos
- Si vence → marca `surprise_verifications.status = 'expired'`
- Si completa → flujo normal de check-in con `surprise_id` en params

## Build para dispositivo físico (sin servidor)
```bash
source ~/.nvm/nvm.sh
cd apps/mobile

# Generar bundle embebido
npx expo export:embed --platform ios \
  --bundle-output ios/Arraigo/main.jsbundle \
  --assets-dest ios/Arraigo \
  --dev false

# Build Release e instalar en iPhone
npx expo run:ios --device --configuration Release
```

## Requisitos previos
- Xcode con Command Line Tools
- CocoaPods (`brew install cocoapods`)
- iPhone con Modo Desarrollador activo
- USB conectado al Mac
- `xcode-select -s /Applications/Xcode.app/Contents/Developer`

## Variables de entorno
```
EXPO_PUBLIC_SUPABASE_URL=https://shusqumfugjkwhuwyyvf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_E8qhtpQDMKGDAIAuclv2UA_vcJpcaa1
```

## Push Notifications
- Se usa Expo Push API (no requiere APNS directo en desarrollo)
- Token se guarda en `profiles.push_token`
- En producción con TestFlight/App Store se necesitan APNS certificates en EAS

## Permisos iOS
- Cámara: "Arraigo necesita acceso a la cámara para verificar tu identidad."
- Ubicación: "Arraigo necesita tu ubicación para verificar que estás en tu domicilio."
