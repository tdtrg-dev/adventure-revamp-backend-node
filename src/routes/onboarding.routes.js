const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { uploader } = require('../middlewares/upload');
const v = require('../validators/onboarding.validators');
const controller = require('../controllers/onboarding.controller');

const bioImageUpload = uploader('user-profiles', 5);

// NOTE: authenticate is applied per-route (not via a blanket router.use()) because
// this router is mounted at bare '/' in routes/index.js — an unconditional use()
// here would intercept every request that reaches this router in the chain,
// including unrelated routes defined in files mounted after it.
router.post('/save-user-bio', authenticate, bioImageUpload.single('bio_image'), validate(v.saveUserBio), controller.saveUserBio);
router.post('/save-radius', authenticate, validate(v.saveRadius), controller.saveRadius);
router.post('/save-user-interest', authenticate, validate(v.saveUserInterest), controller.saveUserInterest);
router.post('/get-onboarding-status', authenticate, validate(v.getOnboardingStatus), controller.getOnboardingStatus);

module.exports = router;
