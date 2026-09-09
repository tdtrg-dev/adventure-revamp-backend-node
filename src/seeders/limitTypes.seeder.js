const FeatureCatalog = require('../models/FeatureCatalog');

/** Mirrors LimitTypesSeeder.php — LimitType was consolidated into FeatureCatalog (type: 'limit_type'). */
async function seedLimitTypes() {
  const names = ['Daily', 'Weekly', 'Monthly'];

  for (const name of names) {
    await FeatureCatalog.findOneAndUpdate(
      { type: 'limit_type', name },
      { type: 'limit_type', name },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`  Limit types: ${names.length} seeded (${names.join(', ')})`);
}

module.exports = seedLimitTypes;
