/**
 * Client Master block client (backend/client_master.py): find a client by PAN or mobile number,
 * download their invoices, and upload / rename / download their grievance files.
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

export const searchClient = (q) => json(`/client-master/search?q=${encodeURIComponent(q)}`);

export const listGrievances = (clientKey, from = '', to = '') => {
  const params = new URLSearchParams({ clientKey });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return json(`/client-master/grievances?${params}`);
};

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.readAsDataURL(file);
});

export const uploadGrievance = async (clientKey, file) =>
  json('/client-master/grievances', {
    method: 'POST',
    body: JSON.stringify({ clientKey, fileName: file.name, contentType: file.type || '', dataBase64: await readAsBase64(file) })
  });

export const renameGrievance = (fileId, fileName) =>
  json(`/client-master/grievances/${encodeURIComponent(fileId)}`, { method: 'PATCH', body: JSON.stringify({ fileName }) });

const saveBlob = async (path, fileName) => {
  const blob = await (await backendFetch(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const downloadGrievance = (file) =>
  saveBlob(`/client-master/grievances/${encodeURIComponent(file.id)}/file`, file.fileName);

export const downloadInvoice = (inv) =>
  saveBlob(`/client-master/invoices/${encodeURIComponent(inv.id)}/pdf`,
    inv.fileName || `Invoice ${inv.invoiceNumber.replace(/\//g, '-')}.pdf`);

// Editing a submission: the user's own password unlocks the form and is checked again on save.
// A wrong password is a 401, which backendFetch words as "sign in again"; keep the server's own message.
const withPassword = (path, method, body) => json(path, { method, body: JSON.stringify(body) }).catch(err => {
  throw new Error(err.message.startsWith('Incorrect password') ? err.message.split(' — ')[0] : err.message);
});

export const unlockClientEditing = (password) => withPassword('/client-master/unlock', 'POST', { password });

export const saveClientDetails = ({ saleId, leadId, password, changes }) =>
  withPassword('/client-master/details', 'PUT', { saleId: saleId || null, leadId: leadId || null, password, changes });
