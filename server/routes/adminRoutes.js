import { Router } from 'express';
import {
  getAllCases,
  getCaseById,
  getAllUsers,
  confirmCaseCompleted,
  updateCaseStatus,
  updateCaseProcessing,
  updateCaseHraDetails,
  addCaseInterimNote,
  updateCaseInterimNote,
  deleteCaseInterimNote,
  deleteCasePermanent,
  patchUserDeferredPayment,
  getEmployeePayouts,
  settleEmployeePayout,
  getUnseenAdminNotices,
  ackAdminNotice,
} from '../controllers/adminController.js';
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
router.get('/notices/unseen', getUnseenAdminNotices);
router.post('/notices/:id/ack', ackAdminNotice);
router.patch('/cases/:id', updateCaseStatus);
router.patch('/cases/:id/processing', updateCaseProcessing);
router.patch('/cases/:id/hra', updateCaseHraDetails);
router.post('/cases/:id/notes', addCaseInterimNote);
router.patch('/cases/:id/notes/:noteId', updateCaseInterimNote);
router.delete('/cases/:id/notes/:noteId', deleteCaseInterimNote);
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
