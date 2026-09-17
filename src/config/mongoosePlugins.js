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

const SOFT_DELETE_FIELD = 'deleted_at';

/**
 * Read operations only. Writes (updateOne/updateMany/findOneAndUpdate/deleteOne)
 * are deliberately left unscoped: the seeders upsert by natural key, and the hard
 * deletes in utils/adminCrud.js and event.service's deleteEvent must still be able
 * to reach a row that has already been soft-deleted.
 *
 * Model.exists() and populate() both run through findOne/find internally, so they
 * inherit the scope without needing a hook of their own.
 */
const SOFT_DELETE_READ_OPS = ['find', 'findOne', 'countDocuments', 'distinct'];

/**
 * Laravel's SoftDeletes trait installs a global scope that appends
 * `deleted_at IS NULL` to every query on the model. Mongoose has no equivalent, so
 * each ported service was left to remember the filter by hand — and the group reads
 * never did, which is why a deleted group kept coming back from every listing
 * endpoint even though the delete itself had succeeded. The event and post reads
 * were only half-converted, so a soft-deleted row vanished from some screens and
 * lingered on others.
 *
 * This restores the global scope: any schema declaring a `deleted_at` path gets the
 * filter injected into its reads and its aggregations. An explicit `deleted_at` in
 * the caller's own filter still wins — which leaves every pre-existing
 * `deleted_at: null` in the services behaving exactly as it did — and
 * `.withTrashed()` opts a single query out.
 */
function softDeletePlugin(schema) {
  if (!schema.path(SOFT_DELETE_FIELD)) return;

  schema.query.withTrashed = function withTrashed() {
    return this.setOptions({ withTrashed: true });
  };

  schema.query.onlyTrashed = function onlyTrashed() {
    return this.setOptions({ withTrashed: true }).where({ [SOFT_DELETE_FIELD]: { $ne: null } });
  };

  schema.pre(SOFT_DELETE_READ_OPS, function excludeTrashed() {
    if (this.getOptions().withTrashed) return;
    if (this.getFilter()[SOFT_DELETE_FIELD] !== undefined) return;
    this.where({ [SOFT_DELETE_FIELD]: null });
  });

  schema.pre('aggregate', function excludeTrashedFromPipeline() {
    if (this.options && this.options.withTrashed) return;

    const pipeline = this.pipeline();
    const first = pipeline[0];

    // $geoNear has to stay the first stage of a pipeline, so its filter goes inside
    // the stage's own `query` rather than into a $match prepended ahead of it. The
    // caller's query is spread last so an explicit deleted_at still wins.
    if (first && first.$geoNear) {
      first.$geoNear.query = { [SOFT_DELETE_FIELD]: null, ...(first.$geoNear.query || {}) };
      return;
    }

    pipeline.unshift({ $match: { [SOFT_DELETE_FIELD]: null } });
  });
}

mongoose.plugin(softDeletePlugin);

module.exports = mongoose;
