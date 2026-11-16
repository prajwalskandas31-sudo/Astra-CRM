/**
 * Client Information Page -> Telegram group (backend/client_info_telegram.py).
 *
 * "Send to Review" posts every detail on the page to the Client_information_page_updates group. The
 * bot token stays on the server; the message ends with a CRM link (?ekyc=<saleId>) that starts the
 * e-KYC & E-Sign request, handled by useEKycDeepLink below.
 */
import { useEffect, useRef } from 'react';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from './backendConfig';

const FIELDS = ['panNumber', 'clientCategory', 'clientPrefix', 'clientName', 'firmName', 'gstin', 'email', 'phone1', 'phone2',
  'clientState', 'paymentDate', 'serviceName', 'serviceTenure', 'transactionNumbers', 'grossSales', 'netSales', 'gst'];

export const postClientInfoToTelegram = async ({ saleId, leadId, clientInfo, attachments = [] }) => {
  if (!isBackendEnabled()) return { skipped: true };
  const details = Object.fromEntries(FIELDS.map(f => [f, clientInfo?.[f] ?? '']));
  // File names only: the uploads themselves stay in the CRM
  details.gstCertificateFile = clientInfo?.gstCertificateFile?.name || '';
  const res = await fetch(`${API_BASE_URL}/client-info/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` },
    body: JSON.stringify({
      saleId,
      leadId: leadId || '',
      details,
      attachmentNames: attachments.map(a => a?.name).filter(Boolean)
    })
  });
  if (!res.ok) throw new Error(await readErrorDetail(res, `HTTP ${res.status}`));
  return res.json();
};

// ─── The e-KYC link from Telegram ────────────────────────────────────────────
const PENDING_KEY = 'crm_pending_ekyc_sale';
const WAIT_FOR_SALE_MS = 45000;

// Read ?ekyc= once at page load and drop it from the address bar, so a refresh never re-sends it.
// It is kept for this tab until the user has signed in and the sale has synced.
(() => {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const saleId = url.searchParams.get('ekyc');
    if (!saleId) return;
    sessionStorage.setItem(PENDING_KEY, saleId);
    url.searchParams.delete('ekyc');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch { /* storage blocked: the link simply does nothing */ }
})();

const readPending = () => { try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; } };
const clearPending = () => { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

/**
 * Runs the standard "Trigger e-KYC & E-Sign" for the sale in the link, once signed in.
 * onStart(sale) runs it; onMissing(saleId) is called if the sale never shows up.
 */
export const useEKycDeepLink = ({ signedIn, sales, onStart, onMissing }) => {
  const handled = useRef(false);
  const waitStarted = useRef(0);

  useEffect(() => {
    const saleId = readPending();
    if (!saleId || !signedIn || handled.current) return undefined;
    const sale = (sales || []).find(s => s.id === saleId);
    if (sale) {
      handled.current = true;
      clearPending();
      onStart(sale);
      return undefined;
    }
    // Shared data arrives a moment after sign-in; wait for the sale before giving up
    if (!waitStarted.current) waitStarted.current = Date.now();
    const timer = setTimeout(() => {
      if (handled.current || readPending() !== saleId) return;
      handled.current = true;
      clearPending();
      onMissing(saleId);
    }, Math.max(0, WAIT_FOR_SALE_MS - (Date.now() - waitStarted.current)));
    return () => clearTimeout(timer);
  }, [signedIn, sales]);  // eslint-disable-line react-hooks/exhaustive-deps
};
