/**
 * Authentication Middleware
 * Simple session-based auth for single-user hosted deployment
 * Supports session cookies (frontend) and X-API-Key header (external API)
 */

const crypto = require('crypto');
const db = require('../db.cjs');

/**
 * Validate session from cookie
 * Returns session data if valid, null otherwise
 */
function validateSession(sessionId) {
  if (!sessionId) return null;

  try {
    const session = db.prepare(`
      SELECT id, created_at, expires_at
      FROM auth_sessions
      WHERE id = ? AND expires_at > datetime('now')
    `).get(sessionId);

    return session || null;
  } catch (error) {
    console.error('[Auth] Session validation error:', error.message);
    return null;
  }
}

/**
 * Parse cookies from request header
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Validate API key from X-API-Key header using constant-time comparison
 */
function checkApiKey(req) {
  const expected = process.env.SACRED_API_KEY;
  if (!expected) return false;

  const provided = req.headers['x-api-key'];
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length) {
    // Still do a comparison to prevent timing attacks on length
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Auth middleware - checks for valid session or API key
 * Skips auth for /api/auth/* routes and /api/bible/status
 */
function authMiddleware(req, res, next) {
  // Skip auth if neither AUTH_PASSWORD nor SACRED_API_KEY is set (local dev)
  if (!process.env.AUTH_PASSWORD && !process.env.SACRED_API_KEY) {
    return next();
  }

  // Skip auth for auth routes (login/logout/me)
  // Note: req.path is relative to mount point (/api), so /api/auth/* becomes /auth/*
  if (req.path.startsWith('/auth')) {
    return next();
  }

  // Skip auth for bible status (used to check server health)
  if (req.path === '/bible/status') {
    return next();
  }

  // Allow if valid session cookie (frontend auth)
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['sacred_session'];
  const session = validateSession(sessionId);

  if (session) {
    req.session = session;
    return next();
  }

  // Allow if valid API key (external API auth)
  if (checkApiKey(req)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Clean up expired sessions (called periodically)
 */
function cleanupExpiredSessions() {
  try {
    const result = db.prepare(`
      DELETE FROM auth_sessions
      WHERE expires_at < datetime('now')
    `).run();

    if (result.changes > 0) {
      console.log(`[Auth] Cleaned up ${result.changes} expired sessions`);
    }
  } catch (error) {
    console.error('[Auth] Session cleanup error:', error.message);
  }
}

module.exports = {
  authMiddleware,
  validateSession,
  parseCookies,
  cleanupExpiredSessions
};
