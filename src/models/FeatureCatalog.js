const mongoose = require('mongoose');
const { Schema } = mongoose;

// Merges services, modules, limit_types — identical id+name lookup shape,
// disambiguated by `type`. Admin CRUD routes for each stay separate URLs,
// filtered by `type` internally.
const featureCatalogSchema = new Schema(
  {
    type: { type: String, enum: ['service', 'module', 'limit_type'], required: true },
    name: { type: String, required: true },
    module_code: { type: String, default: null }, // only used when type === 'module'
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

featureCatalogSchema.index({ type: 1 });

module.exports = mongoose.model('FeatureCatalog', featureCatalogSchema);
