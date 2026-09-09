const { ok, err, unauthorized, auth, body, query, pathParam } = require('./_helpers');

module.exports = {
  '/tax-rates': {
    get: {
      tags: ['Taxonomy'],
      summary: 'List active tax rates',
      parameters: query('TaxonomyTaxRatesIndex'),
      responses: { 200: ok('Tax rates fetched.') },
    },
  },
  '/tax-rates/{id}': {
    get: {
      tags: ['Taxonomy'],
      summary: 'Get a single tax rate',
      parameters: [pathParam('id', 'Tax rate id.')],
      responses: { 200: ok('Tax rate fetched.'), 400: err('Not found.') },
    },
  },
  '/get-company-categories': {
    get: {
      tags: ['Taxonomy'],
      summary: 'List company categories (used at signup for company accounts)',
      responses: { 200: ok('Categories fetched.') },
    },
  },
  '/get-all-interest': {
    post: {
      tags: ['Taxonomy'],
      summary: 'List interests (self-referencing category tree)',
      ...auth,
      ...body('TaxonomyGetAllInterest'),
      responses: { 200: ok('Interests fetched.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
};
