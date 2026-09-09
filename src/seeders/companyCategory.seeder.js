const CompanyCategory = require('../models/CompanyCategory');

/** Mirrors CompanyCategorySeeder.php. */
async function seedCompanyCategories() {
  const titles = ['IT', 'Agency'];

  for (const title of titles) {
    await CompanyCategory.findOneAndUpdate({ title }, { title }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  console.log(`  Company categories: ${titles.length} seeded (${titles.join(', ')})`);
}

module.exports = seedCompanyCategories;
