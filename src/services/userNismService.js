/**
 * NISM Exam Details documents (backend/user_nism.py): up to 10 per user, uploaded / downloaded / deleted one by one.
 * The six NISM details themselves are saved with the user (POST / PUT /api/users, field "nism").
 */
import { backendFetch } from './leegalityService';

export const NISM_MAX_DOCS = 10;
export const NISM_MAX_FILE_BYTES = 10 * 1024 * 1024;

const base = (userId) => `/users/${encodeURIComponent(userId)}/nism-documents`;

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.readAsDataURL(file);
});

export const listNismDocs = async (userId) => (await backendFetch(base(userId))).json();

export const uploadNismDoc = async (userId, file) =>
  (await backendFetch(base(userId), {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: file.type || '', dataBase64: await readAsBase64(file) })
  })).json();

export const deleteNismDoc = async (userId, docId) =>
  (await backendFetch(`${base(userId)}/${encodeURIComponent(docId)}`, { method: 'DELETE' })).json();

export const saveBlobAs = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const downloadNismDoc = async (userId, doc) =>
  saveBlobAs(await (await backendFetch(`${base(userId)}/${encodeURIComponent(doc.id)}/file`)).blob(), doc.fileName);
