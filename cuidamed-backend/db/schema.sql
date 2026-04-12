-- ═══════════════════════════════════════════════════════════
--  CUIDAMED — Esquema de base de datos PostgreSQL
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Usuarios (solo pacientes, sin contraseña) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cedula       VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ── Medicamentos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  dose_mg         DECIMAL(10,2),
  frequency       VARCHAR(50) NOT NULL DEFAULT 'daily',
  compartment     SMALLINT CHECK (compartment BETWEEN 1 AND 8),
  scheduled_time  TIME NOT NULL,
  period_days     INT DEFAULT 30,
  notes           TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── Dosis ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMP NOT NULL,
  taken_at        TIMESTAMP,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'taken', 'missed', 'skipped')),
  marked_by       VARCHAR(20) DEFAULT 'patient',
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Dispositivo BMO ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bmo_devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_code   VARCHAR(50) UNIQUE NOT NULL,
  location      VARCHAR(100),
  connected     BOOLEAN DEFAULT FALSE,
  battery_pct   SMALLINT DEFAULT 100 CHECK (battery_pct BETWEEN 0 AND 100),
  firmware_ver  VARCHAR(20),
  last_sync     TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Compartimentos del BMO ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bmo_compartments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID NOT NULL REFERENCES bmo_devices(id) ON DELETE CASCADE,
  slot_number   SMALLINT NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
  medication_id UUID REFERENCES medications(id),
  stock_pct     SMALLINT DEFAULT 100 CHECK (stock_pct BETWEEN 0 AND 100),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (device_id, slot_number)
);

-- ── Notificaciones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doses_medication ON doses(medication_id);
CREATE INDEX IF NOT EXISTS idx_doses_scheduled  ON doses(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_doses_status     ON doses(status);
CREATE INDEX IF NOT EXISTS idx_notifs_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_read      ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_meds_patient     ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_users_cedula     ON users(cedula);