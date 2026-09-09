const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, required: true },
    related_type: { type: String, default: null },
    related_id: { type: Schema.Types.ObjectId, default: null },
    data: { type: Schema.Types.Mixed, default: null },
    title: { type: String, default: null },
    body: { type: String, default: null },
    read_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

notificationSchema.index({ recipient_id: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
