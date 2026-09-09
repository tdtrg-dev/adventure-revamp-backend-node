const mongoose = require('mongoose');
const { Schema } = mongoose;

const rewardTransactionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    action_type: { type: String, enum: ['reaction', 'comment', 'share'], required: true },
    action_count: { type: Number, required: true },
    points_earned: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

rewardTransactionSchema.index({ user_id: 1 });

module.exports = mongoose.model('RewardTransaction', rewardTransactionSchema);
