const mongoose = require('mongoose');
const { Schema } = mongoose;

const mediaSchema = new Schema(
  {
    file_path: { type: String, required: true },
    file_type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// was post_reactions
const reactionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reaction_type: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, _id: false }
);

const postSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    group_id: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    original_post_id: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    event_id: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
    title: { type: String, default: null },
    description: { type: String, default: null },
    event_link: { type: String, default: null },
    status: { type: String, enum: ['publish', 'draft'], default: 'publish' },
    visibility: { type: String, enum: ['Public', 'Friends', 'Private'], default: 'Public' },

    interests: [{ type: Schema.Types.ObjectId, ref: 'Interest' }], // was post_interests
    media: [mediaSchema],

    saved_by: [{ type: Schema.Types.ObjectId, ref: 'User' }], // was post_saves
    hidden_by: [{ type: Schema.Types.ObjectId, ref: 'User' }], // was post_hides
    shared_by: [{ type: Schema.Types.ObjectId, ref: 'User' }], // was post_shares
    reactions: [reactionSchema], // was post_reactions

    // was post_reward_counters — tracks how many of each action already converted to points
    reward_counters: {
      reaction: { type: Number, default: 0 },
      comment: { type: Number, default: 0 },
      share: { type: Number, default: 0 },
    },

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

postSchema.index({ user_id: 1 });
postSchema.index({ group_id: 1 });
postSchema.index({ saved_by: 1 });
postSchema.index({ hidden_by: 1 });

module.exports = mongoose.model('Post', postSchema);
