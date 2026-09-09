const mongoose = require('mongoose');
const { Schema } = mongoose;

const postViewSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    ip_address: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

postViewSchema.index({ post_id: 1 });

module.exports = mongoose.model('PostView', postViewSchema);
