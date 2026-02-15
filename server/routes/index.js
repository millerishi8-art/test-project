import { Router } from 'express';
import authRoutes from './authRoutes.js';
import casesRoutes from './casesRoutes.js';
import adminRoutes from './adminRoutes.js';
import benefitsRoutes from './benefitsRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

router.use(authRoutes);
router.use('/cases', casesRoutes);
router.use('/benefits', benefitsRoutes);
router.use('/admin', adminRoutes);

export default router;
