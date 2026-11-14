import React, { useState } from 'react';
import { useToast } from './ToastNotification';
import { Landmark, Plus, Save, RotateCcw, Edit2, Trash2, ExternalLink } from 'lucide-react';

export const ACCOUNT_TYPES = ['Current', 'Savings', 'Cash Credit', 'Overdraft', 'Other'];

const FIELDS = [
  { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. HDFC Bank', required: true },
  { key: 'accountNumber', label: 'Account Number', placeholder: 'e.g. 50200012345678', required: true, mono: true },
  { key: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', mono: true, upper: true },
  { key: 'accountType', label: 'Account Type', type: 'select' },
  { key: 'bankBranch', label: 'Bank Branch', placeholder: 'e.g. Althan, Surat' },
  { key: 'upiId', label: 'UPI ID / Link', placeholder: 'e.g. company@hdfcbank or upi://pay?pa=...' },
  { key: 'paymentGatewayLink', label: 'Payment Gateway Link', placeholder: 'e.g. https://rzp.io/l/company', type: 'url', wide: true }
];

const EMPTY = { bankName: '', accountNumber: '', ifscCode: '', accountType: 'Current', bankBranch: '', upiId: '', paymentGatewayLink: '' };
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const isLink = (v) => /^https?:\/\//i.test(v || '');

/** Company bank accounts, kept in the Company Profile under "bankAccounts". */
export const CompanyBankAccounts = ({ accounts = [], canEdit, onChange }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const reset = () => { setForm(EMPTY); setEditingId(null); };
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.keys(EMPTY).map(k => [k, (form[k] || '').trim()]));
    clean.ifscCode = clean.ifscCode.toUpperCase();
    clean.accountNumber = clean.accountNumber.replace(/\s+/g, '');
    if (!clean.bankName || !clean.accountNumber) {
      showToast('Bank Name and Account Number are required.', 'error');
      return;
    }
    if (clean.ifscCode && !IFSC_PATTERN.test(clean.ifscCode)) {
      showToast('IFSC Code should be 11 characters, like HDFC0001234.', 'error');
      return;
    }
    if (clean.paymentGatewayLink && !isLink(clean.paymentGatewayLink)) {
      showToast('Payment Gateway Link should start with https://', 'error');
      return;
    }
    const duplicate = accounts.find(a => a.id !== editingId && a.accountNumber === clean.accountNumber && a.ifscCode === clean.ifscCode);
    if (duplicate) {
      showToast(`This account is already saved (${duplicate.bankName}).`, 'error');
      return;
    }
    if (editingId) {
      onChange(accounts.map(a => a.id === editingId ? { ...a, ...clean } : a));
      showToast(`${clean.bankName} account updated.`, 'success');
    } else {
      onChange([...accounts, { id: 'bank-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900), ...clean }]);
      showToast(`${clean.bankName} account added.`, 'success');
    }
    reset();
  };

  const handleEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, a[k] || EMPTY[k]])) });
  };

  const handleDelete = (a) => {
    if (!window.confirm(`Delete the ${a.bankName} account ending ${String(a.accountNumber).slice(-4)}?`)) return;
    onChange(accounts.filter(x => x.id !== a.id));
    if (editingId === a.id) reset();
    showToast(`${a.bankName} account deleted.`, 'info');
  };

  const dirty = editingId || Object.keys(EMPTY).some(k => form[k] !== EMPTY[k]);
  const muted = <span style={{ color: 'var(--text-muted)' }}>—</span>;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Landmark size={16} color="var(--accent)" /> Bank Details
        </h4>
        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {canEdit
            ? 'The company accounts clients pay into. Add as many as you need; each change is saved and shared immediately.'
            : 'The company accounts clients pay into.'}
        </p>
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 0' }}>
          <div className="form-grid">
            {FIELDS.map(f => (
              <div className="form-group" key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                <label htmlFor={`bank-${f.key}`}>{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select id={`bank-${f.key}`} value={form[f.key]} onChange={e => set(f.key, e.target.value)}>
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <input
                    id={`bank-${f.key}`}
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => set(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    autoComplete="off"
                    style={f.mono ? { fontFamily: 'monospace' } : undefined}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            {dirty && (
              <button type="button" className="btn-secondary" onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={14} /> {editingId ? 'Cancel Edit' : 'Clear'}
              </button>
            )}
            <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {editingId ? <><Save size={14} /> Save Bank Account</> : <><Plus size={14} /> Add Bank Account</>}
            </button>
          </div>
        </form>
      )}

      <div style={{ overflowX: 'auto', marginTop: '16px' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>IFSC Code</th>
              <th>Account Type</th>
              <th>Bank Branch</th>
              <th>UPI ID / Link</th>
              <th>Payment Gateway</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  {canEdit ? 'No bank accounts yet. Add the first one above.' : 'No bank accounts have been added yet.'}
                </td>
              </tr>
            ) : accounts.map((a, i) => (
              <tr key={a.id}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{a.bankName}</td>
                <td style={{ fontFamily: 'monospace' }}>{a.accountNumber}</td>
                <td style={{ fontFamily: 'monospace' }}>{a.ifscCode || muted}</td>
                <td>{a.accountType || muted}</td>
                <td>{a.bankBranch || muted}</td>
                <td style={{ maxWidth: '220px', wordBreak: 'break-all' }}>
                  {a.upiId ? (isLink(a.upiId) ? <a href={a.upiId} target="_blank" rel="noopener noreferrer">{a.upiId}</a> : a.upiId) : muted}
                </td>
                <td>
                  {a.paymentGatewayLink ? (
                    <a href={a.paymentGatewayLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Open <ExternalLink size={12} />
                    </a>
                  ) : muted}
                </td>
                {canEdit && (
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleEdit(a)}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--status-danger)' }} onClick={() => handleDelete(a)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
