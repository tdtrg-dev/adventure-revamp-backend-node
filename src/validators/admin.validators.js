const Joi = require('joi');
const { objectId, emailField, passwordField } = require('./common');

const login = Joi.object({
  email: emailField(),
  password: passwordField(),
});

const companyCategory = Joi.object({ title: Joi.string().required() });

const taxRateCreate = Joi.object({
  name: Joi.string().max(100).required(),
  rate: Joi.number().min(0).max(100).required(), // validated as the incoming percentage, converted to decimal before save
  tax_type: Joi.string().valid('inclusive', 'exclusive').required(),
  applicable_to: Joi.string().valid('subscription', 'ticket', 'both').required(),
  tax_category: Joi.string().valid('general', 'portal_fee'),
  country_code: Joi.string().max(5).allow(null, ''),
  is_active: Joi.boolean(),
});

const paymentPlan = Joi.object({ title: Joi.string().max(255).required() });

const planCostMapping = Joi.object({
  payment_plan_id: objectId().required(),
  plan_for: Joi.string().valid('individual', 'company').required(),
  plan_type: Joi.string().valid('monthly', 'yearly').required(),
  price: Joi.number().min(0).required(),
  tax_rate_id: objectId().allow(null, ''),
});

const planService = Joi.object({
  plan_cost_mapping_id: objectId().required(),
  service_module_mapping_id: objectId().required(),
  limit_type_id: objectId().allow(null, ''),
  allow_limit: Joi.string().max(100).allow(null, ''),
  is_enable: Joi.string().valid('yes', 'no').required(),
});

const serviceModuleMapping = Joi.object({
  service_id: objectId().required(),
  module_id: objectId().required(),
});

const featureCatalogService = Joi.object({ name: Joi.string().max(255).required() });
const featureCatalogModule = Joi.object({
  module_name: Joi.string().max(255).required(),
  module_code: Joi.string().max(50).required(),
});
const featureCatalogLimitType = Joi.object({ name: Joi.string().max(100).required() });

const parkStayLeadIndex = Joi.object({
  type: Joi.string().valid('host', 'guest'),
  status: Joi.string().valid('new', 'contacted', 'converted', 'rejected'),
  search: Joi.string().max(150),
  page: Joi.number().integer().min(1),
  per_page: Joi.number().integer().min(1).max(100),
});

const parkStayLeadStatus = Joi.object({
  status: Joi.string().valid('new', 'contacted', 'converted', 'rejected').required(),
});

const actionUserEventReport = Joi.object({
  report_id: objectId().required(),
  action: Joi.string().valid('warn', 'suspend', 'ban', 'dismiss', 'unpublish', 'delete').required(),
  remarks: Joi.string().allow(null, ''),
});

module.exports = {
  login,
  companyCategory,
  taxRateCreate,
  paymentPlan,
  planCostMapping,
  planService,
  serviceModuleMapping,
  featureCatalogService,
  featureCatalogModule,
  featureCatalogLimitType,
  parkStayLeadIndex,
  parkStayLeadStatus,
  actionUserEventReport,
};
