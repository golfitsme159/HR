const User = require('../models/User');
const WfhRequest = require('../models/WfhRequest');
const ApiError = require('../utils/ApiError');
const { sendWfhStatusNotification } = require('./lineService');
const {
  startOfDay,
  isBlockedWfhDay,
  isPublicHoliday,
  getHolidayName,
  businessDaysBetween,
  monthRange,
} = require('../utils/dateUtils');

const ACTIVE_STATUSES = ['PENDING', 'APPROVED'];

/**
 * Validates a candidate WFH date against every date/quota business rule and
 * throws an ApiError on the first violation. Shared by create and update so
 * both paths enforce exactly the same rules.
 *
 *   1. Requested date must be in the future.
 *   2. WFH is only allowed on Tue/Wed/Thu (Sat/Sun/Mon/Fri blocked).
 *   3. Not a Thai public holiday.
 *   4. At least 1 business day notice (e.g. Tue must be filed by the prev Fri).
 *   5. No duplicate active request for the same day.
 *   6. Monthly WFH count stays within user.maxWfhPerMonth.
 *
 * @param {object} params
 * @param {import('mongoose').Document} params.user
 * @param {Date} params.requestedDate  already normalized to start-of-day
 * @param {string} [params.excludeRequestId]  ignore this request in dup/quota checks
 */
async function assertWfhDateAllowed({ user, requestedDate, excludeRequestId }) {
  const today = startOfDay(new Date());

  // Rule 1: must be a future date.
  if (requestedDate <= today) {
    throw new ApiError(400, 'requestedDate must be in the future');
  }

  // Rule 2: block Sat/Sun/Mon/Fri.
  if (isBlockedWfhDay(requestedDate)) {
    throw new ApiError(400, 'WFH is only allowed on Tuesday, Wednesday, or Thursday');
  }

  // Rule 3: block Thai public holidays.
  if (isPublicHoliday(requestedDate)) {
    throw new ApiError(
      400,
      `WFH is not allowed on a public holiday (${getHolidayName(requestedDate)})`
    );
  }

  // Rule 4: at least 1 business day of notice.
  if (businessDaysBetween(today, requestedDate) < 1) {
    throw new ApiError(
      400,
      'At least 1 business day notice is required (e.g. a Tuesday must be requested by the previous Friday)'
    );
  }

  // Rule 5: no duplicate active request for the same day.
  const dupQuery = {
    userId: user._id,
    requestedDate,
    status: { $in: ACTIVE_STATUSES },
  };
  if (excludeRequestId) dupQuery._id = { $ne: excludeRequestId };
  const duplicate = await WfhRequest.findOne(dupQuery);
  if (duplicate) {
    throw new ApiError(409, 'A WFH request already exists for this date');
  }

  // Rule 6: monthly quota (count active requests in the same month).
  const { start, end } = monthRange(requestedDate);
  const countQuery = {
    userId: user._id,
    status: { $in: ACTIVE_STATUSES },
    requestedDate: { $gte: start, $lt: end },
  };
  if (excludeRequestId) countQuery._id = { $ne: excludeRequestId };
  const usedThisMonth = await WfhRequest.countDocuments(countQuery);
  if (usedThisMonth >= user.maxWfhPerMonth) {
    throw new ApiError(400, `Monthly WFH limit reached (${user.maxWfhPerMonth} per month)`);
  }
}

/**
 * Creates a WFH request for an employee after enforcing all business rules.
 * @param {string} userId
 * @param {string|Date} rawDate
 * @returns {Promise<WfhRequest>}
 */
async function createWfhRequest(userId, rawDate) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, 'requestedDate is invalid');
  }

  const requestedDate = startOfDay(parsed);
  await assertWfhDateAllowed({ user, requestedDate });

  return WfhRequest.create({ userId, requestedDate, status: 'PENDING' });
}

/**
 * Modifies (reschedules) or cancels an employee's own WFH request.
 *
 * - Cancel: set `cancel: true`. Only PENDING/APPROVED requests can be cancelled,
 *   and only while ≥ 1 business day of notice remains on the ORIGINAL date
 *   (you can't cancel same-day / last-minute).
 * - Modify: pass `requestedDate`. The request must be PENDING/APPROVED and the
 *   NEW date must satisfy every rule in assertWfhDateAllowed (Tue/Wed/Thu, not a
 *   holiday, ≥ 1 business day notice, no duplicate, within the monthly quota).
 *   A previously-approved request drops back to PENDING for re-approval.
 *
 * @param {string} userId  from req.user (never trust the body for identity)
 * @param {string} requestId
 * @param {{ requestedDate?: string|Date, cancel?: boolean, status?: string }} payload
 */
async function updateWfhRequest(userId, requestId, { requestedDate, cancel, status } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const request = await WfhRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'WFH request not found');

  // Ownership: an employee may only touch their own requests.
  if (String(request.userId) !== String(userId)) {
    throw new ApiError(403, 'You can only modify your own requests');
  }
  if (!ACTIVE_STATUSES.includes(request.status)) {
    throw new ApiError(409, `Only pending or approved requests can be changed (this is ${request.status})`);
  }

  const wantsCancel = cancel === true || status === 'CANCELLED';

  // ---- Cancellation ----
  if (wantsCancel) {
    const today = startOfDay(new Date());
    if (businessDaysBetween(today, startOfDay(request.requestedDate)) < 1) {
      throw new ApiError(
        400,
        'Too late to cancel: at least 1 business day notice is required before the WFH date'
      );
    }
    request.status = 'CANCELLED';
    request.decidedAt = new Date();
    await request.save();
    return request.populate([{ path: 'approvedBy', select: 'fullName role' }]);
  }

  // ---- Modification (reschedule) ----
  if (!requestedDate) {
    throw new ApiError(400, 'Provide a new requestedDate to modify, or cancel:true to cancel');
  }
  const parsed = new Date(requestedDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, 'requestedDate is invalid');
  }
  const nextDate = startOfDay(parsed);

  // Enforce all the same rules on the new date, ignoring THIS request so it
  // doesn't clash with itself in the duplicate / monthly-quota checks.
  await assertWfhDateAllowed({ user, requestedDate: nextDate, excludeRequestId: request._id });

  request.requestedDate = nextDate;
  // Rescheduling invalidates any prior decision — back to PENDING for re-review.
  request.status = 'PENDING';
  request.approvedBy = null;
  request.decidedAt = null;
  await request.save();

  return request.populate([{ path: 'approvedBy', select: 'fullName role' }]);
}

/**
 * Lists WFH requests, optionally filtered by status, newest requested date first.
 * @param {{ status?: string }} filter
 */
async function listRequests({ status } = {}) {
  const query = {};
  if (status) query.status = status;

  return WfhRequest.find(query)
    .populate('userId', 'fullName nickname nationalIdLast6 role')
    .populate('approvedBy', 'fullName role')
    .sort({ requestedDate: -1, createdAt: -1 });
}

/**
 * Approves or rejects a pending WFH request. On decision, best-effort pushes a
 * LINE notification to the employee (never blocks the decision if it fails).
 * @param {{ requestId: string, status: 'APPROVED'|'REJECTED', hrUser: object }} params
 *   hrUser is the already-authenticated HR/Admin from the protectHR middleware.
 */
async function decideRequest({ requestId, status, hrUser }) {
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, "status must be either 'APPROVED' or 'REJECTED'");
  }
  if (!hrUser || !['HR', 'ADMIN'].includes(hrUser.role)) {
    throw new ApiError(403, 'Only HR or ADMIN users can decide requests');
  }

  const request = await WfhRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'WFH request not found');
  if (request.status !== 'PENDING') {
    throw new ApiError(409, `Request is already ${request.status}`);
  }

  request.status = status;
  request.approvedBy = hrUser._id;
  request.decidedAt = new Date();
  await request.save();

  // Notify the employee over LINE (best-effort; never throws).
  await notifyEmployee(request, status, hrUser);

  return request.populate([
    { path: 'userId', select: 'fullName nickname role' },
    { path: 'approvedBy', select: 'fullName role' },
  ]);
}

/** Best-effort LINE push to the employee who owns the request. */
async function notifyEmployee(request, status, hrUser) {
  try {
    const employee = await User.findById(request.userId).select('lineUserId');
    if (employee?.lineUserId) {
      const hrNickname = hrUser.nickname || hrUser.fullName || 'HR';
      await sendWfhStatusNotification(employee.lineUserId, status, request.requestedDate, hrNickname);
    }
  } catch (err) {
    console.error('[wfhService] notifyEmployee failed:', err.message);
  }
}

/** Lists a single employee's own WFH requests, newest first. */
async function listMyRequests(userId) {
  return WfhRequest.find({ userId })
    .populate('approvedBy', 'fullName role')
    .sort({ requestedDate: -1, createdAt: -1 });
}

module.exports = {
  createWfhRequest,
  updateWfhRequest,
  listRequests,
  decideRequest,
  listMyRequests,
};
