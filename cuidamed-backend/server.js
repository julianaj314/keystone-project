require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── Middlewares ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/medications',   require('./routes/medications'));
app.use('/api/doses',         require('./routes/doses'));
app.use('/api/bmo',           require('./routes/bmo'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/caregiver',     require('./routes/caregiver'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', project: 'Cuidamed', version: '1.0.0' });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

// ── Arrancar ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cuidamed API corriendo en http://localhost:${PORT}`);
});