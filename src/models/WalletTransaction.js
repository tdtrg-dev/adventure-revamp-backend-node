const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletTransactionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transaction_type: { type: String, enum: ['credit', 'debit'], required: true },
    source_type: { type: String, enum: ['ticket_sale', 'payout', 'refund', 'adjustment', 'subscription'], required: true },
    source_id: { type: Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true },
    balance_before: { type: Number, required: true },
    balance_after: { type: Number, required: true },
    description: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

walletTransactionSchema.index({ user_id: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
