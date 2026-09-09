const mongoose = require('mongoose');
const { Schema } = mongoose;

const taxRateSchema = new Schema(
  {
    name: { type: String, required: true },
    rate: { type: Number, required: true }, // decimal, e.g. 0.0825
    tax_type: { type: String, enum: ['inclusive', 'exclusive'], required: true },
    applicable_to: { type: String, enum: ['subscription', 'ticket', 'both'], required: true },
    tax_category: { type: String, enum: ['general', 'portal_fee'], default: 'general' },
    country_code: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('TaxRate', taxRateSchema);
