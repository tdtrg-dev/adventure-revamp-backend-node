const mongoose = require('mongoose');
const { Schema } = mongoose;

// friend-request lifecycle — distinct from User.following (a simpler one-way follow)
const connectionSchema = new Schema(
  {
    sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

connectionSchema.index({ sender_id: 1, receiver_id: 1 }, { unique: true });

module.exports = mongoose.model('Connection', connectionSchema);
