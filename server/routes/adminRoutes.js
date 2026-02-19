import { Router } from 'express';
import { getAllCases, getCaseById, getAllUsers, confirmCaseCompleted, demoteAdmin } from '../controllers/adminController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(isAdmin);

router.get('/cases', getAllCases);
router.get('/cases/:id', getCaseById);
router.patch('/cases/:id/confirm-completed', confirmCaseCompleted);
router.get('/users', getAllUsers);
router.patch('/users/:id/demote', demoteAdmin);

export default router;
