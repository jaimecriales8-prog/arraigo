# Roadmap — Arraigo

Backlog priorizado de mejoras al MVP. Actualizado 2026-07-26.

## ✅ Hecho

### 1. Mapa de ubicaciones (panel)
Mapa Leaflet + OpenStreetMap en el detalle del caso: domicilio + geocerca (círculo con el radio permitido) + cada punto de check-in (verde dentro del radio, rojo fuera), con distancia al centro. Da visión real de dónde estuvo el imputado y patrones de evasión.
→ `apps/web/src/app/dashboard/casos/[id]/UbicacionMapa.tsx`

### 2. Ver evidencia fotográfica (panel)
Modal con selfie / escena capturada / foto de referencia por check-in, vía signed URLs del bucket privado `checkin-evidence`. Verificación visual + evidencia con cadena de custodia.
→ `apps/web/src/app/api/checkins/[id]/fotos/route.ts`, `FotosViewer.tsx`

### 6. Escalamiento de alertas (backend)
Trigger en `checkins` que detecta 3 incumplimientos consecutivos (missed/failed/completed con overall_passed=false — `excused` no cuenta) y crea una alerta `escalation` con severidad crítica, visible de inmediato en `/dashboard/alertas`. **Decisión:** solo alerta en el panel por ahora — no hay proveedor de email/SMS configurado en el proyecto para notificar al juez fuera de él (se puede agregar después con Resend u otro si se define).
→ `supabase/migrations/20260725_010_escalamiento_alertas.sql` (aplicada en Supabase el 2026-07-31)

### 3. Gestionar check-ins (panel + backend)
- **Excusar una ausencia justificada** con nota → pasa a `checkin_status = 'excused'`, ya no cuenta como incumplimiento (ni para estadísticas ni para el streak de escalamiento) y resuelve automáticamente las alertas asociadas a ese check-in.
- **Suspender / cerrar el caso, cambiar horarios o el radio** desde un bloque "Gestionar caso" en el detalle, junto a Reasignar técnico.
→ `apps/web/src/app/api/checkins/excusar/route.ts`, `apps/web/src/app/api/casos/editar/route.ts`, `ExcusarCheckin.tsx`, `EditarCaso.tsx`

### 7. Reporte de cumplimiento exportable (panel)
Botón "📄 Descargar reporte" en el detalle del caso → genera un PDF (vía `@react-pdf/renderer`, server-side) con info del caso, resumen de cumplimiento (% aprobados sobre check-ins no excusados), todos los incidentes (alertas) y el historial completo de check-ins con motivo de fallo/excusa. Para anexar al expediente judicial.
→ `apps/web/src/app/api/casos/[id]/reporte/route.tsx`

### 5. Dispositivo apagado / desinstalado / sin señal (app + backend)
`profiles.last_seen_at` actualizado por la app (al abrir + cada 15 min en foreground) y por `process-checkin` server-side en cada verificación. Cron cada 30 min crea alerta crítica `device_silent` si un imputado con caso activo lleva más de 12h sin reportar (dedup: no repite mientras la ventana de silencio siga vigente). "Última actividad del dispositivo" visible en el detalle del caso y en el reporte PDF.
**Limitación conocida (documentada en la migración y en el código):** la señal solo se actualiza mientras la app está en primer plano o al completar un check-in — no hay tarea en segundo plano registrada, así que apagar el teléfono o forzar el cierre de la app deja de generar señal, que es justo lo que se quiere detectar. Complementa (no reemplaza) las alertas de check-in no realizado.
→ `supabase/migrations/20260725_011_heartbeat_dispositivo.sql`, `apps/mobile/src/hooks/usePushNotifications.ts` (`useHeartbeat`), `supabase/functions/process-checkin/index.ts`

### 4. Mensajería al preso (panel + backend + app)
Tabla `case_messages` (texto libre, no requiere verificación de presencia — para eso está la sorpresa) + Edge Function `send-message` (mismo patrón APNs de `trigger-surprise`, control de acceso por rol/org). Panel: botón "💬 Enviar mensaje" en el detalle del caso + historial con estado leído/no leído. App: modal bloqueante "📢 Mensaje del funcionario" con botón "Entendido" (marca `read_at`), por push si hay token o por polling cada 15s como respaldo.
→ `supabase/migrations/20260725_012_mensajeria_preso.sql`, `supabase/functions/send-message/index.ts`, `apps/web/src/components/EnviarMensaje.tsx`, `apps/mobile/app/(imputado)/home.tsx`
**Nota:** requiere el build de TestFlight con el heartbeat (punto 5) para que la app reciba/marque mensajes — mismo ciclo de compilación, se agrupó en el mismo build.

### 8. Alertas agrupadas por caso (panel)
`/dashboard/alertas` ya no es una lista plana: agrupa las alertas sin resolver por caso, con los casos con más alertas primero (empate → alerta más reciente). Cada grupo es un bloque plegable (expediente, imputado, contador, criticidad, link al caso) con las alertas dentro; grupos de más de 3 alertas empiezan colapsados y dentro de un grupo se muestran las primeras 5 con "Mostrar N más". Paginado por caso (8/página).
→ `apps/web/src/app/dashboard/alertas/AlertasLista.tsx`

### 9. Reporte PDF por rango de fechas (panel)
El botón "📄 Descargar reporte" ahora tiene un selector (todo el historial / último día / última semana / último mes) antes de generar el PDF. El rango se pasa como `?rango=` a la API, que filtra check-ins y alertas por `created_at` (info del caso y estadísticas de cumplimiento se calculan solo sobre lo filtrado); el PDF muestra el periodo elegido en el encabezado.
→ `apps/web/src/app/dashboard/casos/[id]/DescargarReporte.tsx`, `apps/web/src/app/api/casos/[id]/reporte/route.tsx`

### 10. Reporte consolidado en PDF (panel)
Botón "📄 Reporte consolidado" en el Dashboard con selector de periodo (todo / último día / último mes / último año). Genera un PDF con métricas agregadas de toda la organización (casos totales/activos, check-ins del periodo, % cumplimiento, alertas críticas/sin resolver) y una tabla con todos los casos (expediente, imputado, ubicación, peligrosidad, estado, check-ins, cumplimiento) — sin el detalle de cada verificación, para eso está el reporte por caso.
→ `apps/web/src/app/dashboard/DescargarConsolidado.tsx`, `apps/web/src/app/api/reportes/consolidado/route.tsx`

### 11. Auditoría de acciones del staff (panel)
Nueva pantalla `/dashboard/auditoria` (judicial/operador/super_admin) con la cadena de custodia de acciones: casos creados/editados, técnico reasignado, check-in excusado, usuario creado, contraseña restablecida, alerta resuelta. Cada acción queda con quién (funcionario + rol), cuándo, sobre qué caso y el detalle específico. La tabla `audit_log` ya existía en el esquema original (con RLS de solo lectura) pero nada escribía en ella — se agregó el helper `logAudit()` y se llama desde cada ruta de mutación. La resolución de alertas se movió de un `update` directo desde el cliente a `POST /api/alertas/resolver`, único punto donde se podía enganchar la auditoría.
→ `apps/web/src/lib/auditLog.ts`, `apps/web/src/app/dashboard/auditoria/`, `apps/web/src/app/api/alertas/resolver/route.ts`
→ `supabase/migrations/20260726_014_audit_log_judicial_policy.sql` (política RLS de lectura para el rol `judicial`, que no existía por un desfase entre el enum original y los roles reales de la app — aplicada en Supabase el 2026-07-31).

### 12. Restablecer contraseña — staff e imputado (panel)
Botón "🔑 Restablecer contraseña" en `/dashboard/usuarios` (por usuario) y en el detalle del caso, sección "Acceso del imputado". Genera una contraseña temporal nueva (`supabase.auth.admin.updateUserById`) y la muestra en un modal para entregarla por un canal seguro — mismo patrón que la creación de usuarios (no hay SMTP/proveedor de email configurado, así que no se envía automáticamente). Sin esto, un imputado que perdía el acceso a su cuenta no tenía forma de recuperarlo.
→ `apps/web/src/app/dashboard/usuarios/RestablecerPassword.tsx`, `apps/web/src/app/api/usuarios/restablecer-password/route.ts`

### 13. Notas de seguimiento por caso (panel)
Botón "📝 Agregar nota" en el detalle del caso — observaciones internas del staff (habló con la familia, pendiente audiencia, etc.), separadas de la mensajería porque esas sí llegan al imputado. Tabla `case_notes` nueva, RLS solo para staff (judicial/operador/tecnico/super_admin); registra auditoría (`case.note_added`).
→ `apps/web/src/app/dashboard/casos/[id]/AgregarNota.tsx`, `apps/web/src/app/api/casos/notas/route.ts`, `supabase/migrations/20260726_015_notas_seguimiento.sql`

### 15. Selects de departamento/municipio en Nuevo caso (panel)
El formulario de creación de caso tenía inputs de texto libre para ciudad/departamento — un typo rompía silenciosamente los filtros del mapa general (que comparan strings exactos). Ahora son selects encadenados (elegir departamento filtra el select de municipio) con el dataset completo DIVIPOLA (33 departamentos, 1110 municipios).
→ `apps/web/src/lib/colombia.ts`, `apps/web/src/app/dashboard/casos/nuevo/CrearCasoForm.tsx`

### 18. Sitio de trabajo — segunda ubicación autorizada por caso (2026-07-28)
El imputado puede registrar un sitio de trabajo desde su celular (selfie de verificación facial + GPS + foto de escena), una sola vez; para cambiarlo después debe solicitarlo y un `judicial` debe aprobarlo antes de que pueda volver a capturar. En el check-in, el imputado elige manualmente "Casa" o "Trabajo" (el botón "Trabajo" solo aparece si ya hay sitio registrado) y el servidor valida el GPS contra el geofence correspondiente — sin lógica de horarios. El selfie se agregó a pedido explícito del usuario para evitar que otra persona haga el registro por el imputado; soporta tanto FaceTec (verificación server-side vía `facetec_sessions`, `checkin_id NULL`) como el modo acelerómetro (fallback cuando la org no tiene FaceTec activo, mismo nivel de verificación que el check-in normal en ese modo).

Sigue los dos patrones ya establecidos en el código en vez de inventar nuevos: privilegios de escritura del imputado vía edge function con service-role que se autoriza a sí misma (como `process-checkin`), y aprobación de staff como acción directa con auditoría (como `ExcusarCheckin`) — no hay tabla de "solicitudes" nueva, solo un puñado de columnas de estado en `cases`.

→ `supabase/migrations/20260728_022_work_location.sql` (columnas `work_*` en `cases`, `location_type` en `checkins`), `supabase/functions/register-work-location/`, `supabase/functions/request-work-location-change/`, `supabase/functions/process-checkin/index.ts` (selector Casa/Trabajo), `apps/mobile/app/(imputado)/trabajo/`, `apps/mobile/src/hooks/useWorkLocationStore.ts`, `apps/web/src/app/dashboard/casos/[id]/AprobarCambioTrabajo.tsx`, `apps/web/src/app/api/casos/aprobar-cambio-trabajo/route.ts`

**Fuera de alcance (fast-follow explícito):** editar `work_geofence_radius_m` desde el panel (fijo en 200m por ahora), marcar retroactivamente check-ins pasados si se vuelve a registrar el sitio, pin del sitio de trabajo en el mapa general y desglose por `location_type` en reportes PDF (la columna ya queda grabada, la UI no se construyó en esta iteración).

### 19. Datos adicionales del imputado en el onboarding (2026-07-28)
Nuevo paso en el onboarding del técnico (entre "escanear domicilio" y "confirmar"), inspirado en el formulario de registro de GeoDataVoice: perfil socioeconómico (estrato, nivel educativo, estado civil, hijos, régimen de salud, tenencia de vivienda, ocupación), un contacto de emergencia, y condiciones médicas/especiales (movilidad reducida, condiciones, medicamentos). Todos los campos son opcionales — a diferencia del formulario de GeoDataVoice, no debe bloquear la activación del caso; el técnico puede "Omitir por ahora". UI con chips/toggles (sin librería de picker nueva, siguiendo el patrón ya usado en `checkin/gps.tsx` y `onboarding/scan.tsx`).

Al explorar el paso final del onboarding se encontró un problema pre-existente no relacionado: `confirmar.tsx` escribe directo en `cases` y `profiles` desde el cliente del técnico, pero no hay ninguna política RLS de `UPDATE` para el rol `tecnico` en esas tablas en las migraciones — o hay una política viva en producción sin migración local (mismo patrón ya visto con `create_scheduled_checkins`), o ese guardado falla silenciosamente sin que nadie lo haya notado. Por eso los campos nuevos se escriben con un edge function separado y auto-autorizado (`save-onboarding-details`, mismo patrón que `register-work-location`), que no depende de esa RLS ambigua.

→ `supabase/migrations/20260729_023_datos_adicionales_onboarding.sql` (14 columnas nuevas en `cases`), `supabase/functions/save-onboarding-details/`, `apps/mobile/app/(tecnico)/onboarding/[caseId]/datos-adicionales.tsx`, `apps/web/src/app/dashboard/casos/[id]/page.tsx` (bloque "Datos adicionales")

**Resuelto (2026-07-31):** se verificó directo contra `pg_policies` — sí existen las políticas RLS de `UPDATE` para `tecnico` en `cases` (`"tecnico actualiza caso asignado"`) y `profiles` (`"tecnico actualiza foto imputado"`), aplicadas en producción pero sin migración local que las respaldara (mismo patrón que `create_scheduled_checkins`). El guardado de `confirmar.tsx` (location, reference_photo_url) funciona correctamente — no era un bug. Formalizadas en `supabase/migrations/20260731_025_documentar_rls_tecnico.sql` (idempotente, no cambia comportamiento) para que no se pierdan en otra sesión/entorno.

### 20. Estudio demográfico — reporte de hallazgos rankeado (2026-07-30)
Nueva página en el panel (`Dashboard → Estudio demográfico`, rol `judicial`/`super_admin`) que cruza automáticamente las 10 variables demográficas/de riesgo del caso (género, estrato, nivel educativo, estado civil, ocupación, régimen de salud, tenencia de vivienda, hijos, movilidad reducida, y el nivel de peligrosidad ya existente) contra la tasa de cumplimiento de check-ins, y muestra los 10 grupos con mejor y los 10 con peor cumplimiento (combinaciones de 1 y 2 variables, ej. "Género: Mujer + Tiene hijos: Sí"). No es una herramienta donde el usuario elige qué cruzar — es un reporte que encuentra los hallazgos solo. Se agregó `genero` al schema (no existía) para poder hacer este tipo de cruce.

Filtra por muestra mínima (al menos 3 casos y 15 check-ins por grupo) para no reportar ruido estadístico como si fuera un patrón — grupos que no cumplen el mínimo se descartan en silencio. Banner de advertencia permanente en la página: es correlación descriptiva, no causal, y los hallazgos son preliminares mientras la muestra de datos demográficos capturados es chica.

El cruce de variables se calcula en TypeScript sobre un dataset ya acotado (una fila por caso, vía la función SQL `demografia_cumplimiento_stats`, mismo patrón que `reporte_consolidado_stats`) — deliberadamente NO se arma SQL dinámico con nombres de columna desde el cliente, para no abrir una superficie de inyección.

→ `supabase/migrations/20260730_024_genero_onboarding.sql` (columna `genero` + función `demografia_cumplimiento_stats`), `apps/web/src/app/dashboard/reportes/demografico/page.tsx`, `apps/web/src/components/Sidebar.tsx` (entrada de nav)

**Fuera de alcance:** exportar a PDF, ajustar los mínimos de muestra desde la UI, combinaciones de 3+ variables (crecimiento combinatorio + riesgo de sobreajuste a ruido).

### 21. Organizaciones separadas — decisión sobre jerarquía judicial (2026-07-31)
Revisión (2026-07-27) confirmó cómo funciona hoy la jerarquía real: `super_admin` (todas las orgs) → dentro de una org, `judicial` y `operador` ven/gestionan **todos** los casos de la organización (scope por `organization_id`, sin ownership individual) → `tecnico` sí está acotado por caso (`cases.technician_id = auth.uid()`) → `imputado` ve solo su propio caso. La columna `cases.supervisor_id` (comentada como "juez/fiscal") existe en el schema pero no se usa en ningún lado del código — es un vestigio.

El usuario planteó originalmente un modelo de ownership individual (cada `judicial` con su propio grupo de presos dentro de una misma org). Al presentarle la alternativa, decidió que el modelo correcto es **organizaciones separadas**: cada entidad judicial (juzgado, fiscalía, etc.) es su propia organización aislada — no ownership individual dentro de una org compartida. El aislamiento por `organization_id` ya existía en el sistema; lo que faltaba era la capacidad de crear organizaciones nuevas desde el panel (antes solo existía una, insertada a mano en una migración semilla).

→ `apps/web/src/app/dashboard/organizaciones/page.tsx`, `CrearOrganizacionForm.tsx`, `apps/web/src/app/api/organizaciones/crear/route.ts` (solo `super_admin`, mismo patrón de auth/auditoría que `usuarios/crear`)

**Fuera de alcance:** editar/desactivar una organización existente desde el panel (solo creación por ahora), transferir casos entre organizaciones.

### 22. Revisión de seguridad — siete hallazgos corregidos (2026-07-27 a 2026-08-01)
Cuatro rondas de auditoría del repo (RLS, rutas con service-role, edge functions, storage, mobile) encontraron siete vulnerabilidades reales, las siete corregidas:

- **HIGH — `case_messages` permitía al imputado alterar mensajes del funcionario.** La política RLS `UPDATE` (pensada solo para marcar `read_at`) filtraba filas pero no columnas — con la anon key + su propio JWT, el imputado podía modificar el contenido de cualquier mensaje de su caso vía PostgREST. Corregido restringiendo el `GRANT UPDATE` a solo la columna `read_at`.
  → `supabase/migrations/20260727_021_fix_case_messages_update_cols.sql`
- **MEDIUM — API key de FaceTec hardcodeada como fallback en el código fuente.** `facetec-proxy` caía a un valor literal si `FACETEC_DEVICE_KEY` no estaba configurada — se confirmó (`npx supabase secrets list`) que esa variable nunca se había configurado en producción, es decir, el fallback SÍ se estaba usando en vivo. Se configuró el secret primero (mismo valor, sin downtime) y luego se quitó el fallback del código — ahora falla explícito (500) si falta.
  → `supabase/functions/facetec-proxy/index.ts`
- **HIGH — `tecnico` podía escribir cualquier columna de su caso asignado, no solo las que usa la app.** Segunda ronda de revisión (tras agregar sitio de trabajo/onboarding/organizaciones) encontró que las políticas RLS de `tecnico` en `cases`/`profiles` (formalizadas en `20260731_025`, ya vivían en producción desde antes) restringen solo filas, no columnas — un técnico autenticado podía escribir `organization_id` (romper aislamiento multi-tenant), `geofence_radius_m` (inflar el radio para pasar el GPS trivialmente), o **`work_change_approved_at`/`work_change_approved_by`** (auto-aprobarse un cambio de sitio de trabajo, saltándose por completo la aprobación de `judicial` que se acababa de construir). No se pudo restringir por columna con `GRANT`/`REVOKE` porque `judicial`/`org_admin` comparten el mismo rol `authenticated` y sí necesitan escribir más columnas. Corregido eliminando el UPDATE directo del cliente y moviendo ese guardado a un edge function nuevo (`finalize-onboarding`, lista blanca explícita: `location`, `onboarding_done_at`, `status`, `reference_photo_url`), mismo patrón que `register-work-location`/`save-onboarding-details`.
  → `supabase/migrations/20260801_026_restringir_rls_tecnico.sql`, `supabase/functions/finalize-onboarding/`, `apps/mobile/app/(tecnico)/onboarding/[caseId]/confirmar.tsx`
- **CRITICAL — cualquier usuario podía autoescalarse a `super_admin`.** Tercera ronda (auditoría completa de las 26 migraciones, no solo lo nuevo) encontró que la política `"usuario actualiza su propio perfil"` (del schema original, nunca corregida) restringía solo filas (`id = auth.uid()`), no columnas. Cualquier usuario autenticado — incluido un `imputado`, el rol de menor privilegio — podía ejecutar `UPDATE profiles SET role = 'super_admin' WHERE id = auth.uid()` con su propia sesión legítima. Como todas las políticas RLS del sistema verifican el rol leyendo `profiles.role` del propio usuario, esto era una escalada completa de imputado a super_admin sin pasar por ningún endpoint de creación de usuarios. Confirmado que el cliente solo escribía `push_token`/`last_seen_at` vía esta política — corregido con `REVOKE UPDATE` + `GRANT UPDATE` restringido a esas dos columnas (mismo patrón que `case_messages`, sin conflicto con otras políticas porque es la única `UPDATE` de self-service sobre `profiles`).
  → `supabase/migrations/20260801_027_restringir_rls_profiles_self_update.sql`
- **HIGH — `/api/checkins/[id]/fotos`, `/api/casos/[id]/reporte` y `/api/reportes/consolidado` solo validaban organización, no rol.** Cuarta ronda (segunda pasada manual, no solo del agente) encontró que estas tres rutas dejaban pasar a cualquier usuario autenticado de la misma organización — incluido un `imputado` — sin restringir a roles de staff. Un imputado podía ver fotos de evidencia de otros presos, descargar el PDF de cumplimiento de cualquier caso, o el roster completo de la organización. Corregido restringiendo a `judicial`/`operador`/`tecnico` (fotos) o `judicial`/`operador`/`super_admin` (reportes).
  → `apps/web/src/app/api/checkins/[id]/fotos/route.ts`, `apps/web/src/app/api/casos/[id]/reporte/route.tsx`, `apps/web/src/app/api/reportes/consolidado/route.tsx`
- **CRITICAL — `storage.objects` del bucket `checkin-evidence` no restringía el path, solo el bucket.** Cualquier usuario autenticado podía leer o **sobrescribir** evidencia fotográfica de cualquier otro caso yendo directo a Supabase Storage, sin pasar por ninguna API — esto hacía insuficiente el fix anterior de `fotos/route.ts`, porque el bucket se podía golpear directo. Con `upsert:true` en el cliente, también permitía alterar evidencia de otro caso (cadena de custodia). Corregido con una función que valida que el `checkin_id`/`case_id` en el path pertenezca a un caso del usuario (imputado o técnico asignado).
  → `supabase/migrations/20260801_028_restringir_storage_evidencia.sql`
- **CRITICAL — un imputado podía fabricar check-ins "aprobados" sin verificación real.** La política `"imputado registra checkin"` (INSERT) validaba el `case_id` pero no restringía columnas — un imputado podía insertar directo `status='completed', overall_passed=true, gps_passed=true, face_passed=true, scene_passed=true`, fabricando un check-in cumplido sin selfie, GPS ni escena real, sin pasar nunca por `process-checkin`. Anulaba la garantía central del producto (monitoreo verificado). Es la única política `INSERT` de `checkins`, así que restringir por columna no afecta otros roles. Corregido con `GRANT INSERT` restringido a `case_id, type, scheduled_at, window_closes_at, expires_at` — `status` queda en su default `'pending'`, los campos de resultado solo los escribe `process-checkin` con service-role. (Efecto secundario: rompía el botón "Iniciar" de la verificación sorpresa porque el cliente mandaba `status: 'pending'` explícito — Postgres rechaza el INSERT completo si se referencia cualquier columna sin GRANT, aunque sea con su valor por defecto. Se corrigió quitando ese campo del insert en `sorpresa.tsx`.)
  → `supabase/migrations/20260801_029_restringir_columnas_checkins_imputado.sql`, `apps/mobile/app/(imputado)/checkin/sorpresa.tsx`

**Nota:** las siete vulnerabilidades comparten la misma causa raíz — políticas RLS de `UPDATE`/`INSERT` en el schema original (o storage) que restringen filas pero nunca columnas/paths. Si se agrega una tabla o bucket nuevo con escritura client-facing, revisar explícitamente si necesita restricción de columna/path antes de darlo por seguro.

### 23. FaceTec en Android — probado en runtime por primera vez, 2 bugs encontrados y corregidos (2026-07-28)
Primera prueba real (nunca antes ejecutado, solo compilado) del flujo completo enroll + check-in en un dispositivo Android físico (Samsung SM-A155F). Encontró y corrigió:

- Enrolamiento fallaba con `abortOnCatastrophicError()` / `Unable To Store FaceMap: An enrollment already exists for this externalDatabaseRefID` — no era un bug, es la Testing API de FaceTec rechazando correctamente el re-enrolamiento del mismo `externalDatabaseRefID` tras probar 23 veces con el mismo imputado de prueba. Se resolvió usando un imputado nuevo.
- `facetec_sessions.kind` solo acepta `'enroll'`/`'auth'` (CHECK constraint) pero el handshake de inicialización del SDK (`kind='init'`, igual en iOS y Android) violaba esa restricción en silencio en cada sesión, en ambas plataformas, desde siempre — el `insert()` no revisaba su resultado así que nunca rompía el flujo visible, solo perdía la vuelta a la BD y el registro de auditoría del handshake. Corregido saltando el insert para `kind='init'`.
  → `supabase/functions/facetec-proxy/index.ts`

Con esto, FaceTec quedó **verificado funcionando en Android** (enroll + auth), cerrando el pendiente que quedaba abierto desde el punto 14.

### 24. Verificación de escena de trabajo usaba siempre el checkpoint de casa (2026-07-28)
Al construir "sitio de trabajo" (punto 18) se agregó el selector Casa/Trabajo para el GPS, pero `checkin/escena.tsx` nunca se actualizó — seguía pidiendo siempre un checkpoint aleatorio de la casa sin importar la ubicación elegida, y `process-checkin` comparaba contra ese checkpoint también sin importar `location_type`. Un check-in real desde el trabajo fallaba la escena por diseño (comparaba la foto del trabajo contra un punto de referencia de la casa — ej. pidió foto de la cocina estando en el trabajo).

Corregido: si `locationType='work'`, el cliente no busca checkpoints (no existen por sitio de trabajo, solo hay una foto única en `cases.work_photo_url`) y el servidor compara contra esa foto en vez de buscar un checkpoint — mismo patrón anti-fraude de siempre (la referencia la decide el servidor según `location_type`, nunca el cliente). Verificado funcionando en iPhone (TestFlight build 6) y Android.
→ `supabase/functions/process-checkin/index.ts`, `apps/mobile/src/hooks/useCheckinStore.ts`, `apps/mobile/app/(imputado)/checkin/escena.tsx`

### 25. Reporte de citas médicas del imputado, con excusa automática opcional (2026-08-02)
El imputado puede avisar con anticipación (solo por adelantado — decisión explícita del usuario, sin justificación retroactiva) que tiene una cita médica: día, ventana de hora inicio/fin, motivo opcional. Vía edge function auto-autorizado (`report-medical-appointment`), mismo patrón que `register-work-location` — nunca RLS abierta al cliente, lección de las 7 vulnerabilidades del punto 22.

El staff decide **por organización**, con un toggle nuevo en `Dashboard → Organizaciones` (visible a `judicial` para su propia org — la página se amplió para dejarlo entrar en modo solo-lectura de su org, antes era 100% `super_admin` — y a `super_admin` para cualquiera), si esas citas excusan automáticamente los check-ins que caigan dentro de la ventana declarada, o si solo quedan como contexto visible en el detalle del caso para que el staff excuse a mano con el botón "Excusar" que ya existía. Límite configurable de citas por mes por organización (`max_citas_medicas_mes`, default 2), validado server-side en el edge function.

La excusa automática se resuelve extendiendo `expire_missed_verifications()` (la función que ya corre cada 15 min marcando `missed` los check-ins vencidos) — antes de marcar `missed`, revisa si el check-in cae dentro de una cita reportada y la organización tiene la excusa automática activada; si sí, lo marca `excused` (con `excused_by = NULL`, excusa del sistema) en vez de `missed`, y no genera alerta.

→ `supabase/migrations/20260802_030_citas_medicas.sql` (tabla `medical_appointments` + columnas en `organizations` + función actualizada), `supabase/functions/report-medical-appointment/`, `apps/web/src/app/dashboard/organizaciones/` (toggle + límite), `apps/web/src/app/dashboard/casos/[id]/page.tsx` (bloque de citas), `apps/mobile/app/(imputado)/citas/`

**Fuera de alcance:** justificación retroactiva, adjuntar soporte médico (foto de la orden), editar/cancelar una cita ya reportada, notificación push al staff cuando se reporta.

## 🔨 En progreso

### 14. App Android — build funcionando, FaceTec verificado en runtime (2026-07-28)
Proyecto nativo generado (`apps/mobile/android/`) con la config que ya traía `app.json`. El grueso de la app (check-ins, mapa, mensajería, notas, heartbeat) ya es cross-platform vía Expo, sin trabajo extra. Puente nativo de FaceTec para Android portado desde iOS con integración real (SDK v10.1.9, `.aar` en `android/app/libs/`, no versionado en git). **`./gradlew :app:assembleRelease` → BUILD SUCCESSFUL**, y FaceTec (enroll + auth) ya se probó y funciona en runtime en dispositivo físico — ver punto 23. En el camino hubo que resolver varios problemas de entorno (Android Studio sin PATH a `node`, Yarn 4 borrando `node_modules` en modo PnP, Gradle 9.3.1 incompatible con un plugin) — documentados en detalle en `docs/app-movil.md` → "Entorno de desarrollo Android — problemas resueltos", para no tener que redescubrirlos.
→ `apps/mobile/android/app/src/main/java/co/arraigo/app/facetec/`, `.yarnrc.yml`, `/patches/*.patch` (raíz del monorepo)

**Pendiente dentro de este punto:**
- Push remoto en Android (Firebase/FCM) — degrada a polling por ahora, sin romper nada.
- Firma de release / decidir distribución (APK directo vs Google Play).

### 16. Escala a 50.000 casos activos — en curso
Revisión de código (2026-07-27) identificó 8 riesgos concretos de escala: `schedule-checkins` con dedup N+1 síncrono por caso/horario, `check_device_silence()` y `expire_missed_verifications()` con loops PL/pgSQL fila por fila, falta de índices compuestos, mapa/reporte consolidado trayendo datos sin límite (todos los check-ins anidados de todos los casos), sin política de retención de fotos en `checkin-evidence`, y `/dashboard/auditoria` con límite fijo de 500 sin paginar. Prioridad acordada: 1) `schedule-checkins` (rompe primero, en miles de casos), 2) mapa + reporte consolidado (uso diario), 3) retención de fotos (costo/legal — pendiente definir requisito legal de retención antes de tocar código).
**Hecho:**
- Índices compuestos (`idx_checkins_case_created`, `idx_alerts_case_resolved`, `idx_alerts_case_type_created`, `idx_audit_log_org_created`) — riesgo nulo, ya aplicado.
  → `supabase/migrations/20260727_016_indices_escala.sql`
- `create_scheduled_checkins()` reescrita a SQL set-based (una query con CTEs en vez de un round-trip a la BD por caso × horario). Se descubrió al aplicar la migración que la función **ya vivía en producción** aplicada directo en el Dashboard (con un cron `schedule-checkins` duplicado corriendo en paralelo al `create-scheduled-checkins` nuevo) — se limpió el duplicado. Validado con datos reales.
  → `supabase/migrations/20260727_017_schedule_checkins_set_based.sql`, `supabase/functions/schedule-checkins/index.ts` (ahora un wrapper delgado)
- Mapa y reporte consolidado movidos a agregación SQL: vista `mapa_casos` (último check-in por caso vía LATERAL join, antes traía el historial completo anidado) y función `reporte_consolidado_stats()` (suma por caso en Postgres, antes traía cada check-in/alerta cruda al servidor). De paso se detectó que el enum `checkin_status` no tiene el valor `'passed'` que el código JS comparaba defensivamente (solo existe `'completed')` — la comparación SQL estricta lo reveló. Verificado en navegador: mapa y PDF consolidado con datos correctos tras el cambio.
  → `supabase/migrations/20260727_018_agregaciones_escala.sql`, `apps/web/src/app/dashboard/mapa/page.tsx`, `apps/web/src/app/api/reportes/consolidado/route.tsx`
- `check_device_silence()` y `expire_missed_verifications()` reescritas a SQL set-based (mismo patrón: loops PL/pgSQL fila por fila con un INSERT por caso → una sola query con `NOT EXISTS`/CTEs). Validado con `SELECT ...()` sin error en ambas.
  → `supabase/migrations/20260727_019_device_silence_set_based.sql`, `supabase/migrations/20260727_020_expire_missed_set_based.sql`

- `/dashboard/auditoria` con paginación real server-side (antes traía hasta 500 filas fijas y filtraba/paginaba en memoria en el cliente). Nuevo `/api/auditoria` con filtro por acción + búsqueda por funcionario/expediente + `.range()` + count exacto. Verificado en navegador.
  → `apps/web/src/app/api/auditoria/route.ts`, `apps/web/src/app/dashboard/auditoria/`

**Único punto pendiente:** política de retención de evidencia fotográfica (`checkin-evidence`) — no se toca hasta que se defina el requisito legal de cuánto tiempo hay obligación de guardar esa evidencia (borrar mal es irreversible y es cadena de custodia judicial).

**Nota importante para sesiones futuras:** al menos una función (`create_scheduled_checkins`) estaba en producción sin migración local que la respaldara — el repo de migraciones puede no reflejar 100% el estado real de la BD. Antes de asumir que algo "no existe" porque no aparece en `supabase/migrations/`, verificar directo contra la BD (ej. `SELECT proname FROM pg_proc WHERE proname ILIKE '%algo%';` o `SELECT jobname, command FROM cron.job;`).

## ⏸️ Diferido

_(vacío)_
