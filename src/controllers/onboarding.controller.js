const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const onboardingService = require('../services/onboarding.service');
const interestService = require('../services/interest.service');

const saveUserBio = asyncHandler(async (req, res) => {
  const bioImageFile = req.file || null;
  const result = await onboardingService.saveUserBio(req.body.user_id, req.body.bio_description, bioImageFile);
  return success(res, result, 'Bio saved successfully.');
});

const saveRadius = asyncHandler(async (req, res) => {
  await onboardingService.saveRadius(req.body.user_id, req.body.radius);
  return success(res, [], 'Radius save successfully');
});

const saveUserInterest = asyncHandler(async (req, res) => {
  await interestService.saveUserInterest(req.body.user_id, req.body.interest_id);
  return success(res, [], 'User interests saved successfully.');
});

const getOnboardingStatus = asyncHandler(async (req, res) => {
  const { _message, ...data } = await onboardingService.getOnboardingStatus(req.body.user_id);
  return success(res, data, _message);
});

module.exports = { saveUserBio, saveRadius, saveUserInterest, getOnboardingStatus };
