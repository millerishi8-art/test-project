import { Router } from 'express';
import { getAllCases, getCaseById, getAllUsers, confirmCaseCompleted, updateCaseStatus, updateCaseProcessing, deleteCasePermanent, patchUserDeferredPayment, getEmployeePayouts, settleEmployeePayout } from '../controllers/adminController.js';
import {
  listEmployeeCases,
  createEmployeeCaseEntry,
  setEmployeeCasePaid,
  resetPaidEmployeeCases,
} from '../controllers/employeeCasesController.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(isAdmin);

router.get('/cases', getAllCases);
router.get('/cases/:id', getCaseById);
router.patch('/cases/:id', updateCaseStatus);
router.patch('/cases/:id/processing', updateCaseProcessing);
router.patch('/cases/:id/confirm-completed', confirmCaseCompleted);
router.delete('/cases/:id', deleteCasePermanent);
router.get('/users', getAllUsers);
router.patch('/users/:id/deferred-payment', patchUserDeferredPayment);
router.get('/payouts', getEmployeePayouts);
router.post('/payouts/settle', settleEmployeePayout);

/** מעקב כייסי מנהלים (ראיונות / הגשת טפסים) + תשלומים */
router.get('/employee-cases', listEmployeeCases);
router.post('/employee-cases', createEmployeeCaseEntry);
router.post('/employee-cases/reset-paid', resetPaidEmployeeCases);
router.patch('/employee-cases/:id/paid', setEmployeeCasePaid);

export default router;
