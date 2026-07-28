-- ============================================================
-- Datos adicionales del imputado capturados por el técnico durante
-- el onboarding: perfil socioeconómico, contacto de emergencia (uno
-- solo) y condiciones médicas/especiales. Todo opcional — información
-- complementaria para el manejo judicial del caso, no bloquea la
-- activación. Se escriben vía el edge function save-onboarding-details
-- (auto-autorizado), no por RLS directa. Ver docs/roadmap.md.
-- ============================================================

ALTER TABLE cases
  -- Perfil socioeconómico
  ADD COLUMN estrato              INTEGER,
  ADD COLUMN nivel_educativo      TEXT,
  ADD COLUMN estado_civil         TEXT,
  ADD COLUMN ocupacion            TEXT,
  ADD COLUMN tiene_hijos          BOOLEAN,
  ADD COLUMN num_hijos            INTEGER,
  ADD COLUMN regimen_salud        TEXT,
  ADD COLUMN tenencia_vivienda    TEXT,
  -- Contacto de emergencia (uno solo)
  ADD COLUMN contacto_emergencia_nombre       TEXT,
  ADD COLUMN contacto_emergencia_telefono     TEXT,
  ADD COLUMN contacto_emergencia_parentesco   TEXT,
  -- Condiciones médicas / especiales
  ADD COLUMN movilidad_reducida   BOOLEAN,
  ADD COLUMN condiciones_medicas TEXT,
  ADD COLUMN medicamentos         TEXT;
