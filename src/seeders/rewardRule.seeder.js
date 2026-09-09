const RewardRule = require('../models/RewardRule');

// Mirrors RewardRuleSeeder.php. Note: Laravel's DatabaseSeeder never actually
// calls this one (an apparent oversight there), but the reward-calculator
// feature genuinely depends on this data existing, so it's included in the
// Node run-all rather than left equally orphaned.
const RULES = [
  { action_type: 'reaction', action_count: 5, reward_points: 50 },
  { action_type: 'comment', action_count: 2, reward_points: 100 },
  { action_type: 'share', action_count: 1, reward_points: 150 },
];

async function seedRewardRules() {
  for (const rule of RULES) {
    await RewardRule.findOneAndUpdate(
      { action_type: rule.action_type },
      rule,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`  Reward rules: ${RULES.length} seeded (${RULES.map((r) => r.action_type).join(', ')})`);
}

module.exports = seedRewardRules;
