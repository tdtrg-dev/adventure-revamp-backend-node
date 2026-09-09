const mongoose = require('mongoose');
const { Schema } = mongoose;

const postCommentSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent_id: { type: Schema.Types.ObjectId, ref: 'PostComment', default: null },
    comment: { type: String, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

postCommentSchema.index({ post_id: 1 });
postCommentSchema.index({ parent_id: 1 });

module.exports = mongoose.model('PostComment', postCommentSchema);
