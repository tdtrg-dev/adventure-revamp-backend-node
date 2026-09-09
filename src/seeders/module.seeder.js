const FeatureCatalog = require('../models/FeatureCatalog');

/** Mirrors ModuleSeeder.php — Module was consolidated into FeatureCatalog (type: 'module'). */
const MODULES = [
  { name: 'Event Post', module_code: '120' },
  { name: 'Event Pictures', module_code: '130' },
  { name: 'Job Post', module_code: '140' },
  { name: 'Social Media Advertising', module_code: '150' },
  { name: 'Customer Support', module_code: '160' },
  { name: 'Dating Swipes', module_code: '170' },
  { name: 'Analytics', module_code: '180' },
];

async function seedModules() {
  for (const mod of MODULES) {
    await FeatureCatalog.findOneAndUpdate(
      { type: 'module', name: mod.name },
      { type: 'module', name: mod.name, module_code: mod.module_code },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`  Modules: ${MODULES.length} seeded (${MODULES.map((m) => m.name).join(', ')})`);
}

module.exports = { seedModules, MODULES };
