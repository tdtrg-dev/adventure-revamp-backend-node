const { ok, unauthorized, auth, body, pathParam, adminCrudPaths, adminOk, adminValidation } = require('./_helpers');

const paymentPlanIdQuery = [{ name: 'payment_plan_id', in: 'query', schema: { type: 'string' }, description: 'Filter to one payment plan.' }];
const costMappingIdQuery = [{ name: 'plan_cost_mapping_id', in: 'query', schema: { type: 'string' }, description: 'Filter to one cost mapping.' }];

module.exports = {
  ...adminCrudPaths('payment-plans', { summaryNoun: 'payment plans', bodyRef: 'AdminPaymentPlan' }),
  ...adminCrudPaths('service-module-mappings', { summaryNoun: 'service-module mappings', bodyRef: 'AdminServiceModuleMapping' }),
  ...adminCrudPaths('services', { summaryNoun: 'billable services', bodyRef: 'AdminFeatureCatalogService' }),
  ...adminCrudPaths('modules', { summaryNoun: 'plan modules', bodyRef: 'AdminFeatureCatalogModule' }),
  ...adminCrudPaths('limit-types', { summaryNoun: 'limit types', bodyRef: 'AdminFeatureCatalogLimitType' }),

  // ── plan-cost-mappings — embedded inside PaymentPlan.cost_mappings[] ─────────
  '/admin/plan-cost-mappings': {
    get: {
      tags: ['Admin'],
      summary: 'List cost mappings across all plans (or one plan via payment_plan_id)',
      ...auth,
      parameters: paymentPlanIdQuery,
      responses: { 200: ok('Cost mappings fetched successfully.'), 401: unauthorized() },
    },
    post: {
      tags: ['Admin'],
      summary: 'Add a cost mapping to a payment plan',
      ...auth,
      ...body('AdminPlanCostMapping'),
      responses: { 200: adminOk('Record created.'), 422: adminValidation(), 401: unauthorized() },
    },
  },
  '/admin/plan-cost-mappings/{id}': {
    get: {
      tags: ['Admin'],
      summary: 'Get a single cost mapping',
      ...auth,
      parameters: [pathParam('id', 'Cost mapping id.')],
      responses: { 200: adminOk('Record found.'), 401: unauthorized() },
    },
    put: {
      tags: ['Admin'],
      summary: 'Update a cost mapping',
      ...auth,
      parameters: [pathParam('id', 'Cost mapping id.')],
      ...body('AdminPlanCostMapping'),
      responses: { 200: adminOk('Record updated.'), 422: adminValidation(), 401: unauthorized() },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Delete a cost mapping',
      ...auth,
      parameters: [pathParam('id', 'Cost mapping id.')],
      responses: { 200: adminOk('Record deleted.'), 401: unauthorized() },
    },
  },

  // ── plan-services — embedded inside cost_mapping.features[] ──────────────────
  '/admin/plan-services': {
    get: {
      tags: ['Admin'],
      summary: 'List plan-service features (or one cost mapping’s via plan_cost_mapping_id)',
      ...auth,
      parameters: costMappingIdQuery,
      responses: { 200: ok('Plan services fetched successfully.'), 401: unauthorized() },
    },
    post: {
      tags: ['Admin'],
      summary: 'Attach a service/module/limit feature to a cost mapping',
      ...auth,
      ...body('AdminPlanService'),
      responses: { 200: adminOk('Record created.'), 422: adminValidation(), 401: unauthorized() },
    },
  },
  '/admin/plan-services/{id}': {
    get: {
      tags: ['Admin'],
      summary: 'Get a single plan-service feature',
      ...auth,
      parameters: [pathParam('id', 'Plan-service id.')],
      responses: { 200: adminOk('Record found.'), 401: unauthorized() },
    },
    put: {
      tags: ['Admin'],
      summary: 'Update a plan-service feature',
      ...auth,
      parameters: [pathParam('id', 'Plan-service id.')],
      ...body('AdminPlanService'),
      responses: { 200: adminOk('Record updated.'), 422: adminValidation(), 401: unauthorized() },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Delete a plan-service feature',
      ...auth,
      parameters: [pathParam('id', 'Plan-service id.')],
      responses: { 200: adminOk('Record deleted.'), 401: unauthorized() },
    },
  },
};
