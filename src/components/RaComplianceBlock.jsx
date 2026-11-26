import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { reportSheet, writeReport } from '../lib/reportExcel';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { loadComplianceMonth, loadComplianceMonths, loadCrmClients, loadRecoFromReports, saveComplianceSheet } from '../services/raComplianceService';
import {
  SHEETS, SHEET_BY_KEY, SUB_BLOCKS, DETAIL_FIELDS, COMPLIANT, NON_COMPLIANT, PENDING, NA,
  blank, newId, fmtDate, monthLabel, currentMonth, shiftMonth, buildContext, displayRows, rowStatus,
  summarize, cellText, recoLabel, carryRows, mergeAuto
} from '../lib/raCompliance';
import {
  ShieldCheck, Save, RefreshCw, FileSpreadsheet, Plus, Trash2, ChevronLeft, ChevronRight, Loader2,
  AlertTriangle, Copy, Eye, EyeOff
} from 'lucide-react';
import { confirmAsync } from './ConfirmDialog';

// RA Monthly Compliance Tracker (backend/ra_compliance.py; sheets and status rules in src/lib/raCompliance.js).
// The Dashboard plus 17 input sheets from the client's workbook. Everything typed is kept per month;
// "Save" stores the changed sheets.

const STATUS_STYLE = {
  [COMPLIANT]: ['var(--status-success)', 'var(--status-success-bg)', 'var(--status-success-border)'],
  [NON_COMPLIANT]: ['var(--status-danger)', 'var(--status-danger-bg)', 'var(--status-danger-border)'],
  [PENDING]: ['var(--status-warning)', 'var(--status-warning-bg)', 'var(--status-warning-border)'],
  'Action needed': ['var(--status-danger)', 'var(--status-danger-bg)', 'var(--status-danger-border)'],
  'In progress': ['var(--status-warning)', 'var(--status-warning-bg)', 'var(--status-warning-border)']
};

const StatusPill = ({ status }) => {
  if (!status) return null;
  const [color, bg, border] = STATUS_STYLE[status] || ['var(--text-muted)', 'transparent', 'var(--border-color)'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', color, background: bg, border: `1px solid ${border}` }}>
      {status}
    </span>
  );
};

const pct = (v) => (v === null ? '-' : `${Math.round(v * 100)}%`);
const sameJson = (a, b) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

const inputBase = { width: '100%', height: '30px', fontSize: '0.8rem', boxSizing: 'border-box', padding: '0 6px' };
const ynTint = (v) => (v === 'Yes' ? 'var(--status-success-bg)' : v === 'No' ? 'var(--status-danger-bg)' : undefined);
const autoCell = { background: 'var(--bg-tertiary, rgba(127,127,127,0.08))', color: 'var(--text-secondary)', fontSize: '0.8rem' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', lineHeight: 1 };
const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px' };

const OPTIONS = { yn: ['Yes', 'No'], ynna: ['Yes', 'No', 'NA'] };

/** Where a line that fills itself in comes from (shown on its "Auto" mark), or '' for a line typed in. */
const autoSource = (row) => (row.reportId ? 'Filled in from the Research Reports block'
  : row.crm ? `Filled in from the CRM (${row.crm === 'renewed' ? 'Old Client renewal' : 'e-signed this month'})`
    : row.profile ? 'Filled in from the Company Profile' : '');

/** One editable cell. */
const CellInput = ({ col, row, ctx, fixed, onChange }) => {
  const v = row[col.key] ?? '';
  const label = col.label;
  if (col.type === 'auto') {
    const text = col.value(row, ctx);
    const bad = text === 'No' || text === 'Not in register' || text === 'Not updated' || String(text).startsWith('No -');
    return <div style={{ ...autoCell, padding: '6px', borderRadius: '4px', minHeight: '18px', color: bad ? 'var(--status-danger)' : autoCell.color }}>{String(text)}</div>;
  }
  if (col.type === 'yn' || col.type === 'ynna' || col.type === 'select') {
    const opts = col.options || OPTIONS[col.type];
    return (
      <select aria-label={label} value={v} onChange={e => onChange(e.target.value)}
        style={{ ...inputBase, background: col.type === 'select' ? undefined : ynTint(v) }}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
        {v && !opts.includes(v) && <option value={v}>{v}</option>}
      </select>
    );
  }
  if (col.type === 'reco') {
    return (
      <select aria-label={label} value={v} onChange={e => onChange(e.target.value)} style={inputBase}>
        <option value="">— pick a call —</option>
        {ctx.recos.map(r => <option key={r.id} value={r.id}>{recoLabel(r.id, ctx) || `#${ctx.recoNo[r.id]}`}</option>)}
        {v && !ctx.recoById[v] && <option value={v}>Not in register</option>}
      </select>
    );
  }
  const problem = col.check ? col.check(v) : '';
  const placeholder = typeof col.placeholder === 'function' ? col.placeholder(row, ctx, fixed) : (col.placeholder || '');
  return (
    <input
      aria-label={label}
      type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
      value={v}
      maxLength={col.maxLength || 2000}
      placeholder={placeholder}
      title={problem || undefined}
      onChange={e => {
        const raw = e.target.value;
        if (col.type === 'number') onChange(raw === '' ? '' : Number(raw));
        else onChange(col.upper ? raw.toUpperCase() : raw);
      }}
      style={{ ...inputBase, borderColor: problem ? 'var(--status-danger)' : undefined }}
    />
  );
};

/** One table: a section of a sheet. */
const SectionTable = ({ sheet, section, rows, ctx, showExample, onRowChange, onDelete, onAdd, readOnly }) => {
  const list = section.kind === 'list';
  const items = displayRows(section, rows, ctx);
  const hasStatus = !sheet.noStatus;
  const lead = [
    ...(section.labelColumn ? [section.labelColumn] : []),
    ...(section.infoColumns || [])
  ];
  const colCount = 1 + lead.length + section.columns.length + (hasStatus ? 1 : 0) + (list ? 1 : 0);

  return (
    <div style={{ marginBottom: '18px' }}>
      {section.title && <h4 style={{ margin: '4px 20px 8px', fontSize: '0.9rem' }}>{section.title}</h4>}
      <div className="table-responsive">
        <table className="crm-table ra-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>Sr. No</th>
              {lead.map(c => <th key={c.key} style={{ minWidth: c.width || 160 }}>{c.label}</th>)}
              {section.columns.map(c => (
                <th key={c.key} title={c.hint} style={{ minWidth: c.width || (c.type === 'yn' || c.type === 'ynna' ? 92 : c.type === 'date' ? 130 : 120) }}>{c.label}</th>
              ))}
              {hasStatus && <th style={{ minWidth: 110 }}>Status</th>}
              {list && <th style={{ width: '40px' }} />}
            </tr>
          </thead>
          <tbody>
            {showExample && section.example && (
              <tr style={{ fontStyle: 'italic', color: 'var(--accent-primary, #6366f1)', opacity: 0.85 }}>
                <td>Ex.</td>
                {lead.map(c => <td key={c.key} />)}
                {section.columns.map(c => {
                  const ex = section.example[c.key];
                  return <td key={c.key} style={{ fontSize: '0.78rem' }}>{c.type === 'date' ? fmtDate(ex) : (ex ?? '')}</td>;
                })}
                {hasStatus && <td><StatusPill status={section.status(section.example, { ...ctx, reportOnFile: () => true, recoById: { [section.example.recoId]: {} } })} /></td>}
                {list && <td />}
              </tr>
            )}
            {items.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ textAlign: 'center', padding: '22px', color: 'var(--text-muted)' }}>
                  {section.kind === 'client' ? 'No clients yet. Add them in the Client Register; they appear here automatically.' : 'Nothing entered yet. Use "Add row" to start.'}
                </td>
              </tr>
            )}
            {items.map(({ row, fixed }, i) => {
              const st = hasStatus ? rowStatus(section, row, ctx, fixed) : '';
              return (
                <tr key={row.id}>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {i + 1}
                    {autoSource(row) && <div title={autoSource(row)} style={{ fontSize: '0.66rem', color: 'var(--accent-primary, var(--accent))', fontWeight: 600 }}>Auto</div>}
                  </td>
                  {section.labelColumn && (
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {fixed?.renamable && !readOnly ? (
                        <input type="text" aria-label="Policy name" value={row.label || ''} placeholder="Other (specify)" title="Type the name of the policy" maxLength={200} style={{ ...inputBase, fontWeight: 500 }}
                          onChange={e => onRowChange(row.id, 'label', e.target.value)} />
                      ) : (row.label || fixed?.label)}
                    </td>
                  )}
                  {(section.infoColumns || []).map(c => <td key={c.key} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{fixed?.[c.key]}</td>)}
                  {section.columns.map(c => (
                    <td key={c.key}>
                      {readOnly && c.type !== 'auto'
                        ? <span style={{ fontSize: '0.8rem' }}>{String(cellText(c, row, ctx, fixed) ?? '')}</span>
                        : <CellInput col={c} row={row} ctx={ctx} fixed={fixed} onChange={val => onRowChange(row.id, c.key, val)} />}
                    </td>
                  ))}
                  {hasStatus && <td>{st === NA ? <StatusPill status="NA" /> : <StatusPill status={st} />}</td>}
                  {list && (
                    <td>
                      {!readOnly && !autoSource(row) && <button type="button" style={iconBtn} title="Delete row" aria-label="Delete row" onClick={() => onDelete(row.id)}><Trash2 size={14} /></button>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list && !readOnly && (
        <div style={{ padding: '8px 20px 0' }}>
          <button type="button" className="btn-secondary" style={btn} onClick={onAdd}><Plus size={14} /> Add row</button>
        </div>
      )}
    </div>
  );
};

// ─── Excel export ─────────────────────────────────────────────────────────────

const exportExcel = (month, ctx, details, profile, summary) => {
  const wb = XLSX.utils.book_new();
  const detail = (f) => details[f.key] || (f.profile ? profile?.[f.profile] : '') || '';
  const d = reportSheet()
    .title('RESEARCH ANALYST - MONTHLY COMPLIANCE CHECKLIST')
    .subtitle('Based on the SEBI (Research Analysts) Regulations, 2014 and circulars issued under them. Self-check aid; confirm against the latest SEBI circulars.')
    .blank()
    .kv('Compliance month', monthLabel(month));
  DETAIL_FIELDS.forEach(f => d.kv(f.label, f.type === 'date' ? fmtDate(detail(f)) : detail(f)));
  d.blank()
    .header(['#', 'Compliance area', 'Tab', 'Items checked', 'Compliant', 'Non-compliant', 'Pending', 'Compliance %', 'Overall status'])
    .rows(summary.lines.map((l, i) => [i + 1, l.area, l.tab, l.items, l.ok, l.nc, l.pending, l.pct === null ? '-' : l.pct, l.overall]))
    .total(['', 'OVERALL', '', summary.total.items, summary.total.ok, summary.total.nc, summary.total.pending, summary.total.pct === null ? '-' : summary.total.pct, summary.total.overall]);
  const ds = d.build({ cols: [34, 52, 24, 13, 11, 14, 10, 13, 16] });
  // percentages as %
  for (let r = 0; r < d.row; r += 1) {
    const cell = ds[XLSX.utils.encode_cell({ r, c: 7 })];
    if (cell && typeof cell.v === 'number') cell.z = '0%';
  }
  XLSX.utils.book_append_sheet(wb, ds, 'Dashboard');

  SHEETS.forEach(sheet => {
    const b = reportSheet().title(`${sheet.no}. ${sheet.title.toUpperCase()}`).subtitle(`Month: ${monthLabel(month)}`);
    let widths = [];
    sheet.sections.forEach(section => {
      if (sheet.sections.length > 1) b.blank().section(section.title);
      const lead = [...(section.labelColumn ? [section.labelColumn] : []), ...(section.infoColumns || [])];
      const header = ['Sr. No', ...lead.map(c => c.label), ...section.columns.map(c => c.label), ...(sheet.noStatus ? [] : ['Status'])];
      b.header(header);
      widths = header.map((h, i) => Math.max(widths[i] || 8, Math.min(40, String(h).length + 2)));
      displayRows(section, ctx.rowsOf(sheet.key, section.key), ctx).forEach(({ row, fixed }, i) => {
        b.body([
          i + 1,
          ...lead.map(c => (c.key === 'label' ? (row.label || fixed?.label || '') : fixed?.[c.key] ?? '')),
          ...section.columns.map(c => cellText(c, row, ctx, fixed)),
          ...(sheet.noStatus ? [] : [rowStatus(section, row, ctx, fixed)])
        ]);
      });
    });
    const ws = b.build({ cols: widths.map(w => Math.max(w, 12)) });
    XLSX.utils.book_append_sheet(wb, ws, `${sheet.no}. ${sheet.short}`.slice(0, 31));
  });
  writeReport(wb, `RA Monthly Compliance Tracker ${month}.xlsx`);
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = ({ month, details, profile, onDetail, summary, clientCount, onOpen, readOnly }) => {
  const t = summary.total;
  const tiles = [
    ['Overall compliance', pct(t.pct), t.overall],
    ['Items checked', t.items],
    ['Compliant', t.ok],
    ['Non-compliant', t.nc],
    ['Pending', t.pending],
    ['Clients in register', clientCount]
  ];
  return (
    <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {tiles.map(([label, value, status]) => (
          <div key={label} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2px', color: label === 'Compliant' && value ? 'var(--status-success)' : label === 'Non-compliant' && value ? 'var(--status-danger)' : undefined }}>{value}</div>
            {status && <div style={{ marginTop: '4px' }}><StatusPill status={status === 'No data' ? '' : status} /></div>}
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem' }}>Details for {monthLabel(month)}</h4>
        <div className="form-grid">
          {DETAIL_FIELDS.map(f => (
            <div className="form-group" key={f.key}>
              <label htmlFor={`ra-${f.key}`}>{f.label}</label>
              <input id={`ra-${f.key}`} type={f.type === 'date' ? 'date' : 'text'} value={details[f.key] || ''} disabled={readOnly}
                placeholder={f.profile && profile?.[f.profile] ? `${profile[f.profile]} (from Company Profile)` : ''}
                onChange={e => onDetail(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>Monthly summary</h4>
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>#</th><th>Compliance area</th><th>Tab</th><th>Items checked</th><th>Compliant</th>
                <th>Non-compliant</th><th>Pending</th><th>Compliance %</th><th>Overall status</th>
              </tr>
            </thead>
            <tbody>
              {summary.lines.map((l, i) => (
                <tr key={`${l.sheet}.${l.section}`} style={{ cursor: 'pointer' }} onClick={() => onOpen(l.sheet)} title="Open this sheet">
                  <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{l.area}</td>
                  <td style={{ color: 'var(--accent-primary, var(--accent))', whiteSpace: 'nowrap' }}>{l.tab}</td>
                  <td>{l.items}</td>
                  <td style={{ color: l.ok ? 'var(--status-success)' : undefined }}>{l.ok}</td>
                  <td style={{ color: l.nc ? 'var(--status-danger)' : undefined }}>{l.nc}</td>
                  <td style={{ color: l.pending ? 'var(--status-warning)' : undefined }}>{l.pending}</td>
                  <td>{pct(l.pct)}</td>
                  <td>{l.overall === 'No data' ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No data</span> : <StatusPill status={l.overall} />}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td /><td>OVERALL</td><td /><td>{t.items}</td><td>{t.ok}</td><td>{t.nc}</td><td>{t.pending}</td><td>{pct(t.pct)}</td>
                <td>{t.overall === 'No data' ? 'No data' : <StatusPill status={t.overall} />}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-primary)' }}>How to use:</strong> pick the month, then go sheet by sheet and fill in the white cells;
        grey cells work themselves out. Every row ends in a Status: Compliant, or Non-compliant when anything in it is missing or No.
        The Client Register fills itself from the CRM (this month's e-signed clients and Old Client renewals), and MITC, KYC, Invoices
        and Client Documents pick every client up automatically; lines marked "Auto" can still be changed. Research Reports link to a call in the Reco Register.
        Italic "Ex." rows show the expected format and are not counted. Save stores the changed sheets for this month.
        Based on the SEBI (Research Analysts) Regulations, 2014; a self-check aid — confirm requirements against the latest SEBI circulars.
      </div>
    </div>
  );
};

// ─── The block ────────────────────────────────────────────────────────────────

export const RaComplianceBlock = () => {
  const { companyProfile } = useCRM();
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth);
  const [server, setServer] = useState({});   // sheet -> {data, updatedBy, updatedAt}
  const [drafts, setDrafts] = useState({});   // sheet -> data being edited
  const [active, setActive] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showExample, setShowExample] = useState(true);
  const loadedMonth = useRef(null);
  // Reco Register lines built from the Research Reports block for this month; not stored, refreshed on every load
  const [recoAuto, setRecoAuto] = useState([]);
  // Client Register lines built from the CRM for this month (new e-signs, Old Client renewals); not stored either
  const [clientAuto, setClientAuto] = useState([]);
  // UPI and Bank lines from the Company Profile's bank accounts (account holder = company name)
  const bankAuto = useMemo(() => (Array.isArray(companyProfile?.bankAccounts) ? companyProfile.bankAccounts : [])
    .filter(a => a && (a.bankName || a.accountNumber))
    .map((a, i) => ({
      id: `bank-${a.id || i + 1}`,
      profile: true,
      bankName: a.bankName || '',
      holder: companyProfile?.companyName || '',
      last4: String(a.accountNumber || '').replace(/\D/g, '').slice(-4),
      type: ['Current', 'Savings'].includes(a.accountType) ? a.accountType : (a.accountType ? 'Other' : ''),
      upiId: a.upiId || '',
      upiEnabled: 'Yes',
      remarks: '-'
    })), [companyProfile]);

  const dataOf = useCallback((sheet) => drafts[sheet] ?? server[sheet]?.data ?? {}, [drafts, server]);
  const rowsOf = useCallback((sheet, section = 'rows') => {
    const rows = Array.isArray(dataOf(sheet)[section]) ? dataOf(sheet)[section] : [];
    if (sheet === 'clientRegister' && section === 'rows') {
      // A client typed in (or brought in by the old "Add CRM clients") who is now an Auto line is not listed twice
      const pans = new Set(clientAuto.map(r => r.pan).filter(Boolean));
      return mergeAuto(clientAuto, rows, r => !blank(r.pan) && pans.has(String(r.pan).toUpperCase()));
    }
    if (sheet === 'upiBank' && section === 'rows') {
      const accounts = new Set(bankAuto.map(r => `${r.bankName}|${r.last4}`));
      return mergeAuto(bankAuto, rows, r => accounts.has(`${r.bankName}|${r.last4}`));
    }
    if (sheet !== 'recoRegister' || section !== 'rows' || !recoAuto.length) return rows;
    // Auto lines first (oldest call first); a value the user changed on one is stored under the same id and wins
    const stored = Object.fromEntries(rows.map(r => [r.id, r]));
    const autoIds = new Set(recoAuto.map(r => r.id));
    return [...recoAuto.map(r => ({ ...r, ...stored[r.id], reportId: r.reportId })), ...rows.filter(r => !autoIds.has(r.id))];
  }, [dataOf, recoAuto, clientAuto, bankAuto]);
  const ctx = useMemo(() => buildContext(month, rowsOf), [month, rowsOf]);
  const summary = useMemo(() => summarize(ctx), [ctx]);
  const dirtySheets = Object.keys(drafts).filter(k => !sameJson(drafts[k], server[k]?.data ?? {}));
  const dirty = dirtySheets.length > 0;

  const load = useCallback(async (m) => {
    setLoading(true);
    setError('');
    try {
      const [res, auto, clients] = await Promise.all([
        loadComplianceMonth(m),
        loadRecoFromReports(m).catch(() => ({ rows: [] })),
        loadCrmClients(m).catch(err => ({ rows: [], error: err.message }))
      ]);
      setRecoAuto(Array.isArray(auto.rows) ? auto.rows : []);
      setClientAuto(Array.isArray(clients.rows) ? clients.rows : []);
      if (clients.error) setError(`Could not load this month's clients from the CRM: ${clients.error}`);
      setServer(res.sheets || {});
      setDrafts({});
      loadedMonth.current = m;
    } catch (err) {
      setError(err.message);
      setRecoAuto([]);
      setClientAuto([]);
      setServer({});
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const changeMonth = async (m) => {
    if (!m || m === month) return;
    if (dirty && !await confirmAsync(`You have unsaved changes for ${monthLabel(month)}. Leave them?`, { danger: true, confirmLabel: 'Leave without saving' })) return;
    setMonth(m);
  };

  // ── editing ──
  const setSheetData = (sheet, updater) => setDrafts(prev => {
    const current = prev[sheet] ?? server[sheet]?.data ?? {};
    return { ...prev, [sheet]: updater(current) };
  });

  const setRows = (sheet, section, updater) => setSheetData(sheet, d => ({ ...d, [section]: updater(Array.isArray(d[section]) ? d[section] : []) }));

  const changeCell = (sheet, section, id, key, value) => setRows(sheet, section, rows => {
    const exists = rows.some(r => r.id === id);
    const next = exists ? rows.map(r => (r.id === id ? { ...r, [key]: value } : r)) : [...rows, { id, [key]: value }];
    return next;
  });

  const addRow = (sheet, section) => setRows(sheet, section, rows => [...rows, { id: newId() }]);

  const LINKED = ['mitc', 'kyc', 'invoices', 'clientDocuments'];
  const deleteRow = async (sheet, section, id) => {
    if (sheet === 'clientRegister') {
      const linked = LINKED.some(s => rowsOf(s).some(r => r.id === id && Object.keys(r).length > 1));
      if (linked && !await confirmAsync('Delete this client? Their MITC, KYC, Invoice and Client Documents lines go too.', { danger: true, confirmLabel: 'Delete' })) return;
      LINKED.forEach(s => { if (rowsOf(s).some(r => r.id === id)) setRows(s, 'rows', rows => rows.filter(r => r.id !== id)); });
    } else if (sheet === 'recoRegister' && rowsOf('researchReports').some(r => r.recoId === id)
      && !await confirmAsync('A research report is linked to this call; it will show "Not in register". Delete anyway?', { danger: true, confirmLabel: 'Delete anyway' })) {
      return;
    }
    setRows(sheet, section, rows => rows.filter(r => r.id !== id));
  };

  // ── saving ──
  const tidy = (sheet, data) => {
    const def = SHEET_BY_KEY[sheet];
    if (!def) return data; // details
    const out = {};
    def.sections.forEach(section => {
      let rows = Array.isArray(data[section.key]) ? data[section.key] : [];
      if (section.kind === 'client') rows = rows.filter(r => ctx.clientById[r.id]);
      if (section.kind === 'fixed') {
        const ids = new Set(section.fixedRows.map(f => f.id));
        rows = rows.filter(r => ids.has(r.id));
      }
      out[section.key] = rows.map(r => Object.fromEntries(Object.entries(r).filter(([, v]) => !blank(v))))
        .filter(r => section.kind === 'list' || Object.keys(r).length > 1);
    });
    return out;
  };

  const save = async () => {
    if (!dirty) return true;
    setSaving(true);
    const saved = {};
    try {
      for (const sheet of dirtySheets) {
        const res = await saveComplianceSheet(month, sheet, tidy(sheet, drafts[sheet]));
        saved[sheet] = { data: res.data, updatedBy: res.updatedBy, updatedAt: res.updatedAt };
      }
      showToast(`Saved ${dirtySheets.length} sheet${dirtySheets.length === 1 ? '' : 's'} for ${monthLabel(month)}.`, 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      if (Object.keys(saved).length) {
        setServer(prev => ({ ...prev, ...saved }));
        setDrafts(prev => {
          const next = { ...prev };
          Object.keys(saved).forEach(k => delete next[k]);
          return next;
        });
      }
      setSaving(false);
    }
  };

  // ── copying ──
  const copyFromEarlier = async (sheet) => {
    try {
      const { months } = await loadComplianceMonths();
      const from = Object.keys(months).find(m => m < month && months[m].includes(sheet));
      if (!from) {
        showToast('No earlier month has this sheet filled in.', 'info');
        return;
      }
      const res = await loadComplianceMonth(from);
      const carried = carryRows(sheet, res.sheets?.[sheet]?.data?.rows);
      if (!carried.length) {
        showToast(`Nothing to copy from ${monthLabel(from)}.`, 'info');
        return;
      }
      if (!await confirmAsync(`Copy ${carried.length} line(s) from ${monthLabel(from)}? Only names / accounts are copied; the checks are left for this month.`, { confirmLabel: 'Copy lines' })) return;
      const def = SHEET_BY_KEY[sheet];
      setRows(sheet, 'rows', rows => {
        if (def.kind === 'fixed') {
          const byId = Object.fromEntries(rows.map(r => [r.id, r]));
          carried.forEach(c => { byId[c.id] = { ...c, ...byId[c.id] }; });
          return Object.values(byId);
        }
        return [...rows, ...carried];
      });
      showToast(`Copied from ${monthLabel(from)}. Review and Save.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const downloadExcel = () => exportExcel(month, ctx, dataOf('details').fields || {}, companyProfile, summary);

  // ── render ──
  const lineStatus = (key) => {
    const lines = summary.lines.filter(l => l.sheet === key);
    if (!lines.length) return null;
    if (lines.some(l => l.nc)) return 'var(--status-danger)';
    if (lines.some(l => l.pending)) return 'var(--status-warning)';
    if (lines.some(l => l.ok)) return 'var(--status-success)';
    return null;
  };

  const sheet = SHEET_BY_KEY[active];
  const lastSaved = sheet ? server[active] : server.details;
  const details = dataOf('details').fields || {};

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <style>{'.ra-table th { font-size: 0.72rem; line-height: 1.25; white-space: normal; vertical-align: bottom; } .ra-table th, .ra-table td { padding: 6px !important; } .ra-table td { vertical-align: middle; }'}</style>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} color="var(--accent)" /> RA Monthly Compliance Tracker</h3>
          <p>SEBI Research Analyst monthly compliance checklist: the Dashboard and 17 input sheets, kept month by month.</p>
        </div>
      </div>

      <div className="paid-filters" style={{ flexWrap: 'wrap', alignItems: 'center', gap: '10px', margin: '0 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" className="btn-secondary" style={{ ...btn, padding: '0 8px' }} aria-label="Previous month" onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
          <input type="month" aria-label="Compliance month" value={month} onChange={e => e.target.value && changeMonth(e.target.value)} style={{ height: '34px', width: '170px', padding: '0 10px' }} />
          <button type="button" className="btn-secondary" style={{ ...btn, padding: '0 8px' }} aria-label="Next month" onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
        </div>
        <strong style={{ fontSize: '0.95rem', whiteSpace: 'nowrap', marginLeft: '4px' }}>{monthLabel(month)}</strong>
        <div style={{ flex: '1 1 0', minWidth: 0 }} />
        <button type="button" className="btn-secondary" style={btn} disabled={loading} onClick={async () => (!dirty || await confirmAsync('Discard unsaved changes and reload?', { danger: true, confirmLabel: 'Discard & reload' })) && load(month)}>
          <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button type="button" className="btn-primary" style={btn} disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save{dirty ? ` (${dirtySheets.length})` : ''}
        </button>
        <button type="button" className="btn-secondary" style={btn} onClick={downloadExcel} title="Dashboard and all 17 sheets for this month">
          <FileSpreadsheet size={14} /> Download Excel
        </button>
      </div>

      {(dirty || error || lastSaved?.updatedBy) && (
        <div style={{ margin: '0 20px 10px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {lastSaved?.updatedBy && <span>This sheet last saved by {lastSaved.updatedBy} on {fmtDate(lastSaved.updatedAt)}</span>}
          {dirty && (
            <span style={{ color: 'var(--status-warning)' }}>
              <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Unsaved: {dirtySheets.map(k => SHEET_BY_KEY[k]?.short || 'Dashboard details').join(', ')}
            </span>
          )}
          {error && <span style={{ color: 'var(--status-danger)' }}>{error}</span>}
        </div>
      )}

      <div role="tablist" aria-label="Compliance sub-blocks" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 20px 18px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        {SUB_BLOCKS.map((b, i) => {
          const on = active === b.key;
          const dot = b.key === 'dashboard' ? null : lineStatus(b.key);
          return (
            <button key={b.key} type="button" role="tab" aria-selected={on} onClick={() => setActive(b.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', fontSize: '0.78rem', lineHeight: 1.2, whiteSpace: 'nowrap', flex: '0 0 auto',
                fontWeight: on ? 600 : 500, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent-border, var(--accent))' : 'var(--border-color)'}`,
                background: on ? 'var(--accent-soft, rgba(99,102,241,0.12))' : 'transparent',
                color: on ? 'var(--accent-primary, var(--text-primary))' : 'var(--text-secondary)'
              }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{i + 1}</span>
              {b.short}
              {dot && <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot }} />}
              {(drafts[b.key === 'dashboard' ? 'details' : b.key] && dirtySheets.includes(b.key === 'dashboard' ? 'details' : b.key)) && <span title="Unsaved" style={{ color: 'var(--status-warning)' }}>•</span>}
            </button>
          );
        })}
      </div>

      {loading && loadedMonth.current !== month ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={18} className="animate-spin" /> Loading {monthLabel(month)}...</div>
      ) : active === 'dashboard' ? (
        <Dashboard
          month={month}
          details={details}
          profile={companyProfile}
          onDetail={(k, v) => setSheetData('details', d => ({ ...d, fields: { ...(d.fields || {}), [k]: v } }))}
          summary={summary}
          clientCount={ctx.clients.length}
          onOpen={setActive}
        />
      ) : sheet && (
        <div>
          <div style={{ margin: '0 20px 12px', display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <h4 style={{ margin: 0, fontSize: '0.98rem' }}>{sheet.no}. {sheet.title}</h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sheet.intro}</p>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {sheet.carry && (
                <button type="button" className="btn-secondary" style={btn} onClick={() => copyFromEarlier(sheet.key)}><Copy size={14} /> Copy from earlier month</button>
              )}
              {sheet.sections.some(s => s.example) && (
                <button type="button" className="btn-secondary" style={btn} onClick={() => setShowExample(v => !v)}>
                  {showExample ? <EyeOff size={14} /> : <Eye size={14} />} {showExample ? 'Hide example' : 'Show example'}
                </button>
              )}
            </div>
          </div>
          {sheet.sections.map(section => (
            <SectionTable
              key={section.key}
              sheet={sheet}
              section={section}
              rows={rowsOf(sheet.key, section.key)}
              ctx={ctx}
              showExample={showExample}
              onRowChange={(id, key, value) => changeCell(sheet.key, section.key, id, key, value)}
              onDelete={(id) => deleteRow(sheet.key, section.key, id)}
              onAdd={() => addRow(sheet.key, section.key)}
            />
          ))}
          {sheet.kind === 'client' && ctx.clients.length === 0 && (
            <div style={{ padding: '0 20px 16px' }}>
              <button type="button" className="btn-secondary" style={btn} onClick={() => setActive('clientRegister')}>Go to Client Register</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RaComplianceBlock;
