const Group = require('../models/Group');
const User = require('../models/User');
const Post = require('../models/Post');
const Conversation = require('../models/Conversation');
const postService = require('./post.service');
const pusher = require('../integrations/pusher');
const { relativeUploadPath } = require('../middlewares/upload');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

// Mirrors Eloquent's default datetime JSON format ('Y-m-d H:i:s'), not the raw
// Mongoose Date's full ISO timestamp.
function datetimeStr(d) {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) : null;
}

function memberOf(group, userId) {
  return group.members.find((m) => String(m.user_id) === String(userId));
}

async function findGroupByMemberId(memberId) {
  const group = await Group.findOne({ 'members._id': memberId });
  if (!group) return null;
  return { group, member: group.members.id(memberId) };
}

async function withOwnerPopulated(groups) {
  return Group.populate(groups, { path: 'user_id', select: 'name profile.image' });
}

function formatGroup(group, extra = {}) {
  return {
    id: group.id,
    user_id: group.user_id?.id || group.user_id,
    owner: group.user_id?.name ? { id: group.user_id.id, name: group.user_id.name, image: group.user_id.profile?.image || null } : undefined,
    group_type: group.group_type,
    event_id: group.event_id,
    title: group.title,
    description: group.description,
    visibility: group.visibility,
    group_photo: group.group_photo,
    cover_photo: group.cover_photo,
    members_count: group.members.filter((m) => m.status === 'approved').length,
    created_at: datetimeStr(group.created_at),
    updated_at: datetimeStr(group.updated_at),
    ...extra,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function createGroup(userId, body, files) {
  const group = await Group.create({
    user_id: userId,
    group_type: body.group_type || 'community',
    event_id: body.event_id || null,
    title: body.title,
    description: body.description,
    visibility: body.visibility || 'Public',
    group_photo: files?.group_photo?.[0] ? relativeUploadPath('groups/photos', files.group_photo[0].filename) : null,
    cover_photo: files?.cover_photo?.[0] ? relativeUploadPath('groups/covers', files.cover_photo[0].filename) : null,
    members: [{ user_id: userId, status: 'approved', member_type: 'admin' }],
  });

  const allGroups = await withOwnerPopulated(await Group.find().sort({ _id: -1 }));
  const formatted = allGroups.map((g) => formatGroup(g));
  pusher.trigger('community-group-channel', 'group.event', { action: 'group_created', data: formatted });
  return formatted;
}

async function updateGroup(userId, groupId, body, files) {
  const group = await Group.findById(groupId);
  if (!group) throw fail('Group not found');
  if (String(group.user_id) !== String(userId)) throw fail('Unauthorized to edit this group');

  if (body.group_type !== undefined) group.group_type = body.group_type;
  if (body.event_id !== undefined) group.event_id = body.event_id;
  if (body.title !== undefined) group.title = body.title;
  if (body.description !== undefined) group.description = body.description;
  if (body.visibility !== undefined) group.visibility = body.visibility;
  if (files?.group_photo?.[0]) group.group_photo = relativeUploadPath('groups/photos', files.group_photo[0].filename);
  if (files?.cover_photo?.[0]) group.cover_photo = relativeUploadPath('groups/covers', files.cover_photo[0].filename);
  await group.save();

  const allGroups = await withOwnerPopulated(await Group.find().sort({ _id: -1 }));
  const formatted = allGroups.map((g) => formatGroup(g));
  pusher.trigger('community-group-channel', 'group.event', { action: 'group_updated', data: formatted });
  return formatted;
}

/**
 * Soft-deletes a group together with everything that only exists because the group
 * does — its posts and its chat thread. Without the cascade those outlive the group
 * and stay reachable: the posts through the community feed and the saved/hidden
 * lists, the conversation through the chat list.
 *
 * Exported because event.service has to run the same cascade on the auto-created
 * event group when its event is deleted. Callers stamp `group.deleted_at` and save
 * it themselves, then pass the group in — the timestamp is reused so the whole
 * cascade shares one deletion time.
 */
async function cascadeGroupDelete(group) {
  const filter = { group_id: group._id, deleted_at: null };
  await Promise.all([
    Post.updateMany(filter, { $set: { deleted_at: group.deleted_at } }),
    Conversation.updateMany(filter, { $set: { deleted_at: group.deleted_at } }),
  ]);
}

async function deleteGroup(userId, groupId) {
  const group = await Group.findById(groupId);
  if (!group) throw fail('Group not found');
  if (String(group.user_id) !== String(userId)) throw fail('Unauthorized to delete this group');
  group.deleted_at = new Date();
  await group.save();
  await cascadeGroupDelete(group);
  pusher.trigger('community-group-channel', 'group.event', { action: 'group_deleted', data: { id: groupId } });
}

async function getAllGroups(userId) {
  const user = await User.findById(userId).select('following');
  const followingIds = (user.following || []).map(String);

  // Public OR mine OR (private but I follow the group's creator)
  const groups = await Group.find({
    $or: [{ visibility: 'Public' }, { user_id: userId }, { user_id: { $in: followingIds } }],
  })
    .sort({ _id: -1 });

  const populated = await withOwnerPopulated(groups);

  return populated.map((g) => {
    const membership = memberOf(g, userId);
    return formatGroup(g, { membership_status: membership ? membership.status : 'not_joined' });
  });
}

async function getUserGroups(userId) {
  const groups = await Group.find({ user_id: userId }).sort({ _id: -1 });
  return groups.map((g) => formatGroup(g));
}

async function getGroupById(id, userId) {
  const group = await Group.findById(id).populate('user_id', 'name profile.image').populate('members.user_id', 'name profile.image');
  if (!group) throw fail('Group not found');

  const members = group.members.map((m) => ({
    id: m._id.toString(),
    user: m.user_id?.name ? { id: m.user_id.id, name: m.user_id.name, image: m.user_id.profile?.image || null } : { id: m.user_id },
    status: m.status,
    member_type: m.member_type,
    is_admin: String(m.user_id?.id || m.user_id) === String(group.user_id?.id || group.user_id),
  }));

  const posts = await Post.find({ group_id: id }).populate('user_id', 'name profile.image').sort({ _id: -1 });
  const allMedia = [];
  posts.forEach((p) => {
    (p.media || []).forEach((m) => allMedia.push({ id: m._id.toString(), file_path: m.file_path, collection_name: null, post_id: p.id }));
  });

  const formattedPosts = await Promise.all(posts.map((p) => postService.getPostById(p.id, userId)));

  const membership = memberOf(group, userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = posts.filter((p) => p.created_at >= today).length;
  const daysSinceCreated = Math.max(1, Math.floor((Date.now() - group.created_at.getTime()) / 86400000));

  return {
    ...formatGroup(group),
    members,
    my_membership_status: membership ? membership.status : 'not_joined',
    posts_today_count: postsToday,
    average_posts_per_day: Math.round((posts.length / daysSinceCreated) * 100) / 100,
    posts: formattedPosts,
    all_media: allMedia,
  };
}

async function getJoinedGroups(userId) {
  const groups = await Group.find({
    user_id: { $ne: userId },
    members: { $elemMatch: { user_id: userId, status: 'approved' } },
  }).sort({ _id: -1 });
  const populated = await withOwnerPopulated(groups);
  return populated.map((g) => formatGroup(g));
}

// ── Membership ───────────────────────────────────────────────────────────────

async function joinGroup(userId, groupId) {
  const group = await Group.findById(groupId);
  if (!group) throw fail('Group not found');

  if (memberOf(group, userId)) throw fail('You have already sent a request or are a member');

  const status = group.visibility === 'Public' ? 'approved' : 'pending';
  group.members.push({ user_id: userId, status, member_type: 'member' });
  await group.save();

  pusher.trigger('community-group-channel', 'group.event', { action: 'group_joined', data: { group_id: groupId, status } });
  return { status };
}

async function leaveGroup(userId, groupId) {
  const group = await Group.findById(groupId);
  if (group && String(group.user_id) === String(userId)) throw fail('Admin cannot leave their own group');

  if (group) {
    group.members = group.members.filter((m) => String(m.user_id) !== String(userId));
    await group.save();
  }

  pusher.trigger('community-group-channel', 'group.event', { action: 'group_left', data: { group_id: groupId, user_id: userId } });
}

async function inviteUserToGroup(groupId, invitedUserId) {
  const group = await Group.findById(groupId);
  if (!group) throw fail('Group not found');
  if (memberOf(group, invitedUserId)) throw fail('User is already a member or invited');

  group.members.push({ user_id: invitedUserId, status: 'invited', member_type: 'member' });
  await group.save();

  pusher.trigger('community-group-channel', 'group.event', { action: 'user_invited', data: { group_id: groupId, user_id: invitedUserId } });
}

async function getGroupInvitations(userId) {
  const groups = await Group.find({ members: { $elemMatch: { user_id: userId, status: 'invited' } } })
    .populate('user_id', 'name profile.image')
    .sort({ _id: -1 });

  return groups.map((g) => {
    const membership = memberOf(g, userId);
    return {
      request_id: membership._id.toString(),
      group: formatGroup(g),
    };
  });
}

async function actionGroupInvitation(userId, requestId, action) {
  const found = await findGroupByMemberId(requestId);
  if (!found || String(found.member.user_id) !== String(userId) || found.member.status !== 'invited') {
    throw fail('Invitation not found');
  }

  if (action === 'confirm') {
    found.member.status = 'approved';
    await found.group.save();
    pusher.trigger('community-group-channel', 'group.event', { action: 'invitation_confirmed', data: { group_id: found.group.id, user_id: userId } });
  } else {
    found.group.members = found.group.members.filter((m) => String(m._id) !== String(requestId));
    await found.group.save();
    pusher.trigger('community-group-channel', 'group.event', { action: 'invitation_cancelled', data: { group_id: found.group.id, user_id: userId } });
  }
}

async function getGroupRequests(groupId, userId) {
  const group = await Group.findById(groupId).populate('members.user_id', 'name profile.image');
  if (!group || String(group.user_id) !== String(userId)) throw fail('Unauthorized or group not found');

  return group.members
    .filter((m) => m.status === 'pending')
    .map((m) => ({
      request_id: m._id.toString(),
      user: m.user_id?.name ? { id: m.user_id.id, name: m.user_id.name, image: m.user_id.profile?.image || null } : { id: m.user_id },
    }));
}

async function actionGroupRequest(userId, requestId, action) {
  const found = await findGroupByMemberId(requestId);
  if (!found || String(found.group.user_id) !== String(userId)) throw fail('Unauthorized');

  if (action === 'approve') {
    found.member.status = 'approved';
    await found.group.save();
  } else {
    found.group.members = found.group.members.filter((m) => String(m._id) !== String(requestId));
    await found.group.save();
  }
}

async function removeMember(adminId, groupId, targetUserId) {
  const group = await Group.findById(groupId);
  if (!group || String(group.user_id) !== String(adminId)) throw fail('Unauthorized. Only group admin can remove members.');
  if (String(targetUserId) === String(adminId)) throw fail('Admin cannot remove themselves.');

  group.members = group.members.filter((m) => String(m.user_id) !== String(targetUserId));
  await group.save();

  pusher.trigger('community-group-channel', 'group.event', { action: 'member_removed', data: { group_id: groupId, user_id: targetUserId } });
}

async function getGroupMembers(groupId) {
  const group = await Group.findById(groupId).populate('members.user_id', 'name profile.image');
  if (!group) throw fail('Group not found');

  return group.members
    .filter((m) => m.status === 'approved')
    .map((m) => ({
      id: m._id.toString(),
      user: m.user_id?.name ? { id: m.user_id.id, name: m.user_id.name, image: m.user_id.profile?.image || null } : { id: m.user_id },
      member_type: m.member_type,
    }));
}

module.exports = {
  createGroup,
  updateGroup,
  deleteGroup,
  cascadeGroupDelete,
  getAllGroups,
  getUserGroups,
  getGroupById,
  getJoinedGroups,
  joinGroup,
  leaveGroup,
  inviteUserToGroup,
  getGroupInvitations,
  actionGroupInvitation,
  getGroupRequests,
  actionGroupRequest,
  removeMember,
  getGroupMembers,
};
