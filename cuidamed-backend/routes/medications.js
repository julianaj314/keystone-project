const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Helper: get the correct patient_id regardless of role
function getPatientId(req, source = 'query') {
  if (req.user.role === 'patient') return req.user.id;
  // For caregiver: id in token IS the patient id (see auth.js caregiver-access)
  if (req.user.role === 'caregiver') return req.user.id;
  // Fallback to query or body
  return source === 'query' ? req.query.patient_id : req.body.patient_id;
}

router.get('/', async (req, res) => {
  const patientId = getPatientId(req, 'query');
  if (!patientId) return res.status(400).json({ error: 'Se requiere patient_id' });
  try {
    const result = await db.query(
      `SELECT m.*, bc.stock_pct FROM medications m
       LEFT JOIN bmo_compartments bc ON bc.medication_id = m.id
       WHERE m.patient_id = $1 AND m.active = true
       ORDER BY m.scheduled_time`,
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /medications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const patientId = getPatientId(req, 'body');
  const { name, dose_mg, frequency, compartment, scheduled_time, notes } = req.body;
  if (!name)           return res.status(400).json({ error: 'El nombre es requerido' });
  if (!scheduled_time) return res.status(400).json({ error: 'La hora es requerida' });
  if (!patientId)      return res.status(400).json({ error: 'patient_id requerido' });
  try {
    const result = await db.query(
      `INSERT INTO medications (patient_id, name, dose_mg, frequency, compartment, scheduled_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [patientId, name, dose_mg||null, frequency||'daily', compartment||null, scheduled_time, notes||null]
    );
    console.log('Medication created:', result.rows[0].name, 'for patient:', patientId);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /medications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, dose_mg, frequency, compartment, scheduled_time, notes, active } = req.body;
  try {
    const result = await db.query(
      `UPDATE medications SET
         name           = COALESCE($1, name),
         dose_mg        = COALESCE($2, dose_mg),
         frequency      = COALESCE($3, frequency),
         compartment    = COALESCE($4, compartment),
         scheduled_time = COALESCE($5, scheduled_time),
         notes          = COALESCE($6, notes),
         active         = COALESCE($7, active),
         updated_at     = NOW()
       WHERE id = $8 RETURNING *`,
      [name, dose_mg, frequency, compartment, scheduled_time, notes, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /medications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE medications SET active=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ message: 'Medicamento desactivado' });
  } catch (err) {
    console.error('DELETE /medications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;