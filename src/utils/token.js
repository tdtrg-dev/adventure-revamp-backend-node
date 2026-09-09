const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ms = require('./ms');
const env = require('../config/env');
const AuthToken = require('../models/AuthToken');

/**
 * Mirrors createToken('auth_token')->plainTextToken — issues a JWT and records it
 * in auth_tokens so logout can revoke this specific token (Sanctum parity).
 */
async function issueToken(subjectId, type) {
  const jti = crypto.randomUUID();
  const expiresInMs = ms(env.jwtExpiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs);

  const token = jwt.sign({ sub: subjectId.toString(), type, jti }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

  await AuthToken.create({
    jti,
    tokenable_type: type,
    tokenable_id: subjectId,
    expires_at: expiresAt,
  });

  return token;
}

async function revokeToken(jti) {
  await AuthToken.updateOne({ jti }, { revoked_at: new Date() });
}

module.exports = { issueToken, revokeToken };
