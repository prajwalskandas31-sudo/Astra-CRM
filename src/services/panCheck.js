/**
 * PAN duplicate check for the Client Information form.
 *
 * With the backend on, the server searches every lead, sale, e-sign record and paid client
 * (not just the ones this user's team can see) and answers only whether the PAN is on file.
 * Offline/demo builds fall back to the records already loaded in the browser.
 */
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from './backendConfig';

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const normalizePan = (pan) => String(pan || '').replace(/\s+/g, '').toUpperCase();

const pansOf = (doc) => [doc?.panNumber, doc?.clientInfo?.panNumber, doc?.fullClientInfo?.panNumber]
  .filter(Boolean)
  .map(normalizePan);

const isTurnedDown = (sale) => /reject|declin/i.test(`${sale?.status || ''} ${sale?.stage || ''}`);

const checkLocally = (pan, leadId, { leads = [], sales = [], eSignRecords = [], paidClients = [] }) => {
  const sources = [
    [paidClients, 'an existing paid client', d => d.leadId],
    [eSignRecords, 'an e-signed client', d => d.leadId],
    [sales.filter(s => !isTurnedDown(s)), 'a submitted sale', d => d.leadId],
    [leads, "another lead's client information", d => d.id]
  ];
  for (const [records, source, leadOf] of sources) {
    const hit = (records || []).some(d => !(leadId && leadOf(d) === leadId) && pansOf(d).includes(pan));
    if (hit) return { exists: true, source };
  }
  return { exists: false };
};

/** Resolves to { exists, source? }. Throws only when the server could not be asked. */
export const checkPanExists = async (rawPan, leadId, localData) => {
  const pan = normalizePan(rawPan);
  if (!PAN_PATTERN.test(pan)) return { exists: false };
  if (!isBackendEnabled()) return checkLocally(pan, leadId, localData || {});

  const token = localStorage.getItem('crm_token') || '';
  const params = new URLSearchParams({ pan, leadId: leadId || '' });
  const res = await fetch(`${API_BASE_URL}/sync/pan-check?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(await readErrorDetail(res, `PAN check failed (${res.status})`));
  return res.json();
};

export const panDuplicateMessage = (source) =>
  `PAN number already exists in the system (${source || 'existing record'}).`;
