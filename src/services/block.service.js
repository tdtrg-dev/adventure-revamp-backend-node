const User = require('../models/User');

/** Checks both directions — was a bidirectional UserBlock table lookup. */
async function getBlockStatus(userId, otherUserId) {
  const [user, other] = await Promise.all([
    User.findById(userId).select('blocked_users'),
    User.findById(otherUserId).select('blocked_users'),
  ]);

  const blockedByMe = user.blocked_users.some((id) => String(id) === String(otherUserId));
  const blockedByThem = other.blocked_users.some((id) => String(id) === String(userId));

  return { blocked: blockedByMe || blockedByThem, blockedByMe, blockedByThem };
}

async function block(blockerId, blockedId) {
  await User.updateOne({ _id: blockerId }, { $addToSet: { blocked_users: blockedId } });
}

async function unblock(blockerId, blockedId) {
  await User.updateOne({ _id: blockerId }, { $pull: { blocked_users: blockedId } });
}

async function isBlockedByMe(blockerId, blockedId) {
  const user = await User.findById(blockerId).select('blocked_users');
  return user.blocked_users.some((id) => String(id) === String(blockedId));
}

async function getBlockedByUser(blockerId, page = 1) {
  const perPage = 20;
  const user = await User.findById(blockerId).select('blocked_users');
  const ids = user.blocked_users || [];
  const total = ids.length;
  const pageIds = ids.slice((page - 1) * perPage, page * perPage);

  const users = await User.find({ _id: { $in: pageIds } }).select('name email profile.image');
  return { users, total, page, per_page: perPage, last_page: Math.max(1, Math.ceil(total / perPage)) };
}

module.exports = { getBlockStatus, block, unblock, isBlockedByMe, getBlockedByUser };
