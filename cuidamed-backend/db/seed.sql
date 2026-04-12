-- ═══════════════════════════════════════════════════════════
--  CUIDAMED — Datos demo
--  Ejecutar después de migrate.js
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  maria_id  UUID;
  bmo_id    UUID;
  los_id    UUID;
  met_id    UUID;
  nap_id    UUID;
BEGIN

-- ── Paciente demo ─────────────────────────────────────────────────────────────
INSERT INTO users (id, cedula, name, phone) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001',
   '1234567890',
   'María García',
   '+57 310 000 0001')
ON CONFLICT (cedula) DO NOTHING;

SELECT id INTO maria_id FROM users WHERE cedula = '1234567890';

-- ── Medicamentos ──────────────────────────────────────────────────────────────
INSERT INTO medications (id, patient_id, name, dose_mg, frequency, compartment, scheduled_time, period_days, notes)
VALUES
  ('b1000000-0000-0000-0000-000000000001', maria_id,
   'Losartán',   50,  'daily',       1, '12:00', 30, 'Tomar con el almuerzo'),
  ('b1000000-0000-0000-0000-000000000002', maria_id,
   'Metformina', 500, 'twice_daily', 2, '20:00', 30, 'Tomar con la cena'),
  ('b1000000-0000-0000-0000-000000000003', maria_id,
   'Naproxeno',  50,  'daily',       3, '06:30', 30, 'En caso de dolor')
ON CONFLICT DO NOTHING;

SELECT id INTO los_id FROM medications WHERE name='Losartán'   AND patient_id=maria_id;
SELECT id INTO met_id FROM medications WHERE name='Metformina' AND patient_id=maria_id;
SELECT id INTO nap_id FROM medications WHERE name='Naproxeno'  AND patient_id=maria_id;

-- ── Dispositivo BMO ───────────────────────────────────────────────────────────
INSERT INTO bmo_devices (id, patient_id, device_code, location, connected, battery_pct, firmware_ver)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  maria_id, 'BMO-2024-001', 'Sala de María', true, 92, 'v1.2.0'
) ON CONFLICT (device_code) DO NOTHING;

SELECT id INTO bmo_id FROM bmo_devices WHERE device_code = 'BMO-2024-001';

-- ── Compartimentos ────────────────────────────────────────────────────────────
INSERT INTO bmo_compartments (device_id, slot_number, medication_id, stock_pct)
VALUES
  (bmo_id, 1, los_id, 78),
  (bmo_id, 2, met_id, 55),
  (bmo_id, 3, nap_id, 18),
  (bmo_id, 4, NULL,   0)
ON CONFLICT (device_id, slot_number) DO UPDATE
  SET medication_id = EXCLUDED.medication_id,
      stock_pct     = EXCLUDED.stock_pct;

-- ── Dosis historial (últimos 7 días) ─────────────────────────────────────────
-- Día -6 al -2: todo tomado
INSERT INTO doses (medication_id, scheduled_at, taken_at, status, marked_by)
SELECT id,
  NOW() - (n || ' days')::interval + scheduled_time::interval,
  NOW() - (n || ' days')::interval + scheduled_time::interval + interval '3 minutes',
  'taken', 'patient'
FROM medications, generate_series(2, 6) AS n
WHERE patient_id = maria_id
ON CONFLICT DO NOTHING;

-- Día -1: Naproxeno olvidado
INSERT INTO doses (medication_id, scheduled_at, taken_at, status, marked_by)
SELECT id,
  NOW() - interval '1 day' + scheduled_time::interval,
  CASE WHEN name != 'Naproxeno'
    THEN NOW() - interval '1 day' + scheduled_time::interval + interval '2 minutes'
    ELSE NULL END,
  CASE WHEN name != 'Naproxeno' THEN 'taken' ELSE 'missed' END,
  CASE WHEN name != 'Naproxeno' THEN 'patient' ELSE NULL END
FROM medications WHERE patient_id = maria_id
ON CONFLICT DO NOTHING;

-- Hoy: Losartán tomada, Metformina pendiente, Naproxeno olvidada
INSERT INTO doses (medication_id, scheduled_at, taken_at, status, marked_by)
VALUES
  (los_id, CURRENT_DATE + TIME '12:00', CURRENT_DATE + TIME '12:03', 'taken',   'patient'),
  (met_id, CURRENT_DATE + TIME '20:00', NULL,                         'pending', NULL),
  (nap_id, CURRENT_DATE + TIME '06:30', NULL,                         'missed',  NULL)
ON CONFLICT DO NOTHING;

-- ── Notificaciones demo ───────────────────────────────────────────────────────
INSERT INTO notifications (user_id, type, title, message, read) VALUES
  (maria_id, 'dose_missed',   'Pastilla no tomada',
   'No tomaste Naproxeno a las 6:30 am.', false),
  (maria_id, 'dose_reminder', 'Pronto tienes que tomar tu pastilla',
   'Metformina 500mg en 30 minutos — Compartimento 2', false),
  (maria_id, 'dose_taken',    '¡Dosis registrada!',
   'Tomaste Losartán correctamente.', true),
  (maria_id, 'low_stock',     'Pocas pastillas',
   'Quedan pocas pastillas de Naproxeno (18%).', true)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Seed completado. Paciente demo: cédula 1234567890';

END $$;