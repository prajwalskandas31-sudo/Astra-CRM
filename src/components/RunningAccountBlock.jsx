import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from './ToastNotification';
import {
  loadStatement, adjustEntry, addManualEntry, editManualEntry, deleteManualEntry, downloadStatementPdf
} from '../services/accountsService';
import { BookOpen, RefreshCw, FileSpreadsheet, FileText, Loader2, Plus, Pencil, Trash2, X, Save, RotateCcw } from 'lucide-react';

// Running Account Statement Block (backend/running_account.py): Credits, Debits and a running Net Balance
// that opens at ₹0 every month.

const TABS = [
  ['all', 'Complete Statement'],
  ['clientPayment', 'Client Payment Credit'],
  ['advanceExpense', 'Advance & Expense Payment Debit'],
  ['salaryAttendance', 'Salary & Attendance'],
  ['manual', 'Manual Entry']
];

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => today().slice(0, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (key) => { const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (key || '—'); };
const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Entries of one tab with their own running balance from ₹0 (the Complete Statement keeps the server's). */
const withBalance = (entries) => {
  let bal = 0;
  return entries.map(e => { bal = r2(bal + e.credit - e.debit); return { ...e, balance: bal }; });
};

const label = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 };
const num = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

const Tile = ({ title, value, tone }) => (
  <div style={{ flex: '1 1 150px', padding: '10px 14px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: tone || 'inherit', ...num, textAlign: 'left' }}>{value}</div>
  </div>
);

const ManualForm = ({ initial, onSave, onCancel, busy }) => {
  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial); }, [initial]);
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 20px 16px' }}>
      <label style={label}>Date
        <input type="date" required value={form.adjustedDate} onChange={set('adjustedDate')} style={{ height: '36px' }} />
      </label>
      <label style={{ ...label, flex: '1 1 260px' }}>Narration
        <input type="text" required maxLength={300} value={form.narration} onChange={set('narration')} placeholder="e.g. Office rent for November" style={{ height: '36px' }} />
      </label>
      <div style={label}>Transaction Type
        <div className="paid-service-tabs" role="radiogroup" aria-label="Transaction Type" style={{ margin: 0 }}>
          {['Credit', 'Debit'].map(t => (
            <button key={t} type="button" role="radio" aria-checked={form.type === t}
              className={`paid-service-tab${form.type === t ? ' active' : ''}`} onClick={() => setForm(prev => ({ ...prev, type: t }))}>{t}</button>
          ))}
        </div>
      </div>
      <label style={label}>Amount (₹)
        <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={set('amount')} style={{ height: '36px', width: '140px' }} />
      </label>
      <button type="submit" className="btn-primary" disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {initial.id ? 'Save changes' : 'Add entry'}
      </button>
      {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} style={{ height: '36px' }}>Cancel</button>}
    </form>
  );
};

const AdjustedDate = ({ entry, onChange }) => {
  if (entry.section === 'manual') return <span>{dmy(entry.adjustedDate)}</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input type="date" value={entry.adjustedDate} aria-label="Adjusted Date"
        onChange={e => e.target.value && onChange(e.target.value)}
        style={{ height: '30px', fontSize: '0.78rem', borderColor: entry.adjusted ? 'var(--accent)' : undefined }} />
      {entry.adjusted && (
        <button type="button" title={`Back to the Entry Date (${dmy(entry.entryDate)})`} aria-label="Reset Adjusted Date" onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><RotateCcw size={13} /></button>
      )}
    </div>
  );
};

const DebitInput = ({ entry, onCommit }) => {
  const [value, setValue] = useState(entry.debit ? String(entry.debit) : '');
  useEffect(() => { setValue(entry.debit ? String(entry.debit) : ''); }, [entry.debit]);
  const commit = () => {
    const n = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(n) || n < 0) { setValue(entry.debit ? String(entry.debit) : ''); return; }
    if (r2(n) !== entry.debit) onCommit(r2(n));
  };
  return (
    <input type="number" min="0" step="0.01" value={value} placeholder="0.00" aria-label="Debit adjustment"
      onChange={e => setValue(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      style={{ width: '110px', height: '30px', fontSize: '0.8rem', textAlign: 'right' }} />
  );
};

const exportExcel = (data) => {
  const wb = XLSX.utils.book_new();
  const head = ['Entry Date', 'Adjusted Date', 'Narration', 'Credit (₹)', 'Debit (₹)', 'Neutral (₹)', 'Net Balance (₹)'];
  TABS.forEach(([id, title]) => {
    const list = id === 'all' ? data.entries : withBalance(data.entries.filter(e => e.section === id));
    const totals = list.reduce((t, e) => ({ c: t.c + e.credit, d: t.d + e.debit, n: t.n + e.neutral }), { c: 0, d: 0, n: 0 });
    const aoa = [
      [`Running Account Statement - ${title}`], [data.monthName], ['Opening Balance', 0], [], head,
      ...list.map(e => [e.entryDate, e.adjustedDate, e.narration, e.credit, e.debit, e.neutral, e.balance]),
      ['', '', 'Total', r2(totals.c), r2(totals.d), r2(totals.n), r2(totals.c - totals.d)]
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet['!cols'] = [{ wch: 12 }, { wch: 13 }, { wch: 70 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, sheet, title.replace(/&/g, 'and').slice(0, 31));
  });
  XLSX.writeFile(wb, `Running Account Statement ${data.monthName}.xlsx`);
};

export const RunningAccountBlock = () => {
  const { showToast } = useToast();
  const [month, setMonth] = useState(thisMonth);
  const [tab, setTab] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const blank = useMemo(() => ({ adjustedDate: today(), narration: '', type: 'Debit', amount: '' }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadStatement(month));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) showToast(okMessage, 'success');
      await load();
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeDate = (entry, date) => run(
    () => adjustEntry(entry.key, date, entry.debitEditable ? entry.debit : undefined),
    date && date.slice(0, 7) !== month ? `Entry moved to ${dmy(date)} - it now shows in that month.` : null
  );
  const changeDebit = (entry, debit) => run(() => adjustEntry(entry.key, entry.adjusted ? entry.adjustedDate : '', debit));

  const saveManual = async (form) => {
    const body = { ...form, narration: form.narration.trim(), amount: Number(form.amount) };
    const ok = await run(() => (form.id ? editManualEntry(form.id, body) : addManualEntry(body)),
      form.id ? 'Entry updated.' : `${form.type} of ${rupees(body.amount)} added.`);
    if (ok) setEditing(null);
    return ok;
  };

  const shown = useMemo(() => {
    if (!data) return [];
    return tab === 'all' ? data.entries : withBalance(data.entries.filter(e => e.section === tab));
  }, [data, tab]);
  const totals = useMemo(() => shown.reduce((t, e) => ({ credit: t.credit + e.credit, debit: t.debit + e.debit, neutral: t.neutral + e.neutral }),
    { credit: 0, debit: 0, neutral: 0 }), [shown]);
  const showNeutral = tab === 'all' || tab === 'salaryAttendance';
  const tabTitle = TABS.find(([id]) => id === tab)[1];

  const pdf = async () => {
    try {
      await downloadStatementPdf(month, tab, `Running Account Statement ${tab === 'all' ? '' : `${tabTitle} `}${data?.monthName || month}.pdf`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={18} color="var(--accent)" /> Running Account Statement</h3>
          <p>
            Money in (Credits) and out (Debits) for the month, from ₹0 at the start of every month. Client payments come from
            closed sales by Payment Date; advances, expenses, salary and attendance from the Salary Block; Professional Tax, PF
            and Insurance are shown as Neutral and do not change the balance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            Month <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ height: '36px' }} />
          </label>
          <button className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn-secondary" disabled={!data} onClick={() => exportExcel(data)} title="Complete Statement plus one sheet per sub-block"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button className="btn-secondary" disabled={!data} onClick={pdf} title={`PDF of: ${tabTitle}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {data && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 20px 14px' }}>
          <Tile title="Opening Balance" value={rupees(0)} />
          <Tile title="Credits" value={rupees(data.totals.credit)} tone="var(--status-success)" />
          <Tile title="Debits" value={rupees(data.totals.debit)} tone="var(--status-danger)" />
          <Tile title="Neutral (PT, PF, Insurance)" value={rupees(data.totals.neutral)} />
          <Tile title="Closing Net Balance" value={rupees(data.totals.net)} tone={data.totals.net < 0 ? 'var(--status-danger)' : undefined} />
        </div>
      )}

      <div className="paid-service-tabs" role="tablist" aria-label="Sub-block" style={{ margin: '0 20px 12px', flexWrap: 'wrap' }}>
        {TABS.map(([id, title]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`paid-service-tab${tab === id ? ' active' : ''}`}
            onClick={() => { setTab(id); setEditing(null); }}>
            {title}{data && id !== 'all' ? ` (${data.entries.filter(e => e.section === id).length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'manual' && (
        <div style={{ margin: '0 20px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ padding: '10px 20px 0', fontSize: '0.82rem', fontWeight: 700 }}>{editing ? 'Edit entry' : 'New manual entry'}</div>
          <ManualForm initial={editing || blank} busy={busy} onSave={saveManual} onCancel={editing ? () => setEditing(null) : null} />
        </div>
      )}

      {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}

      {!error && (shown.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
          {loading ? 'Loading...' : `No entries in ${data?.monthName || month}${tab === 'all' ? '' : ` for ${tabTitle}`}.`}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Entry Date</th>
                <th>Adjusted Date</th>
                <th>Narration</th>
                <th style={num}>Credit (₹)</th>
                <th style={num}>Debit (₹)</th>
                {showNeutral && <th style={num}>Neutral (₹)</th>}
                <th style={num}>Net Balance (₹)</th>
                {tab === 'manual' && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {shown.map(e => (
                <tr key={e.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dmy(e.entryDate)}</td>
                  <td><AdjustedDate entry={e} onChange={(d) => changeDate(e, d)} /></td>
                  <td style={{ minWidth: '260px' }}>
                    {e.narration}
                    {e.section === 'manual' && e.createdBy && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Added by {e.createdBy}</div>}
                  </td>
                  <td style={{ ...num, color: e.credit ? 'var(--status-success)' : 'var(--text-muted)' }}>{e.credit ? rupees(e.credit) : '—'}</td>
                  <td style={num}>
                    {e.debitEditable
                      ? <DebitInput entry={e} onCommit={(d) => changeDebit(e, d)} />
                      : <span style={{ color: e.debit ? 'var(--status-danger)' : 'var(--text-muted)' }}>{e.debit ? rupees(e.debit) : '—'}</span>}
                  </td>
                  {showNeutral && <td style={{ ...num, color: 'var(--text-muted)' }}>{e.neutral ? rupees(e.neutral) : '—'}</td>}
                  <td style={{ ...num, fontWeight: 600, color: e.balance < 0 ? 'var(--status-danger)' : undefined }}>{rupees(e.balance)}</td>
                  {tab === 'manual' && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {confirmDelete === e.manualId ? (
                        <>
                          <button type="button" className="btn-secondary" disabled={busy} style={{ height: '28px', fontSize: '0.75rem', color: 'var(--status-danger)' }}
                            onClick={async () => { await run(() => deleteManualEntry(e.manualId), 'Entry deleted.'); setConfirmDelete(null); }}>Delete</button>
                          <button type="button" aria-label="Keep entry" onClick={() => setConfirmDelete(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" aria-label="Edit entry" title="Edit"
                            onClick={() => setEditing({ id: e.manualId, adjustedDate: e.adjustedDate, narration: e.narration, type: e.type, amount: String(e.credit || e.debit) })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Pencil size={14} /></button>
                          <button type="button" aria-label="Delete entry" title="Delete" onClick={() => setConfirmDelete(e.manualId)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>Total ({shown.length} entries)</td>
                <td style={num}>{rupees(totals.credit)}</td>
                <td style={num}>{rupees(totals.debit)}</td>
                {showNeutral && <td style={num}>{rupees(totals.neutral)}</td>}
                <td style={num}>{rupees(totals.credit - totals.debit)}</td>
                {tab === 'manual' && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {tab === 'manual' && !shown.length && !loading && (
        <div style={{ margin: '-24px 20px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <Plus size={11} style={{ verticalAlign: 'middle' }} /> Use the form above to record a Credit or Debit.
        </div>
      )}
      <div style={{ padding: '0 20px 16px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        Salary lines are dated on the month's last day. Salary Paid = Fixed / Commission + Incentive − Deduction − Advance already
        given, so together with the Advance, Expenses and Absent / Half Day lines the balance matches the cash that left the company.
        Change an Adjusted Date to move an entry to another day (or month).
      </div>
    </div>
  );
};

export default RunningAccountBlock;
