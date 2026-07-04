const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  authenticateEmployeeByToken,
  verifyHrToken,
} = require('../services/authService');

/** Pulls the token out of an `Authorization: Bearer <token>` header. */
function extractBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(
      401,
      'Missing or malformed Authorization header (expected: Bearer <token>)'
    );
  }
  return token;
}

/**
 * Authenticates an employee via their LINE ID token and attaches the User
 * document to `req.user`.
 */
const protectEmployee = asyncHandler(async (req, res, next) => {
  const idToken = extractBearer(req);
  req.user = await authenticateEmployeeByToken(idToken);
  next();
});

/**
 * Authenticates an HR/Admin via their JWT, verifies the role, and attaches the
 * User document to `req.user`.
 */
const protectHR = asyncHandler(async (req, res, next) => {
  const token = extractBearer(req);
  req.user = await verifyHrToken(token);
  next();
});

module.exports = { protectEmployee, protectHR };
