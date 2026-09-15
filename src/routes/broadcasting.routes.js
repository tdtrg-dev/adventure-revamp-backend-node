const express = require('express');
const router = express.Router();

const { resolveAuth } = require('../middlewares/auth');
const broadcastAuth = require('../services/broadcastAuth.service');
const pusher = require('../integrations/pusher');

// The format Pusher clients issue, and the one pusher.authorizeChannel() insists on.
const SOCKET_ID = /^\d+\.\d+$/;

/**
 * Node equivalent of Laravel's framework-native `POST /broadcasting/auth` route
 * (registered via bootstrap/app.php's withBroadcasting(), authorized per
 * routes/channels.php — see broadcastAuth.service.js). Pusher/Echo clients call
 * this to get permission to subscribe to a private channel (e.g.
 * `private-user.{id}`, `private-conversation.{id}`).
 *
 * Deliberately NOT wrapped in this app's usual {success,code,message,data}
 * envelope, and NOT behind the shared `authenticate` middleware: this route has
 * no equivalent in Helper::createAPIResponce-based controllers in the real app
 * either — it's pure Laravel/Sanctum framework plumbing, so its failure shapes
 * mirror Laravel's own raw default exception JSON, and its success shape must be
 * exactly what Pusher's JS client expects ({auth: "..."}), not an envelope.
 */
router.post('/broadcasting/auth', async (req, res) => {
  try {
    const resolved = await resolveAuth(req);
    if (!resolved) return res.status(401).json({ message: 'Unauthenticated.' });

    const { channel_name, socket_id } = req.body || {};
    // typeof guards too: the urlencoded parser turns channel_name[]=... into an array.
    if (typeof channel_name !== 'string' || typeof socket_id !== 'string' || !channel_name || !socket_id) {
      return res.status(400).json({ message: 'channel_name and socket_id are required.' });
    }
    // Checked here so a hand-crafted value is a 400 instead of a thrown 500.
    if (!SOCKET_ID.test(socket_id)) {
      return res.status(400).json({ message: 'socket_id is invalid.' });
    }

    // Every registered channel belongs to a user — their own inbox or a
    // conversation they take part in — so an admin token has nothing to subscribe to.
    if (!resolved.user) return res.status(403).json({ message: 'This action is unauthorized.' });

    const authorized = await broadcastAuth.isAuthorized(resolved.user, channel_name);
    if (!authorized) return res.status(403).json({ message: 'This action is unauthorized.' });

    return res.status(200).json(pusher.authorizeChannel(socket_id, channel_name));
  } catch (e) {
    console.error('broadcasting/auth failed:', e.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
