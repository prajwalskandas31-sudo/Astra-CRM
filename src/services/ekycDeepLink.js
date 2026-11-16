/**
 * The e-KYC link at the end of the Client Information message in the Telegram review group
 * (backend/sale_review.py): <CRM_PUBLIC_URL>/?ekyc=<saleId>. Opening it signs in to the CRM and runs
 * the standard "Trigger e-KYC & E-Sign" for that sale (see useEKycDeepLink in src/App.jsx).
 */
import { useEffect, useRef } from 'react';

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
 * Calls onStart(sale) once signed in and the sale from the link has arrived;
 * onMissing(saleId) if it never shows up.
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
