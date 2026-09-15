const Notification = require('../models/Notification');
const pusher = require('../integrations/pusher');
const { sendToUserTopic } = require('../integrations/firebase');

/**
 * Mirrors SendPusherNotificationJob — the central fan-out helper: creates a
 * Notification row (unless saveToDb=false), broadcasts a Pusher event on the
 * recipient's private-user.{id} channel, and best-effort pushes via Firebase.
 * Fire-and-forget from callers (matches the plan's "no queue table" decision).
 */
async function notifyUser(recipientId, type, payload = {}, { actorId = null, relatedType = null, relatedId = null, title = '', body = '', saveToDb = true } = {}) {
  let broadcastPayload = payload;

  if (saveToDb) {
    const notification = await Notification.create({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      related_type: relatedType,
      related_id: relatedId,
      data: payload,
      title,
      body,
    });
    broadcastPayload = { ...payload, notification_id: notification.id };
  }

  pusher.trigger(pusher.userChannel(recipientId), type, broadcastPayload);

  if (saveToDb) {
    sendToUserTopic(recipientId, { title, body, data: { navigateTo: type } }).catch((e) => console.error('Firebase push failed:', e.message));
  }
}

module.exports = { notifyUser };
