/**
 * Email Block client: Sender Email ID, the 19 Welcome Kit files and "Send Welcome Kit".
 * Everything goes through the CRM backend (backend/email_kit.py); the SMTP password is
 * sent there once and never comes back to the browser.
 */
import { backendFetch } from './leegalityService';

const json = async (path, options) => (await backendFetch(path, options)).json();

export const getEmailSettings = () => json('/email/settings');

export const saveEmailSettings = (changes) =>
  json('/email/settings', { method: 'PUT', body: JSON.stringify(changes) });

export const clearSmtpPassword = () => json('/email/settings/password', { method: 'DELETE' });

export const sendTestEmail = (to) =>
  json('/email/test', { method: 'POST', body: JSON.stringify({ to: to || null }) });

export const listWelcomeKitFiles = () => json('/email/welcome-kit/files');

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.readAsDataURL(file);
});

export const uploadWelcomeKitFile = async (slot, file) =>
  json(`/email/welcome-kit/files/${slot}`, {
    method: 'PUT',
    body: JSON.stringify({ fileName: file.name, contentType: file.type || '', dataBase64: await readAsBase64(file) })
  });

export const deleteWelcomeKitFile = (slot) => json(`/email/welcome-kit/files/${slot}`, { method: 'DELETE' });

export const downloadWelcomeKitFile = async (slot, fileName) => {
  const blob = await (await backendFetch(`/email/welcome-kit/files/${slot}`)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `welcome-kit-${slot}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const previewWelcomeKit = (saleId) => json(`/email/welcome-kit/preview/${encodeURIComponent(saleId)}`);

export const sendWelcomeKit = (saleId) =>
  json('/email/welcome-kit/send', { method: 'POST', body: JSON.stringify({ saleId }) });

export const getWelcomeKitLog = () => json('/email/welcome-kit/log');

/** One-line summary of a completed send, for toasts. */
export const describeSend = (r) => {
  const files = r.attachments.length;
  const kyc = r.kycFiles?.length ? ` and ${r.kycFiles.length} e-KYC document${r.kycFiles.length === 1 ? '' : 's'}` : '';
  const agreement = r.agreementAttached ? ` including the signed agreement${kyc}` : '';
  const copy = r.savedToSent === false ? ` (Note: no copy was saved in the mailbox's Sent folder: ${r.sentCopyError})` : '';
  return `Welcome Kit sent to ${r.to} from ${r.from} with ${files} attachment${files === 1 ? '' : 's'}${agreement}.${copy}`;
};
