import { Router } from 'express';
import { submitCase, getMyCases, renewCase, requestDeferredPayment } from '../controllers/casesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/', submitCase);
router.post('/defer-payment-request', requestDeferredPayment);
router.get('/', getMyCases);
router.put('/:caseId/renew', renewCase);

export default router;
