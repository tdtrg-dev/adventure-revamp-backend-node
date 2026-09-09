const { ok, body } = require('./_helpers');

// These 3 public marketing-site forms get Laravel's raw default FormRequest 422
// shape (`{message, errors}`), not the standard `{success,code,message,data}`
// envelope every other endpoint uses — see WebsiteValidationError.
const validationError = {
  description: 'Validation failed.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/WebsiteValidationError' } } },
};
const serverError = {
  description: 'The submission could not be saved.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
};

module.exports = {
  '/subsciblenews-letter': {
    post: {
      tags: ['Website'],
      summary: 'Subscribe to the marketing newsletter',
      ...body('WebsiteNewsletter'),
      responses: { 200: ok('Subscribed (or re-subscribed).'), 422: validationError, 500: serverError },
    },
  },
  '/contact-us': {
    post: {
      tags: ['Website'],
      summary: 'Submit the public contact-us form',
      ...body('WebsiteContact'),
      responses: { 200: ok('Message received.'), 422: validationError, 500: serverError },
    },
  },
  '/park-stay-lead': {
    post: {
      tags: ['Website'],
      summary: 'Join the Park & Stay waitlist (host or guest side)',
      ...body('WebsiteParkStayLead'),
      responses: { 200: ok('Signup recorded (or an existing one refreshed).'), 422: validationError, 500: serverError },
    },
  },
};
