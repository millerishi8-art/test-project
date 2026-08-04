import { Router } from 'express';
import {
  submitCase,
  submitCardOrder,
  uploadCaseAttachment,
  getMyCases,
  renewCase,
  requestDeferredPayment,
  submitDeferredPaymentProposedDeadline,
} from '../controllers/casesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/upload-attachment', uploadCaseAttachment);
router.post('/card-order', submitCardOrder);
router.post('/', submitCase);
router.post('/defer-payment-request', requestDeferredPayment);
router.post('/defer-payment-proposed-deadline', submitDeferredPaymentProposedDeadline);
router.get('/', getMyCases);
router.put('/:caseId/renew', renewCase);

export default router;
