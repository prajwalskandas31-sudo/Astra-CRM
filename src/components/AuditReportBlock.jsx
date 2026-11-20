import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from './ToastNotification';
import { loadClientFee, saveClientFee, downloadClientFeePdf } from '../services/accountsService';
import { ClipboardList, RefreshCw, FileSpreadsheet, FileText, Loader2, Save, RotateCcw, AlertTriangle } from 'lucide-react';

// Audit Report Blocks (backend/audit_report.py). Sub-block: Client and Fee Details, the half-yearly
// format. The CRM fills in what it can; any value can be typed over (and reset), then downloaded.

const SUB_BLOCKS = [['client-fee', 'Client and Fee Details']];
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MONEY_ROWS = new Set(['r7', 'r8']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (key) => { const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ''; };
const rupees = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

const currentPeriod = () => {
  const d = new Date();
  const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { fy, half: d.getMonth() >= 3 && d.getMonth() <= 8 ? 'H1' : 'H2' };
};
const periodKey = (fy, half) => `${fy}-${String((fy + 1) % 100).padStart(2, '0')}-${half}`;

const DETAIL_COLUMNS = {
  r1: [['clientName', 'Client'], ['category', 'Category'], ['pan', 'PAN'], ['phone', 'Phone'], ['service', 'Service'], ['startDate', 'Start'], ['endDate', 'Ends']],
  r2: [['clientName', 'Client'], ['category', 'Category'], ['pan', 'PAN'], ['phone', 'Phone'], ['service', 'Service'], ['eSignedOn', 'E-Signed On'], ['documentId', 'Document ID']],
  r3: [['clientName', 'Client'], ['category', 'Category'], ['pan', 'PAN'], ['phone', 'Phone'], ['service', 'Service'], ['startDate', 'Start'], ['expiredOn', 'Expired On']],
  r5: [['clientName', 'Client'], ['category', 'Category'], ['pan', 'PAN'], ['phone', 'Phone'], ['service', 'Service'], ['startDate', 'Start'], ['endDate', 'Ends']],
  r8: [['clientName', 'Client'], ['category', 'Category'], ['pan', 'PAN'], ['service', 'Service'], ['paymentDate', 'Payment Date'], ['grossSales', 'Gross (₹)'], ['netSales', 'Net Sales (₹)']]
};

/** The rows with the typed values applied, (iv) and the totals recalculated. */
const applyDraft = (rows, draft) => {
  const num = (k, fallback) => (k in draft ? Number(draft[k]) || 0 : fallback);
  const out = rows.map(r => {
    if (r.kind === 'columns' && r.key !== 'r4') {
      const cells = Object.fromEntries(COLUMNS.map(c => [c, num(`${r.key}.${c}`, r.auto[c])]));
      return { ...r, cells, total: r2(COLUMNS.reduce((s, c) => s + cells[c], 0)) };
    }
    if (r.kind === 'single') { const v = num(r.key, r.auto); return { ...r, value: v, total: v }; }
    if (r.kind === 'text') { const v = r.key in draft ? draft[r.key] : r.auto; return { ...r, value: v, total: v }; }
    return r;
  });
  const [i, ii, iii] = ['r1', 'r2', 'r3'].map(k => out.find(r => r.key === k));
  return out.map(r => {
    if (r.key !== 'r4') return r;
    const cells = Object.fromEntries(COLUMNS.map(c => [c, i.cells[c] + ii.cells[c] - iii.cells[c]]));
    return { ...r, cells, total: COLUMNS.reduce((s, c) => s + cells[c], 0) };
  });
};

const draftFromRows = (rows) => {
  const d = {};
  rows.forEach(r => {
    if (r.kind === 'columns') (r.edited || []).forEach(c => { d[`${r.key}.${c}`] = String(r.cells[c]); });
    else if (r.edited) d[r.key] = String(r.value);
  });
  return d;
};

const fmt = (row, v) => (MONEY_ROWS.has(row.key) ? rupees(v) : String(v ?? ''));
const cellExcel = (row, v) => (row.kind === 'text' ? String(v ?? '') : Number(v) || 0);

const exportExcel = (data, rows, keys) => {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['Client and Fee Details'], [data.label], [],
    ['Sr. No.', 'Particulars', 'Details of Individual clients', '', '', 'Details of Non-Individual clients', '', '', 'Total (A+B+C+D+E+F)'],
    ['', '', 'Resident (A)', 'Non-Resident (B)', 'FPI (C)', 'Resident (D)', 'Non-Resident (E)', 'FPI (F)', '']
  ];
  const merges = [{ s: { r: 3, c: 2 }, e: { r: 3, c: 4 } }, { s: { r: 3, c: 5 }, e: { r: 3, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }, { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } }, { s: { r: 3, c: 8 }, e: { r: 4, c: 8 } }];
  rows.filter(r => keys.includes(r.key)).forEach(r => {
    if (r.kind === 'columns') {
      aoa.push([r.srNo, r.particulars, ...COLUMNS.map(c => r.cells[c]), r.total]);
    } else {
      const note = r.key === 'r5' && r.day && !r.edited ? ` (on ${dmy(r.day)})` : '';
      aoa.push([r.srNo, r.particulars, r.kind === 'text' ? r.value : (note ? `${r.value}${note}` : cellExcel(r, r.value)), '', '', '', '', '', cellExcel(r, r.total)]);
      merges.push({ s: { r: aoa.length - 1, c: 2 }, e: { r: aoa.length - 1, c: 7 } });
    }
  });
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!merges'] = merges;
  sheet['!cols'] = [{ wch: 8 }, { wch: 62 }, ...COLUMNS.map(() => ({ wch: 16 })), { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'Client and Fee Details');
  keys.forEach(k => {
    const cols = DETAIL_COLUMNS[k];
    const items = data.details[k] || [];
    if (!cols || !items.length) return;
    const row = rows.find(r => r.key === k);
    const s = XLSX.utils.aoa_to_sheet([
      [`${row.srNo}. ${row.particulars}`], ['Clients counted by the CRM (values typed into the report are not reflected here)'], [],
      cols.map(([, t]) => t), ...items.map(d => cols.map(([key]) => d[key] ?? ''))
    ]);
    s['!cols'] = cols.map(([key]) => ({ wch: key === 'clientName' || key === 'service' ? 28 : 14 }));
    XLSX.utils.book_append_sheet(wb, s, `Row ${row.srNo} clients`);
  });
  const suffix = keys.length === rows.length ? '' : ` Row ${keys.map(k => rows.find(r => r.key === k).srNo).join('-')}`;
  XLSX.writeFile(wb, `Client and Fee Details ${data.period}${suffix}.xlsx`);
};

const inputStyle = { width: '100%', minWidth: '56px', height: '30px', fontSize: '0.8rem', textAlign: 'right', boxSizing: 'border-box', padding: '0 6px' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 };
const th = { textAlign: 'center', verticalAlign: 'middle' };

const Cell = ({ row, k, value, auto, edited, onChange, onReset, wide }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: wide ? 'stretch' : 'flex-end' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
      <input type="number" min="0" step={MONEY_ROWS.has(row.key) ? '0.01' : '1'} value={value} aria-label={`${row.particulars} ${k}`}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, borderColor: edited ? 'var(--accent)' : undefined }} />
      {edited && <button type="button" style={iconBtn} title={`Back to the CRM's figure (${fmt(row, auto)})`} aria-label="Reset to the CRM's figure" onClick={onReset}><RotateCcw size={12} /></button>}
    </div>
    {edited && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CRM: {fmt(row, auto)}</span>}
  </div>
);

const ClientFeeDetails = () => {
  const { showToast } = useToast();
  const now = useMemo(currentPeriod, []);
  const [fy, setFy] = useState(now.fy);
  const [half, setHalf] = useState(now.half);
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const period = periodKey(fy, half);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loadClientFee(period);
      setData(res);
      setDraft(draftFromRows(res.rows));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const savedDraft = useMemo(() => (data ? draftFromRows(data.rows) : {}), [data]);
  const dirty = JSON.stringify(savedDraft) !== JSON.stringify(draft);
  const rows = useMemo(() => (data ? applyDraft(data.rows, draft) : []), [data, draft]);

  const set = (k, v) => setDraft(prev => ({ ...prev, [k]: v }));
  const reset = (k) => setDraft(prev => { const n = { ...prev }; delete n[k]; return n; });

  const save = async () => {
    setSaving(true);
    try {
      const values = Object.fromEntries(Object.entries(draft).filter(([, v]) => String(v).trim() !== ''));
      const res = await saveClientFee(period, values);
      setData(res);
      setDraft(draftFromRows(res.rows));
      showToast('Client and Fee Details saved for this half.', 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Downloads use the saved values, so save first when something was typed
  const ready = async () => !dirty || save();
  const excel = async (keys) => { if (await ready()) exportExcel(data, rows, keys); };
  const pdf = async (keys) => {
    if (!(await ready())) return;
    try {
      const suffix = keys.length === rows.length ? '' : ` Row ${keys.map(k => rows.find(r => r.key === k).srNo).join('-')}`;
      await downloadClientFeePdf(period, keys, `Client and Fee Details ${period}${suffix}.pdf`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const years = [];
  for (let y = now.fy + 1; y >= 2020; y -= 1) years.push(y);
  const allKeys = rows.map(r => r.key);

  const RowDownloads = ({ k }) => (
    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
      <button type="button" style={iconBtn} title="Download this row (Excel, with the clients counted)" aria-label="Download row as Excel" onClick={() => excel([k])}><FileSpreadsheet size={15} /></button>
      <button type="button" style={iconBtn} title="Download this row (PDF, with the clients counted)" aria-label="Download row as PDF" onClick={() => pdf([k])}><FileText size={15} /></button>
    </div>
  );

  return (
    <>
      <div className="paid-filters" style={{ flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          Financial Year
          <select value={fy} onChange={e => setFy(Number(e.target.value))} style={{ height: '36px' }}>
            {years.map(y => <option key={y} value={y}>{`${y}-${String((y + 1) % 100).padStart(2, '0')}`}</option>)}
          </select>
        </label>
        <div className="paid-service-tabs" role="tablist" aria-label="Half" style={{ margin: 0 }}>
          {[['H1', '1st Half (Apr - Sep)'], ['H2', '2nd Half (Oct - Mar)']].map(([id, t]) => (
            <button key={id} type="button" role="tab" aria-selected={half === id} className={`paid-service-tab${half === id ? ' active' : ''}`} onClick={() => setHalf(id)}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
          <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button className="btn-secondary" disabled={!data} onClick={() => excel(allKeys)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }} title="Whole report, plus a sheet of clients for each counted row">
          <FileSpreadsheet size={14} /> Download Excel
        </button>
        <button className="btn-secondary" disabled={!data} onClick={() => pdf(allKeys)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
          <FileText size={14} /> Download PDF
        </button>
      </div>

      {data && (
        <div style={{ margin: '0 20px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{data.label}</strong> ({dmy(data.from)} to {dmy(data.to)})
          {data.updatedBy && <> · last saved by {data.updatedBy}</>}
          {dirty && <span style={{ color: 'var(--status-warning)', marginLeft: '8px' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Unsaved changes</span>}
        </div>
      )}
      {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}

      {data && (
        <div className="table-responsive">
          <style>{'.audit-table th, .audit-table td { padding-left: 6px !important; padding-right: 6px !important; }'}</style>
          <table className="crm-table audit-table">
            <thead>
              <tr>
                <th rowSpan={2} style={th}>Sr. No.</th>
                <th rowSpan={2} style={th}>Particulars</th>
                <th colSpan={3} style={th}>Details of Individual clients</th>
                <th colSpan={3} style={th}>Details of Non-Individual clients</th>
                <th rowSpan={2} style={th}>Total (A+B+C+D+E+F)</th>
                <th rowSpan={2} style={th}>Download</th>
              </tr>
              <tr>
                {['Resident (A)', 'Non-Resident (B)', 'FPI (C)', 'Resident (D)', 'Non-Resident (E)', 'FPI (F)'].map(t => <th key={t} style={th}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td style={{ textAlign: 'center' }}>{r.srNo}</td>
                  <td style={{ minWidth: '200px', fontSize: '0.8rem' }}>{r.particulars}</td>
                  {r.kind === 'columns' && COLUMNS.map(c => (
                    <td key={c}>
                      {r.key === 'r4'
                        ? <div style={{ textAlign: 'right', fontWeight: 600 }} title="(i) + (ii) - (iii)">{r.cells[c]}</div>
                        : <Cell row={r} k={c} value={`${r.key}.${c}` in draft ? draft[`${r.key}.${c}`] : String(r.auto[c])} auto={r.auto[c]}
                            edited={`${r.key}.${c}` in draft} onChange={v => set(`${r.key}.${c}`, v)} onReset={() => reset(`${r.key}.${c}`)} />}
                    </td>
                  ))}
                  {r.kind === 'single' && (
                    <td colSpan={6}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ width: '200px' }}>
                          <Cell row={r} k="value" value={r.key in draft ? draft[r.key] : String(r.auto)} auto={r.auto} edited={r.key in draft}
                            onChange={v => set(r.key, v)} onReset={() => reset(r.key)} wide />
                        </div>
                        {r.key === 'r5' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {r.day ? `CRM: most clients active on ${dmy(r.day)}` : 'No active clients in this half yet'}
                          </span>
                        )}
                        {r.key === 'r7' && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter the amount (₹)</span>}
                      </div>
                    </td>
                  )}
                  {r.kind === 'text' && (
                    <td colSpan={6}>
                      <textarea rows={2} maxLength={500} value={draft[r.key] ?? ''} placeholder="e.g. Fixed Deposit No. ... with ... Bank, lien marked to RAASB"
                        onChange={e => (e.target.value ? set(r.key, e.target.value) : reset(r.key))}
                        style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'inherit', padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box' }} />
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.kind === 'text' ? '' : fmt(r, r.total)}</td>
                  <td><RowDownloads k={r.key} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loading && !data && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}

      <div style={{ padding: '10px 20px 16px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        (i) clients with an active service on the last day of the previous half · (ii) e-signs completed in the half (E-Sign Block) ·
        (iii) clients whose service expired in the half, by expiry date · (iv) = (i) + (ii) − (iii) · 5: the day with the most active
        clients · 8: Net Sales of closed sales by Payment Date. Individual / Non-Individual is the Client Category on the Client Information page;
        the CRM has no residency field, so its counts go to Resident and Non-Resident / FPI start at 0. Type over any value and Save;
        the reset arrow brings back the CRM's figure.
      </div>
    </>
  );
};

export const AuditReportBlock = () => {
  const [sub, setSub] = useState('client-fee');
  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={18} color="var(--accent)" /> Audit Report Blocks</h3>
          <p>Half-yearly audit reports: 1st half April - September, 2nd half October - March.</p>
        </div>
      </div>
      <div className="paid-service-tabs" role="tablist" aria-label="Audit report" style={{ margin: '0 20px 12px' }}>
        {SUB_BLOCKS.map(([id, t]) => (
          <button key={id} type="button" role="tab" aria-selected={sub === id} className={`paid-service-tab${sub === id ? ' active' : ''}`} onClick={() => setSub(id)}>{t}</button>
        ))}
      </div>
      {sub === 'client-fee' && <ClientFeeDetails />}
    </div>
  );
};

export default AuditReportBlock;
