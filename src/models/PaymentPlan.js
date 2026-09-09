const mongoose = require('mongoose');
const { Schema } = mongoose;

// was plan_services
const planFeatureSchema = new Schema(
  {
    service_module_mapping_id: { type: Schema.Types.ObjectId, ref: 'ServiceModuleMapping', required: true },
    limit_type_id: { type: Schema.Types.ObjectId, ref: 'FeatureCatalog', default: null },
    allow_limit: { type: String, default: null },
    is_enable: { type: String, enum: ['yes', 'no'], default: 'yes' },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// was plan_cost_mappings
const planCostMappingSchema = new Schema(
  {
    plan_for: { type: String, enum: ['individual', 'company'], required: true },
    plan_type: { type: String, enum: ['monthly', 'yearly'], required: true },
    price: { type: Number, required: true },
    tax_rate_id: { type: Schema.Types.ObjectId, ref: 'TaxRate', default: null },
    features: [planFeatureSchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const paymentPlanSchema = new Schema(
  {
    title: { type: String, required: true },
    cost_mappings: [planCostMappingSchema],
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PaymentPlan', paymentPlanSchema);
