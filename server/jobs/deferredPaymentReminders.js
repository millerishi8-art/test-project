import cron from 'node-cron';
import { connectToMongoDB } from '../db/mongodb.js';
import { readUsers, updateUserById } from '../models/User.js';
import {
  parseYyyyMmDd,
  todayIsraelYyyyMmDd,
  daysBetweenYmd,
} from '../utils/deferredPaymentDates.js';
import {
  sendDeferredPaymentWeeklyReminderEmail,
  sendDeferredPaymentDueDateFinalWarningEmail,
} from '../services/email.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ריצה יומית: תזכורת שבועית למי שמועד פירעון עתידי; ביום הפירעון — מייל אזהרת יום אחרון (פעם אחת).
 */
export async function runDeferredPaymentReminderJob() {
  await connectToMongoDB();
  const users = await readUsers();
  const todayIl = todayIsraelYyyyMmDd();
  const now = Date.now();

  let weeklySent = 0;
  let lastDaySent = 0;
  let skippedPastDeadline = 0;

  for (const user of users) {
    if (!user.deferredPaymentApproved || !user.deferredPaymentDeadline) continue;

    const deadlineYmd = parseYyyyMmDd(user.deferredPaymentDeadline);
    if (!deadlineYmd) continue;

    if (deadlineYmd < todayIl) {
      skippedPastDeadline++;
      continue;
    }

    const email = (user.email || '').trim();
    if (!email) continue;

    if (deadlineYmd === todayIl) {
      if (user.deferredPaymentDueDateWarningSentAt) continue;
      const ok = await sendDeferredPaymentDueDateFinalWarningEmail(email, user.name, deadlineYmd);
      if (ok) {
        await updateUserById(user.id, {
          deferredPaymentDueDateWarningSentAt: new Date().toISOString(),
        });
        lastDaySent++;
      }
      continue;
    }

    const daysLeft = daysBetweenYmd(todayIl, deadlineYmd);
    const approvedMs = user.deferredPaymentApprovedAt
      ? new Date(user.deferredPaymentApprovedAt).getTime()
      : 0;
    const lastWeeklyMs = user.deferredPaymentWeeklyReminderLastAt
      ? new Date(user.deferredPaymentWeeklyReminderLastAt).getTime()
      : 0;

    let shouldWeekly = false;
    if (!user.deferredPaymentWeeklyReminderLastAt) {
      if (!approvedMs) continue;
      const sinceApproval = now - approvedMs;
      if (sinceApproval >= WEEK_MS) shouldWeekly = true;
      else if (daysLeft < 7 && sinceApproval >= ONE_DAY_MS) shouldWeekly = true;
    } else if (now - lastWeeklyMs >= WEEK_MS) {
      shouldWeekly = true;
    }

    if (shouldWeekly) {
      const ok = await sendDeferredPaymentWeeklyReminderEmail(email, user.name, deadlineYmd);
      if (ok) {
        await updateUserById(user.id, {
          deferredPaymentWeeklyReminderLastAt: new Date().toISOString(),
        });
        weeklySent++;
      }
    }
  }

  const summary = `[DeferredPaymentReminders] ${todayIl} weekly=${weeklySent} lastDay=${lastDaySent} pastDeadline=${skippedPastDeadline}`;
  console.log(summary);
  return { ok: true, todayIl, weeklySent, lastDaySent, skippedPastDeadline };
}

/** מתזמן cron להרצה מקומית / שרת שרץ ברציפות (לא ב-Vercel serverless) */
export function scheduleDeferredPaymentReminders() {
  const expr =
    (process.env.DEFERRED_PAYMENT_REMINDER_CRON || '0 6 * * *').trim() || '0 6 * * *';

  cron.schedule(
    expr,
    async () => {
      try {
        await runDeferredPaymentReminderJob();
      } catch (e) {
        console.error('[DeferredPaymentReminders] job error:', e?.message || e);
      }
    },
    { timezone: process.env.CRON_TZ || 'Asia/Jerusalem' }
  );

  console.log(
    `[DeferredPaymentReminders] Scheduled cron "${expr}" (${process.env.CRON_TZ || 'Asia/Jerusalem'})`
  );
}
