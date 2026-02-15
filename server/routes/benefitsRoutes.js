import { Router } from 'express';
import { getBenefits } from '../controllers/benefitsController.js';

const router = Router();

router.get('/', getBenefits);

export default router;
