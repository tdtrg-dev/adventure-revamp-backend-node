const admin = require('firebase-admin');
const env = require('../config/env');

let initialized = false;

function getMessaging() {
  if (!env.firebase.credentials) {
    throw new Error('Firebase is not configured (FIREBASE_CREDENTIALS missing).');
  }
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert(require(env.firebase.credentials)),
      projectId: env.firebase.projectId,
    });
    initialized = true;
  }
  return admin.messaging();
}

/**
 * Mirrors FireBaseNotificationTriggerService::fireBaseTrigger — pushes to the
 * per-user topic ("user_<id>") only. The Laravel version's device-token/web-push
 * branch (sendToWebUsers) references a DeviceToken model that doesn't exist
 * anywhere in the app (dead code that would throw if ever reached) — not ported.
 */
async function sendToUserTopic(userId, { title, body, data = {} } = {}) {
  const messaging = getMessaging();
  const topic = `user_${userId}`;

  await messaging.send({
    topic,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    apns: { payload: { aps: { sound: 'default', 'content-available': 1 } } },
  });
}

module.exports = { sendToUserTopic };
