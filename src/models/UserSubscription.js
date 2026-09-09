const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSubscriptionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payment_plan_id: { type: Schema.Types.ObjectId, ref: 'PaymentPlan', required: true },
    plan_cost_mapping_id: { type: Schema.Types.ObjectId, required: true }, // sub-doc _id within PaymentPlan.cost_mappings
    status: { type: String, enum: ['pending', 'active', 'cancelled', 'expired', 'on_hold'], default: 'pending' },
    trial_ends_at: { type: Date, default: null },
    starts_at: { type: Date, default: null },
    ends_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancellation_reason: { type: String, default: null },
    auto_renew: { type: Boolean, default: true },
    gateway: { type: String, enum: ['stripe', 'manual', 'free', 'google', 'apple'], required: true },
    gateway_subscription_id: { type: String, default: null, unique: true, sparse: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSubscriptionSchema.index({ user_id: 1 });
userSubscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
