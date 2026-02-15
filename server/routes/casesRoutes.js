import { Router } from 'express';
import { submitCase, getMyCases, renewCase } from '../controllers/casesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/', submitCase);
router.get('/', getMyCases);
router.put('/:caseId/renew', renewCase);

export default router;
