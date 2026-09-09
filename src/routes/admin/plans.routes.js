const express = require('express');
const router = express.Router();

const { authenticate } = require('../../middlewares/auth');
const asyncHandler = require('../../utils/asyncHandler');
const { adminSuccess, adminError, adminListBypass, adminValidationError } = require('../../utils/adminResponse');
const { adminStore, adminUpdate, adminShow, adminDestroy, validateAdmin } = require('../../utils/adminCrud');
const { success, error } = require('../../utils/response');
const v = require('../../validators/admin.validators');

const PaymentPlan = require('../../models/PaymentPlan');
const ServiceModuleMapping = require('../../models/ServiceModuleMapping');
const FeatureCatalog = require('../../models/FeatureCatalog');

router.use(authenticate);

// ── payment-plans ────────────────────────────────────────────────────────────
router.get(
  '/payment-plans',
  asyncHandler(async (req, res) => {
    const plans = await PaymentPlan.find().sort({ _id: 1 });
    const data = plans.map((p) => ({
      id: p.id,
      title: p.title,
      cost_mappings_count: p.cost_mappings.length,
      created_at: p.created_at ? p.created_at.toISOString().replace('T', ' ').slice(0, 19) : null,
    }));
    return adminListBypass(res, data, 'Payment plans fetched successfully.');
  })
);
router.post('/payment-plans', adminStore(PaymentPlan, { rules: v.paymentPlan, uniqueCheck: (val) => PaymentPlan.exists({ title: val.title }) }));
router.get('/payment-plans/:id', adminShow(PaymentPlan));
router.put(
  '/payment-plans/:id',
  adminUpdate(PaymentPlan, {
    updateRules: v.paymentPlan,
    uniqueCheckUpdate: (val, id) => PaymentPlan.exists({ title: val.title, _id: { $ne: id } }),
  })
);
router.delete('/payment-plans/:id', adminDestroy(PaymentPlan));

// ── plan-cost-mappings ───────────────────────────────────────────────────────
// Embedded inside PaymentPlan.cost_mappings[] — CRUD here manipulates that array
// via the sub-document's own _id rather than a standalone collection.

async function findCostMapping(id) {
  const plan = await PaymentPlan.findOne({ 'cost_mappings._id': id });
  return plan ? { plan, mapping: plan.cost_mappings.id(id) } : null;
}

router.get(
  '/plan-cost-mappings',
  asyncHandler(async (req, res) => {
    if (req.query.payment_plan_id) {
      const plan = await PaymentPlan.findById(req.query.payment_plan_id);
      if (!plan) return adminListBypass(res, null, 'Payment plan not found.', false);
      return adminListBypass(res, plan.cost_mappings, 'Cost mappings fetched successfully.');
    }

    const plans = await PaymentPlan.find().populate('cost_mappings.tax_rate_id', 'name rate');
    const data = [];
    plans.forEach((plan) => {
      plan.cost_mappings.forEach((m) => {
        data.push({
          id: m.id,
          payment_plan_id: plan.id,
          plan_title: plan.title,
          plan_for: m.plan_for,
          plan_type: m.plan_type,
          price: m.price,
          tax_rate_id: m.tax_rate_id?.id || null,
          tax_rate_name: m.tax_rate_id?.name || null,
          price_with_tax: m.tax_rate_id ? Math.round(m.price * (1 + m.tax_rate_id.rate) * 100) / 100 : m.price,
          created_at: m.created_at,
        });
      });
    });
    data.sort((a, b) => (a.payment_plan_id === b.payment_plan_id ? a.plan_type.localeCompare(b.plan_type) : String(a.payment_plan_id).localeCompare(String(b.payment_plan_id))));
    return success(res, data, 'Cost mappings fetched successfully.');
  })
);
router.post(
  '/plan-cost-mappings',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.planCostMapping, req.body);
    if (validationErrors) return adminValidationError(res, validationErrors, message);

    const plan = await PaymentPlan.findById(value.payment_plan_id);
    if (!plan) return adminError(res, 'Record not found');
    if (plan.cost_mappings.some((m) => m.plan_for === value.plan_for && m.plan_type === value.plan_type)) {
      return adminError(res, 'This record already exists');
    }

    plan.cost_mappings.push({ plan_for: value.plan_for, plan_type: value.plan_type, price: value.price, tax_rate_id: value.tax_rate_id || null });
    await plan.save();
    return adminSuccess(res, plan.cost_mappings[plan.cost_mappings.length - 1], 'Record created successfully');
  })
);
router.get(
  '/plan-cost-mappings/:id',
  asyncHandler(async (req, res) => {
    const found = await findCostMapping(req.params.id);
    if (!found) return adminError(res, 'Record not found');
    return adminSuccess(res, found.mapping, 'Record found');
  })
);
router.put(
  '/plan-cost-mappings/:id',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.planCostMapping, req.body);
    if (validationErrors) return adminValidationError(res, validationErrors, message);

    const found = await findCostMapping(req.params.id);
    if (!found) return adminError(res, 'Record not found');

    const dup = found.plan.cost_mappings.some((m) => String(m._id) !== req.params.id && m.plan_for === value.plan_for && m.plan_type === value.plan_type);
    if (dup) return adminError(res, 'This record already exists');

    Object.assign(found.mapping, { plan_for: value.plan_for, plan_type: value.plan_type, price: value.price, tax_rate_id: value.tax_rate_id || null });
    await found.plan.save();
    return adminSuccess(res, found.mapping, 'Data updated successfully');
  })
);
router.delete(
  '/plan-cost-mappings/:id',
  asyncHandler(async (req, res) => {
    const found = await findCostMapping(req.params.id);
    if (found) {
      found.mapping.deleteOne();
      await found.plan.save();
    }
    return adminSuccess(res, [], 'Record deleted successfully');
  })
);

// ── plan-services ────────────────────────────────────────────────────────────
// Embedded inside cost_mapping.features[] — one level deeper still.

async function findPlanService(id) {
  const plan = await PaymentPlan.findOne({ 'cost_mappings.features._id': id });
  if (!plan) return null;
  for (const mapping of plan.cost_mappings) {
    const feature = mapping.features.id(id);
    if (feature) return { plan, mapping, feature };
  }
  return null;
}

async function describeFeatureRow(mapping, feature) {
  const mappingDoc = await ServiceModuleMapping.findById(feature.service_module_mapping_id);
  const catalogIds = [mappingDoc?.service_id, mappingDoc?.module_id, feature.limit_type_id].filter(Boolean);
  const catalog = await FeatureCatalog.find({ _id: { $in: catalogIds } });
  const catalogMap = new Map(catalog.map((c) => [String(c._id), c.name]));

  return {
    id: feature.id,
    plan_cost_mapping_id: mapping.id,
    service_module_mapping_id: feature.service_module_mapping_id,
    service_name: mappingDoc ? catalogMap.get(String(mappingDoc.service_id)) || null : null,
    module_name: mappingDoc ? catalogMap.get(String(mappingDoc.module_id)) || null : null,
    limit_type_id: feature.limit_type_id,
    limit_type_name: feature.limit_type_id ? catalogMap.get(String(feature.limit_type_id)) || null : null,
    allow_limit: feature.allow_limit,
    is_enable: feature.is_enable,
  };
}

router.get(
  '/plan-services',
  asyncHandler(async (req, res) => {
    if (req.query.plan_cost_mapping_id) {
      const found = await findCostMapping(req.query.plan_cost_mapping_id);
      if (!found) return adminListBypass(res, null, 'Plan cost mapping not found.', false);
      const rows = await Promise.all(found.mapping.features.map((f) => describeFeatureRow(found.mapping, f)));
      return adminListBypass(res, rows, 'Plan services fetched successfully.');
    }

    const plans = await PaymentPlan.find();
    const rows = [];
    for (const plan of plans) {
      for (const mapping of plan.cost_mappings) {
        for (const feature of mapping.features) {
          rows.push(await describeFeatureRow(mapping, feature));
        }
      }
    }
    return success(res, rows, 'Plan services fetched successfully.');
  })
);
router.post(
  '/plan-services',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.planService, req.body);
    if (validationErrors) return adminValidationError(res, validationErrors, message);

    const found = await findCostMapping(value.plan_cost_mapping_id);
    if (!found) return adminError(res, 'Record not found');
    if (found.mapping.features.some((f) => String(f.service_module_mapping_id) === value.service_module_mapping_id)) {
      return adminError(res, 'This record already exists');
    }

    found.mapping.features.push(value);
    await found.plan.save();
    const feature = found.mapping.features[found.mapping.features.length - 1];
    return adminSuccess(res, await describeFeatureRow(found.mapping, feature), 'Record created successfully');
  })
);
router.get(
  '/plan-services/:id',
  asyncHandler(async (req, res) => {
    const found = await findPlanService(req.params.id);
    if (!found) return adminError(res, 'Record not found');
    return adminSuccess(res, await describeFeatureRow(found.mapping, found.feature), 'Record found');
  })
);
router.put(
  '/plan-services/:id',
  asyncHandler(async (req, res) => {
    const { value, validationErrors, message } = validateAdmin(v.planService, req.body);
    if (validationErrors) return adminValidationError(res, validationErrors, message);

    const found = await findPlanService(req.params.id);
    if (!found) return adminError(res, 'Record not found');

    const dup = found.mapping.features.some((f) => String(f._id) !== req.params.id && String(f.service_module_mapping_id) === value.service_module_mapping_id);
    if (dup) return adminError(res, 'This record already exists');

    Object.assign(found.feature, value);
    await found.plan.save();
    return adminSuccess(res, await describeFeatureRow(found.mapping, found.feature), 'Data updated successfully');
  })
);
router.delete(
  '/plan-services/:id',
  asyncHandler(async (req, res) => {
    const found = await findPlanService(req.params.id);
    if (found) {
      found.feature.deleteOne();
      await found.plan.save();
    }
    return adminSuccess(res, [], 'Record deleted successfully');
  })
);

// ── service-module-mappings ──────────────────────────────────────────────────
router.get(
  '/service-module-mappings',
  asyncHandler(async (req, res) => {
    const mappings = await ServiceModuleMapping.find({ deleted_at: null }).populate('service_id', 'name').populate('module_id', 'name').sort({ _id: 1 });
    const data = mappings.map((m) => ({ id: m.id, service_id: m.service_id?.id, service_name: m.service_id?.name, module_id: m.module_id?.id, module_name: m.module_id?.name }));
    return adminListBypass(res, data, 'Service module mappings fetched successfully.');
  })
);
router.post(
  '/service-module-mappings',
  adminStore(ServiceModuleMapping, {
    rules: v.serviceModuleMapping,
    uniqueCheck: (val) => ServiceModuleMapping.exists({ service_id: val.service_id, module_id: val.module_id }),
  })
);
router.get('/service-module-mappings/:id', adminShow(ServiceModuleMapping));
router.put(
  '/service-module-mappings/:id',
  adminUpdate(ServiceModuleMapping, {
    updateRules: v.serviceModuleMapping,
    uniqueCheckUpdate: (val, id) => ServiceModuleMapping.exists({ service_id: val.service_id, module_id: val.module_id, _id: { $ne: id } }),
  })
);
router.delete('/service-module-mappings/:id', adminDestroy(ServiceModuleMapping));

// ── services / modules / limit-types ─────────────────────────────────────────
// All three are the same FeatureCatalog collection, filtered/tagged by `type`.

function featureCatalogResource(path, type, { rules, uniqueField, serialize, deserialize }) {
  router.get(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const rows = await FeatureCatalog.find({ type, deleted_at: null }).sort({ _id: 1 });
      return adminListBypass(res, rows.map(serialize), 'Records found');
    })
  );
  router.post(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const { value, validationErrors, message } = validateAdmin(rules, req.body);
      if (validationErrors) return adminValidationError(res, validationErrors, message);

      if (await FeatureCatalog.exists({ type, [uniqueField]: value[uniqueField] })) return adminError(res, 'This record already exists');

      const row = await FeatureCatalog.create({ type, ...deserialize(value) });
      return adminSuccess(res, serialize(row), 'Record created successfully');
    })
  );
  router.get(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const row = await FeatureCatalog.findOne({ _id: req.params.id, type });
      if (!row) return adminError(res, 'Record not found');
      return adminSuccess(res, serialize(row), 'Record found');
    })
  );
  router.put(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const { value, validationErrors, message } = validateAdmin(rules, req.body);
      if (validationErrors) return adminValidationError(res, validationErrors, message);

      const row = await FeatureCatalog.findOne({ _id: req.params.id, type });
      if (!row) return adminError(res, 'Record not found');

      if (await FeatureCatalog.exists({ type, [uniqueField]: value[uniqueField], _id: { $ne: req.params.id } })) {
        return adminError(res, 'This record already exists');
      }

      Object.assign(row, deserialize(value));
      await row.save();
      return adminSuccess(res, serialize(row), 'Data updated successfully');
    })
  );
  router.delete(`/${path}/:id`, adminDestroy(FeatureCatalog));
}

featureCatalogResource('services', 'service', {
  rules: v.featureCatalogService,
  uniqueField: 'name',
  serialize: (r) => ({ id: r.id, name: r.name }),
  deserialize: (val) => ({ name: val.name }),
});

featureCatalogResource('modules', 'module', {
  rules: v.featureCatalogModule,
  uniqueField: 'module_code',
  serialize: (r) => ({ id: r.id, module_name: r.name, module_code: r.module_code }),
  deserialize: (val) => ({ name: val.module_name, module_code: val.module_code }),
});

featureCatalogResource('limit-types', 'limit_type', {
  rules: v.featureCatalogLimitType,
  uniqueField: 'name',
  serialize: (r) => ({ id: r.id, name: r.name }),
  deserialize: (val) => ({ name: val.name }),
});

module.exports = router;
