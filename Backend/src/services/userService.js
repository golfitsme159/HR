const User = require('../models/User');
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

module.exports = { createEmployee, listHrStaff };
