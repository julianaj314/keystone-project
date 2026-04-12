const cron = require('node-cron');
const db   = require('../db');
const { createNotification, notifyCaregivers } = require('./notifications');

function startScheduler() {

  // ── 1. Generar dosis del día — cada día a las 00:01 ──────────────────────
  cron.schedule('1 0 * * *', async () => {
    console.log('[Scheduler] Generando dosis del día...');
    try {
      const meds = await db.query(
        `SELECT id, scheduled_time, patient_id FROM medications WHERE active = true`
      );
      for (const med of meds.rows) {
        const scheduledAt = new Date();
        const [h, m] = med.scheduled_time.split(':');
        scheduledAt.setHours(parseInt(h), parseInt(m), 0, 0);

        const exists = await db.query(
          `SELECT id FROM doses WHERE medication_id = $1 AND scheduled_at::date = CURRENT_DATE`,
          [med.id]
        );
        if (!exists.rows.length) {
          await db.query(
            `INSERT INTO doses (medication_id, scheduled_at) VALUES ($1, $2)`,
            [med.id, scheduledAt]
          );
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error generando dosis:', err.message);
    }
  });

  // ── 2. Recordatorio 30 min antes de cada dosis — cada minuto ──────────────
  cron.schedule('* * * * *', async () => {
    try {
      const upcoming = await db.query(
        `SELECT d.id, d.scheduled_at, m.name AS med_name, m.patient_id, m.compartment
         FROM doses d
         JOIN medications m ON m.id = d.medication_id
         WHERE d.status = 'pending'
           AND d.scheduled_at BETWEEN NOW() + INTERVAL '29 minutes'
                                   AND NOW() + INTERVAL '31 minutes'`
      );
      for (const dose of upcoming.rows) {
        await createNotification(
          dose.patient_id,
          'dose_reminder',
          'Pronto tienes que tomar tu pastilla',
          `${dose.med_name} en 30 minutos — Compartimento ${dose.compartment ?? '—'}`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error en recordatorio 30 min:', err.message);
    }
  });

  // ── 3. Detectar dosis olvidadas — cada 5 minutos ──────────────────────────
  // Si la dosis pasó hace más de 45 min y sigue en 'pending' → missed + alertas
  cron.schedule('*/5 * * * *', async () => {
    try {
      const missed = await db.query(
        `UPDATE doses SET status = 'missed'
         WHERE status = 'pending'
           AND scheduled_at < NOW() - INTERVAL '45 minutes'
         RETURNING id, medication_id, scheduled_at`
      );

      for (const dose of missed.rows) {
        const med = await db.query(
          `SELECT name, patient_id, compartment FROM medications WHERE id = $1`,
          [dose.medication_id]
        );
        if (!med.rows.length) continue;
        const { name, patient_id, compartment } = med.rows[0];

        // Notificar al paciente
        await createNotification(
          patient_id,
          'dose_missed',
          'Pastilla no tomada',
          `No tomaste ${name}. Tu cuidador fue notificado.`
        );

        // Notificar a cuidadores con urgencia
        await notifyCaregivers(
          patient_id,
          'caregiver_alert',
          `Alerta: ${name} no fue tomada`,
          `Han pasado 45 min desde la hora programada (${dose.scheduled_at.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}) y no hay registro en el BMO.`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error detectando dosis olvidadas:', err.message);
    }
  });

  // ── 4. Resumen semanal para cuidadores — domingos a las 8 pm ──────────────
  cron.schedule('0 20 * * 0', async () => {
    console.log('[Scheduler] Enviando resúmenes semanales...');
    try {
      const links = await db.query(
        `SELECT cl.caregiver_id, cl.patient_id, u.name AS patient_name
         FROM caregiver_links cl
         JOIN users u ON u.id = cl.patient_id`
      );

      for (const link of links.rows) {
        const stats = await db.query(
          `SELECT
             ROUND(COUNT(*) FILTER (WHERE status='taken') * 100.0
               / NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0), 0) AS pct
           FROM doses d
           JOIN medications m ON m.id = d.medication_id
           WHERE m.patient_id = $1
             AND d.scheduled_at >= NOW() - INTERVAL '7 days'`,
          [link.patient_id]
        );
        const pct = stats.rows[0].pct || 0;
        await createNotification(
          link.caregiver_id,
          'weekly_summary',
          `Resumen semanal de ${link.patient_name}`,
          `${link.patient_name} tomó el ${pct}% de sus dosis esta semana.`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error en resumen semanal:', err.message);
    }
  });

  console.log('[Scheduler] Tareas programadas activas.');
}

module.exports = { startScheduler };
