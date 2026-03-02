/**
 * Middleware to restrict access to localhost only
 * Prevents admin routes from being accessed over the network
 */

const localOnlyAccess = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Normalize IPv6 localhost addresses
  const normalizedIp = clientIp.replace(/^::ffff:/, '');
  
  // Allow localhost in various forms
  const allowedIps = [
    '127.0.0.1',      // IPv4 localhost
    '::1',            // IPv6 localhost
    'localhost'       // hostname
  ];
  
  const isLocalhost = allowedIps.some(ip => normalizedIp.includes(ip));
  
  if (!isLocalhost) {
    console.log(`❌ Blocked admin access attempt from: ${clientIp}`);
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Admin panel is only accessible from localhost for security reasons'
    });
  }
  
  next();
};

module.exports = localOnlyAccess;
