const express = require('express');
const router = express.Router();

const { authenticate } = require('../../middlewares/auth');
const asyncHandler = require('../../utils/asyncHandler');
const { adminSuccess, adminError, adminListBypass, adminValidationError } = require('../../utils/adminResponse');
const { adminStore, adminUpdate, adminShow, adminDestroy, validateAdmin } = require('../../utils/adminCrud');
const { success, error } = require('../../utils/response');
const v = require('../../validators/admin.validators');

const CompanyCategory = require('../../models/CompanyCategory');
const Interest = require('../../models/Interest');
const TaxRate = require('../../models/TaxRate');
const interestService = require('../../services/interest.service');
const taxRateService = require('../../services/taxRate.service');

router.use(authenticate);

// ── company-category ─────────────────────────────────────────────────────────
router.get(
  '/company-category',
  asyncHandler(async (req, res) => {
    const data = await CompanyCategory.find({ deleted_at: null }).sort({ _id: -1 });
    return adminListBypass(res, data, 'Records found');
  })
);
router.post(
  '/company-category',
  adminStore(CompanyCategory, {
    rules: v.companyCategory,
    uniqueCheck: (v) => CompanyCategory.exists({ title: v.title }),
  })
);
router.get('/company-category/:id', adminShow(CompanyCategory));
router.put(
  '/company-category/:id',
  adminUpdate(CompanyCategory, {
    updateRules: v.companyCategory,
    uniqueCheckUpdate: (v, id) => CompanyCategory.exists({ title: v.title, _id: { $ne: id } }),
  })
);
router.delete('/company-category/:id', adminDestroy(CompanyCategory));

// ── interest ─────────────────────────────────────────────────────────────────
// Laravel's admin InteresetController overrides store/update entirely (bypassing
// its own rules()/uniqueCheck(), which are dead code there) — mirrored as-is.
router.get(
  '/interest',
  asyncHandler(async (req, res) => {
    try {
      const data = await interestService.getAllInterest(req.query.interest_id);
      return adminSuccess(res, data, data.length === 1 && req.query.interest_id ? 'Interest fetched successfully.' : 'Interests fetched successfully.');
    } catch (e) {
      return adminError(res, e.message);
    }
  })
);
router.post(
  '/interest',
  asyncHandler(async (req, res) => {
    if (!req.body.id || req.body.id === 0) {
      if (await Interest.exists({ title: req.body.title })) return adminError(res, 'This title already exist');
    }
    const interest = await Interest.create({ title: req.body.title, image: req.body.image || null, parent_id: req.body.parent_id || null });
    return adminSuccess(res, interest, 'Record created successfully');
  })
);
router.put(
  '/interest/:id',
  asyncHandler(async (req, res) => {
    if (await Interest.exists({ title: req.body.title, _id: { $ne: req.params.id } })) return adminError(res, 'This title already exist');
    const interest = await Interest.findById(req.params.id);
    if (!interest) return adminError(res, 'Record not found');
    interest.title = req.body.title;
    if (req.body.image) interest.image = req.body.image;
    if (req.body.parent_id !== undefined) interest.parent_id = req.body.parent_id || null;
    await interest.save();
    return adminSuccess(res, interest, 'Data updated successfully');
  })
);
router.get('/interest/:id', adminShow(Interest));
router.delete('/interest/:id', adminDestroy(Interest));

// ── tax-rates ────────────────────────────────────────────────────────────────
router.get(
  '/tax-rates',
  asyncHandler(async (req, res) => {
    const result = await taxRateService.adminGetAll(req.query);
    return adminListBypass(res, result, 'Tax rates fetched successfully.');
  })
);
router.post(
  '/tax-rates',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.taxRateCreate, req.body);
    if (validationErrors) {
      return adminValidationError(res, validationErrors, message);
    }

    const countryCode = value.country_code ? value.country_code.toUpperCase() : null;
    const dupQuery = { name: value.name, country_code: countryCode };
    if (await TaxRate.exists(dupQuery)) return adminError(res, 'This record already exists');

    const taxRate = await TaxRate.create({ ...value, country_code: countryCode, rate: Math.round((value.rate / 100) * 10000) / 10000 });
    return adminSuccess(res, taxRate, 'Record created successfully');
  })
);
router.put(
  '/tax-rates/:id',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.taxRateCreate, req.body);
    if (validationErrors) {
      return adminValidationError(res, validationErrors, message);
    }

    const taxRate = await TaxRate.findById(req.params.id);
    if (!taxRate) return adminError(res, 'Record not found');

    const countryCode = value.country_code ? value.country_code.toUpperCase() : null;
    if (await TaxRate.exists({ name: value.name, country_code: countryCode, _id: { $ne: req.params.id } })) {
      return adminError(res, 'This record already exists');
    }

    Object.assign(taxRate, { ...value, country_code: countryCode, rate: Math.round((value.rate / 100) * 10000) / 10000 });
    await taxRate.save();
    return adminSuccess(res, taxRate, 'Data updated successfully');
  })
);
router.get('/tax-rates/:id', adminShow(TaxRate));
router.delete('/tax-rates/:id', adminDestroy(TaxRate));
router.patch(
  '/tax-rates/:id/toggle-status',
  asyncHandler(async (req, res) => {
    try {
      const data = await taxRateService.toggleStatus(req.params.id);
      return success(res, data, 'Tax rate status updated successfully.');
    } catch (e) {
      return error(res, e.message, e.statusCode || 400, []);
    }
  })
);

module.exports = router;
