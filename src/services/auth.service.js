const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const AuthToken = require('../models/AuthToken');
const LoginHistory = require('../models/LoginHistory');
const { issueToken, revokeToken } = require('../utils/token');
const { verifySocialToken } = require('../integrations/socialAuth');
const { sendEmailViaMailgun } = require('../integrations/mailgun');
const env = require('../config/env');
const presenceService = require('./presence.service');
const { datetimeStr, diffForHumans } = require('../utils/dateFormat');

// One-time code policy, shared by email verification and password reset. The
// 6-digit format is mirrored by otpCode() in validators/common.js — change both together.
const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Each purpose keeps its own code state on the user, so requesting a password
 * reset never cancels a signup code that is still in flight, or the reverse.
 */
const OTP_PURPOSES = {
  verify_email: {
    hash: 'email_otp_hash',
    expiresAt: 'email_otp_expires_at',
    attempts: 'email_otp_attempts',
    lastSentAt: 'email_otp_last_sent_at',
    subject: `Your ${env.appName} verification code`,
    html: emailOtpHtml,
  },
  reset_password: {
    hash: 'password_reset_otp_hash',
    expiresAt: 'password_reset_otp_expires_at',
    attempts: 'password_reset_otp_attempts',
    lastSentAt: 'password_reset_otp_last_sent_at',
    subject: `Your ${env.appName} password reset code`,
    html: resetOtpHtml,
  },
};

// Loaded only to be checked — never allowed onto the wire.
const SECRET_USER_FIELDS = [
  'password',
  'password_reset_token',
  'password_reset_expires',
  ...Object.values(OTP_PURPOSES).flatMap((p) => [p.hash, p.expiresAt, p.attempts, p.lastSentAt]),
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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function recordLoginHistory(userId, lat, long, address) {
  LoginHistory.create({ user_id: userId, latitude: lat || null, longitude: long || null, location: address || null }).catch((e) =>
    console.error('StoreLoginHistory failed:', e.message)
  );
}

function otpCodeHtml(otp) {
  return `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${otp}</p>`;
}

function emailOtpHtml(otp) {
  return `<p>Welcome to ${env.appName}!</p><p>Use this code to verify your email address:</p>${otpCodeHtml(otp)}<p>This code expires in ${OTP_TTL_MS / 60000} minutes. If you didn't create an account, you can safely ignore this email.</p>`;
}

function resetOtpHtml(otp) {
  return `<p>We received a request to reset your ${env.appName} password.</p><p>Use this code to continue:</p>${otpCodeHtml(otp)}<p>This code expires in ${OTP_TTL_MS / 60000} minutes. If you didn't ask to reset your password, you can ignore this email — your password will not change.</p>`;
}

/**
 * Codes are stored as an HMAC keyed with the server secret and bound to both the
 * purpose and the user. An unkeyed hash would not protect them — there are only a
 * million 6-digit codes, so anyone holding a database dump could try them all —
 * and binding the purpose means a signup code can never pass as a reset code.
 */
function hashOtp(purposeName, userId, otp) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${purposeName}:${userId}:${otp}`).digest('hex');
}

/**
 * Issues a fresh code for a purpose — replacing any earlier one — and emails it.
 *
 * The resend cooldown is claimed in the same atomic update that stores the code,
 * so two concurrent requests cannot both send: the loser reports `cooldown`
 * instead of mailing a second code that would silently invalidate the first. A
 * failed send releases the cooldown so the user can retry straight away rather
 * than wait out a code they never received.
 *
 * `filter` narrows which accounts may receive one; `set` rides along in the same update.
 *
 * @returns {Promise<{ sent: true } | { sent: false, reason: 'cooldown', retryAfterSeconds: number } | { sent: false, reason: 'delivery_failed' }>}
 */
async function sendOtp(purposeName, userId, { filter = {}, set = {} } = {}) {
  const purpose = OTP_PURPOSES[purposeName];
  const now = new Date();
  const otp = String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      ...filter,
      $or: [{ [purpose.lastSentAt]: null }, { [purpose.lastSentAt]: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) } }],
    },
    {
      $set: {
        [purpose.hash]: hashOtp(purposeName, userId, otp),
        [purpose.expiresAt]: new Date(now.getTime() + OTP_TTL_MS),
        [purpose.attempts]: 0,
        [purpose.lastSentAt]: now,
        ...set,
      },
    },
    { new: true }
  );

  if (!user) {
    const current = await User.findById(userId).select(`+${purpose.lastSentAt}`);
    const lastSent = current?.[purpose.lastSentAt]?.getTime() ?? now.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((lastSent + OTP_RESEND_COOLDOWN_MS - now.getTime()) / 1000));
    return { sent: false, reason: 'cooldown', retryAfterSeconds };
  }

  const delivered = await sendEmailViaMailgun(user.email, purpose.subject, purpose.html(otp));
  if (!delivered) {
    await User.updateOne({ _id: userId, [purpose.lastSentAt]: now }, { $set: { [purpose.lastSentAt]: null } });
    return { sent: false, reason: 'delivery_failed' };
  }
  return { sent: true };
}

function sendEmailOtp(userId) {
  return sendOtp('verify_email', userId, { filter: { email_verified_at: null } });
}

/** Turns a failed send into the API error for an endpoint whose whole job is sending the code. */
function throwUnlessSent(otp, noun) {
  if (otp.reason === 'cooldown') {
    throw fail(`Please wait ${otp.retryAfterSeconds} seconds before requesting a new code.`, 429, { retry_after_seconds: otp.retryAfterSeconds });
  }
  if (!otp.sent) {
    throw fail(`We couldn't send the ${noun} right now. Please try again shortly.`, 503);
  }
}

function codeIssued(user) {
  return { email: user.email, expiresInSeconds: OTP_TTL_MS / 1000, resendAvailableInSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
}

/**
 * Checks a code and, when it matches, clears it in the same atomic update that
 * applies `onSuccess` — so each code works exactly once.
 *
 * `guard` is added to every write's filter (email verification uses it so two
 * racing verifications cannot both succeed); `precheck` can reject the account
 * before the code is looked at.
 *
 * @returns {Promise<import('mongoose').Document>} the user after the update
 */
async function consumeOtp(purposeName, email, otp, { guard = {}, precheck, onSuccess = {} } = {}) {
  const purpose = OTP_PURPOSES[purposeName];
  const fields = `+${purpose.hash} +${purpose.expiresAt} +${purpose.attempts} +${purpose.lastSentAt}`;

  const user = await User.findOne({ email }).select(fields);
  if (!user) throw fieldError('email', 'This email is not registered.');
  if (precheck) precheck(user);
  if (!user[purpose.hash]) throw fieldError('otp', 'There is no active code for this email. Please request a new one.');
  if (user[purpose.attempts] >= OTP_MAX_ATTEMPTS) throw fieldError('otp', 'Too many incorrect attempts. Please request a new code.', 429);
  if (user[purpose.expiresAt] <= new Date()) throw fieldError('otp', 'This code has expired. Please request a new one.');

  // Spend the attempt before comparing. Concurrent guesses each consume one, so no
  // burst of parallel requests gets more than OTP_MAX_ATTEMPTS tries at a code;
  // matching on the hash also means a code replaced mid-flight is not the one
  // being guessed against.
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      ...guard,
      [purpose.hash]: user[purpose.hash],
      [purpose.attempts]: { $lt: OTP_MAX_ATTEMPTS },
      [purpose.expiresAt]: { $gt: new Date() },
    },
    { $inc: { [purpose.attempts]: 1 } },
    { new: true }
  ).select(fields);
  if (!claimed) throw fieldError('otp', 'This code is no longer valid. Please request a new one.');

  const matches = crypto.timingSafeEqual(Buffer.from(claimed[purpose.hash], 'hex'), Buffer.from(hashOtp(purposeName, claimed._id, otp), 'hex'));
  if (!matches) {
    const left = OTP_MAX_ATTEMPTS - claimed[purpose.attempts];
    if (left <= 0) throw fieldError('otp', 'Too many incorrect attempts. Please request a new code.', 429);
    throw fieldError('otp', `The code you entered is incorrect. You have ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
  }

  const consumed = await User.findOneAndUpdate(
    { _id: claimed._id, ...guard, [purpose.hash]: claimed[purpose.hash] },
    { $set: { [purpose.hash]: null, [purpose.expiresAt]: null, [purpose.attempts]: 0, ...onSuccess } },
    { new: true }
  );
  if (!consumed) throw fieldError('otp', 'This code is no longer valid. Please request a new one.');
  return consumed;
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
  const verified = await consumeOtp('verify_email', email, otp, {
    guard: { email_verified_at: null },
    precheck: (user) => {
      if (user.email_verified_at) throw fieldError('email', 'This email is already verified. Please log in.');
    },
    onSuccess: { email_verified_at: new Date() },
  });

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

  throwUnlessSent(await sendEmailOtp(user._id), 'verification code');
  return codeIssued(user);
}

/** Forgot password, step 1: email a reset code. Calling it again is how the app resends. */
async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) throw fieldError('email', 'This email is not registered.');

  // A new code also voids any reset token handed out by an earlier step 2, so
  // restarting the flow cannot leave an older session able to set the password.
  const otp = await sendOtp('reset_password', user._id, { set: { password_reset_token: null, password_reset_expires: null } });
  throwUnlessSent(otp, 'reset code');
  return codeIssued(user);
}

/**
 * Forgot password, step 2: trade the code for a short-lived, single-use reset
 * token. Only its hash is stored; the token itself is 256 random bits, so unlike
 * the code it needs no attempt counter.
 */
async function verifyResetOtp(email, otp) {
  const resetToken = crypto.randomBytes(32).toString('hex');
  await consumeOtp('reset_password', email, otp, {
    onSuccess: {
      password_reset_token: sha256(resetToken),
      password_reset_expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return { resetToken, expiresInSeconds: RESET_TOKEN_TTL_MS / 1000 };
}

/** Forgot password, step 3: set the new password with the reset token. */
async function resetPassword(email, resetToken, password) {
  const user = await User.findOne({ email });
  if (!user) throw fieldError('email', 'This email is not registered.');

  const tokenFilter = { _id: user._id, password_reset_token: sha256(resetToken), password_reset_expires: { $gt: new Date() } };
  const invalid = () => fieldError('reset_token', 'This reset session is invalid or has expired. Please request a new code.');

  // Rejects a bad token before paying for a bcrypt hash.
  if (!(await User.exists(tokenFilter))) throw invalid();

  const passwordHash = await bcrypt.hash(password, 10);

  // Matching and clearing the token in one update keeps it single-use even when
  // two submissions race each other.
  const updated = await User.findOneAndUpdate(tokenFilter, { $set: { password: passwordHash, password_reset_token: null, password_reset_expires: null } });
  if (!updated) throw invalid();

  const now = new Date();

  // Every existing session ends — whoever else holds one may be the reason for the reset.
  await AuthToken.updateMany({ tokenable_type: 'user', tokenable_id: user._id, revoked_at: null }, { $set: { revoked_at: now } });

  // Receiving the code proved the inbox, which is all email verification checks.
  // An existing verified date is left alone.
  await User.updateOne(
    { _id: user._id, email_verified_at: null },
    { $set: { email_verified_at: now, email_otp_hash: null, email_otp_expires_at: null, email_otp_attempts: 0 } }
  );
}

module.exports = {
  signup,
  login,
  socialLogin,
  logout,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
