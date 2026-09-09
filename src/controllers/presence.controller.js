const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const presenceService = require('../services/presence.service');

const ping = asyncHandler(async (req, res) => {
  await presenceService.markOnline(req.user);
  return success(res, { is_online: true, last_seen_at: req.user.last_seen_at }, 'OK');
});

const goOffline = asyncHandler(async (req, res) => {
  await presenceService.markOffline(req.user);
  return success(res, { is_online: false, last_seen_at: req.user.last_seen_at }, 'Marked offline.');
});

module.exports = { ping, goOffline };
