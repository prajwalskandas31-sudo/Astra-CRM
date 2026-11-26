import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { reportSheet, writeReport } from '../lib/reportExcel';
import { useToast } from './ToastNotification';
import {
  listAnnexureReports, createAnnexureReport, loadAnnexureReport, saveAnnexureReport,
  deleteAnnexureReport, downloadAnnexureReport
} from '../services/annexureASaasService';
import {
  Cloud, Plus, Copy, Trash2, Save, Loader2, FileText, FileSpreadsheet, FileType, AlertTriangle,
  ArrowUp, ArrowDown, RotateCcw, ListPlus, RefreshCw
} from 'lucide-react';
import { confirmAsync } from './ConfirmDialog';

// Annexure A for SaaS Reporting (backend/annexure_a_saas.py): a manual input sheet in the exact layout of
// the "Annexure A" format. Nothing is fetched from the rest of the CRM; every value is typed in here,
// saved, then downloaded as Word (the original template filled in), PDF or Excel.

const TITLE = 'Annexure A';
// Same as backend COLUMNS; the server's copy (from GET /annexure-a-saas) is used once it has loaded
const FALLBACK_COLUMNS = [
  { key: 'enlistmentNumber', title: 'IA/RA Enlistment Number', kind: 'text' },
  { key: 'iaRaName', title: 'IA/RA Name', kind: 'text' },
  { key: 'usingSaas', title: 'Whether using any SaaS based solutions (Yes / No)', kind: 'choice', options: ['Yes', 'No'] },
  { key: 'serviceName', title: 'Name of SaaS/ Hosted Service', kind: 'text' },
  { key: 'serviceType', title: 'Type (SaaS or Hosted Service)', kind: 'choice', options: ['SaaS', 'Hosted Service'] },
  { key: 'criticality', title: 'Critical/ non-critical', kind: 'choice', options: ['Critical', 'Non-critical'] },
  { key: 'hostingLocation', title: 'Location of hosting of SaaS/ Hosted Service (Within India/ Outside India)', kind: 'choice', options: ['Within India', 'Outside India'] },
  { key: 'comments', title: 'Comments (if any)', kind: 'textarea' }
];
const DEFAULT_CC = 'BSE Ltd.\n25th Floor, P. J. Towers, Fort\nMumbai 400 023.';
const COLUMN_WIDTHS = { enlistmentNumber: 150, iaRaName: 170, usingSaas: 110, serviceName: 170, serviceType: 140, criticality: 130, hostingLocation: 150, comments: 220 };

const blankRow = (columns) => Object.fromEntries(columns.map(c => [c.key, '']));
const isFilled = (row, columns) => columns.some(c => String(row[c.key] || '').trim());
const stamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fileName = (label, ext) => `Annexure A for SaaS Reporting - ${String(label || 'Report').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Report'}.${ext}`;
const editable = (r) => ({ label: r.label, rows: r.rows, signatoryName: r.signatoryName || '', signatoryDesignation: r.signatoryDesignation || '', cc: r.cc ?? '' });

/** Things worth a second look before the report goes out. They never block a save or download. */
const checks = (rows, columns) => {
  const out = [];
  const title = Object.fromEntries(columns.map(c => [c.key, c.title]));
  rows.forEach((r, i) => {
    if (!isFilled(r, columns)) return;
    const missing = [];
    if (!r.enlistmentNumber) missing.push(title.enlistmentNumber);
    if (!r.iaRaName) missing.push(title.iaRaName);
    if (!r.usingSaas) missing.push(title.usingSaas);
    if (r.usingSaas === 'Yes') ['serviceName', 'serviceType', 'criticality', 'hostingLocation'].forEach(k => { if (!r[k]) missing.push(title[k]); });
    if (missing.length) out.push(`SN ${i + 1}: ${missing.join(', ')} not filled in`);
    if (r.usingSaas === 'No' && (r.serviceName || r.serviceType || r.criticality || r.hostingLocation)) {
      out.push(`SN ${i + 1}: "No" SaaS based solutions, but SaaS details are filled in`);
    }
  });
  return out;
};

const exportExcel = (report, columns) => {
  const header = ['SN', ...columns.map(c => c.title)];
  const ccLines = String(report.cc || '').split('\n').map(s => s.trim()).filter(Boolean);
  const b = reportSheet().title(TITLE).subtitle(report.label || '').header(header)
    .rows(report.rows.map((r, i) => [i + 1, ...columns.map(c => r[c.key] || '')]));
  b.blank().text('With Regards').blank().text('________________');
  [report.signatoryName, report.signatoryDesignation].filter(Boolean).forEach(v => b.text(v));
  if (ccLines.length) { b.blank(); ccLines.forEach((l, i) => b.text(i === 0 ? `c.c.:   ${l}` : l)); }
  const sheet = b.build({ cols: [6, ...columns.map(c => Math.round((COLUMN_WIDTHS[c.key] || 140) / 6.5))] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Annexure A');
  writeReport(wb, fileName(report.label, 'xlsx'));
};

const cellInput = { width: '100%', height: '32px', fontSize: '0.8rem', boxSizing: 'border-box', padding: '0 6px' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', lineHeight: 1 };
const th = { textAlign: 'center', verticalAlign: 'middle', fontSize: '0.74rem', lineHeight: 1.3, whiteSpace: 'normal' };
const btn = { display: 'flex', alignItems: 'center', gap: '6px', height: '36px' };
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' };

export const AnnexureASaasBlock = () => {
  const { showToast } = useToast();
  const [schema, setSchema] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saved, setSaved] = useState(null);    // the report as last loaded / saved
  const [draft, setDraft] = useState(null);    // what is on screen
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(null); // null | 'new' | 'copy'

  const columns = schema?.columns || FALLBACK_COLUMNS;
  const maxRows = schema?.maxRows || 500;
  const dirty = useMemo(() => !!(saved && draft && JSON.stringify(editable(saved)) !== JSON.stringify(draft)), [saved, draft]);
  const warnings = useMemo(() => (draft ? checks(draft.rows, columns) : []), [draft, columns]);

  const refreshList = useCallback(async () => {
    const res = await listAnnexureReports();
    setSchema(res.schema);
    setReports(res.reports);
    return res.reports;
  }, []);

  const open = useCallback(async (reportId) => {
    setSelectedId(reportId);
    if (!reportId) { setSaved(null); setDraft(null); return; }
    setLoading(true);
    setError('');
    try {
      const r = await loadAnnexureReport(reportId);
      setSaved(r);
      setDraft(editable(r));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await refreshList();
        if (list.length) await open(list[0].id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshList, open]);

  // Warn before closing the tab with unsaved typing
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const leaveOk = async () => !dirty || confirmAsync('This report has unsaved changes. Discard them?', { confirmLabel: 'Discard changes', danger: true });

  const switchTo = async (reportId) => { if (await leaveOk()) open(reportId); };

  const create = async (e) => {
    e.preventDefault();
    const label = newName.trim();
    if (!label) { showToast('Give the report a name.', 'error'); return; }
    if (creating === 'new' && !(await leaveOk())) return;
    setBusy('create');
    try {
      const r = await createAnnexureReport(label, creating === 'copy' ? selectedId : undefined);
      await refreshList();
      setSaved(r);
      setDraft(editable(r));
      setSelectedId(r.id);
      setCreating(null);
      setNewName('');
      showToast(creating === 'copy' ? `Copied to "${r.label}".` : `"${r.label}" created with ${r.rows.length} blank rows.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft || !saved) return false;
    if (!draft.label.trim()) { showToast('Give the report a name.', 'error'); return false; }
    setBusy('save');
    try {
      const r = await saveAnnexureReport({ id: saved.id, updatedAt: saved.updatedAt, ...draft });
      setSaved(r);
      setDraft(editable(r));
      refreshList().catch(() => {});
      showToast('Annexure A saved.', 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!saved || !await confirmAsync(`Delete the report "${saved.label}"? This cannot be undone.`, { danger: true, confirmLabel: 'Delete' })) return;
    setBusy('delete');
    try {
      await deleteAnnexureReport(saved.id);
      const list = await refreshList();
      await open(list[0]?.id || '');
      showToast('Report deleted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  // Downloads are built from the saved report, so save first when something was typed
  const download = async (format) => {
    if (dirty && !(await save())) return;
    const report = { ...saved, ...draft };
    if (format === 'xlsx') { exportExcel(report, columns); return; }
    setBusy(format);
    try {
      await downloadAnnexureReport(saved.id, format, fileName(report.label, format));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  // ---------- editing ----------
  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setCell = (i, k, v) => setDraft(d => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRow = (at) => setDraft(d => {
    if (d.rows.length >= maxRows) { showToast(`A report can have at most ${maxRows} rows.`, 'error'); return d; }
    const rows = [...d.rows];
    rows.splice(at ?? rows.length, 0, blankRow(columns));
    return { ...d, rows };
  });
  const removeRow = async (i) => {
    if (draft.rows.length <= 1) { showToast('The report needs at least one row.', 'error'); return; }
    if (isFilled(draft.rows[i], columns) && !await confirmAsync(`Remove SN ${i + 1}? What was typed in it will be lost.`, { danger: true, confirmLabel: 'Remove' })) return;
    setDraft(d => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }));
  };
  const moveRow = (i, by) => setDraft(d => {
    const j = i + by;
    if (j < 0 || j >= d.rows.length) return d;
    const rows = [...d.rows];
    [rows[i], rows[j]] = [rows[j], rows[i]];
    return { ...d, rows };
  });
  const fillFromFirst = () => {
    const { enlistmentNumber = '', iaRaName = '' } = draft.rows[0] || {};
    if (!enlistmentNumber && !iaRaName) { showToast('Type the IA/RA Enlistment Number and Name in SN 1 first.', 'info'); return; }
    const needs = (r, i) => i > 0 && isFilled(r, columns) && ((!r.enlistmentNumber && enlistmentNumber) || (!r.iaRaName && iaRaName));
    const n = draft.rows.filter(needs).length;
    if (!n) { showToast('No filled-in rows are missing them.', 'info'); return; }
    setDraft(d => ({
      ...d,
      rows: d.rows.map((r, i) => (needs(r, i) ? { ...r, enlistmentNumber: r.enlistmentNumber || enlistmentNumber, iaRaName: r.iaRaName || iaRaName } : r))
    }));
    showToast(`Filled in ${n} row(s) from SN 1.`, 'info');
  };
  const removeBlankRows = () => {
    const kept = draft.rows.filter(r => isFilled(r, columns));
    if (kept.length === draft.rows.length) { showToast('There are no blank rows.', 'info'); return; }
    setDraft(d => ({ ...d, rows: kept.length ? kept : [blankRow(columns)] }));
  };

  const filled = draft ? draft.rows.filter(r => isFilled(r, columns)).length : 0;

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Cloud size={18} color="var(--accent)" /> Annexure A for SaaS Reporting</h3>
          <p>Manual input sheet in the Annexure A format. Nothing is filled in automatically: type every value, Save, then download.</p>
        </div>
      </div>

      {/* Reports */}
      <div className="paid-filters" style={{ flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          Report
          <select value={selectedId} onChange={e => switchTo(e.target.value)} style={{ height: '36px', minWidth: '240px' }} disabled={!reports.length}>
            {!reports.length && <option value="">No reports yet</option>}
            {reports.map(r => <option key={r.id} value={r.id}>{`${r.label} (${r.filledRows}/${r.rowCount} rows filled)`}</option>)}
          </select>
        </label>
        <button className="btn-secondary" style={btn} onClick={() => { setCreating('new'); setNewName(''); }}><Plus size={14} /> New Report</button>
        <button className="btn-secondary" style={btn} disabled={!saved} onClick={() => { setCreating('copy'); setNewName(saved ? `${saved.label} (copy)` : ''); }} title="Start a new report from a copy of this one"><Copy size={14} /> Duplicate</button>
        <button className="btn-secondary" style={{ ...btn, color: 'var(--status-danger)' }} disabled={!saved || busy === 'delete'} onClick={remove}><Trash2 size={14} /> Delete</button>
        <button className="btn-secondary" style={btn} disabled={loading || !saved} onClick={() => switchTo(selectedId)} title="Reload the saved copy"><RefreshCw size={14} /> Reload</button>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={btn} disabled={!dirty || busy === 'save'} onClick={save}>
          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button className="btn-secondary" style={btn} disabled={!saved || !!busy} onClick={() => download('docx')} title="The Annexure A Word format, filled in"><FileType size={14} /> Word</button>
        <button className="btn-secondary" style={btn} disabled={!saved || !!busy} onClick={() => download('pdf')}><FileText size={14} /> PDF</button>
        <button className="btn-secondary" style={btn} disabled={!saved || !!busy} onClick={() => download('xlsx')}><FileSpreadsheet size={14} /> Excel</button>
      </div>

      {creating && (
        <form onSubmit={create} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', margin: '0 20px 12px', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.8rem' }}>{creating === 'copy' ? 'Name of the copy' : 'Name of the new report'}</span>
          <input autoFocus value={newName} maxLength={120} onChange={e => setNewName(e.target.value)} placeholder="e.g. SaaS Reporting - Nov 2026" style={{ height: '34px', minWidth: '260px', padding: '0 8px' }} />
          <button type="submit" className="btn-primary" style={{ ...btn, height: '34px' }} disabled={busy === 'create'}>
            {busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {creating === 'copy' ? 'Create Copy' : 'Create'}
          </button>
          <button type="button" className="btn-secondary" style={{ ...btn, height: '34px' }} onClick={() => setCreating(null)}>Cancel</button>
          {creating === 'new' && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Starts with the format's {schema?.templateRows || 16} blank rows.</span>}
        </form>
      )}

      {error && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}
      {loading && !draft && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}
      {!loading && !error && !reports.length && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No Annexure A reports yet. Click <strong>New Report</strong> to start one.
        </div>
      )}

      {draft && saved && (
        <>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', margin: '0 20px 12px' }}>
            <label style={{ ...fieldLabel, minWidth: '280px' }}>
              Report name (for your reference and the file name; not printed)
              <input value={draft.label} maxLength={120} onChange={e => setField('label', e.target.value)} style={{ height: '34px', padding: '0 8px' }} />
            </label>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: '8px' }}>
              {filled} of {draft.rows.length} rows filled
              {saved.updatedBy && <> · last saved by {saved.updatedBy} on {stamp(saved.updatedAt)}</>}
              {dirty && <span style={{ color: 'var(--status-warning)', marginLeft: '8px' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Unsaved changes</span>}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', margin: '4px 0 8px' }}>{TITLE}</div>
          <div className="table-responsive">
            <style>{'.annexure-table th, .annexure-table td { padding: 5px 5px !important; vertical-align: middle; } .annexure-table select, .annexure-table input, .annexure-table textarea { background: var(--bg-input, transparent); color: inherit; }'}</style>
            <table className="crm-table annexure-table">
              <thead>
                <tr>
                  <th style={{ ...th, width: '44px' }}>SN</th>
                  {columns.map(c => <th key={c.key} style={{ ...th, minWidth: `${COLUMN_WIDTHS[c.key] || 140}px` }}>{c.title}</th>)}
                  <th style={{ ...th, width: '110px' }}>Row</th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                    {columns.map(c => (
                      <td key={c.key}>
                        {c.kind === 'choice' && (
                          <select value={r[c.key] || ''} onChange={e => setCell(i, c.key, e.target.value)} aria-label={`SN ${i + 1} ${c.title}`} style={cellInput}>
                            <option value="">Select</option>
                            {c.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                        {c.kind === 'textarea' && (
                          <textarea rows={1} maxLength={2000} value={r[c.key] || ''} onChange={e => setCell(i, c.key, e.target.value)} aria-label={`SN ${i + 1} ${c.title}`}
                            style={{ ...cellInput, height: 'auto', minHeight: '32px', padding: '6px', fontFamily: 'inherit', resize: 'vertical' }} />
                        )}
                        {c.kind === 'text' && (
                          <input value={r[c.key] || ''} maxLength={300} onChange={e => setCell(i, c.key, e.target.value)} aria-label={`SN ${i + 1} ${c.title}`} style={cellInput} />
                        )}
                      </td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                        <button type="button" style={iconBtn} title="Move up" aria-label={`Move SN ${i + 1} up`} disabled={i === 0} onClick={() => moveRow(i, -1)}><ArrowUp size={14} /></button>
                        <button type="button" style={iconBtn} title="Move down" aria-label={`Move SN ${i + 1} down`} disabled={i === draft.rows.length - 1} onClick={() => moveRow(i, 1)}><ArrowDown size={14} /></button>
                        <button type="button" style={iconBtn} title="Insert a blank row below" aria-label={`Insert a row below SN ${i + 1}`} onClick={() => addRow(i + 1)}><ListPlus size={14} /></button>
                        <button type="button" style={{ ...iconBtn, color: 'var(--status-danger)' }} title="Remove this row" aria-label={`Remove SN ${i + 1}`} onClick={() => removeRow(i)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 20px' }}>
            <button className="btn-secondary" style={btn} onClick={() => addRow()}><Plus size={14} /> Add Row</button>
            <button className="btn-secondary" style={btn} onClick={fillFromFirst} title="Copies SN 1's IA/RA Enlistment Number and IA/RA Name into filled-in rows where they are blank">
              <Copy size={14} /> Fill blank IA/RA details from SN 1
            </button>
            <button className="btn-secondary" style={btn} onClick={removeBlankRows}><Trash2 size={14} /> Remove blank rows</button>
          </div>

          {warnings.length > 0 && (
            <details style={{ margin: '0 20px 12px', fontSize: '0.78rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--status-warning)' }}>
                <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> {warnings.length} thing(s) to check before you submit (downloads still work)
              </summary>
              <ul style={{ margin: '6px 0 0 18px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {warnings.map(w => <li key={w}>{w}</li>)}
              </ul>
            </details>
          )}

          {/* Sign-off, as at the foot of the format */}
          <div style={{ margin: '4px 20px 18px', padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'grid', gap: '12px', maxWidth: '640px' }}>
            <div style={{ fontWeight: 700 }}>With Regards</div>
            <div style={{ fontWeight: 700, letterSpacing: '1px' }}>________________</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ ...fieldLabel, flex: 1, minWidth: '200px' }}>
                Signatory name (optional, printed under the line)
                <input value={draft.signatoryName} maxLength={300} onChange={e => setField('signatoryName', e.target.value)} style={{ height: '34px', padding: '0 8px' }} />
              </label>
              <label style={{ ...fieldLabel, flex: 1, minWidth: '200px' }}>
                Designation (optional)
                <input value={draft.signatoryDesignation} maxLength={300} onChange={e => setField('signatoryDesignation', e.target.value)} style={{ height: '34px', padding: '0 8px' }} />
              </label>
            </div>
            <label style={fieldLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                c.c. (one line per line; leave empty to leave the c.c. out)
                {draft.cc !== (schema?.defaultCc || DEFAULT_CC) && (
                  <button type="button" style={{ ...iconBtn, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '3px' }} onClick={() => setField('cc', schema?.defaultCc || DEFAULT_CC)}>
                    <RotateCcw size={12} /> Restore the format's c.c.
                  </button>
                )}
              </span>
              <textarea rows={3} maxLength={1000} value={draft.cc} onChange={e => setField('cc', e.target.value)}
                style={{ fontFamily: 'inherit', fontSize: '0.85rem', padding: '6px 8px', resize: 'vertical' }} />
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default AnnexureASaasBlock;
