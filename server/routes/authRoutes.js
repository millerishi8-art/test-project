import { Router } from 'express';
import { register, login, getMe, verifyCode, resendVerificationEmail, requestPhoneVerification, verifyPhone, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// —— Public routes (no auth) ——
router.post('/register', register);
router.post('/login', login);
router.post('/verify-code', verifyCode);        // PUBLIC: unverified users have no token; body: { email, code }
router.post('/resend-verification', resendVerificationEmail); // PUBLIC: body: { email }
router.post('/request-phone-verification', requestPhoneVerification);
router.post('/verify-phone', verifyPhone);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// —— Protected (require token) ——
router.get('/me', authenticateToken, getMe);

export default router;
