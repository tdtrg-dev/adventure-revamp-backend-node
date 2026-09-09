const { ok, okList, err, unauthorized, auth, body, pathParam } = require('./_helpers');

const idParam = (name = 'id') => [pathParam(name, 'Resource id.')];

module.exports = {
  // ── Posts ──────────────────────────────────────────────────────────────────
  '/create-post': {
    post: {
      tags: ['Community'],
      summary: 'Create a post (multipart — media optional)',
      ...auth,
      ...body('CommunityCreatePost'),
      responses: { 200: ok('Post created.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/create-group-post': {
    post: {
      tags: ['Community'],
      summary: 'Create a post inside a group (multipart — media optional)',
      ...auth,
      ...body('CommunityCreateGroupPost'),
      responses: { 200: ok('Post created.'), 400: err('Validation failed or not a group member.'), 401: unauthorized() },
    },
  },
  '/update-group-post/{id}': {
    post: {
      tags: ['Community'],
      summary: 'Update a group post (multipart — media optional)',
      ...auth,
      parameters: idParam(),
      ...body('CommunityUpdateGroupPost'),
      responses: { 200: ok('Post updated.'), 400: err('Validation failed or not authorized.'), 401: unauthorized() },
    },
  },
  '/update-post/{id}': {
    post: {
      tags: ['Community'],
      summary: 'Update a post (multipart — media optional)',
      ...auth,
      parameters: idParam(),
      ...body('CommunityUpdatePost'),
      responses: { 200: ok('Post updated.'), 400: err('Validation failed or not authorized.'), 401: unauthorized() },
    },
  },
  '/delete-post/{id}': {
    delete: {
      tags: ['Community'],
      summary: 'Delete a post',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Post deleted.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
  '/get-all-posts': {
    get: {
      tags: ['Community'],
      summary: 'Global public post feed',
      ...auth,
      parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
      responses: { 200: okList('Posts fetched.'), 401: unauthorized() },
    },
  },
  '/get-user-posts': {
    get: {
      tags: ['Community'],
      summary: "List the caller's own posts",
      ...auth,
      responses: { 200: okList('Posts fetched.'), 401: unauthorized() },
    },
  },
  '/get-post/{id}': {
    get: {
      tags: ['Community'],
      summary: 'Get a single post with its comment tree',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Post fetched.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/get-saved-posts': {
    get: {
      tags: ['Community'],
      summary: "List the caller's saved posts",
      ...auth,
      responses: { 200: okList('Posts fetched.'), 401: unauthorized() },
    },
  },

  // ── Comments ───────────────────────────────────────────────────────────────
  '/add-comment': {
    post: {
      tags: ['Community'],
      summary: 'Comment on a post (or reply to a comment)',
      ...auth,
      ...body('CommunityAddComment'),
      responses: { 200: ok('Comment added.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/update-comment/{id}': {
    post: {
      tags: ['Community'],
      summary: 'Edit a comment',
      ...auth,
      parameters: idParam(),
      ...body('CommunityUpdateComment'),
      responses: { 200: ok('Comment updated.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
  '/delete-comment/{id}': {
    delete: {
      tags: ['Community'],
      summary: 'Delete a comment',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Comment deleted.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },

  // ── Reactions / shares / saves / hides ────────────────────────────────────
  '/toggle-reaction': {
    post: {
      tags: ['Community'],
      summary: 'React to (or un-react from) a post',
      ...auth,
      ...body('CommunityToggleReaction'),
      responses: { 200: ok('Reaction toggled.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/share-post': {
    post: {
      tags: ['Community'],
      summary: 'Share a post',
      ...auth,
      ...body('CommunityPostIdOnly'),
      responses: { 200: ok('Post shared.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/toggle-save-post': {
    post: {
      tags: ['Community'],
      summary: 'Save (or unsave) a post',
      ...auth,
      ...body('CommunityPostIdOnly'),
      responses: { 200: ok('Save toggled.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/toggle-hide-post': {
    post: {
      tags: ['Community'],
      summary: 'Hide (or unhide) a post from the caller’s own feed',
      ...auth,
      ...body('CommunityPostIdOnly'),
      responses: { 200: ok('Hide toggled.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-hidden-posts': {
    get: {
      tags: ['Community'],
      summary: 'List posts the caller has hidden',
      ...auth,
      responses: { 200: okList('Posts fetched.'), 401: unauthorized() },
    },
  },

  // ── Reports ────────────────────────────────────────────────────────────────
  '/report-post': {
    post: {
      tags: ['Community'],
      summary: 'Report a post to moderators',
      ...auth,
      ...body('CommunityReportPost'),
      responses: { 200: ok('Report submitted.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-my-reported-posts': {
    get: {
      tags: ['Community'],
      summary: 'List posts the caller has reported',
      ...auth,
      responses: { 200: okList('Reports fetched.'), 401: unauthorized() },
    },
  },
  '/get-my-posts-with-reports': {
    get: {
      tags: ['Community'],
      summary: "List the caller's own posts that have been reported by others",
      ...auth,
      responses: { 200: okList('Posts fetched.'), 401: unauthorized() },
    },
  },
  '/get-all-reported-posts': {
    get: {
      tags: ['Community'],
      summary: 'List all reported posts (moderation queue)',
      ...auth,
      responses: { 200: okList('Reports fetched.'), 401: unauthorized() },
    },
  },
  '/action-reported-post': {
    post: {
      tags: ['Community'],
      summary: 'Act on a reported post (dismiss / unpublish / delete)',
      ...auth,
      ...body('CommunityActionReportedPost'),
      responses: { 200: ok('Action taken.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },

  // ── Follow / connections ───────────────────────────────────────────────────
  '/toggle-follow-user': {
    post: {
      tags: ['Community'],
      summary: 'Follow (or unfollow) another user',
      ...auth,
      ...body('CommunityToggleFollowUser'),
      responses: { 200: ok('Follow toggled.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-followed-users': {
    get: {
      tags: ['Community'],
      summary: 'List users the caller follows',
      ...auth,
      responses: { 200: okList('Users fetched.'), 401: unauthorized() },
    },
  },
  '/get-my-connections': {
    get: {
      tags: ['Community'],
      summary: 'List mutual connections (users the caller follows who follow back)',
      ...auth,
      responses: { 200: okList('Connections fetched.'), 401: unauthorized() },
    },
  },

  // ── Groups ─────────────────────────────────────────────────────────────────
  '/create-group': {
    post: {
      tags: ['Community'],
      summary: 'Create a group (multipart — group_photo/cover_photo optional)',
      ...auth,
      ...body('CommunityCreateGroup'),
      responses: { 200: ok('Group created.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/update-group/{id}': {
    post: {
      tags: ['Community'],
      summary: 'Update a group (multipart — group_photo/cover_photo optional)',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Group updated.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
  '/delete-group/{id}': {
    delete: {
      tags: ['Community'],
      summary: 'Delete a group',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Group deleted.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
  '/get-all-groups': {
    get: {
      tags: ['Community'],
      summary: 'List public groups',
      ...auth,
      responses: { 200: okList('Groups fetched.'), 401: unauthorized() },
    },
  },
  '/get-user-groups': {
    get: {
      tags: ['Community'],
      summary: 'List groups the caller owns',
      ...auth,
      responses: { 200: okList('Groups fetched.'), 401: unauthorized() },
    },
  },
  '/get-joined-groups': {
    get: {
      tags: ['Community'],
      summary: 'List groups the caller has joined',
      ...auth,
      responses: { 200: okList('Groups fetched.'), 401: unauthorized() },
    },
  },
  '/get-group/{id}': {
    get: {
      tags: ['Community'],
      summary: 'Get a single group',
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Group fetched.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },
  '/join-group': {
    post: {
      tags: ['Community'],
      summary: 'Join a public group (or request to join a private one)',
      ...auth,
      ...body('CommunityGroupIdOnly'),
      responses: { 200: ok('Joined (or request sent).'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/leave-group': {
    post: {
      tags: ['Community'],
      summary: 'Leave a group',
      ...auth,
      ...body('CommunityGroupIdOnly'),
      responses: { 200: ok('Left group.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/invite-user': {
    post: {
      tags: ['Community'],
      summary: 'Invite a user to a group',
      ...auth,
      ...body('CommunityInviteUserToGroup'),
      responses: { 200: ok('Invitation sent.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-group-invitations': {
    get: {
      tags: ['Community'],
      summary: "List the caller's pending group invitations",
      ...auth,
      responses: { 200: okList('Invitations fetched.'), 401: unauthorized() },
    },
  },
  '/action-group-invitation': {
    post: {
      tags: ['Community'],
      summary: 'Accept or decline a group invitation',
      ...auth,
      ...body('CommunityActionGroupInvitation'),
      responses: { 200: ok('Action taken.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-group-requests/{groupId}': {
    get: {
      tags: ['Community'],
      summary: "List a private group's pending join requests (owner/admin only)",
      ...auth,
      parameters: [pathParam('groupId', 'Group id.')],
      responses: { 200: okList('Requests fetched.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
  '/action-group-request': {
    post: {
      tags: ['Community'],
      summary: 'Approve or reject a join request',
      ...auth,
      ...body('CommunityActionGroupRequest'),
      responses: { 200: ok('Action taken.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/remove-member': {
    post: {
      tags: ['Community'],
      summary: 'Remove a member from a group (owner/admin only)',
      ...auth,
      ...body('CommunityRemoveMember'),
      responses: { 200: ok('Member removed.'), 400: err('Validation failed or not authorized.'), 401: unauthorized() },
    },
  },
  '/get-group-members/{groupId}': {
    get: {
      tags: ['Community'],
      summary: 'List a group’s approved members',
      ...auth,
      parameters: [pathParam('groupId', 'Group id.')],
      responses: { 200: okList('Members fetched.'), 400: err('Not found.'), 401: unauthorized() },
    },
  },

  // ── Rewards / analytics ────────────────────────────────────────────────────
  '/get-user-rewards': {
    get: {
      tags: ['Community'],
      summary: "Get the caller's reward-point balance and history",
      ...auth,
      responses: { 200: ok('Rewards fetched.'), 401: unauthorized() },
    },
  },
  '/record-view': {
    post: {
      tags: ['Community'],
      summary: 'Record a post view (analytics)',
      ...auth,
      ...body('CommunityPostIdOnly'),
      responses: { 200: ok('View recorded.'), 400: err('Validation failed.'), 401: unauthorized() },
    },
  },
  '/get-post-analytics/{id}': {
    get: {
      tags: ['Community'],
      summary: "Get a post's view/engagement analytics (author only)",
      ...auth,
      parameters: idParam(),
      responses: { 200: ok('Analytics fetched.'), 400: err('Not authorized.'), 401: unauthorized() },
    },
  },
};
