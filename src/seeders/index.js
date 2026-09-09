// Mirrors DatabaseSeeder.php's run order, plus reward-rule (see rewardRule.seeder.js
// for why that one is included despite Laravel's DatabaseSeeder never calling it).
// Every individual seeder is idempotent (find-then-upsert, matching Laravel's
// updateOrCreate) — safe to run against a fresh database or re-run against an
// already-seeded one.
const steps = [
  ['Admins', require('./admin.seeder')],
  ['Company categories', require('./companyCategory.seeder')],
  ['Interests', require('./interest.seeder')],
  ['Limit types', require('./limitTypes.seeder')],
  ['Price plan', require('./pricePlan.seeder')],
  ['Modules', require('./module.seeder').seedModules],
  ['Services', require('./services.seeder').seedServices],
  ['Company payment plans', require('./companyPaymentPlan.seeder')],
  ['Ticket categories', require('./ticketCategory.seeder')],
  ['Tax rates', require('./taxRate.seeder')],
  ['Reward rules', require('./rewardRule.seeder')],
];

async function runSeeders() {
  for (const [label, fn] of steps) {
    console.log(`Seeding: ${label}`);
    await fn();
  }
}

module.exports = runSeeders;
