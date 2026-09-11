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

function recordLoginHistory(userId, lat, long, address) {
  LoginHistory.create({ user_id: userId, latitude: lat || null, longitude: long || null, location: address || null }).catch((e) =>
    console.error('StoreLoginHistory failed:', e.message)
  );
}

function verificationEmailHtml(url) {
  return `<p>Please verify your email by clicking the link below:</p><p><a href="${url}">${url}</a></p>`;
}

function resetPasswordEmailHtml(url) {
  return `<p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 60 minutes.</p>`;
}

function sendVerificationEmail(user, baseUrl) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const hash = crypto.createHash('sha1').update(user.email).digest('hex');
  const url = `${baseUrl || env.frontendUrl}/verify-email?${new URLSearchParams({
    id: user.id.toString(),
    hash,
    expires: String(expiresAt),
  })}`;
  sendEmailViaMailgun(user.email, 'Verify Email', verificationEmailHtml(url)).catch(() => {});
}

async function signup(body) {
  const { id, name, email, user_type, password, gender, dob, phone, bio, radius, google_id, current_lat, current_long, full_address } = body;

  let user;
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

    sendVerificationEmail(user);
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

  const accessToken = await issueToken(user._id, 'user');
  recordLoginHistory(user._id, current_lat, current_long, full_address);

  return { user, accessToken };
}

async function login(email, password) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const err = new Error('This email is not registered.');
    err.statusCode = 400;
    throw err;
  }

  if (!(await bcrypt.compare(password, user.password))) {
    const err = new Error('Invalid password');
    err.statusCode = 400;
    throw err;
  }

  if (user.is_banned) {
    const err = new Error('Your account has been permanently banned from the platform.');
    err.statusCode = 403;
    throw err;
  }

  if (user.suspended_until && user.suspended_until > new Date()) {
    const remaining = diffForHumans(user.suspended_until);
    const err = new Error(`Your account is temporarily suspended. Please try again in ${remaining}.`);
    err.statusCode = 403;
    err.data = { suspended_until: datetimeStr(user.suspended_until) };
    throw err;
  }

  const accessToken = await issueToken(user._id, 'user');
  return { user, accessToken };
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
  return { user, accessToken: jwtToken, provider };
}

async function logout(jti, user) {
  await presenceService.markOffline(user);
  await revokeToken(jti);
}

async function verifyEmail(id, hash, expires) {
  const user = await User.findById(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 400;
    throw err;
  }

  const expected = crypto.createHash('sha1').update(user.email).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
    const err = new Error('Invalid verification link');
    err.statusCode = 400;
    throw err;
  }

  if (expires && Number(expires) < Math.floor(Date.now() / 1000)) {
    const err = new Error('Verification link expired');
    err.statusCode = 400;
    throw err;
  }

  if (user.email_verified_at) {
    return { alreadyVerified: true };
  }

  user.email_verified_at = new Date();
  await user.save();
  return { alreadyVerified: false };
}

async function resendVerificationEmail(userId, baseUrl) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 400;
    throw err;
  }
  if (user.email_verified_at) {
    return { alreadyVerified: true };
  }
  sendVerificationEmail(user, baseUrl);
  return { alreadyVerified: false };
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
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
