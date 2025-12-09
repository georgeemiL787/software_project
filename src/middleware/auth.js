const jwt = require('jsonwebtoken');
const pool = require('../db');

// auth middleware: verifies Bearer token and attaches decoded.user to req.user
async function auth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ msg: 'No token, authorization denied' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ msg: 'Malformed token' });

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'no_jwt_secret_set');
    req.user = decoded.user;

    // Check revocation table (if available)
    try {
      const [rows] = await pool.query('SELECT id FROM revoked_tokens WHERE token = ? LIMIT 1', [token]);
      if (rows && rows.length) return res.status(401).json({ msg: 'Token has been revoked' });
    } catch (e) {
      // ignore DB errors and proceed
    }

    return next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token is not valid' });
  }
}

// authorize middleware generator: authorize(...allowedRoles)
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) return res.status(401).json({ msg: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ msg: `Forbidden: role '${req.user.role}'` });
    next();
  };
}

// Export compatibility: default export is the auth function, but also expose named helpers
module.exports = auth;
module.exports.auth = auth;
module.exports.authorize = authorize;
