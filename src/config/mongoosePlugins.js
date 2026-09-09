const mongoose = require('mongoose');

/**
 * Eloquent's default JSON serialization for a Carbon datetime attribute is
 * getDateFormat() ('Y-m-d H:i:s'), not ISO-8601 — so every timestamp on a
 * Laravel model (created_at/updated_at and friends) renders as e.g.
 * "2026-08-14 03:10:22", not "2026-08-14T03:10:22.000Z". Mongoose has no
 * equivalent default, so raw Date values would otherwise leak the full
 * ISO string on any endpoint that serializes a live document directly
 * (the generic admin CRUD helpers in utils/adminCrud.js, in particular).
 * Fields explicitly cast `date:Y-m-d` in Laravel (start_date/end_date/
 * event_date/dob) are formatted at their own call sites instead, since
 * those never reach this transform as raw Mongoose documents.
 */
function formatDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function deepFormatDates(value) {
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = deepFormatDates(value[i]);
    return value;
  }
  if (value && typeof value === 'object' && !value._bsontype) {
    for (const key of Object.keys(value)) value[key] = deepFormatDates(value[key]);
    return value;
  }
  return value;
}

/**
 * Laravel's JSON payloads key every record by `id` (numeric). We keep that field
 * name for parity even though the underlying value is now a Mongo ObjectId string —
 * applied globally so every schema (including embedded sub-documents) gets it.
 *
 * Required from both config/db.js and models/index.js (require() caches by path,
 * so this only ever registers once) so the transform is guaranteed to be in place
 * no matter which of the two happens to load first.
 */
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      if (ret._id) {
        ret.id = ret._id.toString();
        delete ret._id;
      }
      return deepFormatDates(ret);
    },
  });
  schema.set('toObject', { virtuals: true });
});

module.exports = mongoose;
