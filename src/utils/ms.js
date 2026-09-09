const UNITS = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Minimal duration parser for values like "90d", "15m", "3600" (seconds).
 * Covers the same shorthand jsonwebtoken's `expiresIn` accepts.
 */
module.exports = function ms(value) {
  if (typeof value === 'number') return value * 1000;

  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);

  const amount = Number(match[1]);
  const unit = match[2] || 's';
  return amount * UNITS[unit];
};
