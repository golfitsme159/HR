const asyncHandler = require('../utils/asyncHandler');
const {
  listEmployees,
  updateEmployee,
  deleteEmployee,
} = require('../services/userService');

/**
 * GET /api/employees  (protectHR)
 * Lists all pre-registered employees.
 */
const getEmployees = asyncHandler(async (req, res) => {
  const data = await listEmployees();
  res.json({ success: true, count: data.length, data });
});

/**
 * PUT /api/employees/:id  (protectHR)
 * Body: { fullName?, nickname?, nationalIdLast6?, maxWfhPerMonth?, annualLeaveQuota? }
 */
const putEmployee = asyncHandler(async (req, res) => {
  const employee = await updateEmployee(req.params.id, req.body);
  res.json({ success: true, data: employee });
});

/**
 * DELETE /api/employees/:id  (protectHR)
 * Removes the employee and their WFH/leave requests.
 */
const removeEmployee = asyncHandler(async (req, res) => {
  const result = await deleteEmployee(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = { getEmployees, putEmployee, removeEmployee };
