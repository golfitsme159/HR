/**
 * Wraps an async Express handler so that any rejected promise is forwarded
 * to the centralized error middleware instead of crashing the process.
 */
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
