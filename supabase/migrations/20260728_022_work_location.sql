-- ============================================================
-- Segunda ubicación autorizada por caso: sitio de trabajo.
-- El imputado la registra él mismo (selfie + GPS + foto de escena),
-- una sola vez; para cambiarla después necesita solicitarlo y que
-- un judicial lo apruebe. Ver docs/roadmap.md para el flujo completo.
-- ============================================================

ALTER TABLE cases
  ADD COLUMN work_address              TEXT,
  ADD COLUMN work_location              GEOMETRY(POINT, 4326),
  ADD COLUMN work_geofence_radius_m     INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN work_photo_url             TEXT,
  ADD COLUMN work_registered_at         TIMESTAMPTZ,
  ADD COLUMN work_change_requested_at   TIMESTAMPTZ,
  ADD COLUMN work_change_reason         TEXT,
  ADD COLUMN work_change_approved_at    TIMESTAMPTZ,
  ADD COLUMN work_change_approved_by    UUID REFERENCES profiles(id);

ALTER TABLE checkins
  ADD COLUMN location_type TEXT NOT NULL DEFAULT 'home' CHECK (location_type IN ('home', 'work'));
