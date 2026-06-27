# Base de Datos — Arraigo

## Proyecto Supabase
- URL: https://shusqumfugjkwhuwyyvf.supabase.co
- Ref: shusqumfugjkwhuwyyvf

## Extensiones
- `uuid-ossp`
- `vector` (pgvector para embeddings de escena)

## Tablas

### organizations
Multi-tenant root. Cada entidad que contrata Arraigo es una organización.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| name | TEXT | Nombre de la organización |
| slug | TEXT UNIQUE | Identificador URL |
| plan | TEXT | free / pro / enterprise |
| created_at | TIMESTAMPTZ | |

### profiles
Extiende `auth.users`. Un perfil por usuario.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK → auth.users | |
| organization_id | UUID FK | |
| role | user_role ENUM | imputado / tecnico / judicial / super_admin |
| full_name | TEXT | |
| document_type | TEXT | CC, CE, PA |
| document_number | TEXT | |
| phone | TEXT | |
| push_token | TEXT | Token Expo para push notifications |
| is_active | BOOLEAN | |

### cases
Un caso por imputado.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| case_number | TEXT | Expediente judicial |
| imputado_id | UUID FK → profiles | |
| assigned_to | UUID FK → profiles | Técnico o judicial responsable |
| status | case_status ENUM | active / suspended / closed |
| home_lat | FLOAT8 | Coordenadas del domicilio |
| home_lng | FLOAT8 | |
| home_radius_m | INT | Radio permitido (metros) |
| checkin_frequency_hours | INT | Frecuencia de check-ins |
| checkin_window_minutes | INT | Ventana de tiempo para completar |

### checkins
Registro de cada verificación.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| case_id | UUID FK | |
| type | TEXT | scheduled / surprise |
| status | checkin_status ENUM | pending / passed / failed |
| gps_lat / gps_lng | FLOAT8 | Coordenadas capturadas |
| gps_accuracy_m | FLOAT4 | Precisión GPS |
| gps_is_mock | BOOLEAN | Anti-spoofing |
| face_score | FLOAT4 | Score verificación facial (0-1) |
| scene_score | FLOAT4 | Score verificación de escena (0-1) |
| selfie_url | TEXT | URL en Storage |
| scene_url | TEXT | URL en Storage |
| expires_at | TIMESTAMPTZ | Para verificaciones sorpresa |

### checkpoints
Puntos de referencia del domicilio para verificación de escena.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| case_id | UUID FK | |
| label | TEXT | Nombre del punto (ej: "Sala") |
| description | TEXT | Instrucción al imputado |
| reference_embedding | vector(512) | Embedding CLIP de la foto de referencia |
| reference_url | TEXT | Foto de referencia |
| is_active | BOOLEAN | |

### surprise_verifications
Verificaciones sorpresa solicitadas por el juzgado.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| case_id | UUID FK | |
| requested_by | UUID FK → profiles | Quién la solicitó |
| expires_at | TIMESTAMPTZ | 15 minutos desde creación |
| status | TEXT | pending / completed / expired |

### audit_log
Inmutable por RULE (no se puede UPDATE ni DELETE). Cadena de custodia legal.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| actor_id | UUID | |
| action | TEXT | create_case, submit_checkin, etc. |
| table_name | TEXT | |
| record_id | UUID | |
| metadata | JSONB | |

## RLS (Row Level Security)

Todas las tablas tienen RLS activado. Políticas basadas en:
- `auth_org()` — retorna el `organization_id` del usuario autenticado
- `auth_role()` — retorna el rol del usuario
- `is_super_admin()` — verifica si es super_admin

## Enums
```sql
user_role: imputado, tecnico, judicial, super_admin
case_status: active, suspended, closed
checkin_status: pending, passed, failed
```

## Datos de prueba
- Organización: Arraigo Demo
- Imputado: Carlos Rodríguez (07a4f83c-e75b-455b-a0b3-a3be83140e63)
- Caso: #2026-00123, Calle 45 #12-34 Chapinero, Bogotá
- Admin panel: admin@arraigo.co / Admin2026!
