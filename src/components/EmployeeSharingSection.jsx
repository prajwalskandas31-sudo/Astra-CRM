import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Users, Search, X, ChevronDown, Check } from 'lucide-react';

// "Sharing Present" block of the Client Information Page: up to 5 employees (any branch) share the
// sale's Gross Sales (A), each by a fixed ₹ amount or a % of Gross Sales.
export const MAX_SHARING_EMPLOYEES = 5;
export const SHARING_FIXED = 'fixed';
export const SHARING_PERCENT = 'percentage';

export const emptySharing = () => ({ present: false, mode: SHARING_FIXED, shares: [] });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Payout per employee, totals and what is left of Gross Sales once they are paid
export const computeSharing = (sharing, grossSales) => {
  const gross = parseFloat(grossSales) || 0;
  const pct = sharing?.mode === SHARING_PERCENT;
  const shares = (sharing?.shares || []).map(s => {
    const value = parseFloat(s.value) || 0;
    return { ...s, amount: round2(pct ? (gross * value) / 100 : value) };
  });
  const totalValue = round2(shares.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0));
  const totalAmount = round2(shares.reduce((sum, s) => sum + s.amount, 0));
  return { gross, shares, totalValue, totalAmount, remaining: round2(gross - totalAmount) };
};

// Error text for the block, or '' when it is valid
export const validateSharing = (sharing, grossSales) => {
  if (!sharing?.present) return '';
  if (!sharing.shares?.length) return 'Select at least 1 employee';
  if (sharing.shares.length > MAX_SHARING_EMPLOYEES) return `Select at most ${MAX_SHARING_EMPLOYEES} employees`;
  if (sharing.shares.some(s => !(parseFloat(s.value) > 0))) return 'Enter a share above 0 for every selected employee';
  const { gross, totalValue, totalAmount } = computeSharing(sharing, grossSales);
  if (sharing.mode === SHARING_PERCENT) {
    if (totalValue > 100) return `Total share is ${totalValue}%, it cannot exceed 100% of Gross Sales`;
  } else if (totalAmount > gross) {
    return `Total share ₹${totalAmount.toLocaleString('en-IN')} exceeds Gross Sales ₹${gross.toLocaleString('en-IN')}`;
  }
  return '';
};

// What gets saved on the sale: the computed payouts travel with it so reviewers see exact figures
export const sharingPayload = (sharing, grossSales) => {
  if (!sharing?.present) return { present: false };
  const { shares, totalValue, totalAmount, remaining } = computeSharing(sharing, grossSales);
  return {
    present: true,
    mode: sharing.mode,
    shares: shares.map(s => ({
      userId: s.userId, name: s.name, employeeCode: s.employeeCode || '', branch: s.branch || '',
      value: parseFloat(s.value) || 0, amount: s.amount
    })),
    totalPercent: sharing.mode === SHARING_PERCENT ? totalValue : undefined,
    totalAmount,
    remaining
  };
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const EmployeeSharingSection = ({ sharing, onChange, grossSales, users = [], branches = [], error = '' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const branchName = (id) => (id && branches.find(b => b.id === id)?.name) || '';

  const employees = useMemo(() => users
    .filter(u => u && u.id && (u.status || 'Active') === 'Active')
    .map(u => ({ userId: u.id, name: u.name || 'Unnamed', employeeCode: u.employeeId || '', branch: branchName(u.branchId) }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [users, branches]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const filtered = employees.filter(e => !q
    || e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || e.branch.toLowerCase().includes(q));

  const selectedIds = new Set(sharing.shares.map(s => s.userId));
  const isPct = sharing.mode === SHARING_PERCENT;
  const { gross, shares, totalValue, totalAmount, remaining } = computeSharing(sharing, grossSales);
  const overLimit = isPct ? totalValue > 100 : totalAmount > gross;
  // Shown live as soon as the shares overshoot Gross Sales, without waiting for Send to Review
  const liveError = overLimit && shares.length > 0
    ? `Total shared ${inr(totalAmount)} is more than Gross Sales ${inr(gross)} (remaining balance ${inr(remaining)}). Reduce the shares — the form cannot be sent to review until the remaining balance is ₹0.00 or more.`
    : '';
  const shownError = error || liveError;

  const set = (patch) => onChange({ ...sharing, ...patch });

  const toggleEmployee = (emp) => {
    if (selectedIds.has(emp.userId)) {
      set({ shares: sharing.shares.filter(s => s.userId !== emp.userId) });
    } else if (sharing.shares.length < MAX_SHARING_EMPLOYEES) {
      set({ shares: [...sharing.shares, { ...emp, value: '' }] });
    }
  };

  const setValue = (userId, value) => set({ shares: sharing.shares.map(s => (s.userId === userId ? { ...s, value } : s)) });

  const pill = (active) => ({
    padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
    background: active ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)'
  });

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} /> Sharing Present <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '6px' }} role="radiogroup" aria-label="Sharing Present">
          {[['Yes', true], ['No', false]].map(([label, val]) => (
            <button key={label} type="button" role="radio" aria-checked={sharing.present === val}
              onClick={() => set({ present: val })} style={pill(sharing.present === val)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {sharing.present && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Employee multi-select (all branches, max 5) */}
          <div ref={boxRef} style={{ position: 'relative' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Employees sharing this sale (any branch, up to {MAX_SHARING_EMPLOYEES})
            </span>
            <button type="button" onClick={() => setOpen(o => !o)}
              className={error && !sharing.shares.length ? 'client-form-input-error' : ''}
              style={{
                width: '100%', minHeight: '38px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px',
                flexWrap: 'wrap', textAlign: 'left', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input, rgba(255,255,255,0.03))', color: 'var(--text-primary)',
                border: `1px solid ${error && !sharing.shares.length ? '#ef4444' : 'var(--border-default)'}`
              }}>
              {sharing.shares.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Select employees…</span>}
              {sharing.shares.map(s => (
                <span key={s.userId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', padding: '2px 4px 2px 8px',
                  borderRadius: 'var(--radius-full)', background: 'rgba(99, 102, 241, 0.16)', border: '1px solid rgba(99, 102, 241, 0.35)'
                }}>
                  {s.name}{s.employeeCode ? ` (${s.employeeCode})` : ''}
                  <span role="button" tabIndex={0} aria-label={`Remove ${s.name}`}
                    onClick={(e) => { e.stopPropagation(); toggleEmployee(s); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleEmployee(s); } }}
                    style={{ display: 'inline-flex', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={12} />
                  </span>
                </span>
              ))}
              <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
            </button>

            {open && (
              <div style={{
                position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: '4px',
                background: 'var(--bg-modal)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-sm)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
              }}>
                <div style={{ position: 'relative', padding: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Search size={13} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
                    placeholder="Search name, employee code or branch"
                    style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '0.8rem' }} />
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {filtered.length === 0 && (
                    <div style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No employees match.</div>
                  )}
                  {filtered.map(emp => {
                    const checked = selectedIds.has(emp.userId);
                    const blocked = !checked && sharing.shares.length >= MAX_SHARING_EMPLOYEES;
                    return (
                      <button key={emp.userId} type="button" disabled={blocked} onClick={() => toggleEmployee(emp)}
                        title={blocked ? `Up to ${MAX_SHARING_EMPLOYEES} employees` : ''}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', textAlign: 'left',
                          background: checked ? 'rgba(99, 102, 241, 0.12)' : 'transparent', border: 'none',
                          color: 'var(--text-primary)', cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.45 : 1
                        }}>
                        <span style={{
                          width: '15px', height: '15px', flexShrink: 0, borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`, background: checked ? 'var(--accent)' : 'transparent'
                        }}>
                          {checked && <Check size={11} color="#fff" />}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{emp.name}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{emp.employeeCode || 'No code'}</span>
                        {emp.branch && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.branch}</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                  {sharing.shares.length}/{MAX_SHARING_EMPLOYEES} selected
                </div>
              </div>
            )}
          </div>

          {/* Fixed Value or Percentage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Sharing type:</span>
            <div style={{ display: 'flex', gap: '6px' }} role="radiogroup" aria-label="Sharing type">
              <button type="button" role="radio" aria-checked={!isPct} onClick={() => set({ mode: SHARING_FIXED })} style={pill(!isPct)}>
                Fixed Value (₹)
              </button>
              <button type="button" role="radio" aria-checked={isPct} onClick={() => set({ mode: SHARING_PERCENT })} style={pill(isPct)}>
                Percentage (% of Gross Sales)
              </button>
            </div>
          </div>

          {/* Per-employee value and payout */}
          {shares.length > 0 && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {shares.map(s => (
                <div key={s.userId} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 140px minmax(110px, auto)', gap: '10px',
                  alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {s.employeeCode || 'No code'}{s.branch ? ` • ${s.branch}` : ''}
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)',
                      ...(isPct ? { right: '10px' } : { left: '10px' })
                    }}>{isPct ? '%' : '₹'}</span>
                    <input type="number" min="0" step="0.01" max={isPct ? 100 : undefined} value={s.value}
                      onChange={(e) => setValue(s.userId, e.target.value)}
                      aria-label={`${isPct ? 'Percentage' : 'Amount'} for ${s.name}`}
                      placeholder={isPct ? 'e.g. 10' : 'e.g. 500'}
                      className={(overLimit || (error && !(parseFloat(s.value) > 0))) ? 'client-form-input-error' : ''}
                      style={{
                        width: '100%', fontSize: '0.82rem', padding: isPct ? '6px 24px 6px 10px' : '6px 10px 6px 22px',
                        borderColor: (overLimit || (error && !(parseFloat(s.value) > 0))) ? '#ef4444' : undefined
                      }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.86rem', fontWeight: 700, color: '#818cf8' }}>{inr(s.amount)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '8px 10px', fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.05)' }}>
                <span>Total shared: <strong>{inr(totalAmount)}</strong>{isPct && ` (${totalValue}%)`}</span>
                <span>
                  Remaining balance: <strong style={{ color: remaining < 0 ? '#ef4444' : '#10b981' }}>{inr(remaining)}</strong>
                </span>
              </div>
            </div>
          )}

          {shownError && <span role="alert" style={{ color: '#ef4444', fontSize: '0.74rem' }}>{shownError}</span>}
        </div>
      )}
    </div>
  );
};

export default EmployeeSharingSection;
