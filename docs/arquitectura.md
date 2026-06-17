# Arquitectura — Arraigo

## Visión general

Arraigo es un sistema multi-tenant B2B. La empresa Arraigo es el super-tenant; las entidades clientes (INPEC, juzgados) son los tenants. Cada entidad tiene sus propios casos, funcionarios y configuración.

```
[App Móvil - Imputado]     [Panel Web - Funcionario]     [Panel Web - Admin]
       ↓                            ↓                            ↓
                        API Gateway (Supabase)
                               ↓
              ┌────────────────────────────────────┐
              │           Supabase                 │
              │  PostgreSQL + PostGIS + pgvector   │
              │  Auth + Storage + Edge Functions   │
              └────────────────────────────────────┘
                               ↓
              ┌─────────────────────────────────────┐
              │         Edge Functions (Deno)        │
              │  process-checkin  │  send-alerts     │
              │  schedule-checkins│                  │
              └─────────────────────────────────────┘
```

## Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| App móvil | Expo (React Native) + TypeScript | GPS nativo, cámara, SecureStore, build sin Xcode/Android Studio |
| Panel web | Next.js 15 + Tailwind CSS | App Router, SSR para dashboard en tiempo real |
| Base de datos | PostgreSQL + PostGIS + pgvector | Geofencing nativo, embeddings CLIP de escena |
| Auth | Supabase Auth | JWT, refresh tokens, RLS integrado |
| Storage | Supabase Storage | Evidencias cifradas (fotos de check-in) |
| Edge Functions | Deno (Supabase) | process-checkin, alertas, scheduler |
| Tipos compartidos | packages/shared | Un solo lugar de verdad entre mobile y web |

## Modelo de tenancy

Cada fila en las tablas principales lleva `organization_id`. RLS filtra automáticamente por organización del usuario autenticado. Un usuario nunca puede ver datos de otra organización.

```
organizations (tenant)
  └── profiles (usuarios de esa org)
  └── cases (casos de esa org)
        └── checkpoints
        └── checkins
        └── alerts
        └── audit_log
```

## Roles

| Rol | Descripción | Acceso |
|---|---|---|
| `super_admin` | Empresa Arraigo | Todo el sistema |
| `org_admin` | Admin de la entidad | Su organización completa |
| `officer` | Funcionario de monitoreo | Casos de su org (solo lectura + alertas) |
| `technician` | Técnico de campo | Casos asignados (checkpoints) |
| `supervisor` | Juez / fiscal | Solo casos asignados a él |
| `imputado` | Persona en arresto domiciliario | Solo su caso y sus check-ins |

## Verificación de identidad (Fase 2)

La verificación facial se delega a **AWS Rekognition** o **DeepFace** self-hosted:
- Foto de referencia capturada por el técnico en el onboarding
- En cada check-in: selfie → comparación → score (0-1)
- Umbral configurable por caso (`face_threshold`, default 0.80)

## Verificación de escena

Usa embeddings **CLIP** (`clip-vit-base-patch32`) almacenados en `pgvector`:
- Técnico registra 3-6 fotos de referencia del domicilio
- En cada check-in: challenge aleatorio → foto → comparación coseno
- Umbral configurable por caso (`scene_threshold`, default 0.82)
- Robusto a cambios de luz y ángulo (CLIP entiende semántica, no píxeles)

## Anti-spoofing GPS

| Amenaza | Contramedida |
|---|---|
| Mock Location (Android) | `isMocked` flag de expo-location |
| GPS falso externo | Señales WiFi del domicilio (Fase futura) |
| VPN / IP falsa | IP geolocation como señal adicional |
| Prestar el teléfono | Liveness detection + face match obligatorio |

El campo `gps_is_mock` se almacena en cada check-in. Un mock detectado genera alerta `critical` automáticamente.

## Cadena de custodia

`audit_log` es **append-only** a nivel de base de datos (RULEs SQL que bloquean UPDATE y DELETE). Cada acción relevante genera un registro inmutable con timestamp, actor, rol e IP. Este log tiene valor legal para el expediente judicial.
