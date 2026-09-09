const mongoose = require('mongoose');
const Post = require('../models/Post');
const PostComment = require('../models/PostComment');
const PostView = require('../models/PostView');
const RewardTransaction = require('../models/RewardTransaction');
const Report = require('../models/Report');
const Group = require('../models/Group');
const Event = require('../models/Event');
const TicketBooking = require('../models/TicketBooking');
const User = require('../models/User');
const pusher = require('../integrations/pusher');
const rewardCalculator = require('./rewardCalculator.service');
const { notifyUser } = require('./notification.service');
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

function extractEventId(eventLink) {
  if (!eventLink) return null;
  try {
    const url = new URL(eventLink);
    return url.searchParams.get('eventId') || null;
  } catch {
    return null;
  }
}

function mediaFileType(originalName) {
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'image' : 'video';
}

function storeMediaEntries(files) {
  return (files || []).map((f) => ({
    file_path: relativeUploadPath('community/media', f.filename),
    file_type: mediaFileType(f.originalname),
  }));
}

async function goingCountFor(eventId) {
  return TicketBooking.countDocuments({ event_id: eventId, status: { $in: ['confirmed', 'used'] } });
}

async function commentCountsFor(postIds) {
  const rows = await PostComment.aggregate([{ $match: { post_id: { $in: postIds } } }, { $group: { _id: '$post_id', count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

/** Mirrors the eager-loaded Post shape used across the module (appended is_saved/is_hidden, *_count fields). */
async function formatPost(post, currentUserId, { includeOriginal = true, includeComments = false } = {}) {
  const isSaved = (post.saved_by || []).some((id) => String(id) === String(currentUserId));
  const isHidden = (post.hidden_by || []).some((id) => String(id) === String(currentUserId));

  let eventSummary = null;
  if (post.event_id) {
    const event = post.populated('event_id') ? post.event_id : await Event.findById(post.event_id).select('trip_name image_thumbnail start_date end_date');
    if (event) {
      eventSummary = {
        id: event.id,
        trip_name: event.trip_name,
        image_thumbnail: event.image_thumbnail,
        start_date: event.start_date,
        end_date: event.end_date,
        going: await goingCountFor(event.id),
      };
    }
  }

  let originalPost = null;
  if (includeOriginal && post.original_post_id) {
    const orig = await Post.findById(post.original_post_id).populate('user_id', 'name profile.image').populate('interests', 'title');
    if (orig) originalPost = await formatPost(orig, currentUserId, { includeOriginal: false, includeComments: false });
  }

  const out = {
    id: post.id,
    user: post.user_id && post.user_id.name ? { id: post.user_id.id, name: post.user_id.name, image: post.user_id.profile?.image || null } : { id: post.user_id },
    group_id: post.group_id || null,
    original_post_id: post.original_post_id || null,
    original_post: originalPost,
    event_id: post.event_id ? (post.event_id.id || post.event_id) : null,
    event: eventSummary,
    title: post.title,
    description: post.description,
    event_link: post.event_link,
    status: post.status,
    visibility: post.visibility,
    interests: (post.interests || []).map((i) => (i.title ? { id: i.id, title: i.title } : { id: i })),
    media: (post.media || []).map((m) => ({ id: m._id.toString(), file_path: m.file_path, file_type: m.file_type })),
    reactions_count: (post.reactions || []).length,
    shares_count: (post.shared_by || []).length,
    is_saved: isSaved,
    is_hidden: isHidden,
    created_at: datetimeStr(post.created_at),
    updated_at: datetimeStr(post.updated_at),
  };

  if (includeComments) {
    out.comments = await getCommentTree(post._id);
  }

  return out;
}

async function attachCommentCounts(formatted, postIds) {
  const counts = await commentCountsFor(postIds);
  formatted.forEach((p) => {
    p.comments_count = counts.get(String(p.id)) || 0;
  });
  return formatted;
}

async function getCommentTree(postId) {
  const topLevel = await PostComment.find({ post_id: postId, parent_id: null }).populate('user_id', 'name profile.image').sort({ _id: 1 });
  const topLevelIds = topLevel.map((c) => c._id);
  const replies = await PostComment.find({ parent_id: { $in: topLevelIds } }).populate('user_id', 'name profile.image').sort({ _id: 1 });

  const repliesByParent = new Map();
  replies.forEach((r) => {
    const key = String(r.parent_id);
    if (!repliesByParent.has(key)) repliesByParent.set(key, []);
    repliesByParent.get(key).push(formatComment(r));
  });

  return topLevel.map((c) => ({ ...formatComment(c), replies: repliesByParent.get(String(c._id)) || [] }));
}

function formatComment(c) {
  return {
    id: c.id,
    post_id: c.post_id,
    parent_id: c.parent_id || null,
    comment: c.comment,
    user: c.user_id && c.user_id.name ? { id: c.user_id.id, name: c.user_id.name, image: c.user_id.profile?.image || null } : { id: c.user_id },
    created_at: datetimeStr(c.created_at),
    updated_at: datetimeStr(c.updated_at),
  };
}

async function requireApprovedGroupMemberIfPrivate(post, userId) {
  if (!post.group_id) return;
  const group = await Group.findById(post.group_id).select('visibility members');
  if (!group || group.visibility !== 'Private') return;
  const isMember = group.members.some((m) => String(m.user_id) === String(userId) && m.status === 'approved');
  if (!isMember) throw fail('You must be a member of this private group to comment');
}

// ── Posts ────────────────────────────────────────────────────────────────────

async function createPost(userId, body, files) {
  const post = await Post.create({
    user_id: userId,
    title: body.title,
    description: body.description,
    event_link: body.event_link || null,
    event_id: extractEventId(body.event_link) && (await Event.exists({ _id: extractEventId(body.event_link) })) ? extractEventId(body.event_link) : null,
    status: 'publish',
    visibility: body.visibility || 'Public',
    interests: body.interests || [],
    media: storeMediaEntries(files),
  });

  await post.populate([{ path: 'user_id', select: 'name profile.image' }, { path: 'interests', select: 'title' }]);
  const formatted = await formatPost(post, userId);
  pusher.trigger('community-feed', 'post.event', { action: 'created', post: formatted });
  return formatted;
}

async function createGroupPost(userId, body, files) {
  const group = await Group.findById(body.group_id);
  if (!group) throw fail('Group not found');
  const isMember = group.members.some((m) => String(m.user_id) === String(userId) && m.status === 'approved');
  if (!isMember) throw fail('You must be a member of this group to post');

  const post = await Post.create({
    user_id: userId,
    group_id: body.group_id,
    title: body.title,
    description: body.description,
    event_link: body.event_link || null,
    event_id: extractEventId(body.event_link) && (await Event.exists({ _id: extractEventId(body.event_link) })) ? extractEventId(body.event_link) : null,
    status: 'publish',
    visibility: 'Public',
    media: storeMediaEntries(files),
  });

  await post.populate({ path: 'user_id', select: 'name profile.image' });
  return formatPost(post, userId);
}

async function updateGroupPost(userId, postId, body, files) {
  const post = await Post.findOne({ _id: postId, user_id: userId, group_id: { $ne: null } });
  if (!post) throw fail('Group post not found or unauthorized');

  const group = await Group.findById(post.group_id);
  const isMember = group && group.members.some((m) => String(m.user_id) === String(userId) && m.status === 'approved');
  if (!isMember) throw fail('You are no longer a member of this group');

  if (body.title !== undefined) post.title = body.title;
  if (body.description !== undefined) post.description = body.description;
  if (body.event_link !== undefined) {
    post.event_link = body.event_link;
    const eid = extractEventId(body.event_link);
    post.event_id = eid && (await Event.exists({ _id: eid })) ? eid : null;
  }
  post.media.push(...storeMediaEntries(files));
  await post.save();

  await post.populate({ path: 'user_id', select: 'name profile.image' });
  return formatPost(post, userId);
}

async function updatePost(userId, postId, body, files) {
  const post = await Post.findOne({ _id: postId, user_id: userId });
  if (!post) throw fail('Post not found or unauthorized');

  if (body.title !== undefined) post.title = body.title;
  if (body.description !== undefined) post.description = body.description;
  if (body.visibility !== undefined) post.visibility = body.visibility;
  if (body.event_link !== undefined) {
    post.event_link = body.event_link;
    const eid = extractEventId(body.event_link);
    post.event_id = eid && (await Event.exists({ _id: eid })) ? eid : null;
  }
  if (body.interests !== undefined) post.interests = body.interests;
  post.media.push(...storeMediaEntries(files));
  await post.save();

  await post.populate([{ path: 'user_id', select: 'name profile.image' }, { path: 'interests', select: 'title' }]);
  const formatted = await formatPost(post, userId);
  pusher.trigger('community-feed', 'post.event', { action: 'updated', post: formatted });
  return formatted;
}

async function deletePost(userId, postId) {
  const post = await Post.findOne({ _id: postId, user_id: userId });
  if (!post) throw fail('Post not found or unauthorized');
  post.deleted_at = new Date();
  await post.save();
  pusher.trigger('community-feed', 'post.event', { action: 'deleted', post: { id: postId } });
}

// Report-exclusion mirrors Laravel's whereDoesntHave(reports mine-resolved) + global >=10 resolved cutoff.
async function getReportExcludedPostIds() {
  const flagged = await Report.aggregate([
    { $match: { target_type: 'post', status: 'resolved' } },
    { $group: { _id: '$target_id', count: { $sum: 1 } } },
    { $match: { count: { $gte: 10 } } },
  ]);
  return flagged.map((f) => f._id);
}

async function getAllPosts(userId) {
  const [myResolvedReports, globallyFlagged, user] = await Promise.all([
    Report.find({ reporter_id: userId, target_type: 'post', status: 'resolved' }).distinct('target_id'),
    getReportExcludedPostIds(),
    User.findById(userId).select('interests following'),
  ]);

  const excludedIds = [...new Set([...myResolvedReports, ...globallyFlagged].map(String))];

  const posts = await Post.find({
    status: 'publish',
    group_id: null,
    hidden_by: { $ne: userId },
    _id: { $nin: excludedIds },
  })
    .populate('user_id', 'name profile.image')
    .populate('interests', 'title');

  const [commentCounts] = await Promise.all([commentCountsFor(posts.map((p) => p._id))]);
  const myInterestIds = new Set((user.interests || []).map(String));
  const myFollowingIds = new Set((user.following || []).map(String));

  const scored = posts.map((post) => {
    const interestMatch = post.interests.filter((i) => myInterestIds.has(String(i.id || i._id))).length * 50;
    const followBonus = myFollowingIds.has(String(post.user_id.id || post.user_id._id)) ? 40 : 0;
    const engagement = ((post.reactions || []).length + (commentCounts.get(String(post._id)) || 0) + (post.shared_by || []).length) * 5;
    const hoursSinceCreated = (Date.now() - post.created_at.getTime()) / 3600000;
    const recency = 100 / (1 + hoursSinceCreated);
    const jitter = Math.random() * 20;
    return { post, score: interestMatch + followBonus + engagement + recency + jitter };
  });

  scored.sort((a, b) => b.score - a.score);

  const formatted = await Promise.all(scored.map(({ post }) => formatPost(post, userId)));
  return attachCommentCounts(formatted, posts.map((p) => p._id));
}

async function getUserPosts(userId) {
  const posts = await Post.find({ user_id: userId }).populate('user_id', 'name profile.image').populate('interests', 'title').sort({ _id: -1 });
  const formatted = await Promise.all(posts.map((post) => formatPost(post, userId)));
  return attachCommentCounts(formatted, posts.map((p) => p._id));
}

async function getPostById(id, currentUserId) {
  const post = await Post.findById(id).populate('user_id', 'name profile.image').populate('interests', 'title');
  if (!post) throw fail('Post not found');
  const formatted = await formatPost(post, currentUserId, { includeComments: true });
  return attachCommentCounts([formatted], [post._id]).then((r) => r[0]);
}

async function getSavedPosts(userId) {
  const excludedIds = await getReportExcludedPostIds();
  const posts = await Post.find({ saved_by: userId, status: 'publish', _id: { $nin: excludedIds } })
    .populate('user_id', 'name profile.image')
    .populate('interests', 'title')
    .sort({ _id: -1 });
  const formatted = await Promise.all(posts.map((post) => formatPost(post, userId)));
  return attachCommentCounts(formatted, posts.map((p) => p._id));
}

async function getHiddenPosts(userId) {
  const excludedIds = await getReportExcludedPostIds();
  const posts = await Post.find({ hidden_by: userId, status: 'publish', _id: { $nin: excludedIds } })
    .populate('user_id', 'name profile.image')
    .populate('interests', 'title')
    .sort({ _id: -1 });
  const formatted = await Promise.all(posts.map((post) => formatPost(post, userId)));
  return attachCommentCounts(formatted, posts.map((p) => p._id));
}

// ── Comments ─────────────────────────────────────────────────────────────────

async function addComment(userId, body) {
  const post = await Post.findById(body.post_id);
  if (!post) throw fail('Post not found');
  await requireApprovedGroupMemberIfPrivate(post, userId);

  await PostComment.create({ post_id: body.post_id, user_id: userId, parent_id: body.parent_id || null, comment: body.comment });
  await rewardCalculator.calculateForPost(body.post_id);

  const comments = await getCommentTree(body.post_id);
  pusher.trigger('community-feed', 'post.event', { action: 'comment_added', post_id: body.post_id, comments });
  return comments;
}

async function updateComment(userId, commentId, comment) {
  const row = await PostComment.findOne({ _id: commentId, user_id: userId });
  if (!row) throw fail('Comment not found or unauthorized');
  row.comment = comment;
  await row.save();

  const comments = await getCommentTree(row.post_id);
  pusher.trigger('community-feed', 'post.event', { action: 'comment_updated', post_id: row.post_id, comments });
  return comments;
}

async function deleteComment(userId, commentId) {
  const row = await PostComment.findOne({ _id: commentId, user_id: userId });
  if (!row) throw fail('Comment not found or unauthorized');
  const postId = row.post_id;
  await PostComment.deleteOne({ _id: commentId });

  const comments = await getCommentTree(postId);
  pusher.trigger('community-feed', 'post.event', { action: 'comment_deleted', post_id: postId, comments });
  return comments;
}

// ── Reactions / shares / saves / hides ───────────────────────────────────────

async function toggleReaction(userId, postId, reactionType) {
  const post = await Post.findById(postId);
  if (!post) throw fail('Post not found');
  await requireApprovedGroupMemberIfPrivate(post, userId);

  const idx = post.reactions.findIndex((r) => String(r.user_id) === String(userId));

  let result;
  let action;
  if (idx >= 0 && post.reactions[idx].reaction_type === reactionType) {
    post.reactions.splice(idx, 1);
    action = 'reaction_removed';
    result = null;
  } else if (idx >= 0) {
    post.reactions[idx].reaction_type = reactionType;
    action = 'reaction_updated';
    result = { post_id: postId, user_id: userId, reaction_type: reactionType };
  } else {
    post.reactions.push({ user_id: userId, reaction_type: reactionType });
    action = 'reaction_added';
    result = { post_id: postId, user_id: userId, reaction_type: reactionType };
  }
  await post.save();

  if (action === 'reaction_added') await rewardCalculator.calculateForPost(postId);

  pusher.trigger('community-feed', 'post.event', { action, post_id: postId, reaction: result });
  return result;
}

async function sharePost(userId, postId, title) {
  const original = await Post.findById(postId);
  if (!original) throw fail('Post not found');
  await requireApprovedGroupMemberIfPrivate(original, userId);

  const reshare = await Post.create({
    user_id: userId,
    original_post_id: postId,
    title: title || null,
    status: 'publish',
    visibility: 'Public',
  });

  original.shared_by.push(userId);
  await original.save();

  await rewardCalculator.calculateForPost(postId);

  await reshare.populate({ path: 'user_id', select: 'name profile.image' });
  const formatted = await formatPost(reshare, userId);
  pusher.trigger('community-feed', 'post.event', { action: 'post_shared', original_post_id: postId, reshare_post: formatted });
  return formatted;
}

async function toggleSavePost(userId, postId) {
  const post = await Post.findById(postId);
  if (!post) throw fail('Post not found');
  await requireApprovedGroupMemberIfPrivate(post, userId);

  const idx = post.saved_by.findIndex((id) => String(id) === String(userId));
  let isSaved;
  if (idx >= 0) {
    post.saved_by.splice(idx, 1);
    isSaved = false;
  } else {
    post.saved_by.push(userId);
    isSaved = true;
  }
  await post.save();

  pusher.trigger('community-feed', 'post.event', { action: isSaved ? 'post_saved' : 'post_unsaved', post_id: postId });
  return { is_saved: isSaved };
}

async function toggleHidePost(userId, postId) {
  const post = await Post.findById(postId);
  if (!post) throw fail('Post not found');

  const idx = post.hidden_by.findIndex((id) => String(id) === String(userId));
  let isHidden;
  if (idx >= 0) {
    post.hidden_by.splice(idx, 1);
    isHidden = false;
  } else {
    post.hidden_by.push(userId);
    isHidden = true;
  }
  await post.save();

  pusher.trigger('community-feed', 'post.event', { action: isHidden ? 'post_hidden' : 'post_unhidden', post_id: postId });
  return { is_hidden: isHidden };
}

// ── Reports ──────────────────────────────────────────────────────────────────

async function reportPost(userId, postId, reason) {
  const post = await Post.findById(postId);
  if (!post) throw fail('Post not found');
  if (String(post.user_id) === String(userId)) throw fail('You cannot report your own post');

  if (await Report.exists({ reporter_id: userId, target_type: 'post', target_id: postId })) {
    throw fail('You have already reported this post');
  }

  await Report.create({ reporter_id: userId, target_type: 'post', target_id: postId, reason, status: 'pending' });
}

async function getAllReportedPostsForAdmin() {
  const reports = await Report.find({ target_type: 'post' })
    .populate('reporter_id', 'name profile.image')
    .populate({ path: 'target_id', select: 'user_id title description media', populate: { path: 'user_id', select: 'name profile.image' } })
    .sort({ _id: -1 });
  return reports;
}

async function actionReportedPost(actorId, reportId, action, remarks) {
  const report = await Report.findById(reportId);
  if (!report || report.target_type !== 'post') throw fail('Report not found');

  const post = await Post.findById(report.target_id);
  if (post) {
    const title = post.title || '';
    if (action === 'warn') {
      await notifyUser(post.user_id, 'post_report_warning', { post_id: post.id }, {
        actorId,
        title: 'Post Reported',
        body: `Warning: Your post '${title}' has been reported for: ${remarks || report.reason}`,
      });
    } else if (action === 'suspend') {
      await User.updateOne({ _id: post.user_id }, { suspended_until: new Date(Date.now() + 24 * 3600000) });
      await notifyUser(post.user_id, 'account_suspended_post', { post_id: post.id }, {
        actorId,
        title: 'Account Suspended',
        body: 'Your account has been suspended for 24 hours due to a reported post.',
      });
    } else if (action === 'remove') {
      post.deleted_at = new Date();
      await post.save();
      await notifyUser(post.user_id, 'post_removed_admin', { post_id: post.id }, {
        actorId,
        title: 'Post Removed',
        body: `Your post '${title}' has been removed by the admin.`,
      });
    }
  }

  report.status = action === 'dismiss' ? 'declined' : 'resolved';
  report.admin_remarks = remarks || report.admin_remarks;
  await report.save();

  const statusText = action === 'dismiss' ? 'dismissed' : `resolved with action: ${action}`;
  await notifyUser(report.reporter_id, 'post_report_action_taken', { report_id: report.id }, {
    actorId,
    title: 'Report Update',
    body: `Your report regarding a community post has been ${statusText}.`,
  });

  return report;
}

async function deleteReport(id) {
  const report = await Report.findById(id);
  if (!report) throw fail('Report not found');
  await report.deleteOne();
}

async function getMyReportedPosts(userId) {
  const reports = await Report.find({ reporter_id: userId, target_type: 'post' }).select('target_id');
  const postIds = reports.map((r) => r.target_id);
  const posts = await Post.find({ _id: { $in: postIds } }).populate('user_id', 'name profile.image').populate('interests', 'title').sort({ _id: -1 });
  const formatted = await Promise.all(posts.map((post) => formatPost(post, userId)));
  return attachCommentCounts(formatted, posts.map((p) => p._id));
}

async function getMyPostsWithReports(userId) {
  const posts = await Post.find({ user_id: userId }).populate('user_id', 'name profile.image').populate('interests', 'title').sort({ _id: -1 });
  const postIds = posts.map((p) => p._id);
  const reportCounts = await Report.aggregate([{ $match: { target_type: 'post', target_id: { $in: postIds } } }, { $group: { _id: '$target_id', count: { $sum: 1 } } }]);
  const reportCountMap = new Map(reportCounts.map((r) => [String(r._id), r.count]));

  const withReports = posts.filter((p) => reportCountMap.has(String(p._id)));
  const formatted = await Promise.all(withReports.map((post) => formatPost(post, userId)));
  formatted.forEach((p) => (p.reports_count = reportCountMap.get(String(p.id)) || 0));
  return attachCommentCounts(formatted, withReports.map((p) => p._id));
}

// ── Views / analytics / rewards ──────────────────────────────────────────────

async function recordView(userId, postId, ip) {
  const oneHourAgo = new Date(Date.now() - 3600000);
  const existing = await PostView.findOne({
    post_id: postId,
    $or: [{ user_id: userId }, { ip_address: ip }],
    created_at: { $gte: oneHourAgo },
  });
  if (!existing) {
    await PostView.create({ post_id: postId, user_id: userId, ip_address: ip });
  }
}

async function getPostAnalytics(id) {
  const postObjectId = new mongoose.Types.ObjectId(id);

  const [earnedRewardsAgg, memberReach, totalComments, totalShares, reactionsAgg] = await Promise.all([
    RewardTransaction.aggregate([{ $match: { post_id: postObjectId } }, { $group: { _id: null, total: { $sum: '$points_earned' } } }]),
    PostView.countDocuments({ post_id: id }),
    PostComment.countDocuments({ post_id: id }),
    Post.findById(id).select('shared_by'),
    Post.findById(id).select('reactions'),
  ]);

  const reactionCounts = {};
  (reactionsAgg?.reactions || []).forEach((r) => {
    reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
  });

  const now = new Date();
  const graphData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = monthDate.toLocaleString('en-US', { month: 'short' });

    const [reactionCount, commentCount, shareCount] = await Promise.all([
      Post.aggregate([
        { $match: { _id: postObjectId } },
        { $project: { reactions: { $filter: { input: '$reactions', cond: { $and: [{ $gte: ['$$this.created_at', monthDate] }, { $lt: ['$$this.created_at', nextMonthDate] }] } } } } },
        { $project: { count: { $size: '$reactions' } } },
      ]),
      PostComment.countDocuments({ post_id: id, created_at: { $gte: monthDate, $lt: nextMonthDate } }),
      Post.aggregate([{ $match: { _id: postObjectId } }, { $project: { count: { $size: { $ifNull: ['$shared_by', []] } } } }]),
    ]);

    const value = (reactionCount[0]?.count || 0) + commentCount + 0; // shared_by has no per-entry timestamp; share timing not tracked per-item
    graphData.push({ label, value });
  }

  return {
    metrics: {
      total_earned_rewards: earnedRewardsAgg[0]?.total || 0,
      total_member_reach: memberReach,
      total_comments: totalComments,
      total_shares: (totalShares?.shared_by || []).length,
    },
    reactions_breakdown: Object.entries(reactionCounts).map(([reaction_type, count]) => ({ reaction_type, count })),
    performance_graph: graphData,
  };
}

async function getUserRewards(userId) {
  const user = await User.findById(userId).select('reward_points');
  const posts = await Post.find({ user_id: userId, status: 'publish' }).sort({ _id: -1 });

  const rewardsList = await Promise.all(
    posts.map(async (post) => ({
      id: post.id,
      title: post.title,
      first_image: post.media?.[0]?.file_path || null,
      likes_count: post.reactions.length,
      comments_count: await PostComment.countDocuments({ post_id: post._id }),
      shares_count: post.shared_by.length,
      earned_points: (await RewardTransaction.aggregate([{ $match: { post_id: post._id, user_id: user._id } }, { $group: { _id: null, total: { $sum: '$points_earned' } } }]))[0]?.total || 0,
    }))
  );

  return { total_earned_rewards: user.reward_points || 0, rewards_list: rewardsList };
}

module.exports = {
  createPost,
  createGroupPost,
  updateGroupPost,
  updatePost,
  deletePost,
  getAllPosts,
  getUserPosts,
  getPostById,
  getSavedPosts,
  addComment,
  updateComment,
  deleteComment,
  toggleReaction,
  sharePost,
  toggleSavePost,
  toggleHidePost,
  getHiddenPosts,
  reportPost,
  getAllReportedPostsForAdmin,
  actionReportedPost,
  deleteReport,
  getMyReportedPosts,
  getMyPostsWithReports,
  recordView,
  getPostAnalytics,
  getUserRewards,
};
