const mongoose = require('mongoose');
const { Schema } = mongoose;

// was ticket_booking_items
const bookingItemSchema = new Schema(
  {
    event_price_id: { type: Schema.Types.ObjectId, default: null }, // references Event.prices[]._id
    ticket_cat_id: { type: Schema.Types.ObjectId, ref: 'TicketCategory', required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    line_total: { type: Number, required: true },
    person_name: { type: String, default: null },
    person_email: { type: String, default: null },
    qr_token: { type: String, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'used'], default: 'pending' },
    scanned_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const ticketBookingSchema = new Schema(
  {
    event_id: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contact_number: { type: String, default: null },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'used'], default: 'pending' },
    qr_token: { type: String, required: true },
    cancelled_at: { type: Date, default: null },
    cancelled_reason: { type: String, default: null },
    refunded_at: { type: Date, default: null },
    scanned_at: { type: Date, default: null },
    subtotal: { type: Number, required: true },
    tax_amount: { type: Number, default: 0 },
    portal_fee_rate: { type: Number, default: 0 },
    customer_portal_fee: { type: Number, default: 0 },
    organizer_portal_fee: { type: Number, default: 0 },
    organizer_net_amount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    invoice_number: { type: String, required: true, unique: true },

    items: [bookingItemSchema],

    // was ticket_booking_payments (1:1 join)
    payment: {
      payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
      refund_payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
      refund_amount: { type: Number, default: null },
      refunded_at: { type: Date, default: null },
      refund_reason: { type: String, default: null },
    },

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

ticketBookingSchema.index({ event_id: 1 });
ticketBookingSchema.index({ user_id: 1 });
ticketBookingSchema.index({ qr_token: 1 });

module.exports = mongoose.model('TicketBooking', ticketBookingSchema);
