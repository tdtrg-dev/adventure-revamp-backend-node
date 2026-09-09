const PaymentPlan = require('../models/PaymentPlan');
const FeatureCatalog = require('../models/FeatureCatalog');
const ServiceModuleMapping = require('../models/ServiceModuleMapping');

// Mirrors CompanyPaymentPlanSeeder.php's per-module-code feature config, keyed
// by the module's module_code. Free plan gets numeric limits; Premium gets
// 'unlimited'. Any mapping not listed here falls back to disabled/no-limit,
// same as Laravel's `?? ['is_enabled' => 2, 'limit' => null, 'limit_id' => null]`.
function featureConfigFor(planKey) {
  if (planKey === 'free') {
    return {
      120: { is_enable: 'yes', allow_limit: '8' },
      170: { is_enable: 'yes', allow_limit: '40' },
    };
  }
  return {
    120: { is_enable: 'yes', allow_limit: 'unlimited' },
    170: { is_enable: 'yes', allow_limit: 'unlimited' },
  };
}
const DEFAULT_FEATURE_CONFIG = { is_enable: 'no', allow_limit: null };

async function upsertCostMapping(plan, { plan_for, plan_type, price, tax_rate_id }) {
  let mapping = plan.cost_mappings.find((m) => m.plan_for === plan_for && m.plan_type === plan_type);
  if (mapping) {
    mapping.price = price;
    mapping.tax_rate_id = tax_rate_id;
  } else {
    plan.cost_mappings.push({ plan_for, plan_type, price, tax_rate_id, features: [] });
    mapping = plan.cost_mappings[plan.cost_mappings.length - 1];
  }
  return mapping;
}

function upsertFeature(mapping, { service_module_mapping_id, limit_type_id, allow_limit, is_enable }) {
  const existing = mapping.features.find((f) => String(f.service_module_mapping_id) === String(service_module_mapping_id));
  if (existing) {
    Object.assign(existing, { limit_type_id, allow_limit, is_enable });
  } else {
    mapping.features.push({ service_module_mapping_id, limit_type_id, allow_limit, is_enable });
  }
}

/**
 * Mirrors CompanyPaymentPlanSeeder.php. One fix vs. the Laravel source: its
 * updateOrCreate() there matches PlanCostMapping on `plan_for => 2` (an integer)
 * while writing `plan_for => 'individual'` (a string) — those never match, so
 * re-running that seeder in Laravel actually creates a duplicate cost mapping
 * every time. That's a real idempotency bug worth fixing here rather than
 * replicating, since (unlike the rest of this migration's response-shape
 * fidelity work) a seeder has no external API contract to stay bug-compatible
 * with — matching on the correct `plan_for: 'individual'` is what was clearly
 * intended, and is the only way this seeder can safely be re-run.
 */
async function seedCompanyPaymentPlans() {
  const monthlyLimitType = await FeatureCatalog.findOne({ type: 'limit_type', name: 'Monthly' });
  const mappings = await ServiceModuleMapping.find().populate('module_id', 'module_code');

  const plans = [
    { key: 'free', title: 'Membership Tiers (Free)', price: 0 },
    { key: 'premium', title: 'Membership Tiers (Premium)', price: 3.99 },
  ];

  for (const { key, title, price } of plans) {
    const plan = (await PaymentPlan.findOne({ title })) || new PaymentPlan({ title, cost_mappings: [] });

    const costMapping = await upsertCostMapping(plan, { plan_for: 'individual', plan_type: 'monthly', price, tax_rate_id: null });

    const config = featureConfigFor(key);
    for (const mapping of mappings) {
      const moduleCode = mapping.module_id?.module_code;
      const featureConfig = config[moduleCode] || DEFAULT_FEATURE_CONFIG;
      upsertFeature(costMapping, {
        service_module_mapping_id: mapping._id,
        limit_type_id: featureConfig.allow_limit ? monthlyLimitType?._id || null : null,
        allow_limit: featureConfig.allow_limit,
        is_enable: featureConfig.is_enable,
      });
    }

    await plan.save();
  }

  console.log(`  Payment plans: ${plans.length} seeded (${plans.map((p) => p.title).join(', ')}), ${mappings.length} feature(s) each`);
}

module.exports = seedCompanyPaymentPlans;
