const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const postService = require('../services/post.service');
const groupService = require('../services/group.service');
const followService = require('../services/follow.service');

// ── Posts ────────────────────────────────────────────────────────────────────

const createPost = asyncHandler(async (req, res) => {
  const data = await postService.createPost(req.user.id, req.body, req.files?.media);
  return success(res, data, 'Post created successfully');
});

const createGroupPost = asyncHandler(async (req, res) => {
  const data = await postService.createGroupPost(req.user.id, req.body, req.files?.media);
  return success(res, data, 'Post created successfully');
});

const updateGroupPost = asyncHandler(async (req, res) => {
  const data = await postService.updateGroupPost(req.user.id, req.params.id, req.body, req.files?.media);
  return success(res, data, 'Post updated successfully');
});

const updatePost = asyncHandler(async (req, res) => {
  const data = await postService.updatePost(req.user.id, req.params.id, req.body, req.files?.media);
  return success(res, data, 'Post updated successfully');
});

const deletePost = asyncHandler(async (req, res) => {
  await postService.deletePost(req.user.id, req.params.id);
  return success(res, [], 'Post deleted successfully');
});

const getAllPosts = asyncHandler(async (req, res) => {
  const data = await postService.getAllPosts(req.user.id);
  return success(res, data, 'Posts fetched successfully');
});

const getUserPosts = asyncHandler(async (req, res) => {
  const data = await postService.getUserPosts(req.user.id);
  return success(res, data, 'Posts fetched successfully');
});

const getPostById = asyncHandler(async (req, res) => {
  const data = await postService.getPostById(req.params.id, req.user.id);
  return success(res, data, 'Post fetched successfully');
});

const getSavedPosts = asyncHandler(async (req, res) => {
  const data = await postService.getSavedPosts(req.user.id);
  return success(res, data, 'Saved posts fetched successfully');
});

// ── Comments ─────────────────────────────────────────────────────────────────

const addComment = asyncHandler(async (req, res) => {
  const data = await postService.addComment(req.user.id, req.body);
  return success(res, data, 'Comment added successfully');
});

const updateComment = asyncHandler(async (req, res) => {
  const data = await postService.updateComment(req.user.id, req.params.id, req.body.comment);
  return success(res, data, 'Comment updated successfully');
});

const deleteComment = asyncHandler(async (req, res) => {
  const data = await postService.deleteComment(req.user.id, req.params.id);
  return success(res, data, 'Comment deleted successfully');
});

// ── Reactions / shares / saves / hides ───────────────────────────────────────

const toggleReaction = asyncHandler(async (req, res) => {
  const data = await postService.toggleReaction(req.user.id, req.body.post_id, req.body.reaction_type);
  return success(res, data, data ? 'Reaction saved' : 'Reaction removed');
});

const sharePost = asyncHandler(async (req, res) => {
  const data = await postService.sharePost(req.user.id, req.body.post_id, req.body.title);
  return success(res, data, 'Post shared successfully');
});

const toggleSavePost = asyncHandler(async (req, res) => {
  const data = await postService.toggleSavePost(req.user.id, req.body.post_id);
  return success(res, data, data.is_saved ? 'Post saved' : 'Post unsaved');
});

const toggleHidePost = asyncHandler(async (req, res) => {
  const data = await postService.toggleHidePost(req.user.id, req.body.post_id);
  return success(res, data, data.is_hidden ? 'Post hidden' : 'Post unhidden');
});

const getHiddenPosts = asyncHandler(async (req, res) => {
  const data = await postService.getHiddenPosts(req.user.id);
  return success(res, data, 'Hidden posts fetched successfully');
});

// ── Reports ──────────────────────────────────────────────────────────────────

const reportPost = asyncHandler(async (req, res) => {
  await postService.reportPost(req.user.id, req.body.post_id, req.body.reason);
  return success(res, [], 'Post reported successfully');
});

const getAllReportedPostsForAdmin = asyncHandler(async (req, res) => {
  const data = await postService.getAllReportedPostsForAdmin();
  return success(res, data, 'Reported posts fetched successfully');
});

const actionReportedPost = asyncHandler(async (req, res) => {
  const data = await postService.actionReportedPost(req.user.id, req.body.report_id, req.body.action, req.body.remarks);
  return success(res, data, 'Action taken successfully');
});

const deleteReport = asyncHandler(async (req, res) => {
  await postService.deleteReport(req.params.id);
  return success(res, [], 'Report deleted successfully');
});

const getMyReportedPosts = asyncHandler(async (req, res) => {
  const data = await postService.getMyReportedPosts(req.user.id);
  return success(res, data, 'Reported posts fetched successfully');
});

const getMyPostsWithReports = asyncHandler(async (req, res) => {
  const data = await postService.getMyPostsWithReports(req.user.id);
  return success(res, data, 'Posts fetched successfully');
});

// ── Follow / connections ─────────────────────────────────────────────────────

const toggleFollowUser = asyncHandler(async (req, res) => {
  const data = await followService.toggleFollowUser(req.user.id, req.body.user_id);
  return success(res, data, data.is_followed ? 'User followed' : 'User unfollowed');
});

const getFollowedUsers = asyncHandler(async (req, res) => {
  const data = await followService.getFollowedUsers(req.user.id);
  return success(res, data, 'Followed users fetched successfully');
});

const getMyConnections = asyncHandler(async (req, res) => {
  const data = await followService.getMyConnections(req.user.id);
  return success(res, data, 'Connections fetched successfully');
});

// ── Groups ───────────────────────────────────────────────────────────────────

const createGroup = asyncHandler(async (req, res) => {
  const data = await groupService.createGroup(req.user.id, req.body, req.files);
  return success(res, data, 'Group created successfully');
});

const updateGroup = asyncHandler(async (req, res) => {
  const data = await groupService.updateGroup(req.user.id, req.params.id, req.body, req.files);
  return success(res, data, 'Group updated successfully');
});

const deleteGroup = asyncHandler(async (req, res) => {
  await groupService.deleteGroup(req.user.id, req.params.id);
  return success(res, [], 'Group deleted successfully');
});

const getAllGroups = asyncHandler(async (req, res) => {
  const data = await groupService.getAllGroups(req.user.id);
  return success(res, data, 'Groups fetched successfully');
});

const getUserGroups = asyncHandler(async (req, res) => {
  const data = await groupService.getUserGroups(req.user.id);
  return success(res, data, 'Groups fetched successfully');
});

const getGroupById = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupById(req.params.id, req.user.id);
  return success(res, data, 'Group fetched successfully');
});

const getJoinedGroups = asyncHandler(async (req, res) => {
  const data = await groupService.getJoinedGroups(req.user.id);
  return success(res, data, 'Groups fetched successfully');
});

const joinGroup = asyncHandler(async (req, res) => {
  const data = await groupService.joinGroup(req.user.id, req.body.group_id);
  return success(res, data, 'Group join processed');
});

const leaveGroup = asyncHandler(async (req, res) => {
  await groupService.leaveGroup(req.user.id, req.body.group_id);
  return success(res, [], 'Left group successfully');
});

const inviteUserToGroup = asyncHandler(async (req, res) => {
  await groupService.inviteUserToGroup(req.body.group_id, req.body.user_id);
  return success(res, [], 'User invited successfully');
});

const getGroupInvitations = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupInvitations(req.user.id);
  return success(res, data, 'Invitations fetched successfully');
});

const actionGroupInvitation = asyncHandler(async (req, res) => {
  await groupService.actionGroupInvitation(req.user.id, req.body.request_id, req.body.action);
  return success(res, [], 'Invitation processed successfully');
});

const getGroupRequests = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupRequests(req.params.groupId, req.user.id);
  return success(res, data, 'Requests fetched successfully');
});

const actionGroupRequest = asyncHandler(async (req, res) => {
  await groupService.actionGroupRequest(req.user.id, req.body.request_id, req.body.action);
  return success(res, [], 'Request processed successfully');
});

const removeMember = asyncHandler(async (req, res) => {
  await groupService.removeMember(req.user.id, req.body.group_id, req.body.user_id);
  return success(res, [], 'Member removed successfully');
});

const getGroupMembers = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupMembers(req.params.groupId);
  return success(res, data, 'Members fetched successfully');
});

// ── Rewards / analytics ──────────────────────────────────────────────────────

const getUserRewards = asyncHandler(async (req, res) => {
  const data = await postService.getUserRewards(req.user.id);
  return success(res, data, 'Rewards fetched successfully');
});

const recordView = asyncHandler(async (req, res) => {
  await postService.recordView(req.user.id, req.body.post_id, req.ip);
  return success(res, [], 'View recorded');
});

const getPostAnalytics = asyncHandler(async (req, res) => {
  const data = await postService.getPostAnalytics(req.params.id);
  return success(res, data, 'Analytics fetched successfully');
});

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
  toggleFollowUser,
  getFollowedUsers,
  getMyConnections,
  createGroup,
  updateGroup,
  deleteGroup,
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
  getUserRewards,
  recordView,
  getPostAnalytics,
};
