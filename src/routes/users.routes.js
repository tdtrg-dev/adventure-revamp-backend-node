const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { uploader } = require('../middlewares/upload');
const v = require('../validators/auth.validators');
const controller = require('../controllers/user.controller');

const bioImageUpload = uploader('user-profiles', 5);
const reportAttachmentUpload = uploader('report-attachments', 10);

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/get-user-profile', validate(v.getUserProfile, 'query'), controller.getUserProfile);

// ── Protected ───────────────────────────────────────────────────────────────
router.post('/get-all-users', authenticate, validate(v.getAllUsers), controller.getAllUsers);
router.post(
  '/update-profile',
  authenticate,
  bioImageUpload.single('bio_image'),
  validate(v.updateProfile),
  controller.updateProfile
);
router.post('/delete-user-profile', authenticate, validate(v.deleteUserProfile), controller.deleteUserProfile);
router.post(
  '/submit-report',
  authenticate,
  reportAttachmentUpload.single('attachment'),
  validate(v.reportUserProfile),
  controller.reportUserProfile
);
router.get('/get-my-reports', authenticate, controller.getMyProfileReports);

module.exports = router;
