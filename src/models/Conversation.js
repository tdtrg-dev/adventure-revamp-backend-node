const mongoose = require('mongoose');
const { Schema } = mongoose;

// was conversation_participants
const participantSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_until: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    is_group: { type: Boolean, default: false },
    name: { type: String, default: null },
    last_message_id: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    group_id: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    participants: [participantSchema],
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

conversationSchema.index({ 'participants.user_id': 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
