const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Net-new collection (no Laravel table) — Laravel generated invoice numbers like
 * "TKT-2026-000001" from the row's auto-increment integer id. Since primary keys
 * are now ObjectId strings (no sequential integer to lean on), this gives an
 * atomic per-prefix-per-year counter to keep that human-readable format.
 */
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. "TKT-2026"
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
