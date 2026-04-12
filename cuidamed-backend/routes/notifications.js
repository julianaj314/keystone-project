const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  const limit  = parseInt(req.query.limit) || 30;
  const unread = req.query.unread === 'true';
  try {
    const result = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 ${unread ? 'AND read = false' : ''}
       ORDER BY created_at DESC LIMIT $2`,
      [req.user.id, limit]
    );
    const countRes = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=false',
      [req.user.id]
    );
    res.json({
      notifications: result.rows,
      unread_count:  parseInt(countRes.rows[0].count)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read=true WHERE user_id=$1',
      [req.user.id]
    );
    res.json({ message: 'Todas marcadas como leídas' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notificación leída' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;