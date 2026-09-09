const mongoose = require('mongoose');
const { Schema } = mongoose;

// was message_statuses (1 row per message per recipient — relevant mainly for group chats)
const statusSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation_id: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'video', 'file', 'audio'], default: 'text' },
    delivered_at: { type: Date, default: null },
    read_at: { type: Date, default: null },
    statuses: [statusSchema],
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

messageSchema.index({ conversation_id: 1, created_at: -1 });

module.exports = mongoose.model('Message', messageSchema);
