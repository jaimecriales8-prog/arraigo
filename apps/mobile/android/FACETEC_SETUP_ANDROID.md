# FaceTec — Android

Espejo de `ios/FACETEC_SETUP.md`. SDK v10.1.9 (Managed Testing, mismo Device
Key que iOS: `dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1`).

## Estado: código escrito, sin compilar todavía (falta Android Studio/JDK)

El puente nativo Android ya está integrado, mirando 1:1 la SampleApp oficial
de FaceTec (`facetec-sdk-android-10.1.9/apps/SampleApp`) y el mismo flujo que
`ios/Arraigo/Facetec/*.swift`:

- `android/app/build.gradle` — dependencia del SDK (`implementation
  files('libs/facetec-sdk-10.1.9.aar')`) + OkHttp (networking). **El `.aar`
  no se versiona en git** (igual que `ios/Frameworks/*.xcframework`, mismo
  patrón: los binarios del SDK no van al repo). Antes de compilar, copiarlo:
  ```bash
  mkdir -p apps/mobile/android/app/libs
  cp ~/Downloads/FaceTecSDK-android-10.1.9/facetec-sdk-10.1.9.aar apps/mobile/android/app/libs/
  ```
  (o desde donde hayas descargado el SDK — el archivo exacto es
  `facetec-sdk-10.1.9.aar`, no el `-automated` ni el `-minimal`).
- `FacetecModule.kt` — expone `initialize`/`enroll`/`authenticate` a JS.
  Diferencia con iOS: FaceTec en Android lanza su propia Activity
  (`startActivityForResult` internamente), así que el resultado se recibe
  vía `ActivityEventListener.onActivityResult` en vez de un delegate directo.
- `FacetecSessionProcessor.kt` — implementa `FaceTecSessionRequestProcessor`:
  recibe el `sessionRequestBlob`, lo manda por POST (OkHttp, con reintentos
  igual que iOS: 4 intentos con backoff 0/0/2s/5s/10s) a `facetec-proxy`
  (Edge Function — sin cambios, ya era platform-agnostic), y devuelve el
  `responseBlob` al SDK.
- `FacetecPackage.kt` + registro en `MainApplication.kt` — ya hecho.
- Lado JS (`src/lib/facetec.ts`) — **sin cambios**, ya era platform-agnostic.

## Pendiente

1. **Instalar Android Studio** (en curso) — trae el JDK embebido que hace
   falta para correr Gradle (`./gradlew help` falló ahora mismo por eso: "Unable
   to locate a Java Runtime").
2. **Primer build de verificación:**
   ```bash
   cd apps/mobile
   npx expo run:android
   ```
   Esto compilará el módulo Kotlin contra el `.aar` real por primera vez —
   es la primera vez que este código se valida contra el compilador (no se
   pudo compilar en este entorno por falta de Android SDK/JDK). Si hay
   errores de firma de métodos del SDK (nombres exactos de clases/parámetros
   pueden variar levemente entre versiones), revisar contra
   `~/Downloads/FaceTecSDK-android-10.1.9/apps/SampleApp/app/src/main/java/com/facetec/sampleapp/SampleAppActivity.java`
   y `SessionRequestProcessor.java` (la referencia oficial usada para escribir
   este puente).
3. **Probar enroll + authenticate** en un dispositivo/emulador real — el
   flujo completo (técnico enrola, imputado hace check-in) depende de que
   `facetec-proxy` acepte las llamadas igual que ya lo hace desde iOS.

## Nota
El resto de la app (checkins por acelerómetro, GPS, cámara, mapa, mensajería,
notas, heartbeat) no depende de esto y ya debería compilar y correr en
Android — el toggle `facetecEnabled` por organización permite operar sin
FaceTec si hace falta probar el resto de la app primero mientras se resuelve
el build de FaceTec.
