const { ok, err, unauthorized, auth, pathParam, adminCrudPaths } = require('./_helpers');

module.exports = {
  ...adminCrudPaths('company-category', { summaryNoun: 'company categories', bodyRef: 'AdminCompanyCategory' }),
  ...adminCrudPaths('interest', { summaryNoun: 'interests' }), // create/update bypass the shared Joi rules — see route source
  ...adminCrudPaths('tax-rates', { summaryNoun: 'tax rates', bodyRef: 'AdminTaxRateCreate' }),

  '/admin/tax-rates/{id}/toggle-status': {
    patch: {
      tags: ['Admin'],
      summary: 'Toggle whether a tax rate is active (standard envelope, not the admin-CRUD one)',
      ...auth,
      parameters: [pathParam('id', 'Tax rate id.')],
      responses: { 200: ok('Tax rate status updated successfully.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
};
