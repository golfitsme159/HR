const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const { LEAVE_TYPES } = require('../models/LeaveRequest');
const ApiError = require('../utils/ApiError');
const { sendLeaveStatusNotification } = require('./lineService');
const { startOfDay, countBusinessDaysInclusive } = require('../utils/dateUtils');

/**
 * Creates a leave request for an employee.
 *
 * Rules:
 *   - leaveType must be ANNUAL / PERSONAL / SICK.
 *   - endDate >= startDate, startDate not in the past.
 *   - The range must contain >= 1 business day (weekends don't count).
 *   - ANNUAL only: requested days + already-pending annual days must not
 *     exceed the employee's remaining annualLeaveQuota.
 *
 * @param {import('mongoose').Document} user  authenticated employee (req.user)
 * @param {{ leaveType: string, startDate: string|Date, endDate: string|Date }} payload
 */
async function createLeaveRequest(user, { leaveType, startDate, endDate }) {
  if (!LEAVE_TYPES.includes(leaveType)) {
    throw new ApiError(400, `leaveType must be one of: ${LEAVE_TYPES.join(', ')}`);
  }

  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'startDate and endDate must be valid dates');
  }
  if (end < start) {
    throw new ApiError(400, 'endDate cannot be before startDate');
  }
  if (start < startOfDay(new Date())) {
    throw new ApiError(400, 'startDate cannot be in the past');
  }

  const numberOfDays = countBusinessDaysInclusive(start, end);
  if (numberOfDays < 1) {
    throw new ApiError(400, 'The selected range contains no business days');
  }

  // Quota check applies to ANNUAL leave only.
  if (leaveType === 'ANNUAL') {
    const pendingDays = await sumPendingAnnualDays(user._id);
    if (numberOfDays + pendingDays > user.annualLeaveQuota) {
      throw new ApiError(
        400,
        `Insufficient annual leave. Remaining: ${user.annualLeaveQuota}, ` +
          `already pending: ${pendingDays}, requested: ${numberOfDays}`
      );
    }
  }

  return LeaveRequest.create({
    userId: user._id,
    leaveType,
    startDate: start,
    endDate: end,
    numberOfDays,
    status: 'PENDING',
  });
}

/** Sums numberOfDays across a user's currently-pending ANNUAL requests. */
async function sumPendingAnnualDays(userId) {
  const [row] = await LeaveRequest.aggregate([
    { $match: { userId, leaveType: 'ANNUAL', status: 'PENDING' } },
    { $group: { _id: null, days: { $sum: '$numberOfDays' } } },
  ]);
  return row ? row.days : 0;
}

/** Lists leave requests, optionally filtered by status, newest first. */
async function listLeaveRequests({ status } = {}) {
  const query = {};
  if (status) query.status = status;

  return LeaveRequest.find(query)
    .populate('userId', 'fullName nickname role annualLeaveQuota')
    .populate('approvedBy', 'fullName role')
    .sort({ startDate: -1, createdAt: -1 });
}

/**
 * Approves or rejects a pending leave request. On approval of ANNUAL leave,
 * atomically deducts numberOfDays from the employee's annualLeaveQuota, guarding
 * against a negative balance (race-safe via a conditional update).
 *
 * @param {{ requestId: string, status: 'APPROVED'|'REJECTED', hrUser: object }} params
 */
async function decideLeaveRequest({ requestId, status, hrUser }) {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, "status must be either 'APPROVED' or 'REJECTED'");
  }
  if (!hrUser || !['HR', 'ADMIN'].includes(hrUser.role)) {
    throw new ApiError(403, 'Only HR or ADMIN users can decide requests');
  }

  const request = await LeaveRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'Leave request not found');
  if (request.status !== 'PENDING') {
    throw new ApiError(409, `Request is already ${request.status}`);
  }

  if (status === 'APPROVED' && request.leaveType === 'ANNUAL') {
    // Conditional decrement: only succeeds if the balance is still sufficient.
    const updated = await User.findOneAndUpdate(
      { _id: request.userId, annualLeaveQuota: { $gte: request.numberOfDays } },
      { $inc: { annualLeaveQuota: -request.numberOfDays } },
      { new: true }
    );
    if (!updated) {
      throw new ApiError(
        409,
        'Cannot approve: employee has insufficient remaining annual leave'
      );
    }
  }

  request.status = status;
  request.approvedBy = hrUser._id;
  request.decidedAt = new Date();
  await request.save();

  // Notify the employee over LINE (best-effort; never throws).
  try {
    const employee = await User.findById(request.userId).select('lineUserId');
    if (employee?.lineUserId) {
      const hrNickname = hrUser.nickname || hrUser.fullName || 'HR';
      await sendLeaveStatusNotification(
        employee.lineUserId,
        status,
        request.startDate,
        request.endDate,
        hrNickname
      );
    }
  } catch (err) {
    console.error('[leaveService] LINE notification failed:', err.message);
  }

  return request.populate([
    { path: 'userId', select: 'fullName role annualLeaveQuota' },
    { path: 'approvedBy', select: 'fullName role' },
  ]);
}

/** Lists a single employee's own leave requests, newest first. */
async function listMyLeaveRequests(userId) {
  return LeaveRequest.find({ userId })
    .populate('approvedBy', 'fullName role')
    .sort({ startDate: -1, createdAt: -1 });
}

module.exports = {
  createLeaveRequest,
  listLeaveRequests,
  decideLeaveRequest,
  listMyLeaveRequests,
};
