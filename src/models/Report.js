const mongoose = require('mongoose');
const { Schema } = mongoose;

// Unifies user_reports (profile|event) + post_reports (post) — one moderation-queue concept.
const reportSchema = new Schema(
  {
    reporter_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target_type: { type: String, enum: ['profile', 'event', 'post'], required: true },
    // refPath lets populate('target_id') resolve to the right collection per target_type
    // (profile -> User, event -> Event, post -> Post) — mirrors Laravel's morphTo.
    target_model: {
      type: String,
      required: true,
      enum: ['User', 'Event', 'Post'],
      default: function () {
        return { profile: 'User', event: 'Event', post: 'Post' }[this.target_type];
      },
    },
    target_id: { type: Schema.Types.ObjectId, required: true, refPath: 'target_model' },
    report_link: { type: String, default: null },
    reason: { type: String, required: true },
    message: { type: String, default: null },
    attachment: { type: String, default: null },
    status: { type: String, enum: ['pending', 'resolved', 'declined'], default: 'pending' },
    admin_remarks: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

reportSchema.index({ reporter_id: 1, target_type: 1, target_id: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
