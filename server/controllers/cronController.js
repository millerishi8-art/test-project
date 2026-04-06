import { runDeferredPaymentReminderJob } from '../jobs/deferredPaymentReminders.js';
import { secureCompare } from '../utils/auth.js';

/**
 * GET /api/cron/deferred-payment-reminders
 * אבטחה: CRON_SECRET ב-query (?secret=) או Authorization: Bearer <CRON_SECRET>
 * לשימוש Vercel Cron או שירות תזמון חיצוני.
 */
export const triggerDeferredPaymentReminders = async (req, res) => {
  try {
    const secret = (process.env.CRON_SECRET || '').trim();
    if (!secret) {
      return res
        .status(503)
        .json({ error: 'CRON_SECRET is not configured on this deployment' });
    }

    const auth = (req.headers.authorization || '').trim();
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const q = (req.query.secret || '').trim();

    const bearerOk = bearer.length > 0 && secureCompare(bearer, secret);
    const queryOk = q.length > 0 && secureCompare(q, secret);
    if (!bearerOk && !queryOk) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await runDeferredPaymentReminderJob();
    return res.json(result);
  } catch (error) {
    console.error('triggerDeferredPaymentReminders:', error);
    return res.status(500).json({ error: error?.message || 'Job failed' });
  }
};
