'use strict';

function adminAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.admin_session === 'authenticated') {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = adminAuth;
