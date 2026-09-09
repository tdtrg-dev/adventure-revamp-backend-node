const mongoose = require('mongoose');
const { Schema } = mongoose;

const parkStayLeadSchema = new Schema(
  {
    type: { type: String, enum: ['host', 'guest'], required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    description: { type: String, default: null },
    status: { type: String, enum: ['new', 'contacted', 'converted', 'rejected'], default: 'new' },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

parkStayLeadSchema.index({ email: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('ParkStayLead', parkStayLeadSchema);
