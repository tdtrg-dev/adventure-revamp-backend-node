const express = require('express');
const router = express.Router();

const { authenticate } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const authRateLimit = require('../../middlewares/authRateLimit');
const v = require('../../validators/admin.validators');
const asyncHandler = require('../../utils/asyncHandler');
const { success, error } = require('../../utils/response');
const adminAuthService = require('../../services/adminAuth.service');

router.post(
  '/admin-login',
  authRateLimit,
  validate(v.login),
  asyncHandler(async (req, res) => {
    const { admin, accessToken } = await adminAuthService.login(req.body.email, req.body.password);
    return success(res, { admin, accessToken }, 'Logged in successfully.');
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.auth) return error(res, 'Unauthenticated.', 401, []);
    await adminAuthService.logout(req.auth.jti);
    return success(res, [], 'Logged out successfully.');
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    return success(res, req.admin || req.user, 'Admin profile fetched successfully.');
  })
);

module.exports = router;
