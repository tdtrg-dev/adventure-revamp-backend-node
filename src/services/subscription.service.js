const PaymentPlan = require('../models/PaymentPlan');
const FeatureCatalog = require('../models/FeatureCatalog');
const ServiceModuleMapping = require('../models/ServiceModuleMapping');
const TaxRate = require('../models/TaxRate');
const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const paymentService = require('./payment.service');
const { nextInvoiceNumber } = require('../utils/invoice');
const { calculateTaxAmount } = require('./payment.service');
const { datetimeStr } = require('../utils/dateFormat');

function notFound(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

/** Locates a specific cost-mapping subdocument by its own _id across all plans. */
async function findCostMapping(planCostMappingId) {
  const plan = await PaymentPlan.findOne({ 'cost_mappings._id': planCostMappingId });
  if (!plan) return null;
  const mapping = plan.cost_mappings.id(planCostMappingId);
  return { plan, mapping };
}

async function describeFeatures(features) {
  const mappingIds = features.map((f) => f.service_module_mapping_id).filter(Boolean);
  const mappings = await ServiceModuleMapping.find({ _id: { $in: mappingIds } });
  const mappingMap = new Map(mappings.map((m) => [String(m._id), m]));

  const catalogIds = [
    ...mappings.flatMap((m) => [m.service_id, m.module_id]),
    ...features.map((f) => f.limit_type_id).filter(Boolean),
  ];
  const catalog = await FeatureCatalog.find({ _id: { $in: catalogIds } });
  const catalogMap = new Map(catalog.map((c) => [String(c._id), c.name]));

  return features.map((f) => {
    const mapping = mappingMap.get(String(f.service_module_mapping_id));
    const serviceName = mapping ? catalogMap.get(String(mapping.service_id)) || '' : '';
    const moduleName = mapping ? catalogMap.get(String(mapping.module_id)) || '' : '';
    const limitName = f.limit_type_id ? catalogMap.get(String(f.limit_type_id)) || '' : '';
    const label = `${f.allow_limit ? f.allow_limit + ' ' : ''}${[serviceName, moduleName, limitName].filter(Boolean).join(' ')}`.trim();
    return { id: f._id.toString(), service: label, enable: f.is_enable };
  });
}

async function getPaymentPlanWithServices(planCostMappingId = null) {
  const query = planCostMappingId ? { 'cost_mappings._id': planCostMappingId } : {};
  const plans = await PaymentPlan.find(query).select('title cost_mappings');

  const rows = [];
  for (const plan of plans) {
    for (const mapping of plan.cost_mappings) {
      if (planCostMappingId && String(mapping._id) !== String(planCostMappingId)) continue;
      rows.push({
        planId: mapping._id.toString(),
        title: plan.title || 'Untitled',
        price: money(mapping.price),
        plan_type: mapping.plan_type,
        plan_for: mapping.plan_for,
        plannedServices: await describeFeatures(mapping.features),
      });
    }
  }

  if (rows.length === 0) throw notFound('Plans not found');
  return rows;
}

async function computeTax(mapping, amount) {
  const result = { subtotal: amount, taxAmount: 0, taxRateId: null, total: amount };
  if (!mapping.tax_rate_id) return result;

  const taxRate = await TaxRate.findById(mapping.tax_rate_id);
  if (!taxRate || !taxRate.is_active) return result;

  result.taxAmount = calculateTaxAmount(taxRate, amount);
  result.taxRateId = taxRate._id;
  if (taxRate.tax_type === 'exclusive') {
    result.total = Math.round((amount + result.taxAmount) * 100) / 100;
  }
  return result;
}

function extractStripePaymentId(raw) {
  return raw.includes('_secret_') ? raw.split('_secret_')[0] : raw;
}

async function savePaymentAndDetail({ subscription, plan, mapping, userId, total, subtotal, taxAmount, taxRateId, startsAt, endsAt, gatewayTxnId, isRenewal, gateway = 'stripe' }) {
  const platformAdminId = await paymentService.getPlatformAdminId();

  const payment = await paymentService.createPayment({
    payer_type: 'user',
    payer_id: userId,
    payee_type: 'admin',
    payee_id: platformAdminId,
    payment_type: 'subscription',
    amount: total,
    subtotal,
    tax_amount: taxAmount,
    tax_rate_id: taxRateId,
    status: 'completed',
    gateway,
    gateway_transaction_id: gatewayTxnId,
    description: `${isRenewal ? 'Renewal' : 'Subscription'} - ${plan.title || 'Plan'} (${mapping.plan_type.charAt(0).toUpperCase() + mapping.plan_type.slice(1)})`,
    metadata: {
      plan_id: mapping._id.toString(),
      plan_type: mapping.plan_type,
      plan_for: mapping.plan_for,
      period_start: startsAt.toISOString().slice(0, 10),
      period_end: endsAt.toISOString().slice(0, 10),
      is_renewal: isRenewal,
    },
  });

  const invoiceNumber = await nextInvoiceNumber('INV');
  payment.subscription_detail = {
    user_subscription_id: subscription._id,
    plan_cost_mapping_id: mapping._id,
    billing_cycle: mapping.plan_type,
    period_start: startsAt,
    period_end: endsAt,
    invoice_number: invoiceNumber,
    is_renewal: isRenewal,
  };
  await payment.save();

  return { payment, invoiceNumber };
}

async function checkout(data) {
  const { user_id: userId, plan_id: planCostMappingId, tid, channel, amount } = data;

  const found = await findCostMapping(planCostMappingId);
  if (!found) throw notFound('Plan not found.');
  const { plan, mapping } = found;

  const { subtotal, taxAmount, taxRateId, total } = await computeTax(mapping, Number(amount));

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  if (mapping.plan_type === 'yearly') endsAt.setFullYear(endsAt.getFullYear() + 1);
  else endsAt.setMonth(endsAt.getMonth() + 1);

  const isFree = mapping.price === 0;
  const gateway = isFree ? 'free' : channel || 'stripe';
  const transactionId = extractStripePaymentId(String(tid));

  if (!isFree && transactionId) {
    const existing = await UserSubscription.findOne({ gateway_subscription_id: transactionId, status: 'active' });
    if (existing) {
      const existingPayment = await Payment.findOne({ 'subscription_detail.user_subscription_id': existing._id });
      return {
        subscription_id: existing.id,
        plan_title: plan.title,
        plan_type: mapping.plan_type,
        status: existing.status,
        starts_at: datetimeStr(existing.starts_at),
        ends_at: datetimeStr(existing.ends_at),
        is_free: false,
        amount_charged: money(total),
        tax_amount: money(taxAmount),
        invoice_number: existingPayment?.subscription_detail?.invoice_number || null,
        payment_id: existingPayment ? existingPayment.id : null,
        already_processed: true,
        _message: 'Subscription already active for this payment.',
      };
    }
  }

  await UserSubscription.updateMany(
    { user_id: userId, status: 'active' },
    { status: 'cancelled', cancelled_at: new Date(), cancellation_reason: 'Plan changed / new subscription' }
  );

  const subscription = await UserSubscription.create({
    user_id: userId,
    payment_plan_id: plan._id,
    plan_cost_mapping_id: mapping._id,
    status: 'active',
    starts_at: startsAt,
    ends_at: endsAt,
    gateway,
    gateway_subscription_id: isFree ? null : transactionId,
    auto_renew: true,
  });

  let payment = null;
  let invoiceNumber = null;
  if (!isFree) {
    ({ payment, invoiceNumber } = await savePaymentAndDetail({
      subscription,
      plan,
      mapping,
      userId,
      total,
      subtotal,
      taxAmount,
      taxRateId,
      startsAt,
      endsAt,
      gatewayTxnId: transactionId,
      isRenewal: false,
      gateway,
    }));
  }

  return {
    subscription_id: subscription.id,
    plan_title: plan.title,
    plan_type: mapping.plan_type,
    status: subscription.status,
    starts_at: datetimeStr(subscription.starts_at),
    ends_at: datetimeStr(subscription.ends_at),
    is_free: isFree,
    amount_charged: isFree ? '0.00' : money(total),
    tax_amount: money(taxAmount),
    invoice_number: invoiceNumber,
    payment_id: payment ? payment.id : null,
    already_processed: false,
    _message: 'Subscription activated successfully.',
  };
}

/** Used by the daily subscription-renewal cron job (plan step: Scheduled jobs). */
async function renew(oldSubscription, newGatewayTxnId) {
  const plan = await PaymentPlan.findOne({ 'cost_mappings._id': oldSubscription.plan_cost_mapping_id });
  if (!plan) throw notFound('Plan not found.');
  const mapping = plan.cost_mappings.id(oldSubscription.plan_cost_mapping_id);

  const { subtotal, taxAmount, taxRateId, total } = await computeTax(mapping, mapping.price);

  const startsAt = new Date(oldSubscription.ends_at);
  const endsAt = new Date(startsAt);
  if (mapping.plan_type === 'yearly') endsAt.setFullYear(endsAt.getFullYear() + 1);
  else endsAt.setMonth(endsAt.getMonth() + 1);

  oldSubscription.status = 'expired';
  oldSubscription.auto_renew = false;
  await oldSubscription.save();

  const newSubscription = await UserSubscription.create({
    user_id: oldSubscription.user_id,
    payment_plan_id: plan._id,
    plan_cost_mapping_id: mapping._id,
    status: 'active',
    starts_at: startsAt,
    ends_at: endsAt,
    gateway: 'stripe',
    gateway_subscription_id: newGatewayTxnId,
    auto_renew: true,
  });

  const { payment, invoiceNumber } = await savePaymentAndDetail({
    subscription: newSubscription,
    plan,
    mapping,
    userId: oldSubscription.user_id,
    total,
    subtotal,
    taxAmount,
    taxRateId,
    startsAt,
    endsAt,
    gatewayTxnId: newGatewayTxnId,
    isRenewal: true,
  });

  return { subscription: newSubscription, payment, invoice: invoiceNumber };
}

async function getCurrentSubscription(userId) {
  const subscription = await UserSubscription.findOne({
    user_id: userId,
    status: 'active',
    $or: [{ ends_at: null }, { ends_at: { $gt: new Date() } }],
  }).sort({ _id: -1 });

  if (!subscription) return null;

  const plan = await PaymentPlan.findOne({ 'cost_mappings._id': subscription.plan_cost_mapping_id });
  const mapping = plan?.cost_mappings.id(subscription.plan_cost_mapping_id);

  return {
    subscription_id: subscription.id,
    plan_cost_mapping_id: subscription.plan_cost_mapping_id,
    plan_title: plan?.title || 'Untitled Plan',
    price: money(mapping?.price),
    plan_type: mapping?.plan_type || 'monthly',
    plan_for: mapping?.plan_for || 'user',
    status: subscription.status,
    starts_at: datetimeStr(subscription.starts_at),
    ends_at: datetimeStr(subscription.ends_at),
    trial_ends_at: datetimeStr(subscription.trial_ends_at),
    auto_renew: subscription.auto_renew,
    gateway: subscription.gateway,
    planned_services: mapping ? await describeFeatures(mapping.features) : [],
  };
}

module.exports = { getPaymentPlanWithServices, checkout, renew, getCurrentSubscription };
