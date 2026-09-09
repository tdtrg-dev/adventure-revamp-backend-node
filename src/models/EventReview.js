const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventReviewSchema = new Schema(
  {
    event_id: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    review: { type: String, default: null },
    is_approved: { type: Boolean, default: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

eventReviewSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('EventReview', eventReviewSchema);
