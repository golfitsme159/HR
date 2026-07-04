const jwt = require('jsonwebtoken');
const env = require('./../config/env');

/** Signs a short-lived HR/Admin session token carrying the user id and role. */
function signHrToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

/** Verifies a JWT and returns its decoded payload. Throws on invalid/expired. */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signHrToken, verifyToken };
