function adminGuard() {
  return (req, res, next) => {
    if (process.env.ADMIN_REQUIRE_2FA === 'true' && !req.user?.twoFactorEnabled) {
      return res.status(403).json({ message: 'Admin 2FA is required' });
    }

    if (process.env.ADMIN_REAUTH_REQUIRED === 'true') {
      const reauthToken = req.header('X-Admin-Reauth');
      if (!reauthToken) {
        return res.status(401).json({ message: 'Admin re-authentication required' });
      }
    }

    next();
  };
}

module.exports = adminGuard;
