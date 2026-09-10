const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const { issueToken, revokeToken } = require('../utils/token');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function login(email, password) {
  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin) throw fail('Invalid password.1');

  if (!admin.is_active) throw fail('Your account has been deactivated. Please contact support.', 403);
  if (!(await bcrypt.compare(password, admin.password))) throw fail('Invalid password.2');

  const accessToken = await issueToken(admin._id, 'admin');
  return { admin, accessToken };
}

async function logout(jti) {
  await revokeToken(jti);
}

module.exports = { login, logout };
