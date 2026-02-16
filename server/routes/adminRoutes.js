import { Router } from 'express';
import { getAllCases, getCaseById, getAllUsers } from '../controllers/adminController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(isAdmin);

router.get('/cases', getAllCases);
router.get('/cases/:id', getCaseById);
router.get('/users', getAllUsers);

export default router;
