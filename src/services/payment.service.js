const Payment = require('../models/Payment');
const Admin = require('../models/Admin');
const TaxRate = require('../models/TaxRate');
const env = require('../config/env');

let cachedPlatformAdminId = null;

/** Mirrors config('payment.platform_admin_id', 1) — falls back to the first admin found. */
async function getPlatformAdminId() {
  if (env.payment.platformAdminId) return env.payment.platformAdminId;
  if (cachedPlatformAdminId) return cachedPlatformAdminId;

  const admin = await Admin.findOne().sort({ _id: 1 }).select('_id');
  if (!admin) throw new Error('No platform admin account configured.');
  cachedPlatformAdminId = admin._id;
  return cachedPlatformAdminId;
}

/** Mirrors PaymentRepository::createPayment — the one reusable payment-record creator. */
async function createPayment(data) {
  return Payment.create({
    payer_type: data.payer_type,
    payer_id: data.payer_id,
    payee_type: data.payee_type || 'admin',
    payee_id: data.payee_id,
    payment_type: data.payment_type,
    amount: data.amount,
    subtotal: data.subtotal,
    tax_amount: data.tax_amount ?? 0,
    tax_rate_id: data.tax_rate_id ?? null,
    currency: data.currency || env.payment.defaultCurrency,
    status: data.status || 'completed',
    gateway: data.gateway,
    gateway_transaction_id: data.gateway_transaction_id ?? null,
    gateway_response: data.gateway_response ?? null,
    description: data.description ?? null,
    metadata: data.metadata ?? null,
    paid_at: data.paid_at || new Date(),
  });
}

/** Mirrors TaxRate::calculateTaxAmount. */
function calculateTaxAmount(taxRate, subtotal) {
  if (taxRate.tax_type === 'inclusive') {
    return Math.round((subtotal - subtotal / (1 + taxRate.rate)) * 100) / 100;
  }
  return Math.round(subtotal * taxRate.rate * 100) / 100;
}

/** Mirrors the portal-fee lookup used by bookTicket/refundBooking/createPaymentIntent. */
async function getActivePortalFeeRate(applicableTo) {
  const record = await TaxRate.findOne({
    is_active: true,
    tax_category: 'portal_fee',
    applicable_to: { $in: [applicableTo, 'both'] },
  });
  return record ? record.rate : 0;
}

async function getActiveGeneralTaxAmount(applicableTo, subtotal) {
  const rates = await TaxRate.find({
    is_active: true,
    tax_category: 'general',
    tax_type: 'exclusive',
    applicable_to: { $in: [applicableTo, 'both'] },
  });
  const total = rates.reduce((sum, r) => sum + calculateTaxAmount(r, subtotal), 0);
  return Math.round(total * 100) / 100;
}

module.exports = { createPayment, getPlatformAdminId, calculateTaxAmount, getActivePortalFeeRate, getActiveGeneralTaxAmount };
