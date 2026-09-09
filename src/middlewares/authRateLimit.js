const rateLimit = require('express-rate-limit');
const { error } = require('../utils/response');

/**
 * Stricter limiter for credential-guessing-prone endpoints (login, signup, social
 * login, password reset, admin login) — the global 300/15min limit in server.js is
 * sized for normal API traffic, not for slowing down brute-force/credential-stuffing
 * attempts against user accounts.
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => error(res, 'Too many attempts. Please try again later.', 429, []),
});

module.exports = authRateLimit;
