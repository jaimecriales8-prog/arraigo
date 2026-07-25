# Roadmap — Arraigo

Backlog priorizado de mejoras al MVP. Actualizado 2026-07-25.

## ✅ Hecho

### 1. Mapa de ubicaciones (panel)
Mapa Leaflet + OpenStreetMap en el detalle del caso: domicilio + geocerca (círculo con el radio permitido) + cada punto de check-in (verde dentro del radio, rojo fuera), con distancia al centro. Da visión real de dónde estuvo el imputado y patrones de evasión.
→ `apps/web/src/app/dashboard/casos/[id]/UbicacionMapa.tsx`

### 2. Ver evidencia fotográfica (panel)
Modal con selfie / escena capturada / foto de referencia por check-in, vía signed URLs del bucket privado `checkin-evidence`. Verificación visual + evidencia con cadena de custodia.
→ `apps/web/src/app/api/checkins/[id]/fotos/route.ts`, `FotosViewer.tsx`

### 6. Escalamiento de alertas (backend)
Trigger en `checkins` que detecta 3 incumplimientos consecutivos (missed/failed/completed con overall_passed=false — `excused` no cuenta) y crea una alerta `escalation` con severidad crítica, visible de inmediato en `/dashboard/alertas`. **Decisión:** solo alerta en el panel por ahora — no hay proveedor de email/SMS configurado en el proyecto para notificar al juez fuera de él (se puede agregar después con Resend u otro si se define).
→ `supabase/migrations/20260725_010_escalamiento_alertas.sql` (⚠️ pendiente de aplicar en el Dashboard de Supabase — no hay CLI linkeado en este entorno)

### 3. Gestionar check-ins (panel + backend)
- **Excusar una ausencia justificada** con nota → pasa a `checkin_status = 'excused'`, ya no cuenta como incumplimiento (ni para estadísticas ni para el streak de escalamiento) y resuelve automáticamente las alertas asociadas a ese check-in.
- **Suspender / cerrar el caso, cambiar horarios o el radio** desde un bloque "Gestionar caso" en el detalle, junto a Reasignar técnico.
→ `apps/web/src/app/api/checkins/excusar/route.ts`, `apps/web/src/app/api/casos/editar/route.ts`, `ExcusarCheckin.tsx`, `EditarCaso.tsx`

### 7. Reporte de cumplimiento exportable (panel)
Botón "📄 Descargar reporte" en el detalle del caso → genera un PDF (vía `@react-pdf/renderer`, server-side) con info del caso, resumen de cumplimiento (% aprobados sobre check-ins no excusados), todos los incidentes (alertas) y el historial completo de check-ins con motivo de fallo/excusa. Para anexar al expediente judicial.
→ `apps/web/src/app/api/casos/[id]/reporte/route.tsx`

## 🔨 En progreso / próximo

### 5. Dispositivo apagado / desinstalado / sin señal (app + backend)
Hoy si el imputado apaga el teléfono o desinstala la app, no pasa nada — no hay heartbeat. Necesita: "última vez visto" + alerta si el dispositivo lleva X horas sin reportar. Apagar el teléfono no puede ser una forma gratis de evadir.

## ⏸️ Diferido

### 4. Mensajería al preso (app — necesita rebuild)
Enviar una instrucción o advertencia a la app del imputado ("preséntese ahora", "acérquese a la ventana"), más allá de la verificación sorpresa. Requiere nueva versión de la app móvil (TestFlight), por eso se difiere frente a las mejoras de solo panel/backend.
