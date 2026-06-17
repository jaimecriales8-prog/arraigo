# Base de datos — Arraigo

## Regla de oro

> **Nunca modificar una migración ya aplicada. Siempre crear una nueva.**
> Archivo de migración = contrato. Cambiarlo rompe otros entornos.

## Migraciones aplicadas

| Archivo | Descripción |
|---|---|
| `20260617_001_schema.sql` | Schema completo + RLS + triggers |
| `20260617_002_fix_trigger.sql` | Fix trigger handle_new_user + org de prueba |
| `20260617_003_seed_prueba.sql` | Seed de datos de prueba |

## Tablas

### `organizations`
Los tenants del sistema. Una fila = una entidad cliente (INPEC, juzgado, etc.).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | Nombre de la entidad |
| `nit` | TEXT | NIT único |
| `contact_email` | TEXT | Email de contacto |
| `is_active` | BOOLEAN | Soft-delete |
| `settings` | JSONB | Configuración por organización |

### `profiles`
Extiende `auth.users`. Un perfil por usuario.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | FK → auth.users |
| `organization_id` | UUID | FK → organizations (null para super_admin) |
| `role` | user_role | Enum de rol |
| `full_name` | TEXT | Nombre completo |
| `document_type` | TEXT | CC, CE, pasaporte |
| `document_number` | TEXT | Número de documento |

### `cases`
El corazón del sistema. Un caso = un imputado bajo una medida de arresto domiciliario.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `organization_id` | UUID | FK → organizations |
| `imputado_id` | UUID | FK → profiles |
| `technician_id` | UUID | FK → profiles (técnico asignado) |
| `supervisor_id` | UUID | FK → profiles (juez/fiscal) |
| `case_number` | TEXT | Número de expediente |
| `status` | case_status | onboarding / active / suspended / closed / revoked |
| `location` | GEOMETRY(POINT) | Coordenadas del domicilio (PostGIS) |
| `geofence_radius_m` | INTEGER | Radio del geofence en metros |
| `checkin_times` | JSONB | Array de horas: `["08:00","14:00","20:00"]` |
| `checkin_window_min` | INTEGER | Minutos de tolerancia por check-in |
| `face_threshold` | NUMERIC | Umbral mínimo verificación facial (0-1) |
| `scene_threshold` | NUMERIC | Umbral mínimo verificación de escena (0-1) |

### `checkpoints`
Puntos de referencia del domicilio. Los registra el técnico en el onboarding presencial.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `case_id` | UUID | FK → cases |
| `label` | TEXT | Ej: "Ventana sala con cortina gris" |
| `description` | TEXT | Instrucción para el imputado |
| `photo_url` | TEXT | URL de la foto de referencia (Storage) |
| `embedding` | VECTOR(512) | Embedding CLIP de la foto (pgvector) |
| `is_active` | BOOLEAN | Se puede desactivar sin borrar |
| `created_by` | UUID | FK → profiles (técnico) |

### `checkins`
Cada verificación programada. Se crea automáticamente por el scheduler.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `case_id` | UUID | FK → cases |
| `scheduled_at` | TIMESTAMPTZ | Cuándo debía hacerse |
| `window_closes_at` | TIMESTAMPTZ | Límite de la ventana |
| `status` | checkin_status | pending / completed / failed / missed / excused |
| `face_score` | NUMERIC | Score de similitud facial (0-1) |
| `face_passed` | BOOLEAN | ¿Pasó el umbral? |
| `face_photo_url` | TEXT | URL de la selfie capturada |
| `gps_lat/lng` | NUMERIC | Coordenadas GPS reportadas |
| `gps_is_mock` | BOOLEAN | ¿GPS simulado detectado? |
| `gps_distance_m` | NUMERIC | Distancia al centroide del domicilio |
| `gps_passed` | BOOLEAN | ¿Dentro del geofence? |
| `scene_checkpoint_id` | UUID | Qué punto de referencia se pidió |
| `scene_score` | NUMERIC | Score de similitud de escena (0-1) |
| `scene_passed` | BOOLEAN | ¿Pasó el umbral? |
| `overall_score` | NUMERIC | Score consolidado 0-100 |
| `overall_passed` | BOOLEAN | Resultado final |

### `alerts`
Alertas generadas automáticamente por incumplimientos.

| Tipo | Severidad | Descripción |
|---|---|---|
| `missed_checkin` | critical | No se realizó en la ventana |
| `gps_out_of_range` | critical | Fuera del geofence |
| `face_verification_failed` | warning | No pasó verificación facial |
| `scene_verification_failed` | warning | No pasó verificación de escena |
| `mock_gps_detected` | critical | GPS simulado detectado |
| `multiple_failures` | critical | 3+ fallos consecutivos |

### `audit_log`
Append-only. Tiene RULEs SQL que bloquean UPDATE y DELETE a nivel de base de datos.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK autoincremental |
| `organization_id` | UUID | FK → organizations |
| `case_id` | UUID | FK → cases |
| `actor_id` | UUID | Quién realizó la acción |
| `actor_role` | user_role | Rol en el momento de la acción |
| `action` | TEXT | Ej: `checkin.completed`, `alert.created` |
| `payload` | JSONB | Snapshot del estado relevante |
| `ip_address` | INET | IP del cliente |

## RLS — Resumen de políticas

El principio base: **cada usuario solo ve lo que le pertenece**.

```
super_admin     → ve TODO sin filtro
org_admin       → ve su organización completa
officer         → ve casos y alerts de su org (solo lectura)
technician      → ve y crea checkpoints en casos asignados
supervisor      → ve solo casos donde supervisor_id = auth.uid()
imputado        → ve solo su caso; INSERT en checkins de su caso
```

Las funciones helper `auth_role()`, `auth_org()` y `is_super_admin()` evitan repetir lógica en cada política.

## Extensiones habilitadas

| Extensión | Uso |
|---|---|
| `uuid-ossp` | Generación de UUIDs |
| `postgis` | Índice espacial, geofencing, ST_Distance |
| `pgcrypto` | Hash de documentos sensibles |
| `vector` | Embeddings CLIP para verificación de escena |
