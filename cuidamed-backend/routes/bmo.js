const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/bmo?patient_id=
router.get('/', async (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patient_id;
  if (!patientId) return res.status(400).json({ error: 'Se requiere patient_id' });
  try {
    const device = await db.query(
      'SELECT * FROM bmo_devices WHERE patient_id=$1 LIMIT 1',
      [patientId]
    );
    if (!device.rows.length)
      return res.status(404).json({ error: 'Dispositivo BMO no encontrado' });

    const compartments = await db.query(
      `SELECT bc.*, m.name AS medication_name, m.dose_mg
       FROM bmo_compartments bc
       LEFT JOIN medications m ON m.id = bc.medication_id
       WHERE bc.device_id=$1
       ORDER BY bc.slot_number`,
      [device.rows[0].id]
    );
    res.json({ device: device.rows[0], compartments: compartments.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/bmo/register
router.post('/register', async (req, res) => {
  const { device_code, location, patient_id } = req.body;
  const targetPatient = req.user.role === 'patient' ? req.user.id : patient_id;
  if (!device_code) return res.status(400).json({ error: 'device_code requerido' });
  try {
    const result = await db.query(
      `INSERT INTO bmo_devices (patient_id, device_code, location)
       VALUES ($1,$2,$3)
       ON CONFLICT (device_code) DO UPDATE SET location=$3
       RETURNING *`,
      [targetPatient, device_code, location || 'Sin ubicación']
    );
    for (let slot = 1; slot <= 4; slot++) {
      await db.query(
        `INSERT INTO bmo_compartments (device_id, slot_number)
         VALUES ($1,$2) ON CONFLICT (device_id, slot_number) DO NOTHING`,
        [result.rows[0].id, slot]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/bmo/heartbeat
router.patch('/heartbeat', async (req, res) => {
  const { device_code, battery_pct, connected } = req.body;
  if (!device_code) return res.status(400).json({ error: 'device_code requerido' });
  try {
    const result = await db.query(
      `UPDATE bmo_devices
       SET connected=$1, battery_pct=COALESCE($2,battery_pct), last_sync=NOW()
       WHERE device_code=$3 RETURNING *`,
      [connected ?? true, battery_pct ?? null, device_code]
    );
    res.json(result.rows[0] || { error: 'Dispositivo no encontrado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/bmo/compartment/:id
router.patch('/compartment/:id', async (req, res) => {
  const { stock_pct, medication_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE bmo_compartments
       SET stock_pct=COALESCE($1,stock_pct),
           medication_id=COALESCE($2,medication_id),
           updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [stock_pct ?? null, medication_id || null, req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Compartimento no encontrado' });

    // Alertas automáticas de stock bajo
    const comp = result.rows[0];
    if (comp.stock_pct !== null && comp.medication_id) {
      const med = await db.query(
        `SELECT m.name, m.patient_id FROM medications m WHERE id=$1`,
        [comp.medication_id]
      );
      if (med.rows.length) {
        const { name, patient_id } = med.rows[0];
        if (comp.stock_pct <= 5) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES ($1,'empty_slot','Compartimento vacío',$2)`,
            [patient_id, `El compartimento ${comp.slot_number} (${name}) está vacío.`]
          );
        } else if (comp.stock_pct <= 20) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES ($1,'low_stock','Pocas pastillas',$2)`,
            [patient_id, `${name} está al ${comp.stock_pct}% en el compartimento ${comp.slot_number}.`]
          );
        }
      }
    }
    res.json(comp);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;