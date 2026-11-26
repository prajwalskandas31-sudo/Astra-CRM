import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award, Download, Trash2, UploadCloud, Loader2, ChevronRight } from 'lucide-react';
import { useToast } from './ToastNotification';
import {
  NISM_MAX_DOCS, NISM_MAX_FILE_BYTES, listNismDocs, uploadNismDoc, deleteNismDoc, downloadNismDoc, saveBlobAs
} from '../services/userNismService';
import { confirmAsync } from './ConfirmDialog';

export const EMPTY_NISM = { name: '', series: '', registrationNumber: '', enrollmentNumber: '', clearedDate: '', validUpto: '' };

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Name as on the NISM certificate' },
  { key: 'series', label: 'Series', placeholder: 'e.g. Series XV - Research Analyst' },
  { key: 'registrationNumber', label: 'Registration Number', placeholder: 'e.g. NISM-202500012345' },
  { key: 'enrollmentNumber', label: 'Enrollment Number', placeholder: 'e.g. 1234567' },
  { key: 'clearedDate', label: 'Exam Cleared Date', type: 'date' },
  { key: 'validUpto', label: 'Valid Upto', type: 'date' }
];

const formatSize = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const formatDay = (key) => {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const smallBtn = { padding: '4px 9px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' };

/** The card at the end of the Add / Edit User form that opens the NISM Exam Details page. */
export const NismExamSummary = ({ details, docCount, onOpen }) => {
  const filled = FIELDS.filter(f => (details?.[f.key] || '').trim()).length;
  return (
    <div style={{
      gridColumn: '1 / -1', background: 'var(--bg-table-head)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
          <Award size={16} /> NISM Exam Details
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {filled === 0 && docCount === 0
            ? 'Name, Series, Registration / Enrollment Number, dates and up to 10 documents, on their own page.'
            : `${filled} of ${FIELDS.length} details filled · ${docCount} document${docCount === 1 ? '' : 's'}`
              + (details?.series ? ` · ${details.series}` : '') + (details?.validUpto ? ` · valid upto ${formatDay(details.validUpto)}` : '')}
        </div>
      </div>
      <button type="button" className="btn-secondary" onClick={onOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
        Open NISM Exam Details <ChevronRight size={14} />
      </button>
    </div>
  );
};

/**
 * The NISM Exam Details page for one user, shown in place of the Add / Edit User form.
 * - Editing a saved user (userId set): documents are uploaded / deleted on the server straight away.
 * - Creating a user (no userId yet): documents wait in pendingFiles and are uploaded once the user is created.
 * The six details are part of the user form and are saved with Submit User / Update User.
 */
export const NismExamDetailsPage = ({ userName, details, onChange, userId, pendingFiles, setPendingFiles, onDocCount, onBack }) => {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [docs, setDocs] = useState([]);
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await listNismDocs(userId);
      setDocs(res.documents || []);
      setCanManage(!!res.canManage);
      onDocCount?.((res.documents || []).length);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, showToast, onDocCount]);

  useEffect(() => { load(); }, [load]);

  const count = userId ? docs.length : pendingFiles.length;
  const left = NISM_MAX_DOCS - count;

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!picked.length) return;
    const tooBig = picked.filter(f => f.size > NISM_MAX_FILE_BYTES);
    if (tooBig.length) showToast(`${tooBig.map(f => f.name).join(', ')}: each file can be at most 10 MB.`, 'warning');
    let ok = picked.filter(f => f.size <= NISM_MAX_FILE_BYTES && f.size > 0);
    if (ok.length > left) {
      showToast(`Only ${NISM_MAX_DOCS} documents are allowed; ${left} more can be added.`, 'warning');
      ok = ok.slice(0, Math.max(left, 0));
    }
    if (!ok.length) return;
    if (!userId) {
      setPendingFiles(prev => [...prev, ...ok.map(file => ({ id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file }))]);
      return;
    }
    setBusy('upload');
    try {
      for (const file of ok) await uploadNismDoc(userId, file);
      showToast(`${ok.length} NISM document${ok.length === 1 ? '' : 's'} uploaded.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
      load();
    }
  };

  const handleDelete = async (doc) => {
    if (!userId) {
      setPendingFiles(prev => prev.filter(p => p.id !== doc.id));
      return;
    }
    if (!await confirmAsync(`Delete ${doc.fileName}? This cannot be undone.`, { danger: true, confirmLabel: 'Delete' })) return;
    setBusy(doc.id);
    try {
      await deleteNismDoc(userId, doc.id);
      showToast(`${doc.fileName} deleted.`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
      load();
    }
  };

  const handleDownload = async (doc) => {
    try {
      if (!userId) saveBlobAs(doc.file, doc.file.name);
      else await downloadNismDoc(userId, doc);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const rows = userId
    ? docs.map(d => ({ id: d.id, fileName: d.fileName, size: d.size, note: `Uploaded ${new Date(d.uploadedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${d.uploadedBy ? ` by ${d.uploadedBy}` : ''}`, raw: d }))
    : pendingFiles.map(p => ({ id: p.id, fileName: p.file.name, size: p.file.size, note: 'Uploads when the user is created', raw: p }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onBack} style={{ ...smallBtn, fontSize: '0.78rem', padding: '6px 10px' }}>
          <ArrowLeft size={14} /> Back to user form
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <Award size={18} color="var(--accent-primary)" /> NISM Exam Details{userName ? ` · ${userName}` : ''}
        </div>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {FIELDS.map(f => (
          <div className="form-group" key={f.key} style={{ margin: 0 }}>
            <label htmlFor={`nism-${f.key}`}>{f.label}</label>
            <input id={`nism-${f.key}`} type={f.type || 'text'} value={details?.[f.key] || ''} placeholder={f.placeholder}
              maxLength={120} min={f.key === 'validUpto' ? details?.clearedDate || undefined : undefined}
              onChange={e => onChange(f.key, e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '-6px' }}>
        These details are saved with the user when you click {userId ? 'Update User' : 'Submit User'}.
      </div>

      <div style={{ background: 'var(--bg-table-head)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
            Documents <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count} of {NISM_MAX_DOCS} · up to 10 MB each)</span>
          </div>
          {canManage && (
            <>
              <input ref={fileRef} type="file" multiple onChange={handleFiles} style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" aria-label="Choose NISM documents" />
              <button type="button" className="btn-primary" disabled={left <= 0 || busy === 'upload'} onClick={() => fileRef.current?.click()}
                style={{ ...smallBtn, fontSize: '0.78rem', padding: '6px 12px' }}>
                {busy === 'upload' ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                {busy === 'upload' ? 'Uploading…' : 'Upload Documents'}
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading documents…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No NISM documents uploaded yet.</div>
        ) : rows.map(r => (
          <div key={r.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fileName}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatSize(r.size)} · {r.note}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button type="button" className="btn-secondary" style={smallBtn} onClick={() => handleDownload(r.raw)}>
                <Download size={12} /> Download
              </button>
              {canManage && (
                <button type="button" className="btn-danger" style={smallBtn} disabled={busy === r.id} onClick={() => handleDelete(r.raw)}>
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
