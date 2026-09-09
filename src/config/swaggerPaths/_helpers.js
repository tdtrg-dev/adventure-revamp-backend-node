// Small builders to keep every module's path manifest concise and consistent.

const json = (ref) => ({ content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });

const ok = (description, ref = 'ApiResponse') => ({ description, ...json(ref) });
const okList = (description) => ok(description, 'ApiListResponse');
const err = (description, ref = 'ApiError') => ({ description, ...json(ref) });
const unauthorized = (description = 'Missing or invalid token.') => err(description);

const auth = { security: [{ bearerAuth: [] }] };

function body(ref) {
  return { requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } } };
}

function query(ref) {
  const schema = require(`../swaggerSchemas`)[ref];
  const props = (schema && schema.properties) || {};
  const required = new Set((schema && schema.required) || []);
  return Object.entries(props).map(([name, s]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: s,
  }));
}

function pathParam(name, description, type = 'string') {
  return { name, in: 'path', required: true, description, schema: { type } };
}

// Admin CRUD envelope (see project memory: 2 distinct admin response shapes,
// both HTTP 200 always — even validation failures and server errors — matching
// a real upstream Laravel quirk that's replicated on purpose).
const adminOk = (description) => ok(description, 'AdminResponse');
const adminList = (description) => ok(description, 'AdminListResponse');
const adminValidation = (description = 'Validation failed.') => ok(description, 'AdminValidationError');

/**
 * Generates the standard 5-route admin CRUD block (list/create/show/update/delete)
 * that Laravel's ApiBaseController-derived admin controllers all share. Covers
 * ~6 resources in this app (company-category, tax-rates, payment-plans,
 * service-module-mappings, services, modules, limit-types) — see admin/*.paths.js.
 */
function adminCrudPaths(resource, { summaryNoun, bodyRef, idParamName = 'id', extraListParams = [] } = {}) {
  const noun = summaryNoun || resource.replace(/-/g, ' ');
  const listPath = `/admin/${resource}`;
  const itemPath = `/admin/${resource}/{${idParamName}}`;

  return {
    [listPath]: {
      get: {
        tags: ['Admin'],
        summary: `List ${noun}`,
        ...auth,
        ...(extraListParams.length ? { parameters: extraListParams } : {}),
        responses: { 200: adminList(`${noun} fetched.`), 401: unauthorized() },
      },
      post: {
        tags: ['Admin'],
        summary: `Create a ${noun.replace(/s$/, '')}`,
        ...auth,
        ...(bodyRef ? body(bodyRef) : {}),
        responses: { 200: adminOk('Record created.'), 422: adminValidation(), 401: unauthorized() },
      },
    },
    [itemPath]: {
      get: {
        tags: ['Admin'],
        summary: `Get a single ${noun.replace(/s$/, '')}`,
        ...auth,
        parameters: [pathParam(idParamName, 'Record id.')],
        responses: { 200: adminOk('Record found.'), 401: unauthorized() },
      },
      put: {
        tags: ['Admin'],
        summary: `Update a ${noun.replace(/s$/, '')}`,
        ...auth,
        parameters: [pathParam(idParamName, 'Record id.')],
        ...(bodyRef ? body(bodyRef) : {}),
        responses: { 200: adminOk('Record updated.'), 422: adminValidation(), 401: unauthorized() },
      },
      delete: {
        tags: ['Admin'],
        summary: `Delete a ${noun.replace(/s$/, '')}`,
        ...auth,
        parameters: [pathParam(idParamName, 'Record id.')],
        responses: { 200: adminOk('Record deleted.'), 401: unauthorized() },
      },
    },
  };
}

module.exports = { json, ok, okList, err, unauthorized, auth, body, query, pathParam, adminOk, adminList, adminValidation, adminCrudPaths };
