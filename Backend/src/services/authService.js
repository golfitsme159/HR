const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyLineIdToken } = require('./lineService');
const { signHrToken, verifyToken } = require('../utils/token');

const HR_ROLES = ['HR', 'ADMIN'];

/**
 * Links a pre-registered employee (found by nationalIdLast6) to their LINE
 * account. Called during first-time onboarding from the LIFF app.
 */
async function linkLineAccount({ idToken, nationalIdLast6 }) {
  if (!idToken || !nationalIdLast6) {
    throw new ApiError(400, 'idToken and nationalIdLast6 are required');
  }

  const profile = await verifyLineIdToken(idToken);
  const lineUserId = profile.sub;

  const user = await User.findOne({ nationalIdLast6: String(nationalIdLast6).trim() });
  if (!user) {
    throw new ApiError(404, 'No pre-registered employee found for this national ID');
  }

  const takenBy = await User.findOne({ lineUserId, _id: { $ne: user._id } });
  if (takenBy) {
    throw new ApiError(409, 'This LINE account is already linked to another employee');
  }

  user.lineUserId = lineUserId;
  await user.save();

  return { user, line: { userId: lineUserId, displayName: profile.name || null } };
}

/**
 * Resolves an employee from a LINE ID token (used by the protectEmployee
 * middleware). The account must have been linked first.
 */
async function authenticateEmployeeByToken(idToken) {
  const profile = await verifyLineIdToken(idToken);
  const user = await User.findOne({ lineUserId: profile.sub });
  if (!user) {
    throw new ApiError(401, 'LINE account is not linked. Please link your account first.');
  }
  return user;
}

/**
 * Validates HR/Admin username + password and returns a signed JWT plus the
 * (sanitized) user document.
 */
async function hrLogin({ username, password }) {
  if (!username || !password) {
    throw new ApiError(400, 'username and password are required');
  }

  // passwordHash is select:false, so request it explicitly.
  const user = await User.findOne({
    username: String(username).trim().toLowerCase(),
  }).select('+passwordHash');

  // Generic message avoids leaking which part was wrong.
  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'Invalid username or password');
  }
  if (!HR_ROLES.includes(user.role)) {
    throw new ApiError(403, 'This account is not authorized for HR access');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const token = signHrToken(user);
  user.passwordHash = undefined; // never return the hash
  return { token, user };
}

/**
 * Verifies an HR JWT (used by the protectHR middleware), loads the current
 * user, and confirms they still hold an HR/Admin role.
 */
async function verifyHrToken(token) {
  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'Token subject no longer exists');
  }
  if (!HR_ROLES.includes(user.role)) {
    throw new ApiError(403, 'HR or Admin access required');
  }
  return user;
}

module.exports = {
  linkLineAccount,
  authenticateEmployeeByToken,
  hrLogin,
  verifyHrToken,
};
