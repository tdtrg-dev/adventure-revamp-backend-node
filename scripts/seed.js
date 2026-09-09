// Node equivalent of `php artisan db:seed` — populates the baseline reference
// data (admin accounts, interests, tax rates, payment plans, etc.) a fresh
// environment needs to actually function. Safe to re-run: every seeder upserts
// by its natural key rather than blindly inserting.
const mongoose = require('../src/config/mongoosePlugins');
const connectDB = require('../src/config/db');
require('../src/models'); // register every schema before any seeder queries them
const runSeeders = require('../src/seeders');

async function main() {
  await connectDB();
  await runSeeders();
  console.log('Done.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
