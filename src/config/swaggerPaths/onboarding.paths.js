const { ok, err, unauthorized, auth, body } = require('./_helpers');

module.exports = {
  '/save-user-bio': {
    post: {
      tags: ['Onboarding'],
      summary: 'Save onboarding step 1 — bio (multipart, bio_image optional)',
      ...auth,
      ...body('OnboardingSaveUserBio'),
      responses: { 200: ok('Bio saved.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/save-radius': {
    post: {
      tags: ['Onboarding'],
      summary: 'Save onboarding step 2 — search radius',
      ...auth,
      ...body('OnboardingSaveRadius'),
      responses: { 200: ok('Radius saved.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/save-user-interest': {
    post: {
      tags: ['Onboarding'],
      summary: 'Save onboarding step 3 — interests',
      ...auth,
      ...body('OnboardingSaveUserInterest'),
      responses: { 200: ok('Interests saved.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-onboarding-status': {
    post: {
      tags: ['Onboarding'],
      summary: "Check which onboarding steps the caller has completed",
      ...auth,
      ...body('OnboardingGetOnboardingStatus'),
      responses: { 200: ok('Status fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
};
