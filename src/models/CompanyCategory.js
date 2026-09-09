const mongoose = require('mongoose');
const { Schema } = mongoose;

const companyCategorySchema = new Schema(
  {
    title: { type: String, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('CompanyCategory', companyCategorySchema);
