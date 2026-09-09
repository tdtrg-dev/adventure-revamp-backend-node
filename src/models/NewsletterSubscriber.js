const mongoose = require('mongoose');
const { Schema } = mongoose;

const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    is_active: { type: Boolean, default: true },
    subscribed_at: { type: Date, default: Date.now },
    unsubscribed_at: { type: Date, default: null },
    source: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
