const User = require('../models/User');
const { relativeUploadPath } = require('../middlewares/upload');

async function saveUserBio(userId, bioDescription, bioImageFile) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 400;
    throw err;
  }

  user.profile.bio = bioDescription;
  if (bioImageFile) {
    user.profile.image = relativeUploadPath('user-profiles', bioImageFile.filename);
  }
  await user.save();

  return { user_id: user.id, bio_description: user.profile.bio, bio_image: user.profile.image };
}

async function saveRadius(userId, radius) {
  await User.updateOne({ _id: userId }, { 'profile.radius': radius });
}

async function getOnboardingStatus(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 400;
    throw err;
  }

  const profile = user.profile;
  const missingSteps = [];

  if (!user.email_verified_at) {
    missingSteps.push({ step: 'email_verification', message: 'Email is not verified' });
  }
  if (!profile.bio || !profile.image) {
    missingSteps.push({ step: 'bio', message: 'Bio information is incomplete' });
  }
  if (profile.radius === null || profile.radius === undefined) {
    missingSteps.push({ step: 'radius', message: 'Radius is not set' });
  }
  if (!user.interests || user.interests.length === 0) {
    missingSteps.push({ step: 'interests', message: 'No interests selected' });
  }

  const isComplete = missingSteps.length === 0;

  return {
    user_id: user.id,
    is_complete: isComplete,
    missing_steps: missingSteps,
    _message: isComplete ? 'Onboarding complete' : 'Onboarding incomplete',
  };
}

module.exports = { saveUserBio, saveRadius, getOnboardingStatus };
