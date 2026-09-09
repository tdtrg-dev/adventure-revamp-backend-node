const Notification = require('../models/Notification');

async function list(userId, page = 1) {
  const perPage = 20;
  const query = { recipient_id: userId };

  const total = await Notification.countDocuments(query);
  const items = await Notification.find(query)
    .populate('actor_id', 'name')
    .sort({ read_at: 1, _id: -1 }) // unread (null read_at) first, then newest first
    .skip((page - 1) * perPage)
    .limit(perPage);

  return {
    data: items,
    pagination: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
  };
}

async function unreadCount(userId) {
  return Notification.countDocuments({ recipient_id: userId, read_at: null });
}

async function markRead(userId, id) {
  const notification = await Notification.findOne({ _id: id, recipient_id: userId });
  if (!notification) {
    const err = new Error('Notification not found.');
    err.statusCode = 404;
    throw err;
  }
  if (!notification.read_at) {
    notification.read_at = new Date();
    await notification.save();
  }
}

async function markAllRead(userId) {
  await Notification.updateMany({ recipient_id: userId, read_at: null }, { read_at: new Date() });
}

async function destroy(userId, id) {
  const result = await Notification.deleteOne({ _id: id, recipient_id: userId });
  if (result.deletedCount === 0) {
    const err = new Error('Notification not found.');
    err.statusCode = 404;
    throw err;
  }
}

async function destroyAll(userId) {
  await Notification.deleteMany({ recipient_id: userId });
}

async function getMyNotifications(userId) {
  return Notification.find({ recipient_id: userId }).sort({ _id: -1 });
}

module.exports = { list, unreadCount, markRead, markAllRead, destroy, destroyAll, getMyNotifications };
