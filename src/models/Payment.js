const mongoose = require('mongoose');
const { Schema } = mongoose;

// was payment_splits
const paymentSplitSchema = new Schema(
  {
    split_type: { type: String, enum: ['platform_fee', 'creator_earnings', 'tax', 'refund_deduction'], required: true },
    recipient_type: { type: String, enum: ['user', 'admin'], default: null },
    recipient_id: { type: Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true },
    percentage: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'transferred', 'failed'], default: 'pending' },
    payout_id: { type: Schema.Types.ObjectId, ref: 'Payout', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// was subscription_payment_details (1:1)
const subscriptionDetailSchema = new Schema(
  {
    user_subscription_id: { type: Schema.Types.ObjectId, ref: 'UserSubscription', default: null },
    plan_cost_mapping_id: { type: Schema.Types.ObjectId, default: null },
    billing_cycle: { type: String, enum: ['monthly', 'yearly'], default: null },
    period_start: { type: Date, default: null },
    period_end: { type: Date, default: null },
    invoice_number: { type: String, default: null },
    is_renewal: { type: Boolean, default: false },
  },
  { _id: false }
);

const paymentSchema = new Schema(
  {
    payer_type: { type: String, enum: ['user', 'admin'], required: true },
    payer_id: { type: Schema.Types.ObjectId, required: true },
    payee_type: { type: String, enum: ['user', 'admin'], default: null },
    payee_id: { type: Schema.Types.ObjectId, default: null },
    payment_type: { type: String, enum: ['subscription', 'ticket_purchase', 'payout', 'refund', 'manual'], required: true },
    amount: { type: Number, required: true },
    subtotal: { type: Number, default: null },
    tax_amount: { type: Number, default: 0 },
    tax_rate_id: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
    gateway: { type: String, enum: ['stripe', 'manual', 'free', 'bank_transfer'], default: 'stripe' },
    // No `default: null` — see Payout.gateway_payout_id for why an explicit
    // null default breaks the sparse+unique index (multiple gateway-less
    // payments, e.g. manual/free-adjacent ones, would collide on shared null).
    gateway_transaction_id: { type: String, unique: true, sparse: true },
    gateway_response: { type: Schema.Types.Mixed, default: null },
    description: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    paid_at: { type: Date, default: null },

    splits: [paymentSplitSchema],
    subscription_detail: { type: subscriptionDetailSchema, default: null },

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

paymentSchema.index({ payer_type: 1, payer_id: 1 });
paymentSchema.index({ payee_type: 1, payee_id: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
