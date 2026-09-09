const TaxRate = require('../models/TaxRate');
const { escapeRegex } = require('../utils/regex');

/** Portal fee: customer pays half (÷2). General taxes: shown as-is. */
function format(t) {
  const isPortalFee = t.tax_category === 'portal_fee';
  const rate = isPortalFee ? t.rate / 2 : t.rate;

  return {
    id: t.id,
    name: t.name,
    rate: Math.round(rate * 10000) / 10000,
    rate_percent: `${Math.round(rate * 100 * 100) / 100}%`,
    tax_type: t.tax_type,
    tax_category: t.tax_category,
    applicable_to: t.applicable_to,
    country_code: t.country_code,
  };
}

async function getAll({ applicable_to, country_code } = {}) {
  const query = { is_active: true, deleted_at: null };

  if (applicable_to) {
    query.applicable_to = { $in: [applicable_to, 'both'] };
  }
  if (country_code) {
    query.$or = [{ country_code: country_code.toUpperCase() }, { country_code: null }];
  }

  // Mongo's ascending sort puts nulls before strings — the opposite of Laravel's
  // `orderByRaw('country_code IS NULL ASC')` (non-null first, null last). Sort by
  // name in Mongo, then a stable JS sort to fix the null-last grouping.
  const taxRates = await TaxRate.find(query).sort({ name: 1 });

  if (taxRates.length === 0) {
    const err = new Error('No tax rates found.');
    err.statusCode = 400;
    throw err;
  }

  taxRates.sort((a, b) => (a.country_code === null) - (b.country_code === null));

  return taxRates.map(format);
}

async function getById(id) {
  const taxRate = await TaxRate.findOne({ _id: id, is_active: true, deleted_at: null });
  if (!taxRate) {
    const err = new Error('Tax rate not found.');
    err.statusCode = 404;
    throw err;
  }
  return format(taxRate);
}

// ── Admin ────────────────────────────────────────────────────────────────────

function formatAdmin(t) {
  const isPortalFee = t.tax_category === 'portal_fee';
  const rate = isPortalFee ? t.rate / 2 : t.rate;

  return {
    id: t.id,
    name: t.name,
    rate: Math.round(rate * 10000) / 10000,
    rate_percent: `${Math.round(rate * 100 * 100) / 100}%`,
    tax_type: t.tax_type,
    tax_category: t.tax_category,
    applicable_to: t.applicable_to,
    country_code: t.country_code,
    is_active: t.is_active,
    created_at: t.created_at ? t.created_at.toISOString().replace('T', ' ').slice(0, 19) : null,
  };
}

async function adminGetAll({ applicable_to, tax_type, tax_category, is_active, search, per_page = 15, page = 1 } = {}) {
  const query = { deleted_at: null };
  if (applicable_to) query.applicable_to = applicable_to;
  if (tax_type) query.tax_type = tax_type;
  if (tax_category) query.tax_category = tax_category;
  if (is_active !== undefined) query.is_active = is_active;
  if (search) query.name = { $regex: escapeRegex(search), $options: 'i' };

  const total = await TaxRate.countDocuments(query);
  const rates = await TaxRate.find(query)
    .sort({ name: 1 })
    .skip((page - 1) * per_page)
    .limit(per_page);
  rates.sort((a, b) => (a.country_code === null) - (b.country_code === null));

  return { data: rates.map(formatAdmin), pagination: { current_page: page, per_page, total, last_page: Math.max(1, Math.ceil(total / per_page)) } };
}

async function toggleStatus(id) {
  const taxRate = await TaxRate.findById(id);
  if (!taxRate) {
    const err = new Error('Tax rate not found.');
    err.statusCode = 404;
    throw err;
  }
  taxRate.is_active = !taxRate.is_active;
  await taxRate.save();
  return formatAdmin(taxRate);
}

module.exports = { getAll, getById, format, adminGetAll, toggleStatus, formatAdmin };
