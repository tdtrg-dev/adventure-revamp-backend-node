const mongoose = require('mongoose');
const { Schema } = mongoose;

const loginHistorySchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    location: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
