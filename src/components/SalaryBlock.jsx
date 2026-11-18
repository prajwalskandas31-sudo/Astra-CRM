import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from '../services/backendConfig';
import { Wallet, RefreshCw, ChevronDown, ChevronRight, Search, X } from 'lucide-react';

// Must match PAY_TYPES in backend/salary.py
const PAY_TYPES = ['Commission', 'Salary', 'Salary plus Incentives'];

const HELP = {
  'Commission': 'Total Salary = Net Sales × the Commission % set on Add User.',
  'Salary': 'Eligible for Salary once Net Sales reach the Target set on Add User; otherwise the shortfall is shown.',
  'Salary plus Incentives': 'Once Net Sales reach the Target: Fixed Salary + (Net Sales − Target) × Incentive %. Otherwise "Target Not Reached".'
};

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = () => { const d = new Date(); return isoDay(new Date(d.getFullYear(), d.getMonth(), 1)); };

const money = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (n) => (n === null || n === undefined ? '—' : `${n}%`);

const TONE = {
  'Eligible for Salary': 'success', 'Target Reached': 'success',
  'Not Eligible for Salary': 'danger', 'Target Not Reached': 'danger',
  'Pay details missing': 'warning'
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const tone = TONE[status] || 'warning';
  return (
    <span className="badge" style={{ fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)` }}>
      {status}
    </span>
  );
};

const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

/**
 * Salary Block (Super Admin only): pick a Pay Type and a date range; every employee with that Pay Type
 * is listed with their Net Sales from closed clients (Paid block), split by Sharing Present, and what they earn.
 * All figures are computed on the server (backend/salary.py).
 */
export const SalaryBlock = () => {
  const { authToken } = useCRM();
  const [payType, setPayType] = useState(PAY_TYPES[0]);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!authToken || !isBackendEnabled()) { setError('The Salary Block needs the CRM server.'); return; }
    if (!from || !to) return;
    if (from > to) { setError('The From date is after the To date.'); setRows([]); return; }
    setLoading(true);
    try {
      const q = new URLSearchParams({ payType, from, to });
      const res = await fetch(`${API_BASE_URL}/salary-block?${q}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
      setRows((await res.json()).rows || []);
      setError('');
    } catch (err) {
      setRows([]);
      setError(err.message || 'Could not load the Salary Block.');
    } finally {
      setLoading(false);
    }
  }, [authToken, payType, from, to]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setOpen(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => rows.filter(r => !q
    || r.name.toLowerCase().includes(q) || (r.employeeId || '').toLowerCase().includes(q) || (r.branch || '').toLowerCase().includes(q)), [rows, q]);

  const totals = useMemo(() => shown.reduce((acc, r) => {
    acc.net += r.netSales || 0;
    acc.pay += r.totalSalary || 0;
    return acc;
  }, { net: 0, pay: 0 }), [shown]);

  const isCommission = payType === 'Commission';
  const isPlus = payType === 'Salary plus Incentives';
  // Chevron, Employee, Branch, Net Sales, Total Salary + the Pay Type's own columns
  const columns = 5 + (isCommission ? 1 : isPlus ? 6 : 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} color="var(--accent)" /> Salary Block
            </h3>
            <p>
              Net Sales from closed clients (Paid block) by Payment Date, split by Sharing Present. {HELP[payType]}
            </p>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="paid-service-tabs" role="tablist" aria-label="Pay Type" style={{ margin: '0 20px 12px' }}>
          {PAY_TYPES.map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={payType === t}
              className={`paid-service-tab${payType === t ? ' active' : ''}`}
              onClick={() => { setPayType(t); setOpen(new Set()); }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="paid-filters" style={{ flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            From <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ height: '36px' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            To <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={{ height: '36px' }} />
          </label>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search employee, code or branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', width: '100%', fontSize: '0.83rem', height: '36px', boxSizing: 'border-box' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}

        {!error && shown.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {loading ? 'Loading...' : rows.length === 0
              ? `No employees have the Pay Type "${payType}". Set it on the Add User page.`
              : 'No employees match this search.'}
          </div>
        ) : !error && (
          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '28px' }} aria-label="Details" />
                  <th>Employee</th>
                  <th>Branch</th>
                  <th style={num}>Net Sales</th>
                  {isCommission && <th style={num}>Commission %</th>}
                  {!isCommission && <th style={num}>Target</th>}
                  {!isCommission && <th style={num}>Fixed Salary</th>}
                  {isPlus && <th style={num}>Incentive %</th>}
                  {isPlus && <th style={num}>Incentive</th>}
                  {!isCommission && <th>Status</th>}
                  {!isCommission && <th style={num}>Difference</th>}
                  <th style={num}>Total Salary</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const expanded = open.has(r.userId);
                  const short = r.status === 'Not Eligible for Salary' || r.status === 'Target Not Reached';
                  return (
                    <React.Fragment key={r.userId}>
                      <tr onClick={() => toggle(r.userId)} style={{ cursor: 'pointer' }}>
                        <td>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td style={{ fontWeight: 600 }}>
                          {r.name}
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {[r.employeeId, r.role, r.userStatus !== 'Active' ? r.userStatus : ''].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{r.branch || '—'}</td>
                        <td style={{ ...num, fontWeight: 600 }}>{money(r.netSales)}</td>
                        {isCommission && <td style={num}>{pct(r.commissionPercent)}</td>}
                        {!isCommission && <td style={num}>{money(r.targetValue)}</td>}
                        {!isCommission && <td style={num}>{money(r.fixedSalary)}</td>}
                        {isPlus && <td style={num}>{pct(r.incentivePercent)}</td>}
                        {isPlus && <td style={num}>{money(r.incentive)}</td>}
                        {!isCommission && <td><StatusBadge status={r.status} /></td>}
                        {!isCommission && (
                          <td style={{ ...num, color: short ? 'var(--status-danger)' : 'var(--text-muted)' }}>
                            {short ? `${money(r.difference)} short` : '—'}
                          </td>
                        )}
                        <td style={{ ...num, fontWeight: 700 }}>
                          {r.status === 'Pay details missing' && isCommission ? <StatusBadge status={r.status} /> : money(r.totalSalary)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td />
                          <td colSpan={columns - 1} style={{ background: 'var(--bg-subtle, transparent)' }}>
                            {r.transactions.length === 0 ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No closed client transactions in this date range.</span>
                            ) : (
                              <table className="crm-table" style={{ fontSize: '0.78rem' }}>
                                <thead>
                                  <tr><th>Payment Date</th><th>Client</th><th>Sale</th><th>Credited as</th><th style={num}>Net Sales credited</th></tr>
                                </thead>
                                <tbody>
                                  {r.transactions.map((t, i) => (
                                    <tr key={`${t.saleId}-${i}`}>
                                      <td>{t.paymentDate}</td>
                                      <td>{t.clientName || '—'}</td>
                                      <td style={{ fontFamily: 'monospace' }}>{t.saleId}</td>
                                      <td>{t.role}</td>
                                      <td style={num}>{money(t.credited)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td colSpan={2} style={{ fontWeight: 700 }}>Total ({shown.length} employee{shown.length === 1 ? '' : 's'})</td>
                  <td style={{ ...num, fontWeight: 700 }}>{money(totals.net)}</td>
                  <td colSpan={columns - 5} />
                  <td style={{ ...num, fontWeight: 700 }}>{money(totals.pay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
