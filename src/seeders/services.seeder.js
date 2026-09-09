const FeatureCatalog = require('../models/FeatureCatalog');
const ServiceModuleMapping = require('../models/ServiceModuleMapping');

const SERVICE_NAMES = [
  'Swipes',
  'Events Posts',
  'Event Pictures',
  'Job Posts',
  'Advertising Campaigns On Add-Venture Social Media',
  '24/7 Customer Support',
  'Analytics',
];

// Mirrors ServicesSeeder.php's two ServiceModuleMapping rows, keyed by the
// module's module_code (Helper::getModuleIdOnTheBaseOfCode(...) in Laravel).
const MAPPINGS = [
  { serviceName: 'Swipes', moduleCode: '170' },
  { serviceName: 'Events Posts', moduleCode: '120' },
];

/** Mirrors ServicesSeeder.php — Service was consolidated into FeatureCatalog (type: 'service'). */
async function seedServices() {
  for (const name of SERVICE_NAMES) {
    await FeatureCatalog.findOneAndUpdate(
      { type: 'service', name },
      { type: 'service', name },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`  Services: ${SERVICE_NAMES.length} seeded (${SERVICE_NAMES.join(', ')})`);

  let mappingCount = 0;
  for (const { serviceName, moduleCode } of MAPPINGS) {
    const service = await FeatureCatalog.findOne({ type: 'service', name: serviceName });
    const mod = await FeatureCatalog.findOne({ type: 'module', module_code: moduleCode });
    if (!service || !mod) continue;

    await ServiceModuleMapping.findOneAndUpdate(
      { service_id: service._id, module_id: mod._id },
      { service_id: service._id, module_id: mod._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    mappingCount++;
  }
  console.log(`  Service-module mappings: ${mappingCount} seeded`);
}

module.exports = { seedServices, SERVICE_NAMES, MAPPINGS };
