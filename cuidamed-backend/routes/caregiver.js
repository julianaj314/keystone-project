const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/caregiver/patient-summary?patient_id=
// Resumen del paciente para el dashboard del cuidador
router.get('/patient-summary', async (req, res) => {
  const patientId = req.query.patient_id || req.user.id;
  try {
    const patient = await db.query(
      'SELECT id, cedula, name, phone FROM users WHERE id=$1',
      [patientId]
    );
    if (!patient.rows.length)
      return res.status(404).json({ error: 'Paciente no encontrado' });

    const stats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='taken')   AS taken,
         COUNT(*) FILTER (WHERE status='missed')  AS missed,
         COUNT(*) FILTER (WHERE status='pending') AS pending
       FROM doses d
       JOIN medications m ON m.id = d.medication_id
       WHERE m.patient_id=$1 AND d.scheduled_at::date=CURRENT_DATE`,
      [patientId]
    );
    res.json({
      patient:        patient.rows[0],
      today_taken:    parseInt(stats.rows[0].taken),
      today_missed:   parseInt(stats.rows[0].missed),
      today_pending:  parseInt(stats.rows[0].pending)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;