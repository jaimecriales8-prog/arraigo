# FaceTec — pasos pendientes para Android

Espejo de `ios/FACETEC_SETUP.md`. El bridge de React Native (Kotlin) ya está
escrito y registrado, pero el cuerpo real de las llamadas al SDK de FaceTec
está pendiente porque el SDK de Android aún no se ha descargado/agregado al
proyecto.

## Ya hecho
- `android/app/src/main/java/co/arraigo/app/facetec/FacetecModule.kt` — expone
  a JS los mismos 3 métodos que iOS: `initialize`, `enroll`, `authenticate`.
  Ahora mismo cada uno rechaza la promesa con `facetec_not_implemented`.
- `FacetecPackage.kt` — registra el módulo, ya está agregado en
  `MainApplication.kt`.
- El lado JS (`src/lib/facetec.ts`) no necesita cambios — ya es
  platform-agnostic (usa `NativeModules.FacetecModule`).

## Pendiente (una vez que tengas la cuenta/SDK de FaceTec para Android)

1. **Agregar la dependencia del SDK** — FaceTec distribuye el SDK Android
   como `.aar` o vía su Maven privado (mismo portal de desarrollador que
   iOS). Se agrega en `android/app/build.gradle` (`dependencies { }`).

2. **Device Key** — la misma que usa iOS
   (`dTCCKq4bZ9mHJrkhc0dL2bCZuzAjMAF1`, ver `src/lib/facetec.ts`), FaceTec
   emite una por app, no por plataforma — debería funcionar igual en Android.
   Confirmar en el portal de FaceTec.

3. **Portar la lógica de sesión** — traducir
   `ios/Arraigo/Facetec/FacetecSessionProcessor.swift` a Kotlin:
   - Recibe el `sessionRequestBlob` del SDK.
   - Lo manda por POST a `facetec-proxy` (Edge Function ya existe y es
     platform-agnostic, no necesita cambios) con `{ requestBlob, kind,
     externalDatabaseRefID, testingApiHeader, checkinId? }`.
   - Devuelve el `responseBlob` de la respuesta al SDK.
   - Reintentos (hasta 4, con backoff) igual que en iOS.

4. **Inicialización** — el equivalente Android de
   `FaceTec.sdk.initializeWithSessionRequest(...)` (nombre exacto de la API
   a confirmar contra la versión del SDK que se descargue — la estructura de
   FaceTec suele ser paralela entre iOS/Android pero los nombres de clase
   varían).

5. **UI de la sesión** — en iOS se presenta un `UIViewController` sobre la
   vista actual; en Android el SDK típicamente abre su propia `Activity` —
   revisar la doc de integración de FaceTec para Android para el patrón
   exacto de lanzamiento.

6. **Build** — una vez integrado:
   ```bash
   cd apps/mobile
   npx expo run:android --variant release
   ```
   (requiere Android Studio + SDK instalados; `ANDROID_HOME` configurado).

## Nota
El resto de la app (checkins sin FaceTec vía acelerómetro, GPS, cámara para
selfie/escena, mapa, mensajería, heartbeat) no depende del SDK de FaceTec y
ya debería compilar y correr en Android sin este trabajo pendiente — el
toggle `facetecEnabled` por organización permite operar sin FaceTec si hace
falta probar el resto de la app primero.
