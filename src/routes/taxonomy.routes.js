const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/taxonomy.validators');
const controller = require('../controllers/taxonomy.controller');

// ── Public ──────────────────────────────────────────────────────────────────
router.get('/tax-rates', validate(v.taxRatesIndex, 'query'), controller.taxRatesIndex);
router.get('/tax-rates/:id', controller.taxRatesShow);
router.get('/get-company-categories', controller.getCompanyCategories);

// ── Protected ───────────────────────────────────────────────────────────────
router.post('/get-all-interest', authenticate, validate(v.getAllInterest), controller.getAllInterest);

module.exports = router;
