const bcrypt = require('bcryptjs');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * HR pre-registers a new employee. The employee links their LINE account later
 * via POST /api/auth/link-line using nationalIdLast6.
 */
async function createEmployee({ fullName, nickname, nationalIdLast6, maxWfhPerMonth, annualLeaveQuota }) {
  if (!fullName || !nationalIdLast6) {
    throw new ApiError(400, 'fullName and nationalIdLast6 are required');
  }
  const nid = String(nationalIdLast6).trim();
  if (!/^\d{6}$/.test(nid)) {
    throw new ApiError(400, 'nationalIdLast6 must be exactly 6 digits');
  }

  const exists = await User.findOne({ nationalIdLast6: nid });
  if (exists) {
    throw new ApiError(409, 'An employee with this national ID is already registered');
  }

  return User.create({
    fullName: fullName.trim(),
    nickname: (nickname || '').trim(),
    nationalIdLast6: nid,
    role: 'EMPLOYEE',
    ...(maxWfhPerMonth != null && maxWfhPerMonth !== '' ? { maxWfhPerMonth: Number(maxWfhPerMonth) } : {}),
    ...(annualLeaveQuota != null && annualLeaveQuota !== '' ? { annualLeaveQuota: Number(annualLeaveQuota) } : {}),
  });
}

/** Lists HR/Admin staff (for the approval "acting as" dropdown). */
async function listHrStaff() {
  return User.find({ role: { $in: ['HR', 'ADMIN'] } })
    .select('fullName nickname role')
    .sort({ fullName: 1 });
}

/**
 * Idempotently ensures the default admin login exists. Safe to call on every
 * boot: if a user with the default username is already present it does nothing
 * (never resets an existing password). Otherwise it creates the ADMIN account
 * with a bcrypt-hashed password — the same hashing used by `npm run seed` and
 * the normal login flow.
 *
 * @returns {Promise<{ created: boolean, username: string, usedFallbackPassword: boolean }>}
 */
async function ensureDefaultAdmin() {
  const username = env.hrDefaultUsername;

  const existing = await User.findOne({ username });
  if (existing) {
    return { created: false, username, usedFallbackPassword: false };
  }

  const passwordHash = await bcrypt.hash(env.hrDefaultPassword, env.bcryptSaltRounds);

  try {
    const admin = await User.create({
      fullName: 'System Administrator',
      nickname: 'Admin',
      nationalIdLast6: env.hrDefaultNationalId,
      role: 'ADMIN',
      username,
      passwordHash,
    });
    return {
      created: true,
      username: admin.username,
      usedFallbackPassword: env.hrDefaultPasswordIsFallback,
    };
  } catch (err) {
    // A concurrent worker may have created it first (unique index race) — that's
    // fine, the account exists either way.
    if (err.code === 11000) {
      return { created: false, username, usedFallbackPassword: false };
    }
    throw err;
  }
}

module.exports = { createEmployee, listHrStaff, ensureDefaultAdmin };
