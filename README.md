# Arraigo — Plataforma de Monitoreo de Arresto Domiciliario

Plataforma SaaS B2B para Colombia que permite a entidades judiciales (INPEC, juzgados) monitorear personas en arresto domiciliario mediante verificación de identidad, GPS y reconocimiento de escena.

## Documentación

| Documento | Descripción |
|---|---|
| [Arquitectura](docs/arquitectura.md) | Visión general, stack, decisiones técnicas |
| [Base de datos](docs/base-de-datos.md) | Schema, tablas, RLS, roles |
| [App móvil](docs/app-movil.md) | Guía de desarrollo de la app Expo |
| [Panel web](docs/panel-web.md) | Guía del panel Next.js para funcionarios |
| [Flujo de check-in](docs/flujo-checkin.md) | Cómo funciona la verificación paso a paso |
| [Seguridad](docs/seguridad.md) | RLS, anti-spoofing, cadena de custodia |
| [Desarrollo local](docs/desarrollo-local.md) | Setup del entorno de desarrollo |
| [Deployment](docs/deployment.md) | Cómo desplegar a producción |

## Estructura del monorepo

```
arraigo/
├── apps/
│   ├── mobile/          # App Expo (React Native) — imputados
│   └── web/             # Next.js 15 — panel judicial y admin
├── packages/
│   └── shared/          # Tipos TypeScript compartidos
├── supabase/
│   ├── migrations/      # Migraciones SQL versionadas
│   └── functions/       # Edge Functions (Deno)
└── docs/                # Documentación
```

## Inicio rápido

```bash
# App móvil
cd apps/mobile && npx expo start

# Panel web
cd apps/web && npm run dev
```

## Credenciales de prueba

| Rol | Email | Password |
|---|---|---|
| Imputado | prueba.imputado@arraigo.co | Arraigo2026! |

## Regla de oro

> Nunca usar `service_role` para suplir lógica de acceso. RLS cubre todos los casos.
> `service_role` solo para Edge Functions de sistema (alertas, scheduler).
