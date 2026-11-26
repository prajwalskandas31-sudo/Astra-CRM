import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from '../services/backendConfig';
import { Wallet, RefreshCw, ChevronDown, ChevronRight, Search, X, Settings2, FileSpreadsheet, Files } from 'lucide-react';
import { SETTING_FIELDS, ENTRY_AMOUNTS, calculate, exportConsolidated, exportIndividual } from './salaryPayroll';

// Must match PAY_TYPES in backend/salary.py
const PAY_TYPES = ['Commission', 'Salary', 'Salary plus Incentives'];

const HELP = {
  'Commission': 'Total Salary = Net Sales × the Commission % set on Add User.',
  'Salary': 'Eligible for Salary once Net Sales reach the Target set on Add User; otherwise the shortfall is shown.',
  'Salary plus Incentives': 'Once Net Sales reach the Target: Fixed Salary + (Net Sales − Target) × Incentive %. Otherwise "Target Not Reached".'
};

const pad = (n) => String(n).padStart(2, '0');
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = (m) => {
  const [y, mo] = (m || '').split('-').map(Number);
  return y && mo ? new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : m;
};

const money = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (n) => (n === null || n === undefined ? '—' : `${n}%`);
const asText = (v) => (v === null || v === undefined || Number(v) === 0 ? '' : String(v));

const TONE = {
  'Eligible for Salary': 'success', 'Target Reached': 'success', 'Applicable': 'warning',
  'Not Eligible for Salary': 'danger', 'Target Not Reached': 'danger', 'Not Applicable': 'neutral',
  'Pay details missing': 'warning'
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const tone = TONE[status] || 'warning';
  const style = tone === 'neutral'
    ? { color: 'var(--text-muted)', border: '1px solid var(--border-default)', background: 'transparent' }
    : { background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)` };
  return <span className="badge" style={{ fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', ...style }}>{status}</span>;
};

const OnOff = ({ on, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onChange}
    style={{
      minWidth: '46px', height: '24px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
      background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-muted)'
    }}
  >
    {on ? 'On' : 'Off'}
  </button>
);

const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
// type="text" + form-control give inputs the app's themed colours; without them the browser draws a white
// box while the text keeps the light theme colour, so typed amounts vanish.
const amountInput = { width: '112px', minWidth: '112px', height: '34px', padding: '6px 10px', fontSize: '0.82rem', lineHeight: 1.4, textAlign: 'right', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' };
const nowrap = { whiteSpace: 'nowrap' };
const cleanNumber = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

const AttendanceCell = ({ a }) => (
  <div style={{ fontSize: '0.74rem', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
    <div><strong>{a.worked}</strong> / {a.workingDays} worked</div>
    <div style={{ color: 'var(--text-muted)' }}>
      PL {a.paidLeave}{a.extraLeave ? <span style={{ color: 'var(--status-danger)' }}> (+{a.extraLeave})</span> : null}
      {' · '}<span style={{ color: a.absent ? 'var(--status-danger)' : undefined }}>A {a.absent}</span>
      {' · '}<span style={{ color: a.halfDay ? 'var(--status-warning)' : undefined }}>HD {a.halfDay}</span>
    </div>
  </div>
);

const Breakdown = ({ r, settings }) => {
  const { attendance: a, calc: c } = r.view;
  const lines = [
    ['Total Salary (calculated)', c.base, ''],
    ['+ Incentive', c.incentive, ''],
    ['− Absent', -c.absentDeduction, `${a.absent} absent${a.extraLeave ? ` + ${a.extraLeave} leave(s) beyond the ${Math.floor(Number(settings.paidLeaves) || 0)} paid` : ''} × ${money(settings.absentDeduction || 0)}`],
    ['− Half Day', -c.halfDayDeduction, `${a.halfDay} × ${money(settings.halfDayDeduction || 0)}`],
    ['+ Expenses', c.expenses, ''],
    ['− Deduction', -c.deduction, ''],
    ['− Advance', -c.advance, ''],
    ['= Before Professional Tax', c.beforeProfessionalTax, ''],
    ['− Professional Tax', -c.professionalTax, `${c.professionalTaxStatus} (limit ${money(settings.professionalTaxLimit || 0)})`],
    ['− Insurance', -c.insurance, r.entry.insurance ? 'On' : 'Off'],
    ['− PF', -c.pf, r.entry.pf ? 'On' : 'Off']
  ];
  return (
    <table className="crm-table" style={{ fontSize: '0.78rem', width: 'auto', minWidth: '420px', flex: '1 1 420px' }}>
      <thead><tr><th>Calculation</th><th>Detail</th><th style={num}>Amount</th></tr></thead>
      <tbody>
        {lines.map(([label, value, detail]) => (
          <tr key={label}><td style={{ whiteSpace: 'nowrap' }}>{label}</td><td style={{ color: 'var(--text-muted)', minWidth: '160px' }}>{detail}</td><td style={num}>{money(value)}</td></tr>
        ))}
        <tr>
          <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Final Total Salary</td>
          <td style={{ color: 'var(--text-muted)' }}>{a.notMarked ? `${a.notMarked} day(s) not marked (no deduction)` : ''}</td>
          <td style={{ ...num, fontWeight: 700 }}>{money(c.finalSalary)}</td>
        </tr>
      </tbody>
    </table>
  );
};

/**
 * Salary Block (Super Admin only): pick a Pay Type and a month; every employee with that Pay Type is listed
 * with their Net Sales from closed clients (Paid block), split by Sharing Present, and what they earn.
 * The month's global settings and each employee's Incentive / Expenses / Deduction / Advance / Insurance / PF
 * are saved on the server as they are typed. The Final Total Salary follows payroll() in backend/salary.py.
 */
export const SalaryBlock = () => {
  const { authToken } = useCRM();
  const [payType, setPayType] = useState(PAY_TYPES[0]);
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState({});
  const [settingsSaved, setSettingsSaved] = useState(true);
  const [entries, setEntries] = useState({});
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [showSettings, setShowSettings] = useState(true);
  const [search, setSearch] = useState('');
  const timers = useRef({});
  const inFlight = useRef(0);

  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }), [authToken]);

  const load = useCallback(async () => {
    if (!authToken || !isBackendEnabled()) { setError('The Salary Block needs the CRM server.'); return; }
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ payType, month });
      const res = await fetch(`${API_BASE_URL}/salary-block?${q}`, { headers });
      if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
      const body = await res.json();
      setRows(body.rows || []);
      setSettings(Object.fromEntries(SETTING_FIELDS.map(f => [f.key, asText(body.settings?.[f.key])])));
      setSettingsSaved(Boolean(body.settings?.saved));
      setEntries(Object.fromEntries((body.rows || []).map(r => [r.userId, {
        ...Object.fromEntries(ENTRY_AMOUNTS.map(f => [f.key, asText(r.entry?.[f.key])])),
        insurance: Boolean(r.entry?.insurance), pf: Boolean(r.entry?.pf)
      }])));
      setError('');
    } catch (err) {
      setRows([]);
      setError(err.message || 'Could not load the Salary Block.');
    } finally {
      setLoading(false);
    }
  }, [authToken, payType, month, headers]);

  useEffect(() => { load(); }, [load]);

  // Save after a short pause in typing; the settings and each employee have their own timer
  const scheduleSave = useCallback((key, path, body) => {
    clearTimeout(timers.current[key]);
    setSaveState('Saving...');
    timers.current[key] = setTimeout(async () => {
      inFlight.current += 1;
      try {
        const res = await fetch(`${API_BASE_URL}/salary-block/${path}?${new URLSearchParams({ month })}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
        if (path === 'settings') setSettingsSaved(true);
        setSaveState(inFlight.current > 1 ? 'Saving...' : 'All changes saved');
      } catch (err) {
        setSaveState(`Not saved: ${err.message || 'server error'}`);
      } finally {
        inFlight.current -= 1;
      }
    }, 700);
  }, [headers, month]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  useEffect(() => { setSaveState(''); }, [month, payType]);

  const setSetting = (key, value) => {
    const next = { ...settings, [key]: cleanNumber(value) };
    setSettings(next);
    scheduleSave('settings', 'settings', Object.fromEntries(SETTING_FIELDS.map(f => [f.key, Number(next[f.key]) || 0])));
  };

  const setEntry = (userId, key, value) => {
    const next = { ...entries[userId], [key]: typeof value === 'string' ? cleanNumber(value) : value };
    setEntries(prev => ({ ...prev, [userId]: next }));
    scheduleSave(`entry:${userId}`, 'entry', {
      userId, ...Object.fromEntries(ENTRY_AMOUNTS.map(f => [f.key, Number(next[f.key]) || 0])),
      insurance: Boolean(next.insurance), pf: Boolean(next.pf)
    });
  };

  const toggle = (id) => setOpen(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  // Each row with its live calculation from the current settings and entries
  const computed = useMemo(() => rows.map(r => {
    const entry = entries[r.userId] || {};
    return { ...r, entry, view: calculate(r.totalSalary, r.attendance, settings, entry) };
  }), [rows, entries, settings]);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => computed.filter(r => !q
    || r.name.toLowerCase().includes(q) || (r.employeeId || '').toLowerCase().includes(q) || (r.branch || '').toLowerCase().includes(q)), [computed, q]);

  const totals = useMemo(() => shown.reduce((acc, r) => {
    acc.net += r.netSales || 0;
    acc.pay += r.totalSalary || 0;
    acc.final += r.view.calc.finalSalary || 0;
    return acc;
  }, { net: 0, pay: 0, final: 0 }), [shown]);

  const isCommission = payType === 'Commission';
  const isPlus = payType === 'Salary plus Incentives';
  const typeColumns = isCommission ? 1 : isPlus ? 6 : 4;
  // Chevron, Employee, Branch, Net Sales, Total Salary, Incentive, Attendance, Expenses, Deduction, Advance,
  // Prof. Tax, Insurance, PF, Final + the Pay Type's own columns
  const columns = 14 + typeColumns;

  const groups = [...new Set(SETTING_FIELDS.map(f => f.group))];

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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setShowSettings(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} aria-expanded={showSettings}>
              <Settings2 size={14} /> {showSettings ? 'Hide settings' : 'Settings'}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {showSettings && (
          <div style={{ margin: '0 20px 16px', padding: '14px 16px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <strong style={{ fontSize: '0.86rem' }}>Settings for {monthLabel(month)}: all employees, all three pay types</strong>
              <span style={{ fontSize: '0.74rem', color: settingsSaved ? 'var(--text-muted)' : 'var(--status-warning)' }}>
                {settingsSaved ? 'Saved for this month' : 'Carried over from an earlier month: change any value to save it for this month'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {groups.map(g => (
                <fieldset key={g} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <legend style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{g}</legend>
                  {SETTING_FIELDS.filter(f => f.group === g).map(f => (
                    <div className="form-group" key={f.key}>
                      <label htmlFor={`sal-set-${f.key}`} style={{ lineHeight: 1.35 }}>{f.label}</label>
                      <input
                        id={`sal-set-${f.key}`}
                        type="text"
                        className="form-control"
                        style={{ width: '100%', minWidth: 0, minHeight: '38px', boxSizing: 'border-box', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                        inputMode={f.whole ? 'numeric' : 'decimal'}
                        value={settings[f.key] ?? ''}
                        placeholder="0"
                        onChange={e => setSetting(f.key, f.whole ? e.target.value.replace(/\D/g, '') : e.target.value)}
                      />
                    </div>
                  ))}
                </fieldset>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Leaves beyond the paid allowance are deducted at the Absent rate; unmarked days are not deducted.
              Professional Tax is deducted only when the salary after all other additions and deductions is above the limit.
            </p>
          </div>
        )}

        <div className="paid-service-tabs" role="tablist" aria-label="Pay Type" style={{ margin: '0 20px 14px' }}>
          {PAY_TYPES.map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={payType === t}
              className={`paid-service-tab${payType === t ? ' active' : ''}`}
              onClick={() => { setPayType(t); setOpen(new Set()); }}
              style={nowrap}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="paid-filters" style={{ flexWrap: 'wrap', alignItems: 'center', gap: '10px', margin: '0 20px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            Month
            <input
              type="month"
              className="form-control"
              value={month}
              onChange={e => e.target.value && setMonth(e.target.value)}
              style={{ height: '36px', minWidth: '170px', padding: '6px 10px', boxSizing: 'border-box' }}
            />
          </label>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
            <input
              type="text"
              className="form-control"
              aria-label="Search employee, code or branch"
              placeholder="Search employee, code or branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', paddingRight: search ? '32px' : '12px', width: '100%', fontSize: '0.83rem', height: '36px', boxSizing: 'border-box' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1, zIndex: 1 }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button className="btn-secondary" disabled={!computed.length} onClick={() => exportConsolidated(payType, month, computed, settings)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', whiteSpace: 'nowrap', flex: '0 0 auto' }} title="One sheet with every employee of this pay type">
            <FileSpreadsheet size={14} /> Export all
          </button>
          <button className="btn-secondary" disabled={!computed.length} onClick={() => exportIndividual(payType, month, computed, settings)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', whiteSpace: 'nowrap', flex: '0 0 auto' }} title="One workbook with a sheet per employee">
            <Files size={14} /> Export per employee
          </button>
        </div>

        {saveState && (
          <div role="status" style={{ margin: '0 20px 8px', fontSize: '0.76rem', color: saveState.startsWith('Not saved') ? 'var(--status-danger)' : 'var(--text-muted)' }}>
            {saveState}
          </div>
        )}
        {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}

        {!error && shown.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {loading ? 'Loading...' : rows.length === 0
              ? `No employees have the Pay Type "${payType}". Set it on the Add User page.`
              : 'No employees match this search.'}
          </div>
        ) : !error && (
          <div className="table-responsive">
            <table className="crm-table" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={{ width: '28px' }} aria-label="Details" />
                  <th style={{ minWidth: '180px' }}>Employee</th>
                  <th style={{ minWidth: '110px' }}>Branch</th>
                  <th style={num}>Net Sales</th>
                  {isCommission && <th style={num}>Commission %</th>}
                  {!isCommission && <th style={num}>Target</th>}
                  {!isCommission && <th style={num}>Fixed Salary</th>}
                  {isPlus && <th style={num}>Incentive %</th>}
                  {isPlus && <th style={num}>Target Incentive</th>}
                  {!isCommission && <th>Status</th>}
                  {!isCommission && <th style={num}>Difference</th>}
                  <th style={num}>Total Salary</th>
                  <th style={num}>Incentive</th>
                  <th>Attendance</th>
                  <th style={num}>Expenses</th>
                  <th style={num}>Deduction</th>
                  <th style={num}>Advance</th>
                  <th>Prof. Tax</th>
                  <th>Insurance</th>
                  <th>PF</th>
                  <th style={num}>Final Total Salary</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const expanded = open.has(r.userId);
                  const short = r.status === 'Not Eligible for Salary' || r.status === 'Target Not Reached';
                  const { attendance: a, calc: c } = r.view;
                  const amount = (key) => (
                    <td style={num}>
                      <input
                        aria-label={`${key} for ${r.name}`}
                        type="text"
                        className="form-control"
                        title={r.entry[key] ? money(r.entry[key]) : undefined}
                        inputMode="decimal"
                        placeholder="0"
                        value={r.entry[key] ?? ''}
                        onChange={e => setEntry(r.userId, key, e.target.value)}
                        style={amountInput}
                      />
                    </td>
                  );
                  return (
                    <React.Fragment key={r.userId}>
                      <tr>
                        <td>
                          <button type="button" onClick={() => toggle(r.userId)} aria-expanded={expanded} aria-label={`Details for ${r.name}`} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => toggle(r.userId)} title={r.name}>
                          {r.name}
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {[r.employeeId, r.role, r.userStatus !== 'Active' ? r.userStatus : ''].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.branch || '—'}</td>
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
                        <td style={num}>
                          {r.status === 'Pay details missing' && isCommission ? <StatusBadge status={r.status} /> : money(r.totalSalary)}
                        </td>
                        {amount('incentive')}
                        <td><AttendanceCell a={a} /></td>
                        {amount('expenses')}
                        {amount('deduction')}
                        {amount('advance')}
                        <td><StatusBadge status={c.professionalTaxStatus} /></td>
                        <td><OnOff on={Boolean(r.entry.insurance)} label={`Insurance for ${r.name}`} onChange={() => setEntry(r.userId, 'insurance', !r.entry.insurance)} /></td>
                        <td><OnOff on={Boolean(r.entry.pf)} label={`PF for ${r.name}`} onChange={() => setEntry(r.userId, 'pf', !r.entry.pf)} /></td>
                        <td style={{ ...num, fontWeight: 700 }}>{money(c.finalSalary)}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td />
                          <td colSpan={columns - 1} style={{ background: 'var(--bg-subtle, transparent)', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                              <Breakdown r={r} settings={settings} />
                              {r.transactions.length === 0 ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No closed client transactions in this month.</span>
                              ) : (
                                <table className="crm-table" style={{ fontSize: '0.78rem', width: 'auto', minWidth: '420px', flex: '1 1 420px' }}>
                                  <thead>
                                    <tr><th>Payment Date</th><th>Client</th><th>Sale</th><th>Credited as</th><th style={num}>Net Sales credited</th></tr>
                                  </thead>
                                  <tbody>
                                    {r.transactions.map((t, i) => (
                                      <tr key={`${t.saleId}-${i}`}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.paymentDate}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.clientName || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.saleId}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.role}</td>
                                        <td style={num}>{money(t.credited)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
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
                  <td colSpan={2} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total ({shown.length} employee{shown.length === 1 ? '' : 's'})</td>
                  <td style={{ ...num, fontWeight: 700 }}>{money(totals.net)}</td>
                  <td colSpan={typeColumns} />
                  <td style={{ ...num, fontWeight: 700 }}>{money(totals.pay)}</td>
                  <td colSpan={8} />
                  <td style={{ ...num, fontWeight: 700 }}>{money(totals.final)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
