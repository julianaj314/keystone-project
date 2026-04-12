const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/by-cedula/:cedula', async (req, res) => {
  const { cedula } = req.params;
  try {
    const result = await db.query(
      'SELECT id, cedula, name, phone FROM users WHERE cedula = $1', [cedula]
    );
    if (!result.rows.length) return res.status(404).json({ exists: false });
    res.json({ exists: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login-cedula', async (req, res) => {
  const { cedula } = req.body;
  if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });
  try {
    const result = await db.query(
      'SELECT id, cedula, name, phone FROM users WHERE cedula = $1', [cedula]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Paciente no encontrado' });
    const user  = result.rows[0];
    const token = jwt.sign({ id: user.id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/register-patient', async (req, res) => {
  const { cedula, name, phone } = req.body;
  if (!cedula || !name) return res.status(400).json({ error: 'Cédula y nombre requeridos' });
  try {
    const exists = await db.query('SELECT id FROM users WHERE cedula = $1', [cedula]);
    if (exists.rows.length) return res.status(409).json({ error: 'Cédula ya registrada' });
    const result = await db.query(
      'INSERT INTO users (cedula, name, phone) VALUES ($1, $2, $3) RETURNING id, cedula, name, phone',
      [cedula, name.trim(), phone || null]
    );
    const user  = result.rows[0];
    const token = jwt.sign({ id: user.id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/caregiver-access', async (req, res) => {
  const { cedula } = req.body;
  if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });
  try {
    const result = await db.query(
      'SELECT id, cedula, name FROM users WHERE cedula = $1', [cedula]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Paciente no encontrado' });
    const patient = result.rows[0];
    const token   = jwt.sign({ id: patient.id, role: 'caregiver', patient_id: patient.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ patient, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, cedula, name, phone, created_at FROM users WHERE id = $1', [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ...result.rows[0], role: req.user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;