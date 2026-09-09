const mongoose = require('mongoose');
const { Schema } = mongoose;

const payoutSchema = new Schema(
  {
    admin_id: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'reversed'], default: 'pending' },
    gateway: { type: String, enum: ['stripe', 'manual', 'bank_transfer'], default: 'stripe' },
    gateway_payout_id: { type: String, default: null, unique: true, sparse: true },
    gateway_response: { type: Schema.Types.Mixed, default: null },
    initiated_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    notes: { type: String, default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Payout', payoutSchema);
