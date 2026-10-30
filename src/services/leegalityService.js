/**
 * Leegality e-KYC & E-Sign client (Workflow LzfDhWc).
 *
 * The browser never talks to Leegality directly: Leegality's API only accepts
 * server-side calls from whitelisted IPs, and the auth token / private salt must
 * not ship in the frontend bundle. Every call goes through the CRM backend
 * (backend/leegality.py), and every value shown in the CRM comes from Leegality.
 */

import { getPrimarySignatory } from './digitalSignatureService';
import { API_BASE_URL } from './backendConfig';

const STORAGE_KEY = 'astra_leegality_api_config';

// UI-only preferences. Credentials live in backend/.env, never here.
export const DEFAULT_LEEGALITY_CONFIG = {
  status: 'Active', // 'Active' | 'Disabled'
  profileId: 'LzfDhWc',
  templateId: 'hm6uV8X',
  environment: 'Live Production'
};

export const getLeegalityConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Drop credentials cached by older builds of the CRM
      const { legacyAuthToken, privateSalt, creditsLeft, whitelistedIPs, ...rest } = JSON.parse(raw);
      return { ...DEFAULT_LEEGALITY_CONFIG, ...rest, profileId: DEFAULT_LEEGALITY_CONFIG.profileId };
    }
  } catch (err) {
    console.warn('Error reading Leegality config from localStorage:', err);
  }
  return { ...DEFAULT_LEEGALITY_CONFIG };
};

export const saveLeegalityConfig = (newConfig) => {
  try {
    const { legacyAuthToken, privateSalt, ...safe } = { ...getLeegalityConfig(), ...newConfig };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch (err) {
    console.error('Error saving Leegality config:', err);
    return newConfig;
  }
};

/**
 * Compute HMAC-SHA1 (used by Settings to illustrate webhook MAC verification)
 */
export const computeHmacSha1 = async (message, secret) => {
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Mask token for secure UI presentation (e.g. "abc123••••wxyz")
 */
export const maskToken = (token, leadChars = 6, tailChars = 4) => {
  if (!token) return '';
  if (token.length <= leadChars + tailChars) return token;
  return `${token.slice(0, leadChars)}••••••••${token.slice(-tailChars)}`;
};

// ─── Backend transport ──────────────────────────────────────────────────────
const backendFetch = async (path, options = {}) => {
  const token = localStorage.getItem('crm_token');
  if (!token) {
    throw new Error('Not signed in to the CRM backend. Start the backend (port 8000) and sign in again as Super Admin.');
  }
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
  } catch {
    throw new Error(`CRM backend is not reachable at ${API_BASE_URL}. Start it with: python -m uvicorn backend.main:app --port 8000`);
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      detail = (await res.json()).detail || detail;
    } catch { /* non-JSON error body */ }
    if (res.status === 401 || res.status === 403) {
      detail = `${detail} — sign in again as Super Admin while the backend is running.`;
    }
    throw new Error(detail);
  }
  return res;
};

/**
 * Read-only connectivity check: is the token accepted, from which IP, which fields lack IDs.
 */
export const getLeegalityBackendStatus = async () => (await backendFetch('/leegality/status')).json();

/**
 * Create the real Leegality signing request for a sale.
 * Returns Leegality's response as recorded by the backend: documentId, invitees (with signUrl),
 * messages, Date 1, tenure option and signature timestamps.
 */
export const dispatchLeegalitySignRequest = async ({ saleId, clientName, email, phone, serviceTenure }) => {
  if (getLeegalityConfig().status === 'Disabled') {
    throw new Error('Leegality API is currently disabled in Settings. Please enable API to dispatch.');
  }
  const signatory = getPrimarySignatory();
  const res = await backendFetch('/leegality/esign/dispatch', {
    method: 'POST',
    body: JSON.stringify({
      saleId,
      clientName,
      email,
      phone,
      serviceTenure,
      signatureDataUrl: signatory?.signatureDataUrl || null,
      signatoryName: signatory?.signerName || null
    })
  });
  return res.json();
};

/**
 * Live document + invitation status straight from Leegality's Details API.
 */
export const getLeegalityDocumentStatus = async (documentId) =>
  (await backendFetch(`/leegality/esign/${encodeURIComponent(documentId)}`)).json();

/**
 * Download the signed agreement ('signed-pdf') or audit trail ('audit-trail') once COMPLETED.
 */
export const downloadLeegalityFile = async (documentId, kind = 'signed-pdf') => {
  const res = await backendFetch(`/leegality/esign/${encodeURIComponent(documentId)}/${kind}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${documentId}_${kind}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * True when a sale's Leegality document was created through the backend (or confirmed by it).
 * Sales touched by the old simulated flow carry made-up document IDs and return false.
 */
export const isRealLeegalityDispatch = (sale) =>
  !!(sale?.eSignDetails?.dispatchedAt || sale?.eSignDetails?.verifiedByLeegality);

/**
 * Traffic-light state of a sale's e-KYC & E-Sign:
 *   red    - not sent to Leegality yet (or the client declined / the invitation expired, so it can be re-sent)
 *   yellow - sent; waiting for the client to complete e-KYC & E-Sign
 *   green  - Leegality reports the document COMPLETED
 * Old simulated "E-Signed" records were never verified by Leegality, so they stay red.
 */
export const getEKycLight = (sale) => {
  if (sale?.eSignStatus === 'Completed' && sale?.eSignDetails?.verifiedByLeegality) return 'green';
  if (isRealLeegalityDispatch(sale) && !['Rejected by Client', 'Invitation Expired'].includes(sale.eSignStatus)) return 'yellow';
  return 'red';
};

/**
 * eSign credit balance from Leegality: { unused, reserved, consumed, expired, total }.
 */
export const getLeegalityWallet = async () => (await backendFetch('/leegality/wallet')).json();
