const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { STATUSES } = require('../models/WfhRequest');
const { listRequests, decideRequest } = require('../services/wfhService');
const { listLeaveRequests, decideLeaveRequest } = require('../services/leaveService');
const { createEmployee, listHrStaff } = require('../services/userService');

// ---- WFH ----------------------------------------------------------------

/**
 * GET /api/hr/requests?status=PENDING  (protectHR)
 * Lists all WFH requests, optionally filtered by status.
 */
const getRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const requests = await listRequests({ status });
  res.json({ success: true, count: requests.length, data: requests });
});

/**
 * POST /api/hr/approve  (protectHR)
 * Body: { requestId, status: 'APPROVED'|'REJECTED' }
 * The deciding HR/Admin is taken from req.user.
 */
const decide = asyncHandler(async (req, res) => {
  const { requestId, status } = req.body;
  if (!requestId || !status) {
    throw new ApiError(400, 'requestId and status are required');
  }

  const request = await decideRequest({ requestId, status, hrUser: req.user });
  res.json({ success: true, data: request });
});

// ---- Leave --------------------------------------------------------------

/**
 * GET /api/hr/leaves?status=PENDING  (protectHR)
 * Lists all leave requests, optionally filtered by status.
 */
const getLeaves = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const leaves = await listLeaveRequests({ status });
  res.json({ success: true, count: leaves.length, data: leaves });
});

/**
 * POST /api/hr/leave/approve  (protectHR)
 * Body: { requestId, status: 'APPROVED'|'REJECTED' }
 * On approval of ANNUAL leave, the quota is deducted in the service.
 */
const decideLeave = asyncHandler(async (req, res) => {
  const { requestId, status } = req.body;
  if (!requestId || !status) {
    throw new ApiError(400, 'requestId and status are required');
  }

  const request = await decideLeaveRequest({ requestId, status, hrUser: req.user });
  res.json({ success: true, data: request });
});

// ---- Staff & employee management ---------------------------------------

/**
 * GET /api/hr/staff  (protectHR)
 * Lists HR/Admin users — used to populate the "acting as" dropdown. Note the
 * authoritative decider is always the JWT holder (req.user); this is a UX aid.
 */
const getStaff = asyncHandler(async (req, res) => {
  const data = await listHrStaff();
  res.json({ success: true, data });
});

/**
 * POST /api/hr/employees  (protectHR)
 * Body: { fullName, nickname, nationalIdLast6, maxWfhPerMonth, annualLeaveQuota }
 * Pre-registers a new employee.
 */
const registerEmployee = asyncHandler(async (req, res) => {
  const employee = await createEmployee(req.body);
  res.status(201).json({ success: true, data: employee });
});

module.exports = { getRequests, decide, getLeaves, decideLeave, getStaff, registerEmployee };
