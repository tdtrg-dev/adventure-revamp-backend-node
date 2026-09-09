const j2s = require('joi-to-swagger');

/**
 * Auto-converts every Joi validator schema into an OpenAPI component schema, so
 * route docs can `$ref` a validator's actual shape instead of re-describing it by
 * hand — single source of truth, and it stays accurate as validators change.
 * Named `<Prefix><PascalCaseExportName>`, e.g. AuthSignup, EventCreateOrUpdateEvent.
 */
const VALIDATOR_MODULES = {
  Admin: require('../validators/admin.validators'),
  Auth: require('../validators/auth.validators'),
  Booking: require('../validators/booking.validators'),
  Chat: require('../validators/chat.validators'),
  Community: require('../validators/community.validators'),
  Connection: require('../validators/connection.validators'),
  Dashboard: require('../validators/dashboard.validators'),
  Event: require('../validators/event.validators'),
  Onboarding: require('../validators/onboarding.validators'),
  Public: require('../validators/public.validators'),
  Subscription: require('../validators/subscription.validators'),
  Taxonomy: require('../validators/taxonomy.validators'),
  Website: require('../validators/website.validators'),
};

function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function buildValidatorSchemas() {
  const schemas = {};
  for (const [prefix, mod] of Object.entries(VALIDATOR_MODULES)) {
    for (const [exportName, schema] of Object.entries(mod)) {
      if (schema && typeof schema.validate === 'function' && schema.type === 'object') {
        schemas[`${prefix}${pascalCase(exportName)}`] = j2s(schema).swagger;
      }
    }
  }
  return schemas;
}

module.exports = buildValidatorSchemas();
