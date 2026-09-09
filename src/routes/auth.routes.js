const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const authRateLimit = require('../middlewares/authRateLimit');
const v = require('../validators/auth.validators');
const controller = require('../controllers/auth.controller');

// ── Public ──────────────────────────────────────────────────────────────────
router.post('/signup', authRateLimit, validate(v.signup), controller.signup);
router.post('/login', authRateLimit, validate(v.login), controller.login);
router.post('/social-login', authRateLimit, validate(v.socialLogin), controller.socialLogin);
router.post('/forgot-password', authRateLimit, validate(v.forgotPassword), controller.forgotPassword);
router.post('/reset-password', authRateLimit, validate(v.resetPassword), controller.resetPassword);
router.post('/resend-verification-email', authRateLimit, validate(v.resendVerificationEmail), controller.resendVerificationEmail);
router.get('/email/verify/:id/:hash', controller.verifyEmail);
router.post('/email/verify/:id/:hash', controller.verifyEmail);

// ── Protected ───────────────────────────────────────────────────────────────
router.post('/logout', authenticate, controller.logout);

module.exports = router;
