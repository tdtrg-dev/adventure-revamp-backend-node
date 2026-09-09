const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const userService = require('../services/user.service');

const getAllUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAllUsersWithContext(req.body.current_user_id, Number(req.body.page) || 1);
  return success(res, result.data, 'Users fetched successfully.');
});

const getUserProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getUserProfile(req.query.user_id);
  return success(res, profile, 'User profile fetched successfully.');
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await userService.updateProfile(req.body.user_id, req.body, req.file);
  return success(res, profile, 'Profile updated successfully.');
});

const deleteUserProfile = asyncHandler(async (req, res) => {
  await userService.deleteUserProfile(req.body.user_id);
  return success(res, [], 'User deleted successfully');
});

const reportUserProfile = asyncHandler(async (req, res) => {
  await userService.reportUserProfile(req.user.id, req.body, req.file);
  const label = req.body.report_type.charAt(0).toUpperCase() + req.body.report_type.slice(1);
  return success(res, [], `${label} reported successfully`);
});

const getMyProfileReports = asyncHandler(async (req, res) => {
  const reports = await userService.getMyProfileReports(req.user.id);
  return success(res, reports, 'Your reports fetched successfully');
});

module.exports = {
  getAllUsers,
  getUserProfile,
  updateProfile,
  deleteUserProfile,
  reportUserProfile,
  getMyProfileReports,
};
