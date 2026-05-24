/**
 * auth.js
 * Handles JWT storage, retrieval, and logout.
 * Used by both login.html and profile.html.
 */

const AUTH_KEY = "graphql_jwt";

/**
 * Save a JWT to sessionStorage.
 * @param {string} token
 */
function saveToken(token) {
  sessionStorage.setItem(AUTH_KEY, token);
}

/**
 * Retrieve the stored JWT (or null).
 * @returns {string|null}
 */
function getToken() {
  return sessionStorage.getItem(AUTH_KEY);
}

/**
 * Remove the stored JWT.
 */
function clearToken() {
  sessionStorage.removeItem(AUTH_KEY);
}

/**
 * Decode a JWT payload (no verification – client-side only).
 * @param {string} token
 * @returns {object|null}
 */
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Redirect to login page if no token is present.
 * Call this at the top of profile.html's script.
 */
function requireAuth() {
  if (!getToken()) {
    window.location.href = "index.html";
  }
}

/**
 * Log the user out: clear token, redirect to login.
 */
function logout() {
  clearToken();
  window.location.href = "index.html";
}
