import { Router } from 'express';
import { register, login, getMe, verifyCode, resendVerificationEmail, requestPhoneVerification, verifyPhone } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/verify-code', verifyCode);
router.post('/resend-verification', resendVerificationEmail);
router.post('/request-phone-verification', requestPhoneVerification);
router.post('/verify-phone', verifyPhone);

export default router;
