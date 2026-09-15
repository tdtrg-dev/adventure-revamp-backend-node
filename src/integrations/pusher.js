const Pusher = require('pusher');
const env = require('../config/env');

/**
 * Same Pusher app/credentials as Laravel — services trigger the identical
 * channel names/event names Laravel currently broadcasts (ConversationEvent,
 * UserNotificationEvent, etc.) so no frontend/mobile changes are needed.
 */
const client = new Pusher({
  appId: env.pusher.appId,
  key: env.pusher.key,
  secret: env.pusher.secret,
  cluster: env.pusher.cluster,
  host: env.pusher.host || undefined,
  port: env.pusher.port || undefined,
  useTLS: env.pusher.scheme === 'https',
});

/**
 * pusher.trigger() throws synchronously (HMAC signing crashes on an undefined
 * secret) when Pusher isn't configured — that must never take down the primary
 * business action (post created, booking confirmed, etc.) that triggers a live
 * broadcast as a side effect. Wrapped here so every caller gets this safety
 * for free instead of needing its own try/catch.
 */
function trigger(channel, event, payload) {
  try {
    return client.trigger(channel, event, payload).catch((e) => console.error('Pusher trigger failed:', e.message));
  } catch (e) {
    console.error('Pusher trigger failed:', e.message);
    return undefined;
  }
}

/**
 * Signs a private-channel subscription request (POST /broadcasting/auth) —
 * mirrors Laravel's Broadcast::auth(). Unlike trigger(), this is not wrapped in
 * a fail-soft try/catch: the endpoint's entire job is producing this signature,
 * so if Pusher isn't configured there's nothing sensible to degrade to — it
 * should surface as a real error, same as it would in Laravel with broken
 * Pusher credentials.
 */
function authorizeChannel(socketId, channel) {
  return client.authorizeChannel(socketId, channel);
}

module.exports = { trigger, authorizeChannel };
