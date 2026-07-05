const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WfhRequest = require('../models/WfhRequest');
const LeaveRequest = require('../models/LeaveRequest');
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

/** Lists all pre-registered employees (role EMPLOYEE), newest first. */
async function listEmployees() {
  return User.find({ role: 'EMPLOYEE' })
    .select('fullName nickname nationalIdLast6 maxWfhPerMonth annualLeaveQuota lineUserId createdAt')
    .sort({ createdAt: -1 });
}

/**
 * Updates an employee's editable fields (name, nickname, national id, quotas).
 * Only EMPLOYEE-role users can be edited via this path; role/username/credentials
 * and lineUserId are never mutable here.
 */
async function updateEmployee(id, { fullName, nickname, nationalIdLast6, maxWfhPerMonth, annualLeaveQuota }) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Employee not found');
  if (user.role !== 'EMPLOYEE') {
    throw new ApiError(403, 'Only employee records can be edited here');
  }

  if (fullName != null) {
    if (!String(fullName).trim()) throw new ApiError(400, 'fullName cannot be empty');
    user.fullName = String(fullName).trim();
  }
  if (nickname != null) {
    user.nickname = String(nickname).trim();
  }
  if (nationalIdLast6 != null) {
    const nid = String(nationalIdLast6).trim();
    if (!/^\d{6}$/.test(nid)) {
      throw new ApiError(400, 'nationalIdLast6 must be exactly 6 digits');
    }
    if (nid !== user.nationalIdLast6) {
      const clash = await User.findOne({ nationalIdLast6: nid, _id: { $ne: user._id } });
      if (clash) throw new ApiError(409, 'An employee with this national ID already exists');
      user.nationalIdLast6 = nid;
    }
  }
  if (maxWfhPerMonth != null && maxWfhPerMonth !== '') {
    const n = Number(maxWfhPerMonth);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, 'maxWfhPerMonth must be a non-negative number');
    user.maxWfhPerMonth = n;
  }
  if (annualLeaveQuota != null && annualLeaveQuota !== '') {
    const n = Number(annualLeaveQuota);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, 'annualLeaveQuota must be a non-negative number');
    user.annualLeaveQuota = n;
  }

  await user.save();
  return user;
}

/**
 * Deletes an employee and, to avoid orphaned records, their WFH and leave
 * requests. Guards against deleting HR/Admin accounts through this path.
 */
async function deleteEmployee(id) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Employee not found');
  if (user.role !== 'EMPLOYEE') {
    throw new ApiError(403, 'Only employee records can be deleted here');
  }

  const [wfh, leave] = await Promise.all([
    WfhRequest.deleteMany({ userId: user._id }),
    LeaveRequest.deleteMany({ userId: user._id }),
  ]);
  await user.deleteOne();

  return {
    id: String(user._id),
    fullName: user.fullName,
    removedWfhRequests: wfh.deletedCount || 0,
    removedLeaveRequests: leave.deletedCount || 0,
  };
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

module.exports = {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  listHrStaff,
  ensureDefaultAdmin,
};
