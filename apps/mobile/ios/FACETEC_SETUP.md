# FaceTec — pasos de Xcode (no automatizables por CLI)

SDK v10.1.5 · Managed Testing · Device Key ya configurada en `src/lib/facetec.ts`.

El código del puente ya está escrito:
- `ios/Arraigo/Facetec/FacetecModule.swift`
- `ios/Arraigo/Facetec/FacetecSessionProcessor.swift`
- `ios/Arraigo/Facetec/FacetecModule.m`
- `ios/Arraigo/Arraigo-Bridging-Header.h` (agregado `#import <React/RCTBridgeModule.h>`)
- Frameworks copiados en `ios/Frameworks/`

## 1. Agregar los archivos del puente al target
En Xcode (abrir `Arraigo.xcworkspace`):
1. Click derecho en el grupo `Arraigo` → **Add Files to "Arraigo"…**
2. Seleccionar la carpeta `Facetec/` (los 3 archivos). Marcar **"Copy items if needed" NO** (ya están en su sitio) y **target Arraigo ✓**.
3. Verificar que `FacetecModule.swift`, `FacetecSessionProcessor.swift` y `FacetecModule.m` aparezcan en **Build Phases → Compile Sources**.

## 2. Embeber el framework
Para **Managed Testing** se usa `FaceTecSDKForDevelopment.xcframework` (no requiere Server Key).
1. Target `Arraigo` → **General → Frameworks, Libraries, and Embedded Content**.
2. Click **+** → **Add Other… → Add Files…** → `ios/Frameworks/FaceTecSDKForDevelopment.xcframework`.
3. Ponerlo en **Embed & Sign**.
4. (Producción, más adelante) cambiar a `FaceTecSDK.xcframework` + FaceTec Server.

## 3. Strings de localización (opcional pero recomendado)
Arrastrar `ios/Frameworks/FaceTec.strings` y `FaceTec-es.strings` al target para textos en español.

## 4. Permiso de cámara
Ya existe `NSCameraUsageDescription` en `Info.plist` (se usa para los check-ins). Verificar que siga.

## 5. Build
```bash
source ~/.nvm/nvm.sh && cd apps/mobile
npx expo export:embed --platform ios --bundle-output ios/Arraigo/main.jsbundle --assets-dest ios/Arraigo --dev false
npx expo run:ios --device --configuration Release
```

### Nota importante — framework de desarrollo vs Release
`FaceTecSDKForDevelopment.xcframework` es el que habilita Managed Testing sin Server Key.
Si el build en `--configuration Release` rechaza el framework de desarrollo, hay dos caminos:
- Construir en Debug pero con bundle embebido (evita Metro igual).
- O esperar la Server Key y usar `FaceTecSDK.xcframework` (producción).
Esto es lo más probable que requiera un ajuste en el primer build.

## Cómo probar
1. Activar el toggle: en `.env.local` poner `EXPO_PUBLIC_FACETEC_DEFAULT=true` (o setear `organizations.facetec_enabled = true` en DB).
2. Un check-in del imputado ahora abrirá la UI de FaceTec en el paso de selfie.
3. OJO: `authenticate()` (check-in) requiere un **enrolamiento previo** del mismo imputado. Para la primera prueba conviene probar primero un enrolamiento (lo cableamos en `identidad.tsx` una vez confirmado que el módulo carga), o probar liveness standalone.
