const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

/**
 * POST /api/auth/link-line
 * Body: { idToken, nationalIdLast6 }
 * Links an HR-pre-registered employee to their LINE account.
 */
const linkLine = asyncHandler(async (req, res) => {
  const { idToken, nationalIdLast6 } = req.body;
  const result = await authService.linkLineAccount({ idToken, nationalIdLast6 });
  res.json({ success: true, data: result });
});

/**
 * POST /api/auth/hr-login
 * Body: { username, password }
 * Returns a short-lived JWT for HR/Admin web access.
 */
const hrLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const { token, user } = await authService.hrLogin({ username, password });
  res.json({ success: true, data: { token, user } });
});

/**
 * GET /api/auth/me  (protectEmployee)
 * Returns the authenticated employee. A 401 here means the LINE account is not
 * yet linked — the frontend uses that to show the account-linking screen.
 */
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = { linkLine, hrLogin, getMe };
