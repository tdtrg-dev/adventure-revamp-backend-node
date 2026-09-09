const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const interestService = require('../services/interest.service');
const taxRateService = require('../services/taxRate.service');
const CompanyCategory = require('../models/CompanyCategory');

const getAllInterest = asyncHandler(async (req, res) => {
  const data = await interestService.getAllInterest(req.body.interest_id);
  return success(res, data, data.length === 1 && req.body.interest_id ? 'Interest fetched successfully.' : 'Interests fetched successfully.');
});

const getCompanyCategories = asyncHandler(async (req, res) => {
  const data = await CompanyCategory.find({ deleted_at: null }).sort({ _id: -1 });
  return success(res, data, 'Record found');
});

const taxRatesIndex = asyncHandler(async (req, res) => {
  const data = await taxRateService.getAll(req.query);
  return success(res, data, 'Tax rates fetched successfully.');
});

const taxRatesShow = asyncHandler(async (req, res) => {
  const data = await taxRateService.getById(req.params.id);
  return success(res, data, 'Tax rate fetched successfully.');
});

module.exports = { getAllInterest, getCompanyCategories, taxRatesIndex, taxRatesShow };
