const db = require('../db');

// Crea una notificación en la base de datos
async function createNotification(userId, type, title, message) {
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES ($1, $2, $3, $4)`,
    [userId, type, title, message]
  );
}

// Notifica a todos los cuidadores vinculados a un paciente
async function notifyCaregivers(patientId, type, title, message) {
  const result = await db.query(
    'SELECT caregiver_id FROM caregiver_links WHERE patient_id = $1',
    [patientId]
  );
  for (const { caregiver_id } of result.rows) {
    await createNotification(caregiver_id, type, title, message);
  }
}

module.exports = { createNotification, notifyCaregivers };
