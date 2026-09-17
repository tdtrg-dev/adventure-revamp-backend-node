const bcrypt = require('bcrypt');
const User = require('../models/User');
const Event = require('../models/Event');
const Post = require('../models/Post');
const Connection = require('../models/Connection');
const Report = require('../models/Report');
const { relativeUploadPath, fileUrl } = require('../middlewares/upload');
const { dateOnly, datetimeStr } = require('../utils/dateFormat');
const eventService = require('./event.service');
const { notifyUser } = require('./notification.service');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

function imageUrl(image) {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return fileUrl(image);
}

async function getUserProfile(userId) {
  const user = await User.findById(userId).populate({ path: 'interests', select: 'title' });
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 400;
    throw err;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    user_type: user.user_type,
    email_verified_at: datetimeStr(user.email_verified_at),
    stripe_account_id: user.stripe_account_id,
    stripe_customer_id: user.stripe_customer_id,
    member_since: dateOnly(user.created_at),

    gender: user.profile.gender,
    dob: dateOnly(user.profile.dob),
    phone: user.profile.phone,
    image: imageUrl(user.profile.image),
    bio: user.profile.bio,
    radius: user.profile.radius,
    address: user.profile.address,
    latitude: user.profile.latitude,
    longitude: user.profile.longitude,

    interests: user.interests.map((i) => ({ id: i.id, title: i.title })),
  };
}

async function updateUserCoreProfile(userId, body) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 400;
    throw err;
  }

  user.name = body.name;
  user.user_type = body.user_type;
  // Email is deliberately not updatable: it is the address proven by the signup
  // OTP, and letting it change here would keep the account verified for an
  // address nobody has confirmed.
  if (body.password) user.password = await bcrypt.hash(body.password, 10);

  if (body.gender) user.profile.gender = body.gender;
  if (body.dob) user.profile.dob = body.dob;
  if (body.phone) user.profile.phone = body.phone;

  await user.save();
  return user;
}

async function updateProfile(userId, body, bioImageFile) {
  await updateUserCoreProfile(userId, body);

  if (body.bio_description || bioImageFile) {
    const user = await User.findById(userId);
    if (body.bio_description) user.profile.bio = body.bio_description;
    if (bioImageFile) {
      user.profile.image = relativeUploadPath('user-profiles', bioImageFile.filename);
    }
    await user.save();
  }

  if (body.radius) {
    await User.updateOne({ _id: userId }, { 'profile.radius': body.radius });
  }

  if (body.interest_sub_cat && body.interest_sub_cat.length) {
    await User.updateOne({ _id: userId }, { interests: body.interest_sub_cat });
  }

  return getUserProfile(userId);
}

async function deleteUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  await User.deleteOne({ _id: userId });
}

async function getAllUsersWithContext(currentUserId, page = 1, perPage = 20) {
  const me = await User.findById(currentUserId).select('blocked_users');

  const blockersOfMe = await User.find({ blocked_users: currentUserId }).select('_id');
  const blockedIds = new Set([...(me?.blocked_users || []).map(String), ...blockersOfMe.map((u) => String(u._id))]);

  const connections = await Connection.find({ $or: [{ sender_id: currentUserId }, { receiver_id: currentUserId }] });

  const myFriendIds = new Set();
  const sentByMe = new Map();
  const sentToMe = new Map();
  connections.forEach((c) => {
    if (String(c.sender_id) === String(currentUserId)) {
      sentByMe.set(String(c.receiver_id), c);
      if (c.status === 'accepted') myFriendIds.add(String(c.receiver_id));
    } else {
      sentToMe.set(String(c.sender_id), c);
      if (c.status === 'accepted') myFriendIds.add(String(c.sender_id));
    }
  });

  const query = {
    _id: { $ne: currentUserId, $nin: [...blockedIds] },
    email_verified_at: { $ne: null },
  };

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('name email is_online last_seen_at profile.image')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  const data = await Promise.all(
    users.map(async (user) => {
      const [isOrganizer, isCommunityMember, theirConnections] = await Promise.all([
        Event.exists({ organizer_id: user._id, status: 'publish' }),
        Post.exists({ user_id: user._id, status: 'publish' }),
        Connection.find({ $or: [{ sender_id: user._id }, { receiver_id: user._id }], status: 'accepted' }),
      ]);

      const theirFriendIds = new Set();
      theirConnections.forEach((c) => {
        theirFriendIds.add(String(c.sender_id) === String(user._id) ? String(c.receiver_id) : String(c.sender_id));
      });
      const mutualCount = [...myFriendIds].filter((id) => theirFriendIds.has(id)).length;

      let connectionStatus = null;
      let connectionId = null;
      if (sentByMe.has(String(user._id))) {
        const row = sentByMe.get(String(user._id));
        connectionStatus = row.status === 'accepted' ? 'friends' : 'request_sent';
        connectionId = row.id;
      } else if (sentToMe.has(String(user._id))) {
        const row = sentToMe.get(String(user._id));
        connectionStatus = row.status === 'accepted' ? 'friends' : 'request_received';
        connectionId = row.id;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: imageUrl(user.profile.image),
        is_online: user.is_online,
        last_seen_at: datetimeStr(user.last_seen_at),
        mutual_friends: mutualCount,
        is_event_organizer: !!isOrganizer,
        is_community_member: !!isCommunityMember,
        connection_status: connectionStatus,
        connection_id: connectionId,
      };
    })
  );

  return { data, total, page, per_page: perPage };
}

async function reportUserProfile(reporterId, body, attachmentFile) {
  const { report_type, report_link, reason, message } = body;

  const url = new URL(report_link);
  const params = url.searchParams;
  const extractedId = report_type === 'profile' ? params.get('id') : params.get('eventId');

  if (!extractedId) {
    const err = new Error('Invalid link, unable to extract ID');
    err.statusCode = 400;
    throw err;
  }

  if (report_type === 'profile') {
    if (extractedId === String(reporterId)) {
      const err = new Error('You cannot report yourself');
      err.statusCode = 400;
      throw err;
    }
    if (!(await User.exists({ _id: extractedId }))) {
      const err = new Error('Reported user does not exist');
      err.statusCode = 400;
      throw err;
    }
    if (await Report.exists({ reporter_id: reporterId, target_type: 'profile', target_id: extractedId })) {
      const err = new Error('You have already reported this profile');
      err.statusCode = 400;
      throw err;
    }
  } else {
    const event = await Event.findById(extractedId);
    if (!event) {
      const err = new Error('Reported event does not exist');
      err.statusCode = 400;
      throw err;
    }
    if (String(event.organizer_id) === String(reporterId)) {
      const err = new Error('You cannot report your own event');
      err.statusCode = 400;
      throw err;
    }
    if (await Report.exists({ reporter_id: reporterId, target_type: 'event', target_id: extractedId })) {
      const err = new Error('You have already reported this event');
      err.statusCode = 400;
      throw err;
    }
  }

  await Report.create({
    reporter_id: reporterId,
    target_type: report_type,
    target_id: extractedId,
    report_link,
    reason,
    message: message || null,
    attachment: attachmentFile ? relativeUploadPath('report-attachments', attachmentFile.filename) : null,
    status: 'pending',
  });
}

async function getMyProfileReports(reporterId) {
  return Report.find({ reporter_id: reporterId, target_type: { $in: ['profile', 'event'] } })
    .sort({ created_at: -1 })
    .populate('target_id');
}

// ── Admin ────────────────────────────────────────────────────────────────────

async function getAllUsers(page = 1) {
  const perPage = 20;
  const query = { email_verified_at: { $ne: null } };
  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select('name email profile.image')
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage);

  return {
    data: users.map((u) => ({ id: u.id, name: u.name, email: u.email, image: imageUrl(u.profile.image) })),
    pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
  };
}

async function getAllReportsForAdmin(type) {
  const query = type ? { target_type: type } : { target_type: { $in: ['profile', 'event'] } };
  return Report.find(query)
    .populate('reporter_id', 'name profile.image')
    .populate({ path: 'target_id', select: 'name email profile media title' })
    .sort({ _id: -1 });
}

async function actionReport(reportId, action, remarks, adminId) {
  const report = await Report.findById(reportId);
  if (!report) throw fail('Report not found');

  if (report.target_type === 'profile') {
    const reportedUser = await User.findById(report.target_id);
    if (!reportedUser) throw fail('Reported user not found');

    if (action === 'warn') {
      const body = `Warning: Your profile has been reported for: ${remarks || report.reason}`;
      await notifyUser(reportedUser._id, 'report_warning', { report_id: report.id }, { actorId: adminId, title: 'Profile Reported', body });
    } else if (action === 'suspend') {
      reportedUser.suspended_until = new Date(Date.now() + 2 * 3600000);
      await reportedUser.save();
      const body = 'Your account has been suspended for 2 hours due to community guideline violations.';
      await notifyUser(reportedUser._id, 'account_suspended', { report_id: report.id }, { actorId: adminId, title: 'Account Suspended', body });
    } else if (action === 'ban') {
      reportedUser.is_banned = true;
      await reportedUser.save();
      const body = 'Your account has been permanently banned from the platform.';
      await notifyUser(reportedUser._id, 'account_banned', { report_id: report.id }, { actorId: adminId, title: 'Account Banned', body });
    }
  } else if (report.target_type === 'event') {
    const event = await Event.findById(report.target_id);
    if (!event) throw fail('Reported event not found');

    if (action === 'warn') {
      const body = `Warning: Your event '${event.trip_name}' has been reported for: ${remarks || report.reason}`;
      await notifyUser(event.organizer_id, 'event_warning', { report_id: report.id }, { actorId: adminId, title: 'Event Reported', body });
    } else if (action === 'unpublish') {
      event.status = 'draft';
      await event.save();
      const body = `Your event '${event.trip_name}' has been unpublished by the admin.`;
      await notifyUser(event.organizer_id, 'event_unpublished', { report_id: report.id }, { actorId: adminId, title: 'Event Unpublished', body });
    } else if (action === 'delete') {
      event.deleted_at = new Date();
      await event.save();
      await eventService.deleteEventGroup(event._id);
      const body = `Your event '${event.trip_name}' has been deleted by the admin due to reports.`;
      await notifyUser(event.organizer_id, 'event_deleted', { report_id: report.id }, { actorId: adminId, title: 'Event Deleted', body });
    }
  }

  report.status = action === 'dismiss' ? 'declined' : 'resolved';
  report.admin_remarks = remarks || report.admin_remarks;
  await report.save();

  const statusText = action === 'dismiss' ? 'dismissed' : `resolved with action: ${action}`;
  const targetLabel = report.target_type === 'profile' ? 'user profile' : 'event';
  await notifyUser(report.reporter_id, 'report_action_taken', { report_id: report.id }, {
    actorId: adminId,
    title: 'Report Update',
    body: `Your report regarding ${targetLabel} has been ${statusText}.`,
  });

  return report;
}

async function deleteReport(id) {
  const report = await Report.findById(id);
  if (!report) throw fail('Report not found');
  await report.deleteOne();
}

module.exports = {
  getUserProfile,
  updateUserCoreProfile,
  updateProfile,
  deleteUserProfile,
  getAllUsersWithContext,
  reportUserProfile,
  getMyProfileReports,
  imageUrl,
  getAllUsers,
  getAllReportsForAdmin,
  actionReport,
  deleteReport,
};
