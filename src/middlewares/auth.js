const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const { error } = require('../utils/response');
const AuthToken = require('../models/AuthToken');

/**
 * Mirrors Sanctum's single guard used for both User and Admin tokens (personal_access_tokens
 * is polymorphic). Verifies the JWT signature/expiry, then checks the auth_tokens collection
 * so logout-revocation still works exactly like Sanctum's currentAccessToken()->delete().
 * Attaches req.auth = { id, type, jti } and req.user / req.admin (the loaded document).
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return error(res, 'Unauthenticated', 401, []);
    }

    let payload;
    try {
      // Pinning algorithms defends against algorithm-confusion attacks (e.g. a
      // forged token whose header claims "alg": "none" or an asymmetric algorithm).
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch (e) {
      return error(res, 'Unauthenticated', 401, []);
    }

    const tokenDoc = await AuthToken.findOne({ jti: payload.jti });
    if (!tokenDoc || tokenDoc.revoked_at || tokenDoc.expires_at < new Date()) {
      return error(res, 'Unauthenticated', 401, []);
    }

    req.auth = { id: payload.sub, type: payload.type, jti: payload.jti };

    if (payload.type === 'admin') {
      const Admin = mongoose.model('Admin');
      const admin = await Admin.findById(payload.sub);
      if (!admin || admin.deleted_at) return error(res, 'Unauthenticated', 401, []);
      req.admin = admin;
    } else {
      const User = mongoose.model('User');
      const user = await User.findById(payload.sub);
      if (!user || user.deleted_at) return error(res, 'Unauthenticated', 401, []);
      req.user = user;
    }

    return next();
  } catch (e) {
    return error(res, 'Unauthenticated', 401, []);
  }
}

module.exports = { authenticate };
