const mongoose = require('mongoose');
const { Schema } = mongoose;

const rewardRuleSchema = new Schema(
  {
    action_type: { type: String, enum: ['reaction', 'comment', 'share'], required: true },
    action_count: { type: Number, required: true },
    reward_points: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('RewardRule', rewardRuleSchema);
