/**
 * Invoice Block client (backend/invoice_block.py): e-signed clients, Generate Invoice (PDF),
 * Invoice Controls and the Claude draft of Notes / Terms & Conditions.
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

export const loadInvoiceBlock = () => json('/invoice-block');

export const generateInvoice = (saleId, kind) =>
  json(`/invoice-block/${encodeURIComponent(saleId)}/generate`, { method: 'POST', body: JSON.stringify({ kind }) });

export const downloadInvoicePdf = async (saleId, number) => {
  const blob = await (await backendFetch(`/invoice-block/${encodeURIComponent(saleId)}/pdf`)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice ${number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const saveInvoiceSettings = (settings) =>
  json('/invoice-block/settings', { method: 'PUT', body: JSON.stringify(settings) });

export const saveBranchCounter = (branchCode, nextNumber) =>
  json('/invoice-block/counters', { method: 'PUT', body: JSON.stringify({ branchCode, nextNumber }) });

export const draftInvoiceText = (field, current, instruction) =>
  json('/invoice-block/draft-text', { method: 'POST', body: JSON.stringify({ field, current, instruction }) });
