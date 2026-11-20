/**
 * Running Account Statement (backend/running_account.py) and Audit Report Blocks
 * (backend/audit_report.py) clients.
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

const download = async (path, filename) => {
  const blob = await (await backendFetch(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ---------------- Running Account Statement ----------------
export const loadStatement = (month) => json(`/running-account?${new URLSearchParams({ month })}`);

export const adjustEntry = (key, adjustedDate, debit) =>
  json('/running-account/adjust', { method: 'PUT', body: JSON.stringify({ key, adjustedDate, debit }) });

export const addManualEntry = (entry) =>
  json('/running-account/manual', { method: 'POST', body: JSON.stringify(entry) });

export const editManualEntry = (id, entry) =>
  json(`/running-account/manual/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(entry) });

export const deleteManualEntry = (id) =>
  json(`/running-account/manual/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const downloadStatementPdf = (month, section, filename) =>
  download(`/running-account/pdf?${new URLSearchParams({ month, section })}`, filename);

// ---------------- Audit Report: Client and Fee Details ----------------
export const loadClientFee = (period) => json(`/audit-reports/client-fee?${new URLSearchParams({ period })}`);

export const saveClientFee = (period, values) =>
  json(`/audit-reports/client-fee?${new URLSearchParams({ period })}`, { method: 'PUT', body: JSON.stringify({ values }) });

export const downloadClientFeePdf = (period, rows, filename) =>
  download(`/audit-reports/client-fee/pdf?${new URLSearchParams({ period, rows: rows.join(',') })}`, filename);
