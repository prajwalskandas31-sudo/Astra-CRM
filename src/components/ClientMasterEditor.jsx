import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Pencil, Plus, Trash2, Loader2, X, Save } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { INDIAN_STATES, SERVICE_TENURES, normalizeTenure } from './ClientInformationModal';
import { unlockClientEditing, saveClientDetails } from '../services/clientMasterService';

// Client MASTER: edit a Client Information Page submission. Opening the form needs the user's own
// login password; the server checks it again on save (backend/client_master.py edit_details).

const PREFIXES = ['Mr.', 'Miss', 'Mrs.'];
const CATEGORIES = ['Individual', 'Non-Individual'];

const toForm = (d) => ({
  clientCategory: d.clientCategory || 'Individual',
  clientPrefix: d.clientPrefix || 'Mr.',
  clientName: d.clientName || '',
  firmName: d.firmName || '',
  gstin: d.gstin || '',
  panNumber: d.panNumber || '',
  email: d.email || '',
  phone1: d.phone1 || '',
  phone2: d.phone2 || '',
  clientState: d.clientState || '',
  paymentDate: d.paymentDate || '',
  serviceName: d.serviceName || '',
  serviceTenure: normalizeTenure(d.serviceTenure || ''),
  serviceEndDate: d.serviceEndDate || '',
  transactionNumbers: (Array.isArray(d.transactionNumbers) ? d.transactionNumbers : [d.transactionNumbers]).filter(Boolean).join(', '),
  paymentModes: (d.paymentModes || []).map(m => ({ mode: m.mode || '', amount: String(m.amount ?? '') })),
  grossSales: String(d.grossSales ?? ''),
  netSales: String(d.netSales ?? ''),
  gst: String(d.gst ?? ''),
  sharingMode: d.employeeSharing?.mode || 'fixed',
  sharingValues: (d.employeeSharing?.shares || []).map(s => String(s.value ?? ''))
});

// Only what the user changed goes to the server, in the shape it expects
const changesBetween = (before, after, hasSharing) => {
  const out = {};
  const simple = ['clientCategory', 'clientPrefix', 'clientName', 'firmName', 'gstin', 'panNumber', 'email', 'phone1', 'phone2',
    'clientState', 'paymentDate', 'serviceName', 'serviceTenure', 'serviceEndDate', 'grossSales', 'netSales', 'gst'];
  simple.forEach(k => { if (String(after[k]).trim() !== String(before[k]).trim()) out[k] = after[k]; });
  if (after.transactionNumbers.trim() !== before.transactionNumbers.trim()) {
    out.transactionNumbers = after.transactionNumbers.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (JSON.stringify(after.paymentModes) !== JSON.stringify(before.paymentModes)) out.paymentModes = after.paymentModes;
  if (hasSharing && (after.sharingMode !== before.sharingMode || JSON.stringify(after.sharingValues) !== JSON.stringify(before.sharingValues))) {
    out.employeeSharing = { mode: after.sharingMode, values: after.sharingValues };
  }
  return out;
};

const Field = ({ label, children, span }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
    {label}
    {children}
  </label>
);

// Themed like the app's text inputs (index.css styles only input[type="text"], so email/tel/password need it inline)
const inputStyle = {
  height: '36px', fontSize: '0.84rem', padding: '6px 10px', width: '100%', boxSizing: 'border-box',
  backgroundColor: 'var(--bg-input, #121318)', color: 'var(--text-primary, #F5F5F4)', border: '1px solid var(--border-default, #2A2D37)', borderRadius: 'var(--radius-md)'
};

const Overlay = ({ children, onClose, labelledBy, width }) => (
  <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby={labelledBy}
      style={{ width: `min(${width}px, calc(100vw - 32px))`, maxWidth: 'none', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', padding: '20px' }}>
      {children}
    </div>
  </div>
);

const PasswordPrompt = ({ onUnlocked, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError('');
    try {
      await unlockClientEditing(password);
      onUnlocked(password);
    } catch (err) {
      setError(err.message);
      setPassword('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} labelledBy="cm-unlock-title" width={420}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Lock size={18} /></span>
          <div>
            <h3 id="cm-unlock-title" style={{ margin: 0, fontSize: '1rem' }}>Password required</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter your login password to edit this client's details.</p>
          </div>
        </div>
        <input ref={input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          aria-label="Your password" placeholder="Your password" style={inputStyle} />
        {error && <div role="alert" style={{ color: 'var(--status-danger)', fontSize: '0.8rem' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Unlock
          </button>
        </div>
      </form>
    </Overlay>
  );
};

const EditForm = ({ submission, password, onSaved, onClose }) => {
  const { services = [], financialSettings } = useCRM();
  const { showToast } = useToast();
  const details = submission.details;
  const shares = details.employeeSharing?.shares || [];
  const initial = useMemo(() => toForm(details), [details]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm(prev => {
    const next = { ...prev, [key]: value };
    if (key === 'grossSales') {
      // Same split as the Client Information Page: Net = Gross ÷ C, GST = Gross − Net
      const gross = parseFloat(value) || 0;
      const c = financialSettings?.cDivisorFactor || 1.18;
      const net = gross > 0 ? (gross / c).toFixed(2) : '0.00';
      next.netSales = net;
      next.gst = gross > 0 ? (gross - parseFloat(net)).toFixed(2) : '0.00';
    }
    return next;
  });
  const setMode = (i, key, value) => set('paymentModes', form.paymentModes.map((m, j) => (j === i ? { ...m, [key]: value } : m)));

  const serviceOptions = [...new Set([...(services || []).map(s => s.name).filter(Boolean), initial.serviceName].filter(Boolean))];
  const tenureOptions = [...new Set([...SERVICE_TENURES, initial.serviceTenure].filter(Boolean))];
  const changes = changesBetween(initial, form, shares.length > 0);
  const changedCount = Object.keys(changes).length;

  const save = async (e) => {
    e.preventDefault();
    if (!changedCount) return setError('Nothing has been changed.');
    setSaving(true);
    setError('');
    try {
      const res = await saveClientDetails({ saleId: submission.saleId, leadId: submission.leadId, password, changes });
      showToast(`Client details saved (${res.saved.length} field${res.saved.length === 1 ? '' : 's'} changed).`, 'success');
      onSaved({ ...form, ...changes });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const text = (key, props = {}) => (
    <input type="text" value={form[key]} onChange={e => set(key, e.target.value)} style={inputStyle} maxLength={200} {...props} />
  );

  return (
    <Overlay onClose={onClose} labelledBy="cm-edit-title" width={860}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h3 id="cm-edit-title" style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} color="var(--accent)" /> Edit Client Details</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Client Information Page submission of {submission.date || 'unknown date'}{submission.submittedBy ? ` by ${submission.submittedBy}` : ''}.
              Changes are saved to the sale, the lead and the paid-client record, with your name and the time.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="Close" style={{ padding: '4px 8px' }}><X size={14} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px 16px' }}>
          <Field label="Client Type">
            <input type="text" value={details.clientType || '—'} disabled style={inputStyle} title="Client Type decides the sale's workflow and cannot be changed here." />
          </Field>
          <Field label="Client Category">
            <select value={form.clientCategory} onChange={e => set('clientCategory', e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Title">
            <select value={form.clientPrefix} onChange={e => set('clientPrefix', e.target.value)} style={inputStyle}>
              {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Client Name">{text('clientName', { required: true })}</Field>
          <Field label="Firm Name">{text('firmName')}</Field>
          <Field label="PAN Number">{text('panNumber', { maxLength: 10, style: { ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' } })}</Field>
          <Field label="GSTIN">{text('gstin', { maxLength: 15, style: { ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' } })}</Field>
          <Field label="Email">{text('email', { type: 'email' })}</Field>
          <Field label="Phone 1">{text('phone1', { inputMode: 'tel', maxLength: 16 })}</Field>
          <Field label="Phone 2">{text('phone2', { inputMode: 'tel', maxLength: 16, placeholder: 'Optional' })}</Field>
          <Field label="State">
            <select value={form.clientState} onChange={e => set('clientState', e.target.value)} style={inputStyle}>
              {!form.clientState && <option value="">Choose a state</option>}
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Payment Date">{text('paymentDate', { type: 'date' })}</Field>
          <Field label="Service Name">
            <select value={form.serviceName} onChange={e => set('serviceName', e.target.value)} style={inputStyle}>
              {!form.serviceName && <option value="">Choose a service</option>}
              {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Service Tenure">
            <select value={form.serviceTenure} onChange={e => set('serviceTenure', e.target.value)} style={inputStyle}>
              {!form.serviceTenure && <option value="">Choose a tenure</option>}
              {tenureOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Service End Date">{text('serviceEndDate', { type: 'date' })}</Field>
          <Field label="Transaction No(s). (comma separated)" span={2}>{text('transactionNumbers')}</Field>
          <Field label="Gross Sales (₹)">{text('grossSales', { inputMode: 'decimal' })}</Field>
          <Field label="Net Sales (₹)">{text('netSales', { inputMode: 'decimal' })}</Field>
          <Field label="GST (₹)">{text('gst', { inputMode: 'decimal' })}</Field>
        </div>

        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Mode(s) of Payment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {form.paymentModes.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input type="text" value={m.mode} onChange={e => setMode(i, 'mode', e.target.value)} placeholder="Mode (UPI, NEFT…)" aria-label={`Payment mode ${i + 1}`} style={{ ...inputStyle, flex: '1 1 160px', width: 'auto' }} maxLength={60} />
                <input type="text" value={m.amount} onChange={e => setMode(i, 'amount', e.target.value)} placeholder="Amount" inputMode="decimal" aria-label={`Amount ${i + 1}`} style={{ ...inputStyle, flex: '1 1 120px', width: 'auto' }} />
                <button type="button" className="btn-secondary" onClick={() => set('paymentModes', form.paymentModes.filter((_, j) => j !== i))}
                  disabled={form.paymentModes.length <= 1} aria-label={`Remove payment mode ${i + 1}`} style={{ padding: '4px 10px' }}><Trash2 size={13} /></button>
              </div>
            ))}
            {form.paymentModes.length < 10 && (
              <button type="button" className="btn-secondary" onClick={() => set('paymentModes', [...form.paymentModes, { mode: '', amount: '' }])}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}><Plus size={13} /> Add mode</button>
            )}
          </div>
        </div>

        {shares.length > 0 && (
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Employee Sharing</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={form.sharingMode} onChange={e => set('sharingMode', e.target.value)} style={{ ...inputStyle, width: '170px' }} aria-label="Sharing mode">
                <option value="fixed">Fixed amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
              {shares.map((s, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                  {s.name || `Employee ${i + 1}`}
                  <input type="text" value={form.sharingValues[i]} inputMode="decimal" aria-label={`Share of ${s.name || `employee ${i + 1}`}`}
                    onChange={e => set('sharingValues', form.sharingValues.map((v, j) => (j === i ? e.target.value : v)))}
                    style={{ ...inputStyle, width: '100px' }} />
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div role="alert" style={{ color: 'var(--status-danger)', fontSize: '0.84rem' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{changedCount ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed` : 'No changes yet'}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !changedCount} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
            </button>
          </div>
        </div>
      </form>
    </Overlay>
  );
};

/**
 * Edit flow for one submission: password prompt, then the form. The password stays in memory only
 * while the form is open (the save sends it again) and is dropped when it closes.
 */
export const ClientMasterEditor = ({ submission, onClose, onSaved }) => {
  const [password, setPassword] = useState('');
  if (!password) return <PasswordPrompt onUnlocked={setPassword} onClose={onClose} />;
  return <EditForm submission={submission} password={password} onClose={onClose} onSaved={onSaved} />;
};
