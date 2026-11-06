'use strict';

/** Guard for admin-only API routes. Relies on express-session. */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = { requireAdmin };
