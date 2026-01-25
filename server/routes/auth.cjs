/**
 * Authentication Routes
 * Simple password-based auth for single-user hosted deployment
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db.cjs');
const { validateSession, parseCookies } = require('../middleware/auth.cjs');

const router = express.Router();

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure random session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compare password with constant-time comparison to prevent timing attacks
 */
function checkPassword(input, expected) {
  if (!input || !expected) return false;

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    // Still do a comparison to prevent timing attacks
    crypto.timingSafeEqual(inputBuffer, inputBuffer);
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

/**
 * POST /api/auth/login
 * Authenticate with password, create session
 */
router.post('/login', (req, res) => {
  const { password } = req.body;
  const expectedPassword = process.env.AUTH_PASSWORD;

  // If no password is configured, auth is disabled
  if (!expectedPassword) {
    return res.status(400).json({ error: 'Authentication not configured' });
  }

  if (!checkPassword(password, expectedPassword)) {
    // Add small delay to prevent brute force
    setTimeout(() => {
      res.status(401).json({ error: 'Invalid password' });
    }, 500);
    return;
  }

  // Create session
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  try {
    db.prepare(`
      INSERT INTO auth_sessions (id, created_at, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionId, now.toISOString(), expiresAt.toISOString());

    // Set session cookie
    res.setHeader('Set-Cookie', [
      `sacred_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * POST /api/auth/logout
 * Delete session and clear cookie
 */
router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['sacred_session'];

  if (sessionId) {
    try {
      db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(sessionId);
    } catch (error) {
      console.error('[Auth] Logout error:', error.message);
    }
  }

  // Clear cookie
  res.setHeader('Set-Cookie', [
    'sacred_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  ]);

  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Check if current session is valid
 */
router.get('/me', (req, res) => {
  const expectedPassword = process.env.AUTH_PASSWORD;

  // If no password is configured, auth is disabled - always authenticated
  if (!expectedPassword) {
    return res.json({ authenticated: true, authRequired: false });
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['sacred_session'];

  const session = validateSession(sessionId);

  if (session) {
    res.json({ authenticated: true, authRequired: true });
  } else {
    res.json({ authenticated: false, authRequired: true });
  }
});

module.exports = router;
