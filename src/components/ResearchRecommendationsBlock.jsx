import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { tableSheet, writeReport } from '../lib/reportExcel';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { NotebookPen, Plus, Trash2, Download, Search } from 'lucide-react';
import { confirmAsync } from './ConfirmDialog';

/*
 * Records for Research Recommendations: the register kept in the "Records for Research Recommendations"
 * sheet. Row 1 of the sheet is the company name, row 2 the title, row 3 these ten columns. Records are the
 * `researchRecommendations` collection; only Admins and the Super Admin read or change it, and the server
 * checks every column (_research_recommendation_check in backend/sync.py; limits below match it).
 */
const SHEET_TITLE = 'RECORDS OF RESEARCH RECOMMENDATIONS MADE DURING THE YEAR';

const COLUMNS = [
  { key: 'srNo', label: 'Sr. No', width: 70 },
  { key: 'date', label: 'Date', width: 140 },
  { key: 'nature', label: 'Nature of Recommendation provided', width: 200, max: 200 },
  { key: 'product', label: 'Products/ Securities in which recommendation is provided', width: 230, max: 200 },
  { key: 'strikePrice', label: 'Strike Price/Trigger Price', width: 140, max: 60 },
  { key: 'period', label: 'Period for Buy/ Sell/ Hold', width: 150, max: 100 },
  { key: 'callPutHold', label: 'Call/Put/ Hold', width: 110 },
  { key: 'buyRate', label: 'Buy Rate', width: 110 },
  { key: 'sellRate', label: 'Sell Rate', width: 110 },
  { key: 'rationaleMaintained', label: 'Whether Rationale for Research Recommendation is maintained (Yes/ No)', width: 190 }
];

const CALL_PUT_HOLD = ['Call', 'Put', 'Hold'];
const YES_NO = ['Yes', 'No'];
const NATURE_SUGGESTIONS = ['Intraday', 'BTST / STBT', 'Short Term', 'Positional', 'Swing', 'Medium Term', 'Long Term', 'Investment', 'Hedging'];
const PERIOD_SUGGESTIONS = ['Intraday', '1 Day', '2-3 Days', '1 Week', '2 Weeks', '1 Month', '3 Months', '6 Months', '1 Year'];
const RATE_MAX = 100000000;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Indian financial year (1 April - 31 March) of a YYYY-MM-DD date, e.g. "2026-27"
const fyOf = (dateKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return '';
  const year = Number(dateKey.slice(0, 4));
  const start = Number(dateKey.slice(5, 7)) >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

const showDate = (dateKey) => (/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '') ? dateKey.split('-').reverse().join('-') : '');
const cleanRate = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const cleanWhole = (v) => v.replace(/\D/g, '').slice(0, 6);
const text = (v) => (v === undefined || v === null ? '' : String(v));

const blankForm = (srNo = '') => ({
  srNo: text(srNo), date: todayKey(), nature: '', product: '', strikePrice: '', period: '',
  callPutHold: '', buyRate: '', sellRate: '', rationaleMaintained: 'Yes'
});

const asDraft = (r) => Object.fromEntries(COLUMNS.map(c => [c.key, text(r[c.key])]));

// Same rules as the server, so a mistake is explained here instead of being rejected on sync
const problemWith = (row) => {
  if (row.srNo !== '' && !(Number(row.srNo) >= 1)) return 'Sr. No must be a whole number from 1.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return 'Date is required.';
  if (!row.product.trim()) return 'Products/ Securities is required.';
  for (const c of COLUMNS) {
    if (c.max && row[c.key].trim().length > c.max) return `${c.label} can be at most ${c.max} characters.`;
  }
  for (const [key, label] of [['buyRate', 'Buy Rate'], ['sellRate', 'Sell Rate']]) {
    if (row[key] !== '' && (Number.isNaN(Number(row[key])) || Number(row[key]) > RATE_MAX)) return `${label} must be a number up to 10,00,00,000.`;
  }
  return '';
};

const bySrNoThenDate = (a, b) => {
  const sa = a.srNo === '' || a.srNo === undefined ? Infinity : Number(a.srNo);
  const sb = b.srNo === '' || b.srNo === undefined ? Infinity : Number(b.srNo);
  if (sa !== sb) return sa - sb;
  return (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '');
};

export const ResearchRecommendationsBlock = () => {
  const {
    researchRecommendations = [], addResearchRecommendation, updateResearchRecommendation, deleteResearchRecommendation,
    companyProfile = {}, currentUser
  } = useCRM();
  const { showToast } = useToast();
  const canEdit = ['Super Admin', 'Admin'].includes(currentUser?.role);
  const companyName = (companyProfile.companyName || '').trim();

  const years = useMemo(() => {
    const set = new Set(researchRecommendations.map(r => fyOf(r.date)).filter(Boolean));
    set.add(fyOf(todayKey()));
    return [...set].sort().reverse();
  }, [researchRecommendations]);
  const [year, setYear] = useState(() => fyOf(todayKey()));
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return researchRecommendations
      .filter(r => year === 'all' || fyOf(r.date) === year)
      .filter(r => !q || COLUMNS.some(c => text(c.key === 'date' ? showDate(r.date) : r[c.key]).toLowerCase().includes(q)))
      .sort(bySrNoThenDate);
  }, [researchRecommendations, year, query]);

  // Next Sr. No within the financial year of the given date
  const nextSrNo = (dateKey) => {
    const fy = fyOf(dateKey);
    return researchRecommendations
      .filter(r => fyOf(r.date) === fy)
      .reduce((max, r) => Math.max(max, Number(r.srNo) || 0), 0) + 1;
  };

  const [form, setForm] = useState(() => blankForm());
  const [srNoTouched, setSrNoTouched] = useState(false);
  useEffect(() => {
    if (!srNoTouched) setForm(f => ({ ...f, srNo: String(nextSrNo(f.date)) }));
  }, [researchRecommendations, form.date, srNoTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows being edited: { [id]: draft }, saved when a field loses focus (selects save straight away)
  const [drafts, setDrafts] = useState({});
  useEffect(() => {
    setDrafts(Object.fromEntries(researchRecommendations.map(r => [r.id, asDraft(r)])));
  }, [researchRecommendations]);

  const setFormField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleAdd = (e) => {
    e.preventDefault();
    const problem = problemWith(form);
    if (problem) { showToast(problem, 'error'); return; }
    addResearchRecommendation(form);
    showToast(`Recommendation${form.srNo ? ` Sr. No ${form.srNo}` : ''} for ${form.product.trim()} added.`, 'success');
    if (fyOf(form.date) !== year && year !== 'all') setYear(fyOf(form.date));
    setSrNoTouched(false);
    setForm(f => ({ ...blankForm(), date: f.date }));
  };

  const saveRow = (record, override = null) => {
    const draft = { ...(drafts[record.id] || asDraft(record)), ...(override || {}) };
    const before = asDraft(record);
    if (COLUMNS.every(c => draft[c.key].trim() === before[c.key].trim())) return;
    const problem = problemWith(draft);
    if (problem) {
      showToast(problem, 'error');
      setDrafts(d => ({ ...d, [record.id]: before }));
      return;
    }
    updateResearchRecommendation(record.id, draft);
    showToast('Recommendation saved.', 'success');
  };

  const handleDelete = async (record) => {
    const name = `${record.srNo ? `Sr. No ${record.srNo} - ` : ''}${record.product || 'this recommendation'}`;
    if (!await confirmAsync(`Delete the recommendation "${name}" dated ${showDate(record.date)}? This cannot be undone.`, { danger: true, confirmLabel: 'Delete' })) return;
    deleteResearchRecommendation(record.id);
    showToast('Recommendation deleted.', 'info');
  };

  // The same layout as the reference sheet: company name, title, the ten column headings, then the rows
  const exportExcel = () => {
    const title = year === 'all' ? SHEET_TITLE : `${SHEET_TITLE} ${year}`;
    const sheet = tableSheet({
      title: companyName || 'Company Name',
      subtitle: title,
      header: COLUMNS.map(c => c.label),
      cols: [8, 12, 24, 30, 16, 16, 12, 12, 12, 30],
      rows: rows.map((r, i) => [
        r.srNo === '' || r.srNo === undefined ? i + 1 : Number(r.srNo),
        showDate(r.date), r.nature || '', r.product || '', r.strikePrice || '', r.period || '', r.callPutHold || '',
        r.buyRate === '' || r.buyRate === undefined ? '' : Number(r.buyRate),
        r.sellRate === '' || r.sellRate === undefined ? '' : Number(r.sellRate),
        r.rationaleMaintained || ''
      ])
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    writeReport(wb, `Records for Research Recommendations${year === 'all' ? '' : ` FY ${year}`}.xlsx`);
  };

  const field = { padding: '7px 10px', fontSize: '0.82rem', boxSizing: 'border-box', width: '100%' };

  // One input per column; used by the add form and by every row of the table
  const renderInput = (key, value, onChange, { onCommit, id, label } = {}) => {
    const common = { id, 'aria-label': label, className: 'form-control', style: field };
    const blurSave = onCommit ? { onBlur: () => onCommit(), onKeyDown: e => e.key === 'Enter' && e.currentTarget.blur() } : {};
    const col = COLUMNS.find(c => c.key === key);
    switch (key) {
      case 'srNo':
        return <input {...common} {...blurSave} inputMode="numeric" value={value} onChange={e => onChange(cleanWhole(e.target.value))} placeholder="Auto" style={{ ...field, textAlign: 'center' }} />;
      case 'date':
        return <input {...common} {...blurSave} type="date" value={value} onChange={e => onChange(e.target.value)} required />;
      case 'buyRate':
      case 'sellRate':
        return <input {...common} {...blurSave} inputMode="decimal" value={value} onChange={e => onChange(cleanRate(e.target.value))} placeholder="0.00" style={{ ...field, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />;
      case 'callPutHold':
      case 'rationaleMaintained': {
        const options = key === 'callPutHold' ? CALL_PUT_HOLD : YES_NO;
        return (
          <select {...common} value={value} onChange={e => { onChange(e.target.value); if (onCommit) onCommit({ [key]: e.target.value }); }}>
            <option value="">Select</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      default:
        return (
          <input {...common} {...blurSave} value={value} maxLength={col.max} onChange={e => onChange(e.target.value)}
            list={key === 'nature' ? 'rr-nature-options' : key === 'period' ? 'rr-period-options' : undefined}
            placeholder={key === 'product' ? 'e.g. RELIANCE / NIFTY 24500 CE' : key === 'strikePrice' ? 'e.g. 2450 / SL 2410' : ''}
            required={key === 'product'} />
        );
    }
  };

  const fyLabel = year === 'all' ? 'All years' : `FY ${year} (1 Apr ${year.slice(0, 4)} - 31 Mar ${Number(year.slice(0, 4)) + 1})`;

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <datalist id="rr-nature-options">{NATURE_SUGGESTIONS.map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="rr-period-options">{PERIOD_SUGGESTIONS.map(o => <option key={o} value={o} />)}</datalist>

      <div className="directory-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotebookPen size={18} color="var(--accent)" /> Records for Research Recommendations
          </h3>
          <p>
            {canEdit
              ? 'Every research recommendation made during the year, column for column as in the register. Add a row below; edit any cell in the table and it saves when you leave it.'
              : 'Every research recommendation made during the year. Only Admins and the Super Admin can change them.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" aria-label="Financial year" value={year} onChange={e => setYear(e.target.value)} style={{ ...field, width: 'auto' }}>
            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
            <option value="all">All years</option>
          </select>
          <button type="button" className="btn-secondary" onClick={exportExcel} disabled={rows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Export to Excel
          </button>
        </div>
      </div>

      {/* Rows 1-2 of the register */}
      <div style={{ margin: '0 20px 16px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', textAlign: 'center', padding: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {companyName || <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Company name not set (Company Profile)</span>}
        </div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.02em', marginTop: '4px' }}>
          {SHEET_TITLE} <span style={{ color: 'var(--accent)' }}>{fyLabel}</span>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' }}>
            {COLUMNS.map(c => (
              <div className="form-group" key={c.key} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label htmlFor={`rr-new-${c.key}`} style={{ fontSize: '0.75rem' }}>
                  {c.label}{c.key === 'date' || c.key === 'product' ? ' *' : ''}
                </label>
                {renderInput(c.key, form[c.key], v => {
                  if (c.key === 'srNo') setSrNoTouched(v !== '');
                  setFormField(c.key, v);
                }, { id: `rr-new-${c.key}` })}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> Add Recommendation
            </button>
          </div>
        </form>
      )}

      <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="search" className="form-control" aria-label="Search recommendations" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search any column" style={{ ...field, paddingLeft: '30px' }} />
        </div>
        <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="table-responsive">
        <table className="crm-table" style={{ minWidth: `${COLUMNS.reduce((s, c) => s + c.width, 0) + (canEdit ? 100 : 0)}px` }}>
          <thead>
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ width: `${c.width}px`, whiteSpace: 'normal', lineHeight: 1.3, verticalAlign: 'bottom' }}>{c.label}</th>
              ))}
              {canEdit && <th style={{ width: '100px' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + (canEdit ? 1 : 0)} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  {query ? 'No recommendations match the search.' : `No recommendations recorded for ${year === 'all' ? 'any year' : `FY ${year}`} yet.`}
                </td>
              </tr>
            ) : rows.map((r, i) => {
              const draft = drafts[r.id] || asDraft(r);
              return (
                <tr key={r.id}>
                  {COLUMNS.map(c => (
                    <td key={c.key}>
                      {canEdit
                        ? renderInput(c.key, draft[c.key],
                          v => setDrafts(d => ({ ...d, [r.id]: { ...(d[r.id] || asDraft(r)), [c.key]: v } })),
                          { onCommit: override => saveRow(r, override), label: `${c.label}, row ${i + 1}` })
                        : <ReadCell column={c.key} record={r} index={i} />}
                    </td>
                  ))}
                  {canEdit && (
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => handleDelete(r)} title="Delete this recommendation"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--status-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReadCell = ({ column, record, index }) => {
  const value = record[column];
  if (column === 'srNo') return <span>{value === '' || value === undefined ? index + 1 : value}</span>;
  if (column === 'date') return <span>{showDate(value)}</span>;
  if (column === 'buyRate' || column === 'sellRate') {
    return (
      <span style={{ display: 'block', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value === '' || value === undefined ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    );
  }
  return <span>{value || '—'}</span>;
};
