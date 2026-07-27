# App Móvil — Arraigo

## Stack
- Expo SDK 56 + Expo Router v4
- React Native (iOS first, Android en construcción — ver abajo)
- Supabase JS client con SecureStore

## Android (2026-07-26 — build funcionando, ver estado abajo)
Proyecto nativo generado con `npx expo prebuild --platform android` (carpeta `android/`, igual que `ios/`: no se versiona completa, solo los archivos custom vía `git add -f`, mismo patrón que iOS). `app.json` ya traía la config de Android (package `co.arraigo.app`, permisos, íconos adaptativos) desde el inicio.

**Ya funciona sin trabajo adicional:** todo el flujo de check-in por acelerómetro, GPS, cámara (selfie/escena), mapa, mensajería, notas y heartbeat — son APIs de Expo que ya son cross-platform.

**Estado actual (2026-07-26): `./gradlew :app:assembleDebug` → BUILD SUCCESSFUL.** El primer APK debug ya se generó y se envió al usuario para probar en el teléfono de un tercero. FaceTec (SDK real v10.1.9) compiló limpio contra el `.aar` real — ver detalle completo, incluyendo todos los problemas de entorno que hubo que resolver para llegar a esto, en **`android/FACETEC_SETUP_ANDROID.md`** y la sección "Entorno de desarrollo Android" más abajo en este documento.

**Pendiente:**
- **Probar el flujo real de FaceTec en un dispositivo/emulador** — enrolamiento (técnico) + autenticación (imputado check-in) contra el SDK real. El código compila pero nunca se ha ejecutado en runtime contra `facetec-proxy`; puede haber ajustes finos de la API real del SDK (nombres exactos de algún método/callback) que solo aparecen al correrlo.
- **Push remoto** — el sistema actual (`trigger-surprise`, `send-message`) habla directo con APNs (solo iOS). En Android, `getDevicePushTokenAsync()` fallará sin un proyecto de Firebase configurado (`google-services.json`) — el código ya captura ese error y no rompe nada (`usePushNotifications.ts`), las sorpresas y mensajes siguen funcionando por polling. Para push real en Android hace falta crear un proyecto Firebase (FCM) y agregar el envío FCM en las Edge Functions junto al de APNs.
- **Firma de release / distribución** — el APK actual es debug (sin firmar para producción, ~195MB). Para release real hace falta un keystore propio y decidir distribución (APK directo vs Google Play Console).

## Entorno de desarrollo Android — problemas resueltos (2026-07-26)
Esta sección documenta en detalle los problemas de tooling que costó bastante diagnosticar, para que una sesión futura no tenga que redescubrirlos. Todos ya están resueltos y el fix está commiteado.

### 1. Android Studio no encuentra `node` (bloqueó el sync por horas)
Android Studio en macOS arranca con el PATH mínimo del sistema (`/usr/bin:/bin:/usr/sbin:/sbin`) sin importar `.zshrc`/`.bashrc`, sin heredar el PATH de la Terminal, y **sin heredar tampoco `launchctl setenv PATH ...`** corrido desde una sesión de Claude Code (esa corre en un entorno aislado que no es la sesión GUI real de macOS). Ni symlinks en `/usr/local/bin` ni reiniciar Android Studio lo arreglaron de forma confiable.
**Fix real:** parchear cada script de Gradle/Kotlin que invoca `"node"` directo (sin ruta) para que use la ruta absoluta del binario (`/Users/jaimecriales/.nvm/versions/node/v22.22.3/bin/node`), vía `patch-package`. Afecta **9 paquetes** (`@react-native/gradle-plugin`, `expo-modules-autolinking`, `expo-modules-core`, `expo-constants`, `react-native-screens`, `@expo/log-box`, y el propio `apps/mobile/android/settings.gradle`) — la fase de *settings* de Gradle en un proyecto Expo/RN llama a `node` en al menos 15 puntos distintos para resolver rutas de paquetes.
Los patches están en `/patches/*.patch` (raíz del monorepo) y se reaplican solos gracias a `"postinstall": "patch-package"` en el `package.json` raíz — **no hay que hacer nada manual tras un `yarn install` normal**, salvo que la ruta de node cambie (ver nota abajo).
**Nota de portabilidad:** la ruta está hardcodeada para *esta* máquina y *esta* versión de node (`v22.22.3` vía nvm). Si cambias de máquina o de versión de node, hay que regenerar los patches (`grep -rl "v22.22.3/bin/node" patches/` para ubicarlos, editar la ruta, y `npx patch-package <paquete> --exclude '.*/(\.gradle|build)/.*'` para cada uno — filtrar después el diff a mano si arrastra archivos de `build/` que no correspondan, ver punto 3).

### 2. Yarn 4 en modo PnP borró `node_modules` por completo
El repo no tenía `.yarnrc.yml`, así que al correr `yarn install` (via `corepack`/`npx yarn`), Yarn 4 (Berry) usó su modo por defecto **Plug'n'Play** y **eliminó `node_modules` entero**, reemplazándolo por `.pnp.cjs`/`.pnp.loader.mjs`. Esto rompe cualquier tooling que espere el layout clásico (todo React Native/Expo/Gradle).
**Fix:** `.yarnrc.yml` en la raíz con `nodeLinker: node-modules`. Ya está commiteado — un `yarn install` normal de ahora en adelante nunca debería volver a hacer esto. **Ojo:** si alguna vez ves que `node_modules` desaparece después de instalar dependencias, es este mismo problema resurgiendo (verificar que `.yarnrc.yml` siga existiendo y con ese valor).

### 3. Gradle build reventaba: `foojay-resolver-convention` incompatible con Gradle 9.3.1
El `gradle-wrapper.properties` generado por `expo prebuild` apuntaba a Gradle 9.3.1 (muy reciente), que rompe compatibilidad con `foojay-resolver-convention@0.5.0` (versión que trae fijada `@react-native/gradle-plugin`) — error `JvmVendorSpec does not have member field IBM_SEMERU`.
**Fix:** dos partes — (a) parche subiendo `foojay-resolver-convention` a `0.8.0` en el `settings.gradle.kts` de `@react-native/gradle-plugin` (mismo patch de la sección 1), y (b) bajar el Gradle wrapper del proyecto a **8.13** (`apps/mobile/android/gradle/wrapper/gradle-wrapper.properties`) — más estable con el resto del stack en este momento.

### 4. Limpieza de caché borró carpetas `build/` reales (no solo caché de Gradle)
Al intentar limpiar cachés de Gradle (`.gradle/`, `build/`) dentro de `node_modules/<paquete>` para generar patches limpios con `patch-package`, un `find ... -iname build -exec rm -rf` fue demasiado agresivo y borró el **JS ya compilado** de 8 paquetes npm (su `build/` real, ej. `node_modules/expo-modules-autolinking/build/`), no solo caché de Gradle. Causó errores tipo `Cannot find module '../build'` en tiempo de ejecución de los scripts de Node que Gradle invoca.
**Fix:** `yarn install` limpio restaura todo desde el lockfile/caché de yarn. **Lección para el futuro:** nunca borrar `build/` a ciegas dentro de `node_modules/<paquete>` — solo `.gradle/` (caché real de Gradle) es seguro de borrar; `build/` puede ser output legítimo de compilación TS/JS del paquete, no solo de Gradle.

### 5. Errores reales de compilación Kotlin en el puente de FaceTec (primera vez que corrió contra el SDK real)
Una vez resueltos los 4 problemas de entorno de arriba, aparecieron errores genuinos de compilación en `FacetecModule.kt` (el código nunca se había compilado contra el `.aar` real antes de este día):
- `activityEventListener` referenciado en `init {}` antes de su declaración (Kotlin ejecuta init blocks y propiedades en orden textual) → reordenado.
- Firma de `onActivityResult` no coincidía con `BaseActivityEventListener` real (`activity: Activity` y `data: Intent` no son nullable, al revés de lo que asumí por analogía con iOS) → corregido.
- `currentActivity` no resuelve como propiedad heredada directa en `ReactContextBaseJavaModule` en este contexto → hay que usar `reactContext.currentActivity` explícito (guardando `reactContext` como propiedad del constructor).
Ya corregido y compilando limpio — ver `apps/mobile/android/app/src/main/java/co/arraigo/app/facetec/FacetecModule.kt`.

### Checklist para retomar el build de Android en una sesión nueva
```bash
cd /Users/jaimecriales/Sites/arraigo
yarn install   # restaura node_modules + reaplica los patches automáticamente (postinstall)

# Copiar el .aar de FaceTec (no está en git, ver android/FACETEC_SETUP_ANDROID.md):
mkdir -p apps/mobile/android/app/libs
cp ~/Downloads/FaceTecSDK-android-10.1.9/facetec-sdk-10.1.9.aar apps/mobile/android/app/libs/

cd apps/mobile/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
./gradlew :app:assembleDebug   # debería dar BUILD SUCCESSFUL
```
El APK queda en `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

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
