import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from './ToastNotification';
import { loadRaPeriodicReport, saveRaPeriodicReport } from '../services/raPeriodicReportService';
import {
  GENERAL, YES_NO, COMPLAINT_ROWS, COMPLAINT_SOURCES, FEE_ROWS, FEE_COLUMNS, TABLES, TABLE_IDS, SUB_BLOCKS,
  tableRows, generalAuto, generalValue, complaintCells, feeAuto, feeValue, feeCells, buildWorkbook, fileName
} from './raPeriodicReport';
import { ScrollText, RefreshCw, FileSpreadsheet, Loader2, Save, RotateCcw, AlertTriangle, Plus, Trash2, Copy, Database } from 'lucide-react';

// RA Periodic Report Block (backend/ra_periodic_report.py): the SEBI RA half-yearly periodic report in
// 11 sub-blocks. The CRM fills in what it knows, the user types the rest (or over the CRM's values),
// Save keeps it per half, and the whole report (or one sub-block) downloads as Excel.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (key) => { const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ''; };
const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currentPeriod = () => {
  const d = new Date();
  const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { fy, half: d.getMonth() >= 3 && d.getMonth() <= 8 ? 'H1' : 'H2' };
};
const periodKey = (fy, half) => `${fy}-${String((fy + 1) % 100).padStart(2, '0')}-${half}`;
const hasRow = (row) => Object.values(row || {}).some(v => String(v ?? '').trim() !== '');

/** Saved data in one fixed shape, so "unsaved changes" compares like with like. */
const normalize = (d) => {
  const out = { general: { ...(d?.general || {}) }, complaints: { ...(d?.complaints || {}) }, clientsFees: { ...(d?.clientsFees || {}) } };
  TABLE_IDS.forEach(t => { if (Array.isArray(d?.[t])) out[t] = d[t]; });
  return out;
};
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));

const inputBase = { width: '100%', height: '32px', fontSize: '0.82rem', boxSizing: 'border-box', padding: '0 8px' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 };
const th = { textAlign: 'center', verticalAlign: 'middle' };
const hint = { fontSize: '0.7rem', color: 'var(--text-muted)' };
const btn = { display: 'flex', alignItems: 'center', gap: '6px', height: '36px' };

/** One input for a field definition (text, yesno, select, date, number, textarea, with a suggestion list). */
const FieldInput = ({ field, value, onChange, label, edited, numeric }) => {
  const style = { ...inputBase, borderColor: edited ? 'var(--accent)' : undefined, textAlign: numeric ? 'right' : undefined };
  const change = (v) => onChange(field.upper ? v.toUpperCase() : v);
  if (field.type === 'yesno' || field.options) {
    return (
      <select value={value} onChange={e => change(e.target.value)} aria-label={label} style={style}>
        <option value="">Select</option>
        {(field.options || YES_NO).map(o => <option key={o} value={o}>{o}</option>)}
        {value && !(field.options || YES_NO).includes(value) && <option value={value}>{value}</option>}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return <textarea rows={2} maxLength={1000} value={value} aria-label={label} onChange={e => change(e.target.value)}
      style={{ ...style, height: 'auto', padding: '6px 8px', fontFamily: 'inherit', resize: 'vertical' }} />;
  }
  const listId = field.list ? `ra-list-${field.key}` : undefined;
  return (
    <>
      <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? '0' : undefined}
        step={field.type === 'number' ? 'any' : undefined} maxLength={1000} value={value} aria-label={label} list={listId}
        onChange={e => change(e.target.value)} style={{ ...style, textTransform: field.upper ? 'uppercase' : undefined }} />
      {listId && <datalist id={listId}>{field.list.map(o => <option key={o} value={o} />)}</datalist>}
    </>
  );
};

/** Value with the CRM's figure behind it: shows a reset arrow once typed over. */
const AutoField = ({ field, value, auto, typed, onChange, onReset, label, numeric, format = (x) => x }) => {
  const edited = typed && auto !== '' && String(value) !== String(auto);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <FieldInput field={field} value={value} onChange={onChange} label={label} edited={edited} numeric={numeric} />
        {edited && <button type="button" style={iconBtn} title={`Back to the CRM's value (${format(auto)})`} aria-label="Reset to the CRM's value" onClick={onReset}><RotateCcw size={12} /></button>}
      </div>
      {edited && <span style={hint}>CRM: {format(auto) || '(blank)'}</span>}
    </div>
  );
};

// ---------------- 1. General Details ----------------
const GeneralTab = ({ data, draft, setSection }) => {
  const field = (f, label) => {
    const auto = generalAuto(data, draft, f);
    const set = (v) => setSection('general', (g) => { const n = { ...g }; if (v === '' && auto === '') delete n[f.key]; else n[f.key] = v; return n; });
    const reset = () => setSection('general', (g) => { const n = { ...g }; delete n[f.key]; return n; });
    return <AutoField field={f} value={generalValue(data, draft, f)} auto={auto} typed={f.key in (draft.general || {})} onChange={set} onReset={reset} label={label} numeric={f.type === 'number'} />;
  };
  const rows = [];
  GENERAL.forEach(item => {
    if (item.kind === 'field') {
      rows.push(<tr key={item.key}><td style={{ textAlign: 'center' }}>{item.sr}</td><td colSpan={2}>{item.label}</td><td>{field(item, item.label)}</td></tr>);
    } else if (item.kind === 'ref') {
      rows.push(<tr key={item.sheet}><td style={{ textAlign: 'center' }}>{item.sr}</td><td colSpan={2}>{item.label}</td>
        <td style={{ color: 'var(--text-muted)' }}>Filled in the "{TABLES[item.sheet].sheet}" sub-block</td></tr>);
    } else {
      const subs = item.kind === 'address'
        ? TABLES.branches.columns.map(c => ({ key: `${item.key}.${c.key}`, label: c.label }))
        : item.fields;
      subs.forEach((f, i) => rows.push(
        <tr key={f.key}>
          {i === 0 && <td rowSpan={subs.length} style={{ textAlign: 'center', verticalAlign: 'top' }}>{item.sr}</td>}
          {i === 0 && <td rowSpan={subs.length} style={{ verticalAlign: 'top', fontWeight: 600 }}>{item.label}</td>}
          <td style={{ fontSize: '0.78rem' }}>{f.label}</td>
          <td>{field(f, `${item.label}: ${f.label}`)}</td>
        </tr>
      ));
    }
  });
  return (
    <div className="table-responsive">
      <table className="crm-table ra-table">
        <thead><tr><th style={{ ...th, width: '60px' }}>Sr. No.</th><th colSpan={2} style={th}>Particulars</th><th style={{ ...th, width: '34%' }}>Details</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};

// ---------------- 2. Complaints ----------------
const ComplaintsTab = ({ draft, setSection }) => {
  const cells = complaintCells(draft);
  const set = (k, v) => setSection('complaints', (c) => { const n = { ...c }; if (v === '') delete n[k]; else n[k] = v; return n; });
  const valueCells = (row) => [
    ...COMPLAINT_SOURCES.map(([s, t]) => (
      <td key={s}>{row.calc
        ? <div style={{ textAlign: 'right', fontWeight: 600 }}>{cells[`${row.key}.${s}`]}</div>
        : <input type="number" min="0" step={row.decimal ? 'any' : '1'} aria-label={`${row.label}: ${t}`} value={draft.complaints?.[`${row.key}.${s}`] ?? ''}
            placeholder="0" onChange={e => set(`${row.key}.${s}`, e.target.value)} style={{ ...inputBase, textAlign: 'right' }} />}
      </td>
    )),
    <td key="total" style={{ textAlign: 'right', fontWeight: 700 }}>{cells[`${row.key}.total`]}</td>
  ];
  return (
    <div className="table-responsive">
      <table className="crm-table ra-table">
        <thead><tr><th style={th}>Sr No.</th><th colSpan={2} style={th}>Particulars</th>
          {COMPLAINT_SOURCES.map(([s, t]) => <th key={s} style={{ ...th, width: '15%' }}>{t}</th>)}<th style={{ ...th, width: '13%' }}>Total (SCORES + Other Sources)</th></tr></thead>
        <tbody>
          {COMPLAINT_ROWS.map(row => (row.subs
            ? row.subs.map((sub, i) => (
              <tr key={sub.key}>
                {i === 0 && <td rowSpan={row.subs.length} style={{ textAlign: 'center', verticalAlign: 'top' }}>{row.sr}</td>}
                {i === 0 && <td rowSpan={row.subs.length} style={{ verticalAlign: 'top', fontWeight: 600 }}>{row.label}</td>}
                <td style={{ fontSize: '0.78rem' }}>{sub.label}</td>
                {sub.text
                  ? <td colSpan={3}><input type="text" maxLength={1000} aria-label="Other complaints (specify)" placeholder="Specify the other type(s), or NA"
                      value={draft.complaints?.[sub.key] ?? ''} onChange={e => set(sub.key, e.target.value)} style={inputBase} /></td>
                  : valueCells(sub)}
              </tr>
            ))
            : <tr key={row.key}><td style={{ textAlign: 'center' }}>{row.sr}</td><td colSpan={2} style={{ fontSize: row.label.length > 120 ? '0.76rem' : undefined }}>{row.label}</td>{valueCells(row)}</tr>))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------- 3. Clients And Fees ----------------
const FeesTab = ({ data, draft, setSection }) => {
  const cells = feeCells(data, draft);
  const set = (k, v) => setSection('clientsFees', (c) => ({ ...c, [k]: v }));
  const reset = (k) => setSection('clientsFees', (c) => { const n = { ...c }; delete n[k]; return n; });
  const auto = (row, k) => (
    <AutoField field={{ key: k, type: row.kind === 'text' ? 'text' : 'number' }} value={String(feeValue(data, draft, k) ?? '')} auto={String(feeAuto(data, k) ?? '')}
      typed={k in (draft.clientsFees || {})} onChange={v => set(k, v)} onReset={() => reset(k)} label={`${row.label} ${k}`}
      numeric={row.kind !== 'text'} format={row.money ? rupees : undefined} />
  );
  return (
    <div className="table-responsive">
      <table className="crm-table ra-table">
        <thead>
          <tr><th rowSpan={2} style={th}>Sr No.</th><th rowSpan={2} style={th}>Particulars</th><th colSpan={3} style={th}>Details of Individual clients</th>
            <th colSpan={3} style={th}>Details of Non-Individual clients</th><th rowSpan={2} style={th}>Total (A+B+C+D+E+F)</th></tr>
          <tr>{['Resident (A)', 'Non-Resident (B)', 'FPI (C)', 'Resident (D)', 'Non-Resident (E)', 'FPI (F)'].map(t => <th key={t} style={th}>{t}</th>)}</tr>
        </thead>
        <tbody>
          {FEE_ROWS.map(row => (
            <tr key={row.key}>
              <td style={{ textAlign: 'center' }}>{row.sr}</td>
              <td style={{ minWidth: '200px', fontSize: '0.8rem' }}>{row.label}</td>
              {row.kind === 'columns'
                ? FEE_COLUMNS.map(c => <td key={c} style={{ minWidth: '90px' }}>{row.calc ? <div style={{ textAlign: 'right', fontWeight: 600 }}>{cells[`${row.key}.${c}`]}</div> : auto(row, `${row.key}.${c}`)}</td>)
                : <td colSpan={6}><div style={{ maxWidth: '360px' }}>{auto(row, row.key)}</div></td>}
              <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {row.kind === 'columns' ? (row.money ? rupees(cells[`${row.key}.total`]) : cells[`${row.key}.total`]) : String(cells[row.key] ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------- 4-11. List sub-blocks ----------------
const TableTab = ({ id, data, draft, setDraft }) => {
  const t = TABLES[id];
  const rows = tableRows(data, draft, id);
  const fromCrm = !Array.isArray(draft[id]);
  const crmRows = data.auto[id] || [];
  const setRows = (next) => setDraft(d => ({ ...d, [id]: next }));
  const setCell = (i, key, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const totalPct = id === 'shareholding' ? rows.filter(hasRow).reduce((s, r) => s + (Number(r.percent) || 0), 0) : null;
  return (
    <>
      <div style={{ margin: '0 20px 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span style={{ flex: 1, minWidth: '200px' }}>{t.title}</span>
        {fromCrm && crmRows.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}><Database size={13} /> Filled from the CRM</span>}
        {!fromCrm && crmRows.length > 0 && (
          <button type="button" className="btn-secondary" style={{ ...btn, height: '30px' }} onClick={() => setDraft(d => { const n = { ...d }; delete n[id]; return n; })}
            title="Replace these rows with the CRM's current values">
            <RotateCcw size={13} /> Use CRM values ({crmRows.length})
          </button>
        )}
        <button type="button" className="btn-secondary" style={{ ...btn, height: '30px' }} onClick={() => setRows([...rows, {}])}><Plus size={13} /> Add row</button>
      </div>
      <div className="table-responsive">
        <table className="crm-table ra-table">
          <thead><tr><th style={{ ...th, width: '44px' }}>SR</th>{t.columns.map(c => <th key={c.key} style={{ ...th, minWidth: c.wide ? '320px' : c.type === 'date' ? '140px' : '150px' }}>{c.label}</th>)}<th style={{ width: '40px' }} /></tr></thead>
          <tbody>
            {rows.map((row, i) => (
              // eslint-disable-next-line react/no-array-index-key -- rows have no ids; the index is their identity
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                {t.columns.map(c => (
                  <td key={c.key}><FieldInput field={{ ...c, key: `${id}-${c.key}` }} value={row[c.key] ?? ''} label={`Row ${i + 1} ${c.label}`}
                    numeric={c.type === 'number'} onChange={v => setCell(i, c.key, v)} /></td>
                ))}
                <td><button type="button" style={iconBtn} title="Delete this row" aria-label={`Delete row ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={t.columns.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No rows yet. Use Add row.</td></tr>}
            {totalPct !== null && rows.length > 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: Math.abs(totalPct - 100) > 0.001 ? 'var(--status-warning)' : undefined }}>
                  {Math.round(totalPct * 100) / 100}%{Math.abs(totalPct - 100) > 0.001 && ' (should be 100%)'}
                </td><td /></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const AUTO_NOTES = {
  general: 'From the CRM: name, SEBI number and logo (Company Profile), PAN (from the GSTIN), addresses (Registered Address and State), contact mobile / email, branches, website, social media and bank Yes / No (from those sub-blocks), research reports (Ready reports in the half), employees (point 38: active users whose Education is Graduate in the User Directory) and UPI. Everything else is typed in; the arrow brings back the CRM\'s value.',
  complaints: 'Type the counts for SCORES and other sources; (d), the ageing total and the Total column are calculated.',
  clientsFees: 'From the Audit Report Blocks -> Client and Fee Details for the same half (including values typed there). (iv) and the totals are calculated; type over any value here.',
  branches: 'From Branch Profiles (address and pincode). Fill in State, City and District.',
  websites: 'From the Company Profile website.',
  banks: 'From the Company Profile bank accounts.',
  upi: 'From the UPI IDs of the Company Profile bank accounts.'
};

export const RaPeriodicReportBlock = () => {
  const { showToast } = useToast();
  const now = useMemo(currentPeriod, []);
  const [fy, setFy] = useState(now.half === 'H1' ? now.fy - 1 : now.fy);
  const [half, setHalf] = useState(now.half === 'H1' ? 'H2' : 'H1'); // the last half that has ended
  const [sub, setSub] = useState('general');
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(normalize({}));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const period = periodKey(fy, half);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loadRaPeriodicReport(period);
      setData(res);
      setDraft(normalize(res.saved));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const dirty = !!data && stable(normalize(data.saved)) !== stable(normalize(draft));
  const setSection = (section, fn) => setDraft(d => ({ ...d, [section]: fn(d[section] || {}) }));

  const save = async () => {
    setSaving(true);
    try {
      const clean = normalize(draft);
      TABLE_IDS.forEach(t => { if (clean[t]) clean[t] = clean[t].filter(hasRow); });
      const res = await saveRaPeriodicReport(period, clean);
      setData(res);
      setDraft(normalize(res.saved));
      showToast('RA Periodic Report saved for this half.', 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const excel = async (ids) => {
    if (dirty && !(await save())) return;
    XLSX.writeFile(buildWorkbook(XLSX, data, draft, ids), fileName(data, ids));
  };

  const copyPrevious = () => {
    const prev = data?.previous;
    if (!prev) return;
    if (!window.confirm(`Copy General Details and the list sub-blocks from ${prev.label}? Complaints and Clients And Fees stay as they are for this half.`)) return;
    const { complaints, clientsFees, ...rest } = normalize(prev.data); // eslint-disable-line no-unused-vars
    setDraft(d => ({ ...normalize(rest), complaints: d.complaints, clientsFees: d.clientsFees }));
    showToast(`Copied from ${prev.label}. Check the values, then Save.`, 'info');
  };

  const years = [];
  for (let y = now.fy; y >= 2020; y -= 1) years.push(y);
  const subName = SUB_BLOCKS.find(([id]) => id === sub)[1];

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <style>{'.ra-table th, .ra-table td { padding-left: 6px !important; padding-right: 6px !important; font-size: 0.8rem; }'}</style>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ScrollText size={18} color="var(--accent)" /> RA Periodic Report Block</h3>
          <p>SEBI Research Analyst half-yearly periodic report in 11 sub-blocks, exported as one Excel workbook.</p>
        </div>
      </div>

      <div className="paid-filters" style={{ flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          Financial Year
          <select value={fy} onChange={e => setFy(Number(e.target.value))} style={{ height: '36px' }}>
            {years.map(y => <option key={y} value={y}>{`${y}-${String((y + 1) % 100).padStart(2, '0')}`}</option>)}
          </select>
        </label>
        <div className="paid-service-tabs" role="tablist" aria-label="Half" style={{ margin: 0 }}>
          {[['H1', 'Half ended 30 Sep'], ['H2', 'Half ended 31 Mar']].map(([id, t]) => (
            <button key={id} type="button" role="tab" aria-selected={half === id} className={`paid-service-tab${half === id ? ' active' : ''}`} onClick={() => setHalf(id)}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {data?.previous && (
          <button className="btn-secondary" onClick={copyPrevious} style={btn} title="Copy the details that rarely change from another saved half">
            <Copy size={14} /> Copy from {data.previous.period}
          </button>
        )}
        <button className="btn-secondary" onClick={load} disabled={loading} style={btn}><RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}</button>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving} style={btn}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button className="btn-primary" disabled={!data} onClick={() => excel(SUB_BLOCKS.map(([id]) => id))} style={btn} title="All 11 sub-blocks, one sheet each">
          <FileSpreadsheet size={14} /> Download Excel
        </button>
      </div>

      {data && (
        <div style={{ margin: '0 20px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Half year ended {dmy(data.to)}</strong> ({dmy(data.from)} to {dmy(data.to)})
          {data.updatedBy && <> · last saved by {data.updatedBy}{data.updatedAt && ` on ${dmy(data.updatedAt)}`}</>}
          {dirty && <span style={{ color: 'var(--status-warning)', marginLeft: '8px' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Unsaved changes</span>}
        </div>
      )}
      {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}

      <div className="paid-service-tabs" role="tablist" aria-label="Sub-block" style={{ margin: '0 20px 12px', flexWrap: 'wrap' }}>
        {SUB_BLOCKS.map(([id, t], i) => (
          <button key={id} type="button" role="tab" aria-selected={sub === id} className={`paid-service-tab${sub === id ? ' active' : ''}`} onClick={() => setSub(id)}>{i + 1}. {t}</button>
        ))}
      </div>

      {data && (
        <>
          <div style={{ margin: '0 20px 10px', display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{AUTO_NOTES[sub] || 'Typed in. Saved for this half.'}</div>
            <button className="btn-secondary" onClick={() => excel([sub])} style={{ ...btn, height: '30px' }}><FileSpreadsheet size={13} /> Download "{subName}"</button>
          </div>
          {sub === 'general' && <GeneralTab data={data} draft={draft} setSection={setSection} />}
          {sub === 'complaints' && <ComplaintsTab draft={draft} setSection={setSection} />}
          {sub === 'clientsFees' && <FeesTab data={data} draft={draft} setSection={setSection} />}
          {TABLE_IDS.includes(sub) && <TableTab key={sub} id={sub} data={data} draft={draft} setDraft={setDraft} />}
        </>
      )}
      {loading && !data && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}
      <div style={{ height: '16px' }} />
    </div>
  );
};

export default RaPeriodicReportBlock;
