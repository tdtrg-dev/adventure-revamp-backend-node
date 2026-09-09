const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventVisitSchema = new Schema(
  {
    event_id: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visit_count: { type: Number, default: 1 },
    last_visited_at: { type: Date, default: Date.now },
    ip_address: { type: String, default: null },
    user_agent: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

eventVisitSchema.index({ event_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('EventVisit', eventVisitSchema);
