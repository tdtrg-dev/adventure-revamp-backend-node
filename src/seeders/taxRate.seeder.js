const TaxRate = require('../models/TaxRate');

// Mirrors TaxRateSeeder.php — only 'Portal Fee' is actually live there; the
// GST/VAT general-tax entries in the Laravel seeder are commented out (dead),
// so they're intentionally not ported here either.
const TAX_RATES = [
  { name: 'Portal Fee', rate: 0.075, tax_type: 'exclusive', applicable_to: 'ticket', tax_category: 'portal_fee', country_code: null, is_active: true },
];

async function seedTaxRates() {
  for (const rate of TAX_RATES) {
    await TaxRate.findOneAndUpdate(
      { name: rate.name, country_code: rate.country_code },
      rate,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`  Tax rates: ${TAX_RATES.length} seeded (${TAX_RATES.map((t) => t.name).join(', ')})`);
}

module.exports = seedTaxRates;
