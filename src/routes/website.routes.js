const express = require('express');
const router = express.Router();

const validateFormRequest = require('../middlewares/validateFormRequest');
const v = require('../validators/website.validators');
const controller = require('../controllers/website.controller');
const { normalizeType } = require('../services/website.service');

router.post('/subsciblenews-letter', validateFormRequest(v.newsletter), controller.subscribeNewsletter);
router.post('/contact-us', validateFormRequest(v.contact), controller.contact);

// Laravel's prepareForValidation() normalizes the free-text `type` label
// (e.g. "Guest / Traveler") to the stored enum ("guest") before rules() runs —
// mirrored here as a pre-validation step.
router.post(
  '/park-stay-lead',
  (req, res, next) => {
    if (req.body && 'type' in req.body) req.body.type = normalizeType(req.body.type);
    next();
  },
  validateFormRequest(v.parkStayLead),
  controller.parkStayLead
);

module.exports = router;
