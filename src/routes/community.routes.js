const express = require('express');
const router = express.Router();

const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { uploader } = require('../middlewares/upload');
const v = require('../validators/community.validators');
const controller = require('../controllers/community.controller');

const mediaUpload = uploader('community/media', 20).fields([{ name: 'media', maxCount: 10 }]);
const groupPhotoUpload = uploader('groups', 10).fields([
  { name: 'group_photo', maxCount: 1 },
  { name: 'cover_photo', maxCount: 1 },
]);

// ── Posts ────────────────────────────────────────────────────────────────────
router.post('/create-post', authenticate, mediaUpload, validate(v.createPost), controller.createPost);
router.post('/create-group-post', authenticate, mediaUpload, validate(v.createGroupPost), controller.createGroupPost);
router.post('/update-group-post/:id', authenticate, mediaUpload, validate(v.updateGroupPost), controller.updateGroupPost);
router.post('/update-post/:id', authenticate, mediaUpload, validate(v.updatePost), controller.updatePost);
router.delete('/delete-post/:id', authenticate, controller.deletePost);
router.get('/get-all-posts', authenticate, controller.getAllPosts);
router.get('/get-user-posts', authenticate, controller.getUserPosts);
router.get('/get-post/:id', authenticate, controller.getPostById);
router.get('/get-saved-posts', authenticate, controller.getSavedPosts);

// ── Comments ─────────────────────────────────────────────────────────────────
router.post('/add-comment', authenticate, validate(v.addComment), controller.addComment);
router.post('/update-comment/:id', authenticate, validate(v.updateComment), controller.updateComment);
router.delete('/delete-comment/:id', authenticate, controller.deleteComment);

// ── Reactions / shares / saves / hides ───────────────────────────────────────
router.post('/toggle-reaction', authenticate, validate(v.toggleReaction), controller.toggleReaction);
router.post('/share-post', authenticate, validate(v.postIdOnly), controller.sharePost);
router.post('/toggle-save-post', authenticate, validate(v.postIdOnly), controller.toggleSavePost);
router.post('/toggle-hide-post', authenticate, validate(v.postIdOnly), controller.toggleHidePost);
router.get('/get-hidden-posts', authenticate, controller.getHiddenPosts);

// ── Reports ──────────────────────────────────────────────────────────────────
router.post('/report-post', authenticate, validate(v.reportPost), controller.reportPost);
router.get('/get-my-reported-posts', authenticate, controller.getMyReportedPosts);
router.get('/get-my-posts-with-reports', authenticate, controller.getMyPostsWithReports);
router.get('/get-all-reported-posts', authenticate, controller.getAllReportedPostsForAdmin);
router.post('/action-reported-post', authenticate, validate(v.actionReportedPost), controller.actionReportedPost);

// ── Follow / connections ─────────────────────────────────────────────────────
router.post('/toggle-follow-user', authenticate, validate(v.toggleFollowUser), controller.toggleFollowUser);
router.get('/get-followed-users', authenticate, controller.getFollowedUsers);
router.get('/get-my-connections', authenticate, controller.getMyConnections);

// ── Groups ───────────────────────────────────────────────────────────────────
router.post('/create-group', authenticate, groupPhotoUpload, validate(v.createGroup), controller.createGroup);
router.post('/update-group/:id', authenticate, groupPhotoUpload, controller.updateGroup);
router.delete('/delete-group/:id', authenticate, controller.deleteGroup);
router.get('/get-all-groups', authenticate, controller.getAllGroups);
router.get('/get-user-groups', authenticate, controller.getUserGroups);
router.get('/get-joined-groups', authenticate, controller.getJoinedGroups);
router.get('/get-group/:id', authenticate, controller.getGroupById);

router.post('/join-group', authenticate, validate(v.groupIdOnly), controller.joinGroup);
router.post('/leave-group', authenticate, validate(v.groupIdOnly), controller.leaveGroup);
router.post('/invite-user', authenticate, validate(v.inviteUserToGroup), controller.inviteUserToGroup);
router.get('/get-group-invitations', authenticate, controller.getGroupInvitations);
router.post('/action-group-invitation', authenticate, validate(v.actionGroupInvitation), controller.actionGroupInvitation);
router.get('/get-group-requests/:groupId', authenticate, controller.getGroupRequests);
router.post('/action-group-request', authenticate, validate(v.actionGroupRequest), controller.actionGroupRequest);
router.post('/remove-member', authenticate, validate(v.removeMember), controller.removeMember);
router.get('/get-group-members/:groupId', authenticate, controller.getGroupMembers);

// ── Rewards / analytics ──────────────────────────────────────────────────────
router.get('/get-user-rewards', authenticate, controller.getUserRewards);
router.post('/record-view', authenticate, validate(v.postIdOnly), controller.recordView);
router.get('/get-post-analytics/:id', authenticate, controller.getPostAnalytics);

module.exports = router;
