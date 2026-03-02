const jwt = require('jsonwebtoken');
const { isAccessTokenRevoked } = require('../security/tokenRevocation');

module.exports = async function(req, res, next) {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: 'Authentication is not configured.' });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Check if token is revoked
    const isRevoked = await isAccessTokenRevoked(token);
    if (isRevoked) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }
    
    req.userId = decoded.userId;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
