const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const { issueToken, revokeToken } = require('../utils/token');
const { verifySocialToken } = require('../integrations/socialAuth');
const { sendEmailViaMailgun } = require('../integrations/mailgun');
const env = require('../config/env');
const presenceService = require('./presence.service');
const { datetimeStr, diffForHumans } = require('../utils/dateFormat');

// Email-verification OTP policy. The 6-digit format is mirrored by otpCode() in
// validators/common.js — change both together.
const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_FIELDS = '+email_otp_hash +email_otp_expires_at +email_otp_attempts +email_otp_last_sent_at';

// Loaded only to be checked — never allowed onto the wire.
const SECRET_USER_FIELDS = [
  'password',
  'password_reset_token',
  'password_reset_expires',
  'email_otp_hash',
  'email_otp_expires_at',
  'email_otp_attempts',
  'email_otp_last_sent_at',
];

function fail(message, code = 400, data = []) {
  const err = new Error(message);
  err.statusCode = code;
  err.data = data;
  return err;
}

/** Error whose `data` is keyed by the offending field — the same shape the validate middleware uses, so the app can show it inline. */
function fieldError(field, message, code = 400) {
  return fail(message, code, { [field]: [message] });
}

/**
 * A user as it goes out in an auth response. `select: false` only applies to
 * documents read with a projection: one that was just created, or read with
 * `+password` to check a login, still carries those values and would serialize
 * them — the bcrypt hash included.
 */
function authUser(user) {
  const json = user.toJSON();
  SECRET_USER_FIELDS.forEach((field) => delete json[field]);
  return json;
}

function recordLoginHistory(userId, lat, long, address) {
  LoginHistory.create({ user_id: userId, latitude: lat || null, longitude: long || null, location: address || null }).catch((e) =>
    console.error('StoreLoginHistory failed:', e.message)
  );
}

function resetPasswordEmailHtml(url) {
  return `<p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 60 minutes.</p>`;
}

function emailOtpHtml(otp) {
  return `<p>Welcome to ${env.appName}!</p><p>Use this code to verify your email address:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${otp}</p><p>This code expires in ${OTP_TTL_MS / 60000} minutes. If you didn't create an account, you can safely ignore this email.</p>`;
}

/**
 * Codes are stored as an HMAC keyed with the server secret and bound to the user
 * id. An unkeyed hash would not protect them: there are only a million 6-digit
 * codes, so anyone holding a database dump could reverse one by trying them all.
 */
function hashOtp(userId, otp) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${userId}:${otp}`).digest('hex');
}

/**
 * Issues a fresh code — replacing any earlier one — and emails it.
 *
 * The resend cooldown is claimed in the same atomic update that stores the code,
 * so two concurrent requests cannot both send: the loser reports `cooldown`
 * instead of mailing a second code that would silently invalidate the first. A
 * failed send releases the cooldown so the user can retry straight away rather
 * than wait out a code they never received.
 *
 * @returns {Promise<{ sent: true } | { sent: false, reason: 'cooldown', retryAfterSeconds: number } | { sent: false, reason: 'delivery_failed' }>}
 */
async function sendEmailOtp(userId) {
  const now = new Date();
  const otp = String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      email_verified_at: null,
      $or: [{ email_otp_last_sent_at: null }, { email_otp_last_sent_at: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) } }],
    },
    {
      $set: {
        email_otp_hash: hashOtp(userId, otp),
        email_otp_expires_at: new Date(now.getTime() + OTP_TTL_MS),
        email_otp_attempts: 0,
        email_otp_last_sent_at: now,
      },
    },
    { new: true }
  );

  if (!user) {
    const current = await User.findById(userId).select('+email_otp_last_sent_at');
    const lastSent = current?.email_otp_last_sent_at?.getTime() ?? now.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((lastSent + OTP_RESEND_COOLDOWN_MS - now.getTime()) / 1000));
    return { sent: false, reason: 'cooldown', retryAfterSeconds };
  }

  const delivered = await sendEmailViaMailgun(user.email, `Your ${env.appName} verification code`, emailOtpHtml(otp));
  if (!delivered) {
    await User.updateOne({ _id: userId, email_otp_last_sent_at: now }, { $set: { email_otp_last_sent_at: null } });
    return { sent: false, reason: 'delivery_failed' };
  }
  return { sent: true };
}

/** Banned and suspended accounts get no session, whichever route they arrive by. */
function assertAccountActive(user) {
  if (user.is_banned) {
    throw fail('Your account has been permanently banned from the platform.', 403);
  }

  if (user.suspended_until && user.suspended_until > new Date()) {
    const remaining = diffForHumans(user.suspended_until);
    throw fail(`Your account is temporarily suspended. Please try again in ${remaining}.`, 403, { suspended_until: datetimeStr(user.suspended_until) });
  }
}

function unverifiedLoginError(email, otp) {
  let message = `Please verify your email. We've sent a verification code to ${email}.`;
  if (otp.reason === 'cooldown') message = `Please verify your email using the code we sent to ${email}.`;
  if (otp.reason === 'delivery_failed') message = "Please verify your email. We couldn't send a new code right now, so please request one again.";

  const data = { email_verified: false, email, otp_sent: otp.sent };
  if (otp.reason === 'cooldown') data.retry_after_seconds = otp.retryAfterSeconds;
  return fail(message, 403, data);
}

async function signup(body) {
  const { id, name, email, user_type, password, gender, dob, phone, bio, radius, google_id, current_lat, current_long, full_address } = body;

  let user;
  let otp = null;
  if (!id || id === 0) {
    if (await User.findOne({ email })) {
      const err = new Error('The email already exists- Please try logging In');
      err.statusCode = 400;
      throw err;
    }

    user = await User.create({
      name,
      email,
      user_type,
      google_id: google_id || null,
      password: await bcrypt.hash(password, 10),
      profile: { gender: gender || null, dob: dob || null, phone: phone || null, bio: bio || null, radius: radius || null },
    });

    otp = await sendEmailOtp(user._id);
  } else {
    user = await User.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 400;
      throw err;
    }
    user.name = name;
    user.user_type = user_type;
    if (google_id) user.google_id = google_id;
    if (password) user.password = await bcrypt.hash(password, 10);
    user.profile.gender = gender ?? user.profile.gender;
    user.profile.dob = dob ?? user.profile.dob;
    user.profile.phone = phone ?? user.profile.phone;
    await user.save();
  }

  recordLoginHistory(user._id, current_lat, current_long, full_address);

  // No session until the email is proven: verifyEmailOtp hands out the first
  // token. The id branch (profile completion) still issues one for accounts that
  // are already verified, such as users who arrived through social login.
  if (!user.email_verified_at) {
    return { user: authUser(user), accessToken: null, otp };
  }

  const accessToken = await issueToken(user._id, 'user');
  return { user: authUser(user), accessToken, otp };
}

async function login(email, password) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw fieldError('email', 'This email is not registered.');
  }

  if (!(await bcrypt.compare(password, user.password))) {
    throw fieldError('password', 'The password you entered is incorrect.');
  }

  assertAccountActive(user);

  // Only reachable with the right password, so it tells nobody anything they
  // could not already find out — and it saves the user a separate resend call
  // before they can finish verifying.
  if (!user.email_verified_at) {
    throw unverifiedLoginError(user.email, await sendEmailOtp(user._id));
  }

  const accessToken = await issueToken(user._id, 'user');
  return { user: authUser(user), accessToken };
}

async function socialLogin(provider, accessToken, userType) {
  let socialUser;
  try {
    socialUser = await verifySocialToken(provider, accessToken);
  } catch (e) {
    const err = new Error(`Invalid social token provided: ${e.message}`);
    err.statusCode = 400;
    throw err;
  }

  const column = provider === 'google' ? 'google_id' : 'fb_id';

  let user = await User.findOne({ $or: [{ [column]: socialUser.id }, { email: socialUser.email }] });

  if (!user) {
    user = await User.create({
      name: socialUser.name,
      email: socialUser.email,
      password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
      [column]: socialUser.id,
      user_type: userType || 'user',
      email_verified_at: new Date(),
    });
  } else {
    if (!user[column]) user[column] = socialUser.id;
    if (!user.email_verified_at) user.email_verified_at = new Date();
    await user.save();
  }

  const jwtToken = await issueToken(user._id, 'user');
  return { user: authUser(user), accessToken: jwtToken, provider };
}

async function logout(jti, user) {
  await presenceService.markOffline(user);
  await revokeToken(jti);
}

async function verifyEmailOtp(email, otp) {
  const user = await User.findOne({ email }).select(OTP_FIELDS);
  if (!user) throw fieldError('email', 'This email is not registered.');
  if (user.email_verified_at) throw fieldError('email', 'This email is already verified. Please log in.');
  if (!user.email_otp_hash) throw fieldError('otp', 'There is no active code for this email. Please request a new one.');
  if (user.email_otp_attempts >= OTP_MAX_ATTEMPTS) throw fieldError('otp', 'Too many incorrect attempts. Please request a new code.', 429);
  if (user.email_otp_expires_at <= new Date()) throw fieldError('otp', 'This code has expired. Please request a new one.');

  // Spend the attempt before comparing. Concurrent guesses each consume one, so no
  // burst of parallel requests gets more than OTP_MAX_ATTEMPTS tries at a code;
  // matching on the hash also means a code replaced mid-flight is not the one
  // being guessed against.
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      email_verified_at: null,
      email_otp_hash: user.email_otp_hash,
      email_otp_attempts: { $lt: OTP_MAX_ATTEMPTS },
      email_otp_expires_at: { $gt: new Date() },
    },
    { $inc: { email_otp_attempts: 1 } },
    { new: true }
  ).select(OTP_FIELDS);
  if (!claimed) throw fieldError('otp', 'This code is no longer valid. Please request a new one.');

  const matches = crypto.timingSafeEqual(Buffer.from(claimed.email_otp_hash, 'hex'), Buffer.from(hashOtp(claimed._id, otp), 'hex'));
  if (!matches) {
    const left = OTP_MAX_ATTEMPTS - claimed.email_otp_attempts;
    if (left <= 0) throw fieldError('otp', 'Too many incorrect attempts. Please request a new code.', 429);
    throw fieldError('otp', `The code you entered is incorrect. You have ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
  }

  const verified = await User.findOneAndUpdate(
    { _id: claimed._id, email_verified_at: null, email_otp_hash: claimed.email_otp_hash },
    { $set: { email_verified_at: new Date(), email_otp_hash: null, email_otp_expires_at: null, email_otp_attempts: 0 } },
    { new: true }
  );
  if (!verified) throw fieldError('otp', 'This code is no longer valid. Please request a new one.');

  // The address is proven either way; a banned or suspended account just does not
  // get a session out of it.
  assertAccountActive(verified);

  const accessToken = await issueToken(verified._id, 'user');
  return { user: authUser(verified), accessToken };
}

async function resendEmailOtp(email) {
  const user = await User.findOne({ email });
  if (!user) throw fieldError('email', 'This email is not registered.');
  if (user.email_verified_at) throw fieldError('email', 'This email is already verified. Please log in.');

  const otp = await sendEmailOtp(user._id);
  if (otp.reason === 'cooldown') {
    throw fail(`Please wait ${otp.retryAfterSeconds} seconds before requesting a new code.`, 429, { retry_after_seconds: otp.retryAfterSeconds });
  }
  if (!otp.sent) {
    throw fail("We couldn't send the verification code right now. Please try again shortly.", 503);
  }

  return { email: user.email, expiresInSeconds: OTP_TTL_MS / 1000, resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Failed to send reset link.');
    err.statusCode = 400;
    throw err;
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.password_reset_token = crypto.createHash('sha256').update(token).digest('hex');
  user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const baseUrl = env.frontendUrl;
  const resetUrl = `${baseUrl}/reset-password?${new URLSearchParams({ token, email })}`;
  sendEmailViaMailgun(user.email, 'Reset Password Notification', resetPasswordEmailHtml(resetUrl)).catch(() => {});
}

async function resetPassword(email, token, password) {
  const user = await User.findOne({ email }).select('+password_reset_token +password_reset_expires');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  if (!user || user.password_reset_token !== hashed || !user.password_reset_expires || user.password_reset_expires < new Date()) {
    const err = new Error('Invalid or expired token.');
    err.statusCode = 400;
    throw err;
  }

  user.password = await bcrypt.hash(password, 10);
  user.password_reset_token = null;
  user.password_reset_expires = null;
  await user.save();
}

module.exports = {
  signup,
  login,
  socialLogin,
  logout,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  resetPassword,
};
