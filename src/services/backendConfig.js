/**
 * Backend connection settings shared by the CRM context and services.
 *
 * Local development talks to the FastAPI backend on localhost and keeps the offline demo fallbacks.
 * Hosted builds set VITE_BACKEND_ENABLED=true, which makes the backend the sole authority for
 * authentication and roles: no demo logins, no built-in passwords, no client-side role switching.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const isBackendAuthoritative = () => import.meta.env.VITE_BACKEND_ENABLED === 'true';

export const isBackendEnabled = () =>
  isBackendAuthoritative() ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

export const readErrorDetail = async (res, fallback) => {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch {}
  return fallback;
};

/**
 * Re-authenticate against the backend for sensitive in-app actions.
 * scope 'self' checks the signed-in user's password; 'admin' accepts any active Admin/Super Admin password.
 */
export const verifyPasswordWithServer = async (password, scope = 'self') => {
  const token = localStorage.getItem('crm_token') || '';
  try {
    const res = await fetch(`${API_BASE_URL}/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ password, scope })
    });
    return res.ok;
  } catch {
    return false;
  }
};
