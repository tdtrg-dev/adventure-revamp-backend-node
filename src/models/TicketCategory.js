const mongoose = require('mongoose');
const { Schema } = mongoose;

// was ticket_category_details — a hasMany (multiple offer rows per category), not 1:1
const ticketCategoryDetailSchema = new Schema(
  {
    offer_title: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// merges ticket_category_details into this collection as an embedded array
const ticketCategorySchema = new Schema(
  {
    title: { type: String, required: true },
    details: [ticketCategoryDetailSchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('TicketCategory', ticketCategorySchema);
