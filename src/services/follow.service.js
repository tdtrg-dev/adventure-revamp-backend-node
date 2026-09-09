const User = require('../models/User');
const pusher = require('../integrations/pusher');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function toggleFollowUser(followerId, followedId) {
  if (String(followerId) === String(followedId)) throw fail('You cannot follow yourself');

  const user = await User.findById(followerId).select('following');
  const idx = user.following.findIndex((id) => String(id) === String(followedId));

  let isFollowed;
  if (idx >= 0) {
    user.following.splice(idx, 1);
    isFollowed = false;
  } else {
    user.following.push(followedId);
    isFollowed = true;
  }
  await user.save();

  pusher.trigger('user-follow-channel', 'toggle.follow.event', { data: { is_followed: isFollowed, follower_id: followerId, followed_id: followedId } });
  return { is_followed: isFollowed };
}

async function getFollowedUsers(userId) {
  const user = await User.findById(userId).select('following').populate('following', 'name email profile.image');
  return user.following.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.profile?.image || null }));
}

/** Mutual follows — the intended behavior of Laravel's getMyConnections (its controller
 * has a dead-code bug that makes the endpoint return a non-standard envelope in production;
 * porting the intended, reachable repository logic rather than the accidental wiring bug). */
async function getMyConnections(userId) {
  const user = await User.findById(userId).select('following');
  const followingIds = user.following || [];
  if (followingIds.length === 0) return [];

  const mutual = await User.find({ _id: { $in: followingIds }, following: userId }).select('name email profile.image');
  return mutual.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.profile?.image || null }));
}

module.exports = { toggleFollowUser, getFollowedUsers, getMyConnections };
