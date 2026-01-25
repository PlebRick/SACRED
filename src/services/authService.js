/**
 * Auth Service
 * API calls for authentication
 */

const API_BASE = '/api/auth';

/**
 * Check if user is authenticated
 * @returns {Promise<{authenticated: boolean, authRequired: boolean}>}
 */
export async function checkAuth() {
  const response = await fetch(`${API_BASE}/me`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to check auth status');
  }

  return response.json();
}

/**
 * Login with password
 * @param {string} password
 * @returns {Promise<{success: boolean}>}
 */
export async function login(password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Login failed');
  }

  return response.json();
}

/**
 * Logout and clear session
 * @returns {Promise<{success: boolean}>}
 */
export async function logout() {
  const response = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }

  return response.json();
}
