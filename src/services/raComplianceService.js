/**
 * RA Monthly Compliance Tracker client (backend/ra_compliance.py).
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

/** {month, sheets: {sheet: {data, updatedBy, updatedAt}}} */
export const loadComplianceMonth = (month) => json(`/ra-compliance?${new URLSearchParams({ month })}`);

/** {months: {"2026-10": ["clientRegister", ...]}} newest first */
export const loadComplianceMonths = () => json('/ra-compliance/months');

/** {month, rows}: one Reco Register line per Ready report in the Research Reports block */
export const loadRecoFromReports = (month) => json(`/ra-compliance/reco-from-reports?${new URLSearchParams({ month })}`);

/** {month, rows}: Client Register lines from the CRM (this month's e-signs and Old Client renewals), each with the
 * `defaults` its MITC / KYC / Invoices / Client Documents lines start from */
export const loadCrmClients = (month) => json(`/ra-compliance/crm-clients?${new URLSearchParams({ month })}`);

export const saveComplianceSheet = (month, sheet, data) =>
  json(`/ra-compliance/${encodeURIComponent(sheet)}?${new URLSearchParams({ month })}`, { method: 'PUT', body: JSON.stringify({ data }) });
