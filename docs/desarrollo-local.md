# Desarrollo local — Arraigo

## Requisitos previos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | 22.x | [nvm](https://github.com/nvm-sh/nvm) |
| npm | 10.x | Incluido con Node |
| Supabase CLI | 2.x | `npm install -g supabase` |
| Expo Go | Última | App Store / Play Store |

## Setup inicial (una sola vez)

```bash
# 1. Clonar el repo
git clone <repo-url>
cd arraigo

# 2. Instalar dependencias del monorepo
npm install

# 3. Variables de entorno — app móvil
cp apps/mobile/.env.example apps/mobile/.env.local
# Editar con las keys del proyecto Supabase

# 4. Variables de entorno — panel web
cp apps/web/.env.example apps/web/.env.local
# Editar con las keys del proyecto Supabase
```

## Supabase

### Proyecto en la nube (actual)

```
URL:  https://shusqumfugjkwhuwyyvf.supabase.co
Ref:  shusqumfugjkwhuwyyvf
```

### Aplicar una migración nueva

1. Crear el archivo en `supabase/migrations/YYYYMMDD_NNN_descripcion.sql`
2. Ejecutarla en el SQL Editor del Dashboard
3. Hacer commit del archivo

> **Nunca modificar migraciones ya aplicadas. Siempre crear nuevas.**

### Generar tipos TypeScript desde el schema

```bash
source ~/.nvm/nvm.sh
SUPABASE_ACCESS_TOKEN=<tu-pat> npx supabase gen types typescript \
  --project-id shusqumfugjkwhuwyyvf \
  > packages/shared/src/database.types.ts
```

## Correr la app móvil

```bash
source ~/.nvm/nvm.sh
cd apps/mobile
npx expo start
```

Escanea el QR con Expo Go en tu celular. Asegúrate de que el celular y el Mac estén en la misma red WiFi.

### Credenciales de prueba

```
Email:    prueba.imputado@arraigo.co
Password: Arraigo2026!
```

## Correr el panel web

```bash
source ~/.nvm/nvm.sh
cd apps/web
npm run dev
# → http://localhost:3000
```

## Workflow de desarrollo

```
1. Crear rama: git checkout -b feat/nombre-feature
2. Desarrollar
3. Si hay cambios de BD: crear migration file + aplicar en Dashboard
4. Commit: git add -A && git commit -m "feat: descripción"
5. Push y PR
```

## Convenciones de commits

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
docs:     Solo documentación
refactor: Refactoring sin cambio de comportamiento
migration: Nueva migración de base de datos
```

## Estructura de una migración

```sql
-- ============================================================
-- ARRAIGO — Descripción breve
-- Migración: YYYYMMDD_NNN_descripcion.sql
-- REGLA: Nunca modificar esta migración. Crear nuevas.
-- ============================================================

-- Cambios aquí...
```

## Variables de entorno — referencia completa

### apps/mobile/.env.local
```env
EXPO_PUBLIC_SUPABASE_URL=       # URL del proyecto Supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=  # Anon key (pública)
```

### apps/web/.env.local
```env
NEXT_PUBLIC_SUPABASE_URL=       # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Anon key (pública)
SUPABASE_SERVICE_ROLE_KEY=      # Service role key (SOLO servidor)
```
