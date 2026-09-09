const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Small standalone collection (a partial reversal of the original full-embedding
 * plan for the plan/service/module feature-gating subsystem): the admin CRUD API
 * treats service-module-mappings as an independently addressable resource — you
 * create one and reference its id later when creating a plan-service — so it
 * needs its own id, which an inline {service_id, module_id} pair on a plan
 * feature entry can't provide. Kept intentionally tiny.
 */
const serviceModuleMappingSchema = new Schema(
  {
    service_id: { type: Schema.Types.ObjectId, ref: 'FeatureCatalog', required: true },
    module_id: { type: Schema.Types.ObjectId, ref: 'FeatureCatalog', required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('ServiceModuleMapping', serviceModuleMappingSchema);
