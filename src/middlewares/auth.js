const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const { error } = require('../utils/response');
const AuthToken = require('../models/AuthToken');

/**
 * Core token resolution shared by `authenticate` and any other entry point that
 * needs the same Sanctum-guard semantics but a different failure response (e.g.
 * the raw, unwrapped shape Laravel's framework-native broadcasting/auth route
 * uses — see routes/broadcasting.routes.js). Mirrors Sanctum's single guard used
 * for both User and Admin tokens (personal_access_tokens is polymorphic).
 * Verifies the JWT signature/expiry, then checks the auth_tokens collection so
 * logout-revocation still works exactly like Sanctum's currentAccessToken()->delete().
 * Returns { auth: {id, type, jti}, user, admin } (user/admin mutually exclusive),
 * or null if the request isn't authenticated.
 */
async function resolveAuth(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  let payload;
  try {
    // Pinning algorithms defends against algorithm-confusion attacks (e.g. a
    // forged token whose header claims "alg": "none" or an asymmetric algorithm).
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (e) {
    return null;
  }

  const tokenDoc = await AuthToken.findOne({ jti: payload.jti });
  if (!tokenDoc || tokenDoc.revoked_at || tokenDoc.expires_at < new Date()) return null;

  const auth = { id: payload.sub, type: payload.type, jti: payload.jti };

  if (payload.type === 'admin') {
    const Admin = mongoose.model('Admin');
    const admin = await Admin.findById(payload.sub);
    if (!admin || admin.deleted_at) return null;
    return { auth, admin };
  }

  const User = mongoose.model('User');
  const user = await User.findById(payload.sub);
  if (!user || user.deleted_at) return null;
  return { auth, user };
}

/** Attaches req.auth = { id, type, jti } and req.user / req.admin (the loaded document). */
async function authenticate(req, res, next) {
  try {
    const resolved = await resolveAuth(req);
    if (!resolved) return error(res, 'Unauthenticated', 401, []);

    req.auth = resolved.auth;
    if (resolved.admin) req.admin = resolved.admin;
    if (resolved.user) req.user = resolved.user;

    return next();
  } catch (e) {
    return error(res, 'Unauthenticated', 401, []);
  }
}

module.exports = { authenticate, resolveAuth };
