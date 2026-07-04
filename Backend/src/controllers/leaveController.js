const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { createLeaveRequest, listMyLeaveRequests } = require('../services/leaveService');

/**
 * POST /api/leave/request  (protectEmployee)
 * Body: { leaveType, startDate, endDate }
 * The employee is taken from req.user (set by the protectEmployee middleware).
 */
const requestLeave = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate } = req.body;
  if (!leaveType || !startDate || !endDate) {
    throw new ApiError(400, 'leaveType, startDate and endDate are required');
  }

  const request = await createLeaveRequest(req.user, { leaveType, startDate, endDate });
  res.status(201).json({ success: true, data: request });
});

/**
 * GET /api/leave/mine  (protectEmployee)
 * Lists the authenticated employee's own leave requests.
 */
const myLeaves = asyncHandler(async (req, res) => {
  const data = await listMyLeaveRequests(req.user._id);
  res.json({ success: true, count: data.length, data });
});

module.exports = { requestLeave, myLeaves };
