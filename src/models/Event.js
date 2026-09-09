const mongoose = require('mongoose');
const { Schema } = mongoose;

// was event_details
const eventDetailSchema = new Schema(
  {
    event_date: { type: Date, required: true },
    description: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// was event_prices
const eventPriceSchema = new Schema(
  {
    ticket_cat_id: { type: Schema.Types.ObjectId, ref: 'TicketCategory', required: true },
    ticket_quantity: { type: Number, default: 0 },
    price: { type: Number, required: true },
    is_unlimited_tickets: { type: String, enum: ['yes', 'no'], default: 'no' },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// was polymorphic `media` table (event-portion)
const mediaSchema = new Schema(
  {
    file_path: { type: String, required: true },
    file_type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const eventSchema = new Schema(
  {
    trip_name: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    location_name: { type: String, default: null },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    location_lat: { type: Number, default: null },
    location_long: { type: Number, default: null },
    description: { type: String, default: null },
    website_link: { type: String, default: null },
    image_thumbnail: { type: String, default: null },
    organizer_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    created_by_role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // 'draft' is an admin-only "unpublished by moderation" state (see Admin\UserController::actionReport's
    // unpublish action) — Laravel's DB enum never actually included it (a real bug there), but the intent
    // is clear, so it's added here as a first-class status rather than replicating the crash.
    status: { type: String, enum: ['pending', 'publish', 'cancel', 'draft'], default: 'pending' },

    gears: [{ type: String }], // was event_gears
    details: [eventDetailSchema], // was event_details
    prices: [eventPriceSchema], // was event_prices
    interests: [{ type: Schema.Types.ObjectId, ref: 'Interest' }], // was event_interests
    media: [mediaSchema], // was polymorphic media

    favourited_by: [{ type: Schema.Types.ObjectId, ref: 'User' }], // was event_favourites

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

eventSchema.index({ location: '2dsphere' });
eventSchema.index({ organizer_id: 1 });
eventSchema.index({ favourited_by: 1 });
eventSchema.index({ interests: 1 });

module.exports = mongoose.model('Event', eventSchema);
