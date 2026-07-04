const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  createWfhRequest,
  updateWfhRequest,
  listMyRequests,
} = require('../services/wfhService');

/**
 * POST /api/wfh/request  (protectEmployee)
 * Body: { requestedDate }
 * The employee is taken from req.user (set by the protectEmployee middleware).
 */
const requestWfh = asyncHandler(async (req, res) => {
  const { requestedDate } = req.body;
  if (!requestedDate) {
    throw new ApiError(400, 'requestedDate is required');
  }

  const request = await createWfhRequest(req.user._id, requestedDate);
  res.status(201).json({ success: true, data: request });
});

/**
 * PUT /api/wfh/:id  (protectEmployee)
 * Body: { requestedDate }  -> reschedule to a new date (re-validated, back to PENDING)
 *       { cancel: true }   -> cancel the request
 * The employee is taken from req.user; ownership is enforced in the service.
 */
const updateWfh = asyncHandler(async (req, res) => {
  const { requestedDate, cancel, status } = req.body;
  if (!requestedDate && cancel !== true && status !== 'CANCELLED') {
    throw new ApiError(400, 'Provide a new requestedDate to modify, or cancel:true to cancel');
  }

  const request = await updateWfhRequest(req.user._id, req.params.id, {
    requestedDate,
    cancel,
    status,
  });
  res.json({ success: true, data: request });
});

/**
 * GET /api/wfh/mine  (protectEmployee)
 * Lists the authenticated employee's own WFH requests.
 */
const myRequests = asyncHandler(async (req, res) => {
  const data = await listMyRequests(req.user._id);
  res.json({ success: true, count: data.length, data });
});

module.exports = { requestWfh, updateWfh, myRequests };
