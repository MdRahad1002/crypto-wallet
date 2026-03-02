const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { validate, schemas } = require('../utils/validation');
const logger = require('../core/logger');
const adminAuth = require('../middleware/adminAuth');
const { toPublicUser } = require('../dto/userDto');
const rateLimit = require('express-rate-limit');
const { revokeAccessToken, revokeRefreshToken, trackSession, revokeAllUserTokens } = require('../security/tokenRevocation');
const metricsService = require('../services/metricsService');
const { setRefreshTokenCookie, clearAuthCookies } = require('../services/cookieManager');
const auth = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.'
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10);

// Issue CSRF token — call this after login so the refreshToken cookie is present,
// allowing getSessionIdentifier to bind the CSRF token to the current session.
// This is a GET so it is safe and excluded from CSRF validation.
router.get('/csrf-token', (req, res) => {
  const csrfToken = req.app.locals.generateCsrfToken(req, res);
  res.json({ csrfToken });
});
router.post('/register', adminAuth, validate(schemas.register), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT secret missing during registration');
      return res.status(500).json({ message: 'Authentication is not configured.' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      email,
      password,
      name
    });

    await user.save();

    // Create JWT token — 2h lifetime balances security and UX (silent refresh handles rotation)
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '2h' });

    res.status(201).json({
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    logger.error('Registration error', { message: error.message });
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', loginLimiter, validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT secret missing during login');
      return res.status(500).json({ message: 'Authentication is not configured.' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.info('login_attempt', {
        type: 'auth_event',
        event: 'login',
        success: false,
        email: email,
        reason: 'invalid_password'
      });
      metricsService.recordAuthEvent('login', false);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT access token — 2h lifetime balances security and UX (silent refresh handles rotation)
    const accessToken = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '2h' });

    // Create refresh token (rotating)
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ tokenHash, createdAt: new Date(), expiresAt });
    await user.save();

    // Track session in Redis (enables revocation)
    await trackSession(user._id.toString(), accessToken, tokenHash);

    // Set secure cookies — CSRF token will be issued by doubleCsrfProtection
    // middleware on the first authenticated API request, after the refreshToken
    // cookie is available for the session identifier.
    await setRefreshTokenCookie(res, refreshToken, REFRESH_TOKEN_EXPIRES_DAYS);

    logger.info('login_success', {
      type: 'auth_event',
      event: 'login',
      success: true,
      userId: user._id.toString(),
      email: email
    });
    metricsService.recordAuthEvent('login', true);

    res.json({
      token: accessToken,
      user: toPublicUser(user)
    });
  } catch (error) {
    logger.error('login_error', {
      type: 'auth_event',
      message: error.message,
      errorType: 'login_error',
      email: req.body?.email
    });
    metricsService.recordAuthEvent('login', false);
    metricsService.recordError('login_error');
    // Surface configuration errors clearly so they appear in Vercel logs
    if (error.message && error.message.includes('Supabase not configured')) {
      return res.status(503).json({ message: 'Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.' });
    }
    res.status(500).json({ message: 'Server error during login', detail: error.message });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ message: 'Authentication is not configured.' });

    const rawToken = req.cookies?.refreshToken ||
      (req.headers.cookie && req.headers.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('refreshToken='))
        ?.split('=')[1]);
    if (!rawToken) return res.status(401).json({ message: 'Refresh token missing' });

    const tokenHash = hashToken(rawToken);

    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    // find token entry
    const tokenEntry = user.refreshTokens.find(t => t.tokenHash === tokenHash);
    if (!tokenEntry) return res.status(401).json({ message: 'Refresh token entry not found' });
    if (new Date() > new Date(tokenEntry.expiresAt)) {
      // remove expired token
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== tokenHash);
      await user.save();
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // revoke old refresh token
    await revokeRefreshToken(tokenHash, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);

    // rotate tokens
    user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== tokenHash);
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ tokenHash: newTokenHash, createdAt: new Date(), expiresAt });
    await user.save();

    // issue new access token — 2h lifetime balances security and UX
    const newAccessToken = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '2h' });

    // track new session
    await trackSession(user._id.toString(), newAccessToken, newTokenHash);

    await setRefreshTokenCookie(res, newRefreshToken, REFRESH_TOKEN_EXPIRES_DAYS);

    logger.info('token_refreshed', {
      type: 'auth_event',
      event: 'refresh',
      userId: user._id.toString()
    });
    metricsService.recordAuthEvent('refresh');

    res.json({ token: newAccessToken });
  } catch (error) {
    logger.error('token_refresh_error', {
      message: error.message,
      errorType: 'refresh_error'
    });
    metricsService.recordError('refresh_error');
    res.status(500).json({ message: 'Unable to refresh token' });
  }
});

// Change password (logged-in user, requires current password)
router.post('/change-password', auth, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from your current password' });
    }

    user.password = newPassword; // pre-save hook will hash it
    // Invalidate all existing refresh tokens on password change
    user.refreshTokens = [];
    await user.save();

    logger.info('password_changed', { type: 'auth_event', event: 'change_password', userId: user._id.toString() });

    // Force new login by clearing cookies
    await clearAuthCookies(res);
    res.json({ message: 'Password changed successfully. Please sign in again.' });
  } catch (error) {
    logger.error('change_password_error', { message: error.message });
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Logout (revokes current and optionally all tokens)
router.post('/logout', async (req, res) => {
  try {
    const { revokeAll } = req.body || {};
    
    // Get user from token if available
    const token = req.header('Authorization')?.replace('Bearer ', '');
    let userId = null;
    
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret);
        userId = decoded.userId;
        
        // Revoke current access token
        await revokeAccessToken(token, 900);
      } catch (e) {
        // Token invalid, continue with refresh token only
      }
    }
    
    const rawToken = req.cookies?.refreshToken || (req.headers.cookie && req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('refreshToken='))?.split('=')[1]);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      
      // Find user if we don't have it yet
      if (!userId) {
        const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
        if (user) userId = user._id.toString();
      }
      
      // Revoke refresh token
      await revokeRefreshToken(tokenHash, REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60);
      
      // Remove from DB
      await User.updateMany({}, { $pull: { refreshTokens: { tokenHash } } });
    }
    
    // Optionally revoke all user sessions (logout everywhere)
    if (revokeAll && userId) {
      await revokeAllUserTokens(userId);
      logger.info('logout_all_tokens', {
        type: 'auth_event',
        event: 'logout',
        userId: userId,
        allTokensRevoked: true
      });
      metricsService.recordAuthEvent('logout');
    } else if (userId) {
      logger.info('logout_current_token', {
        type: 'auth_event',
        event: 'logout',
        userId: userId,
        allTokensRevoked: false
      });
      metricsService.recordAuthEvent('logout');
    } else {
      logger.info('logout_no_user', {
        type: 'auth_event',
        event: 'logout',
        warning: 'no_user_id_found'
      });
    }

    // Clear all auth cookies securely
    await clearAuthCookies(res);
    res.json({ message: 'Logged out', revokedAll: revokeAll || false });
  } catch (error) {
    logger.error('logout_error', {
      message: error.message,
      errorType: 'logout_error'
    });
    metricsService.recordError('logout_error');
    res.status(500).json({ message: 'Logout failed' });
  }
});

module.exports = router;
