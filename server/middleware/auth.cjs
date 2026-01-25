/**
 * Authentication Middleware
 * Simple session-based auth for single-user hosted deployment
 */

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
 * Auth middleware - checks for valid session
 * Skips auth for /api/auth/* routes and /api/bible/status
 */
function authMiddleware(req, res, next) {
  // Skip auth if AUTH_PASSWORD is not set (local dev or optional auth)
  if (!process.env.AUTH_PASSWORD) {
    return next();
  }

  // Skip auth for auth routes (login/logout/me)
  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  // Skip auth for bible status (used to check server health)
  if (req.path === '/api/bible/status') {
    return next();
  }

  // Get session from cookie
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['sacred_session'];

  const session = validateSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Attach session to request for use in routes
  req.session = session;
  next();
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
