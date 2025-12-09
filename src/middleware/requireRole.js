module.exports = function(requiredRole) {
  return function(req, res, next) {
    if (!req.user || !req.user.role) return res.status(401).json({ msg: 'Unauthorized' });
    if (req.user.role !== requiredRole) return res.status(403).json({ msg: 'Forbidden: insufficient role' });
    next();
  };
};
