const mongoose = require('mongoose');
const { Schema } = mongoose;

const interestSchema = new Schema(
  {
    title: { type: String, required: true },
    image: { type: String, default: null },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Interest', default: null },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Interest', interestSchema);
