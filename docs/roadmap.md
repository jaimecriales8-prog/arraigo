# Roadmap — Arraigo

Backlog priorizado de mejoras al MVP. Actualizado 2026-07-25.

## ✅ Hecho

### 1. Mapa de ubicaciones (panel)
Mapa Leaflet + OpenStreetMap en el detalle del caso: domicilio + geocerca (círculo con el radio permitido) + cada punto de check-in (verde dentro del radio, rojo fuera), con distancia al centro. Da visión real de dónde estuvo el imputado y patrones de evasión.
→ `apps/web/src/app/dashboard/casos/[id]/UbicacionMapa.tsx`

### 2. Ver evidencia fotográfica (panel)
Modal con selfie / escena capturada / foto de referencia por check-in, vía signed URLs del bucket privado `checkin-evidence`. Verificación visual + evidencia con cadena de custodia.
→ `apps/web/src/app/api/checkins/[id]/fotos/route.ts`, `FotosViewer.tsx`

## 🔨 En progreso / próximo

### 3. Gestionar check-ins (panel + backend)
- Excusar una ausencia justificada (`checkin_status` ya tiene `excused`) con nota → no cuenta como incumplimiento.
- Suspender / cerrar el caso, cambiar horarios o el radio desde el panel.

### 5. Dispositivo apagado / desinstalado / sin señal (app + backend)
Hoy si el imputado apaga el teléfono o desinstala la app, no pasa nada — no hay heartbeat. Necesita: "última vez visto" + alerta si el dispositivo lleva X horas sin reportar. Apagar el teléfono no puede ser una forma gratis de evadir.

### 6. Escalamiento de alertas (backend)
Hoy cada incumplimiento genera una alerta suelta. Falta lógica de escalada: p. ej. 3 incumplimientos seguidos → alerta crítica + notificar al juez automáticamente.

### 7. Reporte de cumplimiento exportable (panel)
Generar un PDF/informe por imputado (historial, % cumplimiento, incidentes) para anexar al expediente judicial.

## ⏸️ Diferido

### 4. Mensajería al preso (app — necesita rebuild)
Enviar una instrucción o advertencia a la app del imputado ("preséntese ahora", "acérquese a la ventana"), más allá de la verificación sorpresa. Requiere nueva versión de la app móvil (TestFlight), por eso se difiere frente a las mejoras de solo panel/backend.
