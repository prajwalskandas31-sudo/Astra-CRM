/**
 * Extended Service Block client (backend/extended_service.py): clients whose paid Net Value over the last
 * 12 months crossed a limit, and assigning them a Service Master service (goes live, invoiced, emailed).
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

/** limit: the Net Value Limit (₹); null loads the last limit used. */
export const loadExtendedService = (limit = null) =>
  json(`/extended-service${limit === null ? '' : `?limit=${encodeURIComponent(limit)}`}`);

export const assignExtendedService = ({ clientKey, serviceId, limit }) =>
  json('/extended-service/assign', { method: 'POST', body: JSON.stringify({ clientKey, serviceId, limit }) });

export const resendExtendedServiceInvoice = (assignmentId) =>
  json(`/extended-service/assignments/${encodeURIComponent(assignmentId)}/resend`, { method: 'POST' });

export const downloadExtendedServiceInvoice = async (assignmentId, number) => {
  const blob = await (await backendFetch(`/extended-service/assignments/${encodeURIComponent(assignmentId)}/pdf`)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice ${String(number || '').replace(/\//g, '-')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
