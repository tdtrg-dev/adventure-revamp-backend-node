const RewardRule = require('../models/RewardRule');
const RewardTransaction = require('../models/RewardTransaction');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');
const User = require('../models/User');

async function getTotalActions(post, actionType) {
  if (actionType === 'reaction') {
    return post.reactions.filter((r) => String(r.user_id) !== String(post.user_id)).length;
  }
  if (actionType === 'comment') {
    return PostComment.countDocuments({ post_id: post._id, user_id: { $ne: post.user_id } });
  }
  if (actionType === 'share') {
    return post.shared_by.filter((id) => String(id) !== String(post.user_id)).length;
  }
  return 0;
}

/**
 * Mirrors RewardCalculatorService::calculateForPost — called synchronously (not
 * queued) from addComment, toggleReaction (new reactions only), and sharePost.
 * Failures are swallowed (matches Laravel: reward calc never blocks the primary action).
 */
async function calculateForPost(postId) {
  try {
    const post = await Post.findById(postId);
    if (!post) return;

    const rules = await RewardRule.find({ is_active: true });
    let changed = false;

    for (const rule of rules) {
      const totalActions = await getTotalActions(post, rule.action_type);
      const processedCount = post.reward_counters[rule.action_type] || 0;
      const pendingActions = totalActions - processedCount;
      if (pendingActions < rule.action_count) continue;

      const times = Math.floor(pendingActions / rule.action_count);
      const rewardedActions = times * rule.action_count;
      const points = times * rule.reward_points;

      await RewardTransaction.create({
        user_id: post.user_id,
        post_id: post._id,
        action_type: rule.action_type,
        action_count: rewardedActions,
        points_earned: points,
      });

      post.reward_counters[rule.action_type] = processedCount + rewardedActions;
      await User.updateOne({ _id: post.user_id }, { $inc: { reward_points: points } });
      changed = true;
    }

    if (changed) await post.save();
  } catch (e) {
    console.error('calculateForPost failed:', e.message);
  }
}

module.exports = { calculateForPost };
