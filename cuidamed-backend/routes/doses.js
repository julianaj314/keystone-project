const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/today', async (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patient_id;
  if (!patientId) return res.status(400).json({ error: 'Se requiere patient_id' });
  try {
    const result = await db.query(
      `SELECT d.*, m.name AS medication_name, m.dose_mg, m.compartment
       FROM doses d JOIN medications m ON m.id = d.medication_id
       WHERE m.patient_id = $1 AND d.scheduled_at::date = CURRENT_DATE
       ORDER BY d.scheduled_at`,
      [patientId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', async (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patient_id;
  const days      = parseInt(req.query.days) || 7;
  if (!patientId) return res.status(400).json({ error: 'Se requiere patient_id' });
  try {
    const result = await db.query(
      `SELECT d.*, m.name AS medication_name, m.dose_mg, m.compartment
       FROM doses d JOIN medications m ON m.id = d.medication_id
       WHERE m.patient_id = $1 AND d.scheduled_at >= NOW() - INTERVAL '${days} days'
       ORDER BY d.scheduled_at DESC`,
      [patientId]
    );
    const grouped = result.rows.reduce((acc, dose) => {
      const date = dose.scheduled_at.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(dose);
      return acc;
    }, {});
    res.json(grouped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/adherence', async (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patient_id;
  const days      = parseInt(req.query.days) || 7;
  if (!patientId) return res.status(400).json({ error: 'Se requiere patient_id' });
  try {
    const result = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status='taken')   AS taken,
         COUNT(*) FILTER (WHERE status='missed')  AS missed,
         COUNT(*) FILTER (WHERE status='pending') AS pending,
         ROUND(COUNT(*) FILTER (WHERE status='taken') * 100.0
           / NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 1) AS adherence_pct
       FROM doses d JOIN medications m ON m.id = d.medication_id
       WHERE m.patient_id = $1 AND d.scheduled_at >= NOW() - INTERVAL '${days} days'`,
      [patientId]
    );
    const streak = await db.query(
      `WITH daily AS (
         SELECT d.scheduled_at::date AS day, BOOL_AND(d.status='taken') AS all_taken
         FROM doses d JOIN medications m ON m.id = d.medication_id
         WHERE m.patient_id = $1 GROUP BY day ORDER BY day DESC
       )
       SELECT COUNT(*) AS streak FROM (
         SELECT day FROM daily WHERE all_taken=true ORDER BY day DESC
       ) s`,
      [patientId]
    );
    res.json({ ...result.rows[0], streak_days: parseInt(streak.rows[0].streak) || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/take', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE doses SET status='taken', taken_at=NOW(), marked_by=$1
       WHERE id=$2 RETURNING *`,
      [req.user.role, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Dosis no encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/generate', async (req, res) => {
  try {
    const meds = await db.query('SELECT id, scheduled_time FROM medications WHERE active=true');
    let created = 0;
    for (const med of meds.rows) {
      const scheduledAt = new Date();
      const [h, m] = med.scheduled_time.split(':');
      scheduledAt.setHours(parseInt(h), parseInt(m), 0, 0);
      const exists = await db.query(
        'SELECT id FROM doses WHERE medication_id=$1 AND scheduled_at::date=CURRENT_DATE',
        [med.id]
      );
      if (!exists.rows.length) {
        await db.query('INSERT INTO doses (medication_id, scheduled_at) VALUES ($1,$2)', [med.id, scheduledAt]);
        created++;
      }
    }
    res.json({ message: `${created} dosis generadas` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;