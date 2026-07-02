# Seguridad — Arraigo

## Principios

1. **RLS primero**: Toda tabla tiene RLS. Ningún dato es accesible sin política explícita.
2. **service_role solo en servidor**: Nunca en el cliente móvil ni en el browser.
3. **Evidencia inmutable**: audit_log no puede modificarse ni borrarse.
4. **Defense in depth**: Múltiples capas de verificación en el check-in.

## Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Las políticas siguen este orden de prioridad:

```sql
-- super_admin: acceso total
is_super_admin()

-- Usuarios de org: solo su organización
organization_id = auth_org()

-- Supervisor: solo casos asignados
supervisor_id = auth.uid()

-- Imputado: solo su caso
imputado_id = auth.uid()
```

Las funciones helper (`auth_role()`, `auth_org()`, `is_super_admin()`) son `SECURITY DEFINER` y `STABLE` — se ejecutan con los permisos del owner (postgres) pero con el contexto de la sesión actual.

## Anti-spoofing GPS

### Android
`expo-location` expone `isMocked` desde `LocationObject.coords`. Se activa cuando:
- El dispositivo tiene "Mock Location" habilitado en opciones de desarrollador
- Una app de terceros inyecta coordenadas falsas

**Respuesta de Arraigo:**
- `gps_is_mock = true` se almacena en el check-in
- Se genera alerta `mock_gps_detected` con severidad `critical`
- El check-in se marca como `failed` automáticamente

### iOS
iOS no expone una API equivalente. El riesgo es menor porque mock location requiere jailbreak. Medidas compensatorias:
- Cruzar con señales WiFi del domicilio (Fase 2)
- Detectar VPN activa y registrarla

## Cifrado de evidencia

Las fotos de selfie y escena se almacenan en Supabase Storage (`checkin-evidence`):
- Bucket **privado** (no public URLs)
- Acceso solo via URLs firmadas temporales generadas server-side
- Supabase Storage cifra los archivos en reposo (AES-256)
- En tránsito: TLS 1.3

## Cadena de custodia (audit_log)

El `audit_log` es legalmente relevante para el expediente judicial:

```sql
-- Estas dos reglas bloquean modificaciones a nivel de motor PostgreSQL
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

Ni siquiera el `super_admin` puede borrar registros del audit_log desde la API. Solo es posible con acceso directo al servidor PostgreSQL.

Cada entrada contiene:
- Timestamp con zona horaria
- ID del actor y su rol en ese momento
- IP del cliente
- Snapshot JSON del estado relevante

## Seguridad del token JWT

- Tokens JWT con expiración de 1 hora (`jwt_expiry = 3600`)
- Refresh token rotation habilitado
- Reuse interval de 10 segundos (previene replay attacks)
- Tokens almacenados en `expo-secure-store` (Keychain en iOS, Keystore en Android)
- **Nunca** en AsyncStorage (no cifrado)

## Protección del endpoint de check-in

La Edge Function `process-checkin` verifica:
1. JWT válido del imputado
2. El `checkinId` pertenece al caso del imputado autenticado
3. La ventana de tiempo está abierta (`scheduled_at ≤ now ≤ window_closes_at`)
4. El caso está en status `active`

Si cualquiera falla → 403, sin revelar qué falló exactamente.

## Cumplimiento — Colombia

| Norma | Aplicación |
|---|---|
| Ley 1581/2012 (Habeas Data) | Datos biométricos y de localización son datos sensibles. Consentimiento explícito en el proceso judicial. |
| Ley 1266/2008 | Datos de antecedentes judiciales. Solo acceso por entidades autorizadas. |
| Circular 002/2020 SIC | Seguridad de datos personales. Cifrado en reposo y tránsito. |

Los datos del imputado no se comparten con terceros. La empresa Arraigo es operadora de datos; la entidad judicial es la responsable.

## Checklist de seguridad por fase

### Fase 0 (✅ Completado)
- [x] RLS habilitado en todas las tablas
- [x] Políticas por rol antes de escribir código
- [x] audit_log inmutable
- [x] Tokens en SecureStore

### Fase 2 (Pendiente)
- [ ] Certificate pinning en la app
- [ ] Detección de root/jailbreak
- [ ] Liveness detection (previene foto de foto)
- [ ] Rate limiting en Edge Functions
- [ ] WAF en API Gateway

### Fase 3 (Pendiente)
- [ ] Penetration testing externo
- [ ] Auditoría de cumplimiento Habeas Data
- [ ] Cifrado de campos sensibles a nivel de aplicación (nombres, documentos)

## Liveness facial — FaceTec (2026-07)

**Decisión:** FaceTec para liveness certificado (iBeta ISO 30107-3 Nivel 1/2) + matching 3D:3D. Genera FaceMap 3D desde cámara 2D normal → funciona en iOS 12+ / Android 5+ sin hardware especial (ARKit descartado: requiere TrueDepth y el dispositivo es del imputado).

**Por qué:** el liveness por acelerómetro NO detecta foto impresa (solo mide movimiento del teléfono). El momento crítico es el check-in NO supervisado, no el enrolamiento (que supervisa el técnico presencialmente).

**Arquitectura:**
- SDK cliente (`ios/Arraigo/Facetec/` — puente RN nativo propio) captura el FaceMap.
- El veredicto lo determina el SERVIDOR, nunca el cliente. Hoy: Managed Testing (api.facetec.com, gratis, desarrollo). Producción: FaceTec Server self-hosted (Server Key pendiente) — los datos biométricos no salen de la infraestructura propia (Habeas Data).
- `externalDatabaseRefID` = `profiles.id` del imputado (ata enrolamiento ↔ verificación).

**Feature toggle:** default global `EXPO_PUBLIC_FACETEC_DEFAULT` + override por organización (`organizations.facetec_enabled`, null = hereda). OFF ⇒ flujo acelerómetro intacto. `checkins.liveness_method` registra el método usado (peso probatorio).

**Deuda de seguridad (Milestone 2):** en Managed Testing la app reporta el resultado — un cliente comprometido podría falsificarlo. Con la Server Key, verificar el match server-side en el middleware antes de aceptar el check-in.

## Verificación de escena con IA (2026-07)

`process-checkin` compara la foto de escena contra la referencia del checkpoint con GPT-4o-mini Vision (signed URLs de 60 s, bucket privado). **Fail-closed:** si la comparación falla por cualquier motivo (red, API, parsing), el check-in FALLA — nunca pasa por defecto, porque pasar silenciosamente anularía la esencia de la verificación de sitio.
