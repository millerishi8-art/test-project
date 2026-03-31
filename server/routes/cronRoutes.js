import { Router } from 'express';
import { triggerDeferredPaymentReminders } from '../controllers/cronController.js';

const router = Router();

router.get('/cron/deferred-payment-reminders', triggerDeferredPaymentReminders);

export default router;
