const mongoose = require('mongoose');
const { Schema } = mongoose;

// was group_members
const groupMemberSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'invited'], default: 'pending' },
    member_type: { type: String, enum: ['admin', 'member'], default: 'member' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const groupSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // owner
    group_type: { type: String, enum: ['event', 'community'], required: true },
    event_id: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    title: { type: String, required: true },
    description: { type: String, default: null },
    visibility: { type: String, enum: ['Public', 'Private'], default: 'Public' },
    group_photo: { type: String, default: null },
    cover_photo: { type: String, default: null },

    members: [groupMemberSchema],

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

groupSchema.index({ 'members.user_id': 1 });
groupSchema.index({ event_id: 1 });

module.exports = mongoose.model('Group', groupSchema);
