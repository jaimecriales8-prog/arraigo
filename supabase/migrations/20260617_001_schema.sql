-- ============================================================
-- ARRAIGO — Schema inicial + RLS
-- Migración: 20260617_001_schema.sql
-- REGLA: Nunca modificar esta migración. Crear nuevas.
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- ENUM: roles del sistema
-- ============================================================
CREATE TYPE user_role AS ENUM (
  'super_admin',   -- empresa Arraigo (ve todo)
  'org_admin',     -- admin de la entidad (INPEC, juzgado)
  'officer',       -- funcionario que monitorea casos
  'technician',    -- técnico que hace onboarding en el domicilio
  'supervisor',    -- juez / fiscal (solo sus casos)
  'imputado'       -- persona en arresto domiciliario
);

CREATE TYPE case_status AS ENUM (
  'onboarding',   -- técnico aún configurando el domicilio
  'active',       -- monitoreo activo
  'suspended',    -- suspendido temporalmente (ej. hospitalización)
  'closed',       -- caso cerrado (cumplió o revocado)
  'revoked'       -- medida revocada por incumplimiento
);

CREATE TYPE checkin_status AS ENUM (
  'pending',      -- programado, aún no realizado
  'completed',    -- realizado y aprobado
  'failed',       -- realizado pero falló alguna verificación
  'missed',       -- no se realizó en la ventana de tiempo
  'excused'       -- excusado por autoridad competente
);

CREATE TYPE alert_severity AS ENUM (
  'info',
  'warning',
  'critical'
);

-- ============================================================
-- TABLA: organizations (tenants)
-- Una organización = una entidad cliente (INPEC, juzgado, etc.)
-- ============================================================
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  nit           TEXT UNIQUE,                    -- NIT de la entidad
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  city          TEXT,
  department    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  settings      JSONB NOT NULL DEFAULT '{}',   -- config por organización
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: profiles (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  role            user_role NOT NULL,
  full_name       TEXT NOT NULL,
  document_type   TEXT,                         -- CC, CE, pasaporte
  document_number TEXT,
  phone           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- super_admin no tiene organization_id (ve todas)
-- imputado tendrá organization_id de la entidad que lo vigila

-- ============================================================
-- TABLA: cases (un imputado = un caso)
-- ============================================================
CREATE TABLE cases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  imputado_id         UUID NOT NULL REFERENCES profiles(id),  -- el preso
  technician_id       UUID REFERENCES profiles(id),           -- técnico asignado
  supervisor_id       UUID REFERENCES profiles(id),           -- juez/fiscal

  -- Datos del caso
  case_number         TEXT NOT NULL,            -- número expediente judicial
  court               TEXT,                     -- juzgado
  crime_description   TEXT,
  status              case_status NOT NULL DEFAULT 'onboarding',

  -- Domicilio
  address             TEXT NOT NULL,
  city                TEXT NOT NULL,
  department          TEXT NOT NULL,
  -- Geofence: punto central + radio en metros
  location            GEOMETRY(POINT, 4326),
  geofence_radius_m   INTEGER NOT NULL DEFAULT 100,

  -- Reglas de check-in
  checkin_times       JSONB NOT NULL DEFAULT '["08:00","14:00","20:00"]', -- horas UTC
  checkin_window_min  INTEGER NOT NULL DEFAULT 30,   -- minutos de tolerancia
  timezone            TEXT NOT NULL DEFAULT 'America/Bogota',

  -- Umbrales de verificación (configurables por caso)
  face_threshold      NUMERIC(4,3) NOT NULL DEFAULT 0.80,
  scene_threshold     NUMERIC(4,3) NOT NULL DEFAULT 0.82,

  -- Fechas del caso
  start_date          DATE NOT NULL,
  end_date            DATE,                     -- null = indefinido

  onboarding_done_at  TIMESTAMPTZ,              -- cuando el técnico terminó
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: checkpoints (puntos de referencia del domicilio)
-- El técnico los captura durante el onboarding presencial
-- ============================================================
CREATE TABLE checkpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,    -- ej: "Ventana con cortina beige", "Cocina"
  description     TEXT,             -- instrucción para el imputado
  photo_url       TEXT NOT NULL,    -- foto de referencia (Storage)
  embedding       VECTOR(512),      -- CLIP embedding de la foto de referencia
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES profiles(id),  -- técnico
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: checkins (cada verificación programada)
-- ============================================================
CREATE TABLE checkins (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  scheduled_at        TIMESTAMPTZ NOT NULL,     -- cuándo debía hacerse
  window_closes_at    TIMESTAMPTZ NOT NULL,     -- límite de la ventana
  completed_at        TIMESTAMPTZ,
  status              checkin_status NOT NULL DEFAULT 'pending',

  -- Resultados de cada verificación
  face_score          NUMERIC(4,3),
  face_passed         BOOLEAN,
  face_photo_url      TEXT,                     -- selfie capturada

  gps_lat             NUMERIC(10,7),
  gps_lng             NUMERIC(10,7),
  gps_accuracy_m      NUMERIC(8,2),
  gps_passed          BOOLEAN,
  gps_distance_m      NUMERIC(8,2),             -- distancia al centroide
  gps_is_mock         BOOLEAN,                  -- flag anti-spoofing

  scene_checkpoint_id UUID REFERENCES checkpoints(id),  -- cuál punto se pidió
  scene_score         NUMERIC(4,3),
  scene_passed        BOOLEAN,
  scene_photo_url     TEXT,

  -- Score consolidado 0-100
  overall_score       NUMERIC(5,2),
  overall_passed      BOOLEAN,

  -- Metadatos del dispositivo (para anti-spoofing)
  device_id           TEXT,
  app_version         TEXT,
  os_version          TEXT,

  failure_reason      TEXT,                     -- si falló, por qué
  notes               TEXT,                     -- nota del funcionario
  excused_by          UUID REFERENCES profiles(id),
  excused_reason      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: alerts
-- ============================================================
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  checkin_id      UUID REFERENCES checkins(id),
  severity        alert_severity NOT NULL DEFAULT 'warning',
  type            TEXT NOT NULL,      -- 'missed_checkin','gps_out','face_fail','mock_gps', etc.
  message         TEXT NOT NULL,
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  resolved_note   TEXT,
  notified_at     TIMESTAMPTZ,        -- cuándo se envió SMS/email
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: audit_log (append-only — nunca UPDATE ni DELETE)
-- Cadena de custodia legal
-- ============================================================
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  case_id         UUID REFERENCES cases(id),
  actor_id        UUID REFERENCES profiles(id),  -- quién hizo la acción
  actor_role      user_role NOT NULL,
  action          TEXT NOT NULL,       -- 'checkin.completed', 'alert.created', etc.
  entity_type     TEXT NOT NULL,       -- 'checkin', 'case', 'alert'
  entity_id       UUID,
  payload         JSONB,               -- snapshot del estado relevante
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_log es inmutable: bloquear UPDATE y DELETE
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ============================================================
-- TABLA: device_tokens (para push notifications)
-- ============================================================
CREATE TABLE device_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, token)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_cases_organization ON cases(organization_id);
CREATE INDEX idx_cases_imputado ON cases(imputado_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_checkins_case ON checkins(case_id);
CREATE INDEX idx_checkins_scheduled ON checkins(scheduled_at);
CREATE INDEX idx_checkins_status ON checkins(status);
CREATE INDEX idx_alerts_case ON alerts(case_id);
CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX idx_audit_log_case ON audit_log(case_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Índice espacial para geofencing
CREATE INDEX idx_cases_location ON cases USING GIST(location);

-- ============================================================
-- FUNCIONES HELPER para RLS
-- ============================================================

-- Retorna el rol del usuario actual
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Retorna la organización del usuario actual
CREATE OR REPLACE FUNCTION auth_org()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ¿Es super_admin?
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT auth_role() = 'super_admin'
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ¿El caso pertenece a la organización del usuario?
CREATE OR REPLACE FUNCTION case_belongs_to_auth_org(p_case_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE id = p_case_id AND organization_id = auth_org()
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens  ENABLE ROW LEVEL SECURITY;

-- ---- organizations ----
CREATE POLICY "super_admin ve todo" ON organizations
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org members ven su org" ON organizations
  FOR SELECT TO authenticated
  USING (id = auth_org());

-- ---- profiles ----
CREATE POLICY "super_admin ve todo" ON profiles
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org members ven perfiles de su org" ON profiles
  FOR SELECT TO authenticated
  USING (organization_id = auth_org());

CREATE POLICY "usuario ve su propio perfil" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "usuario actualiza su propio perfil" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---- cases ----
CREATE POLICY "super_admin ve todo" ON cases
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org ve sus casos" ON cases
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org()
    AND auth_role() IN ('org_admin', 'officer', 'technician')
  );

CREATE POLICY "supervisor ve casos asignados" ON cases
  FOR SELECT TO authenticated
  USING (
    supervisor_id = auth.uid()
    AND auth_role() = 'supervisor'
  );

CREATE POLICY "imputado ve su caso" ON cases
  FOR SELECT TO authenticated
  USING (
    imputado_id = auth.uid()
    AND auth_role() = 'imputado'
  );

CREATE POLICY "org_admin crea y edita casos" ON cases
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org() AND auth_role() = 'org_admin');

CREATE POLICY "org_admin actualiza casos" ON cases
  FOR UPDATE TO authenticated
  USING (organization_id = auth_org() AND auth_role() = 'org_admin');

-- ---- checkpoints ----
CREATE POLICY "super_admin ve todo" ON checkpoints
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org ve checkpoints de sus casos" ON checkpoints
  FOR SELECT TO authenticated
  USING (
    case_belongs_to_auth_org(case_id)
    AND auth_role() IN ('org_admin', 'officer', 'technician')
  );

CREATE POLICY "supervisor ve checkpoints de sus casos" ON checkpoints
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND supervisor_id = auth.uid()
    )
  );

CREATE POLICY "tecnico crea checkpoints en sus casos" ON checkpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND technician_id = auth.uid()
    )
  );

CREATE POLICY "tecnico elimina checkpoints de sus casos" ON checkpoints
  FOR DELETE TO authenticated
  USING (
    auth_role() = 'technician'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND technician_id = auth.uid()
    )
  );

-- ---- checkins ----
CREATE POLICY "super_admin ve todo" ON checkins
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org ve checkins de sus casos" ON checkins
  FOR SELECT TO authenticated
  USING (
    case_belongs_to_auth_org(case_id)
    AND auth_role() IN ('org_admin', 'officer')
  );

CREATE POLICY "supervisor ve checkins de sus casos" ON checkins
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND supervisor_id = auth.uid()
    )
  );

CREATE POLICY "imputado ve sus propios checkins" ON checkins
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'imputado'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND imputado_id = auth.uid()
    )
  );

-- El imputado SOLO puede insertar, nunca modificar
CREATE POLICY "imputado registra checkin" ON checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'imputado'
    AND EXISTS (
      SELECT 1 FROM cases
      WHERE id = case_id
        AND imputado_id = auth.uid()
        AND status = 'active'
    )
  );

-- ---- alerts ----
CREATE POLICY "super_admin ve todo" ON alerts
  FOR ALL TO authenticated
  USING (is_super_admin());

CREATE POLICY "org ve alertas de sus casos" ON alerts
  FOR SELECT TO authenticated
  USING (
    case_belongs_to_auth_org(case_id)
    AND auth_role() IN ('org_admin', 'officer')
  );

CREATE POLICY "supervisor ve alertas de sus casos" ON alerts
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND supervisor_id = auth.uid()
    )
  );

CREATE POLICY "officer y org_admin resuelven alertas" ON alerts
  FOR UPDATE TO authenticated
  USING (
    case_belongs_to_auth_org(case_id)
    AND auth_role() IN ('org_admin', 'officer')
  );

-- ---- audit_log ----
-- Solo lectura para roles autorizados. Nadie puede insertar directo (solo via service role).
CREATE POLICY "super_admin ve todo el audit" ON audit_log
  FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY "org ve su audit" ON audit_log
  FOR SELECT TO authenticated
  USING (
    organization_id = auth_org()
    AND auth_role() IN ('org_admin', 'officer')
  );

CREATE POLICY "supervisor ve audit de sus casos" ON audit_log
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM cases WHERE id = case_id AND supervisor_id = auth.uid()
    )
  );

-- ---- device_tokens ----
CREATE POLICY "usuario gestiona sus propios tokens" ON device_tokens
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "super_admin ve todo" ON device_tokens
  FOR ALL TO authenticated
  USING (is_super_admin());

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER: crear perfil al registrar usuario en Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'imputado'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

