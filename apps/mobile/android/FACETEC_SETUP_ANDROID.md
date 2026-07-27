# FaceTec — Android

Espejo de `ios/FACETEC_SETUP.md`. SDK v10.1.9 (Managed Testing, mismo Device
Key que iOS: `dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1`).

## Estado (2026-07-26): compila limpio — `BUILD SUCCESSFUL`. Falta probarlo en runtime.

El puente nativo Android ya está integrado y **ya compiló correctamente**
(`./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`, primer APK debug
generado y entregado para pruebas), mirando 1:1 la SampleApp oficial de
FaceTec (`facetec-sdk-android-10.1.9/apps/SampleApp`) y el mismo flujo que
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
  Detalles de la firma real (aprendidos al compilar por primera vez contra
  el SDK real, distintos de lo que se asumió por analogía con iOS):
  - `onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?)` —
    `activity` **no** es nullable (a diferencia de lo que uno esperaría).
  - No hay una propiedad `currentActivity` heredada directamente utilizable
    en el cuerpo de la clase — hay que usar `reactContext.currentActivity`
    explícito (guardando `reactContext` como propiedad del constructor).
  - El `val activityEventListener = object : BaseActivityEventListener() {...}`
    debe declararse **antes** del bloque `init {}` que lo registra (Kotlin
    ejecuta inicializadores en orden textual — si el `init{}` va primero,
    da error "must be initialized").
- `FacetecSessionProcessor.kt` — implementa `FaceTecSessionRequestProcessor`:
  recibe el `sessionRequestBlob`, lo manda por POST (OkHttp, con reintentos
  igual que iOS: 4 intentos con backoff 0/0/2s/5s/10s) a `facetec-proxy`
  (Edge Function — sin cambios, ya era platform-agnostic), y devuelve el
  `responseBlob` al SDK.
- `FacetecPackage.kt` + registro en `MainApplication.kt` — ya hecho.
- Lado JS (`src/lib/facetec.ts`) — **sin cambios**, ya era platform-agnostic.

## Cómo se llegó al build exitoso (contexto para no repetir el trabajo)

Compilar por primera vez tomó bastante porque aparecieron **varios problemas
de entorno completamente ajenos a FaceTec** (Android Studio sin encontrar
`node`, Yarn borrando `node_modules`, versión de Gradle incompatible con un
plugin). Todo el detalle paso a paso está en `docs/app-movil.md`, sección
**"Entorno de desarrollo Android — problemas resueltos"** — revisar ahí antes
de asumir que un error nuevo es de FaceTec; muy probablemente sea tooling.

## Pendiente

1. **Probar enroll + authenticate en runtime** — el código compila pero
   nunca se ha ejecutado de verdad contra el SDK (ni en emulador ni en
   dispositivo físico). El flujo completo (técnico enrola al imputado,
   imputado hace check-in con liveness) depende de que `facetec-proxy`
   acepte las llamadas igual que ya lo hace desde iOS — debería funcionar
   sin cambios porque el proxy es platform-agnostic, pero es la primera
   verificación real pendiente.
2. Si aparece algún error de runtime (no de compilación), revisar contra
   `~/Downloads/FaceTecSDK-android-10.1.9/apps/SampleApp/app/src/main/java/com/facetec/sampleapp/SampleAppActivity.java`
   y `SessionRequestProcessor.java` (la referencia oficial usada para escribir
   este puente).

## Nota
El resto de la app (checkins por acelerómetro, GPS, cámara, mapa, mensajería,
notas, heartbeat) no depende de esto y ya compila/corre en Android — el
toggle `facetecEnabled` por organización permite operar sin FaceTec si hace
falta probar el resto de la app primero.
