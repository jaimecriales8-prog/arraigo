# App Móvil — Arraigo

## Stack

- **Expo SDK 52** + React Native 0.76
- **expo-router** v4 — navegación basada en archivos
- **TypeScript** estricto
- **Supabase JS** con SecureStore para persistencia de sesión
- **Zustand** para estado del check-in en curso

## Estructura

```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root layout — guard de auth y redirección por rol
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx            # Pantalla de login
│   └── (imputado)/
│       ├── _layout.tsx
│       ├── home.tsx             # Dashboard del imputado
│       └── checkin/
│           ├── selfie.tsx       # Paso 1 — cámara frontal
│           ├── gps.tsx          # Paso 2 — ubicación GPS
│           ├── escena.tsx       # Paso 3 — foto del domicilio
│           └── resultado.tsx    # Resultado y envío
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase con SecureStore
│   │   ├── gps.ts               # GPS + anti-spoofing + Haversine
│   │   └── storage.ts           # Upload de fotos a Supabase Storage
│   └── hooks/
│       ├── useAuth.ts           # Sesión, perfil, signIn, signOut
│       ├── useCase.ts           # Caso activo del imputado + check-in pendiente
│       └── useCheckinStore.ts   # Estado efímero del flujo de check-in (Zustand)
└── app.json                     # Config Expo — permisos, bundle IDs
```

## Correr en desarrollo

```bash
cd apps/mobile
npx expo start
```

Escanea el QR con **Expo Go** (iOS/Android). Para build nativo (necesario para GPS en background):

```bash
npx expo run:android   # requiere Android Studio
npx expo run:ios       # requiere Xcode + cuenta Apple Developer
```

## Variables de entorno

Copia `apps/mobile/.env.example` a `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Las variables `EXPO_PUBLIC_*` se exponen al cliente. **Nunca** poner el `service_role` aquí.

## Navegación y guards de auth

`app/_layout.tsx` observa la sesión de Supabase y redirige:
- Sin sesión → `/(auth)/login`
- Sesión con rol `imputado` → `/(imputado)/home`
- Otros roles → pantalla de login (la app móvil es exclusiva para imputados)

## Estado del check-in (Zustand)

`useCheckinStore` es un store efímero (en memoria) que acumula los datos de las 3 pantallas del check-in:

```
selfie.tsx  → setSelfie(base64, uri)
gps.tsx     → setGPS(lat, lng, accuracy, isMock)
escena.tsx  → setScene(base64, uri, checkpointId)
resultado.tsx → lee todo el store → envía → store.reset()
```

Al terminar (exitoso o fallido), `reset()` limpia el store.

## Detección de GPS mock

`src/lib/gps.ts` expone el campo `isMock` de `expo-location`:

```typescript
const loc = await getCurrentLocation()
// loc.isMock === true si el dispositivo usa mock location (Android)
```

En iOS no existe mock location nativo (requiere jailbreak), por lo que el flag siempre es `false`.

## Permisos requeridos

| Permiso | Cuándo se pide | Plataforma |
|---|---|---|
| Cámara | Primera vez en selfie.tsx | iOS + Android |
| Ubicación (en uso) | Primera vez en gps.tsx | iOS + Android |

Los permisos se declaran en `app.json` bajo `plugins`.

## Credenciales de prueba

| Campo | Valor |
|---|---|
| Email | prueba.imputado@arraigo.co |
| Password | Arraigo2026! |
| Caso | 2026-00123 |

## Próximos pasos (Fase 2)

- [ ] Push notifications (Expo Notifications) para alertar al imputado
- [ ] Detección de liveness (parpadeo o movimiento de cabeza)
- [ ] Background location para monitoreo continuo
- [ ] Certificate pinning para mayor seguridad
- [ ] Build de producción con EAS Build
