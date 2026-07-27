# App Móvil — Arraigo

## Stack
- Expo SDK 56 + Expo Router v4
- React Native (iOS first, Android en construcción — ver abajo)
- Supabase JS client con SecureStore

## Android (2026-07-26, en construcción)
Proyecto nativo generado con `npx expo prebuild --platform android` (carpeta `android/`, igual que `ios/`: no se versiona completa, solo los archivos custom vía `git add -f`, mismo patrón que iOS). `app.json` ya traía la config de Android (package `co.arraigo.app`, permisos, íconos adaptativos) desde el inicio.

**Ya funciona sin trabajo adicional:** todo el flujo de check-in por acelerómetro, GPS, cámara (selfie/escena), mapa, mensajería, notas y heartbeat — son APIs de Expo que ya son cross-platform.

**Pendiente:**
- **FaceTec** — el puente nativo (`ios/Arraigo/Facetec/*.swift`) solo existe para iOS. Se generó el equivalente Kotlin (`android/app/src/main/java/co/arraigo/app/facetec/FacetecModule.kt` + `FacetecPackage.kt`, ya registrado en `MainApplication.kt`) pero el cuerpo de `initialize`/`enroll`/`authenticate` está stub (rechaza con `facetec_not_implemented`) hasta tener el SDK de FaceTec para Android. Detalle completo en `android/FACETEC_SETUP_ANDROID.md`. Mientras tanto, el toggle `facetecEnabled` por organización permite operar con el liveness por acelerómetro.
- **Push remoto** — el sistema actual (`trigger-surprise`, `send-message`) habla directo con APNs (solo iOS). En Android, `getDevicePushTokenAsync()` fallará sin un proyecto de Firebase configurado (`google-services.json`) — el código ya captura ese error y no rompe nada (`usePushNotifications.ts`), las sorpresas y mensajes siguen funcionando por polling. Para push real en Android hace falta crear un proyecto Firebase (FCM) y agregar el envío FCM en las Edge Functions junto al de APNs.
- **Build/firma** — requiere Android Studio + SDK instalados localmente (`ANDROID_HOME`), y un keystore de firma para builds de release. Sin Play Store, se puede probar instalando el APK directo en el teléfono (`npx expo run:android` en modo debug, o generar el APK de release y transferirlo).

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

## Heartbeat (2026-07-25)
`useHeartbeat` (en `usePushNotifications.ts`) actualiza `profiles.last_seen_at` al abrir la app, al volver a foreground y cada 15 min mientras sigue abierta. Es la señal que el backend usa para alertar si el dispositivo lleva >12h sin reportar (ver `docs/panel-web.md` → Heartbeat de dispositivo). Solo funciona en foreground — no hay tarea en segundo plano registrada.

## Mensajería del funcionario (2026-07-25)
`home.tsx` sondea `case_messages` sin leer cada 15s (igual que las sorpresas) y muestra un `Modal` bloqueante ("📢 Mensaje del funcionario") con botón "Entendido" que marca `read_at`. También llega por push (`type: 'message'` en el payload de APNs) — el listener de notificaciones en `usePushNotifications.ts` navega a home al tocarla, donde el polling recoge el mensaje.

## Permisos iOS
- Cámara: "Arraigo necesita acceso a la cámara para verificar tu identidad."
- Ubicación: "Arraigo necesita tu ubicación para verificar que estás en tu domicilio."
