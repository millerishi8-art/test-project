import { Router } from 'express';
import { getAllCases, getCaseById, getAllUsers, confirmCaseCompleted, updateCaseStatus, demoteAdmin, deleteCasePermanent } from '../controllers/adminController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(isAdmin);

router.get('/cases', getAllCases);
router.get('/cases/:id', getCaseById);
router.patch('/cases/:id', updateCaseStatus);
router.patch('/cases/:id/confirm-completed', confirmCaseCompleted);
router.delete('/cases/:id', deleteCasePermanent);
router.get('/users', getAllUsers);
router.patch('/users/:id/demote', demoteAdmin);

export default router;
