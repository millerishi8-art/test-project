import { Router } from 'express';
import {
  submitCase,
  getMyCases,
  renewCase,
  requestDeferredPayment,
  submitDeferredPaymentProposedDeadline,
} from '../controllers/casesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/', submitCase);
router.post('/defer-payment-request', requestDeferredPayment);
router.post('/defer-payment-proposed-deadline', submitDeferredPaymentProposedDeadline);
router.get('/', getMyCases);
router.put('/:caseId/renew', renewCase);

export default router;
