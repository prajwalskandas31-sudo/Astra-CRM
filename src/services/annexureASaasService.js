/**
 * Annexure A for SaaS Reporting (backend/annexure_a_saas.py) client.
 */
import { backendFetch } from './leegalityService';

const BASE = '/annexure-a-saas';
const json = async (path, options) => (await backendFetch(path, options)).json();
const id = (reportId) => `${BASE}/${encodeURIComponent(reportId)}`;

export const listAnnexureReports = () => json(BASE);

export const createAnnexureReport = (label, copyFrom) =>
  json(BASE, { method: 'POST', body: JSON.stringify({ label, ...(copyFrom ? { copyFrom } : {}) }) });

export const loadAnnexureReport = (reportId) => json(id(reportId));

export const saveAnnexureReport = (report) =>
  json(id(report.id), { method: 'PUT', body: JSON.stringify(report) });

export const deleteAnnexureReport = (reportId) => json(id(reportId), { method: 'DELETE' });

/** format: 'docx' | 'pdf' */
export const downloadAnnexureReport = async (reportId, format, filename) => {
  const blob = await (await backendFetch(`${id(reportId)}/${format}`)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
