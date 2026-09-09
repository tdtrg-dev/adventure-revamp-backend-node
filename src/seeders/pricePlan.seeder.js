// Mirrors PricePlanSeeder.php — every line of its run() body is commented out in
// the real Laravel app, so it's a genuine no-op there today. Kept as an explicit
// stub (rather than omitted) so the run order/step count still lines up 1:1 with
// DatabaseSeeder.php, and so a future re-enable on the Laravel side has an obvious
// place to port to.
async function seedPricePlan() {
  console.log('  Price plan (Laravel seeder is a no-op — nothing to do): skipped');
}

module.exports = seedPricePlan;
