import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from './ToastNotification';
import {
  loadInvoiceBlock, generateInvoice, downloadInvoicePdf, saveInvoiceSettings, saveBranchCounter, draftInvoiceText
} from '../services/invoiceService';
import {
  Receipt, Search, Download, FileText, Loader2, SlidersHorizontal, Sparkles, Save, AlertTriangle, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

// Invoice Block: tax invoices for every client who has e-signed (backend/invoice_block.py).

const rupees = (v) => (v === null || v === undefined || v === ''
  ? '—'
  : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const formatMoment = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value)
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

const Section = ({ icon: Icon, title, subtitle, children, actions }) => (
  <div className="directory-card" style={{ overflow: 'hidden' }}>
    <div className="directory-toolbar">
      <div className="directory-title-area">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon size={18} color="var(--accent)" /> {title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const Empty = ({ children }) => (
  <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{children}</div>
);

const Warning = ({ children }) => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '0 20px 12px', padding: '10px 12px', borderRadius: '8px',
    background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', fontSize: '0.82rem' }}>
    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
    <span>{children}</span>
  </div>
);

const label = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 };
const muted = { fontSize: '0.75rem', color: 'var(--text-muted)' };

const FILTERS = [
  ['all', 'All'],
  ['invoice2', 'Invoice 2 recommended'],
  ['pending', 'Not generated'],
  ['generated', 'Generated']
];

// ---------------- Invoice Controls ----------------

const TextWithClaude = ({ field, title, value, onChange }) => {
  const { showToast } = useToast();
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);

  const draft = async () => {
    setBusy(true);
    try {
      const { text } = await draftInvoiceText(field, value, instruction.trim());
      onChange(text);
      showToast(`Claude drafted the ${title}. Review it, then Save Controls.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={label}>{title} (printed on every invoice)</span>
      <textarea rows={5} value={value} maxLength={3000} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontSize: '0.83rem', fontFamily: 'inherit', padding: '8px 10px', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input type="text" value={instruction} maxLength={500} onChange={e => setInstruction(e.target.value)}
          placeholder="Optional: tell Claude what to change (e.g. add a line about GST)"
          style={{ flex: '1 1 260px', height: '34px', fontSize: '0.8rem' }} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={draft}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {busy ? 'Drafting…' : 'Draft with Claude'}
        </button>
      </div>
    </div>
  );
};

const InvoiceControls = ({ settings, branches, onSaved, onBranches }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [counters, setCounters] = useState({});

  useEffect(() => { setForm(settings); }, [settings]);

  const set = (key) => (value) => setForm(prev => ({ ...prev, [key]: value }));
  const pct = (key) => {
    const n = parseFloat(form[key]);
    return Number.isFinite(n) ? n : NaN;
  };
  const rates = ['gstPercent', 'igstPercent', 'cgstPercent', 'sgstPercent'];
  const badRate = rates.some(k => !(pct(k) >= 0 && pct(k) <= 100));
  const mismatch = !badRate && (Math.abs(pct('igstPercent') - pct('gstPercent')) > 0.001
    || Math.abs(pct('cgstPercent') + pct('sgstPercent') - pct('gstPercent')) > 0.001);
  const badBranch = form.defaultBranchCode && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(form.defaultBranchCode.trim());

  const save = async () => {
    if (badRate) return showToast('Each percentage must be between 0 and 100.', 'error');
    if (badBranch) return showToast('The default Branch ID may only use letters, digits, - and _.', 'error');
    setSaving(true);
    try {
      const saved = await saveInvoiceSettings({ ...form, ...Object.fromEntries(rates.map(k => [k, pct(k)])) });
      onSaved(saved);
      showToast('Invoice Controls saved. New invoices use them.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveCounter = async (code) => {
    const n = parseInt(counters[code], 10);
    if (!(n >= 1 && n <= 99999)) return showToast('Enter a number from 1 to 99999.', 'error');
    try {
      const { branches: updated } = await saveBranchCounter(code, n);
      onBranches(updated);
      setCounters(prev => ({ ...prev, [code]: '' }));
      showToast(`The next ${code} invoice this month will be ${updated.find(b => b.code === code)?.nextInvoice}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const rateField = (key, text) => (
    <label style={label} key={key}>
      {text}
      <input type="number" min="0" max="100" step="0.01" value={form[key]} onChange={e => set(key)(e.target.value)}
        style={{ height: '36px', width: '110px', fontSize: '0.85rem' }} />
    </label>
  );

  return (
    <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {rateField('gstPercent', 'GST %')}
        {rateField('igstPercent', 'IGST %')}
        {rateField('cgstPercent', 'CGST %')}
        {rateField('sgstPercent', 'SGST %')}
        <label style={label}>
          Default Branch ID
          <input type="text" value={form.defaultBranchCode} maxLength={20} placeholder="e.g. BLR"
            onChange={e => set('defaultBranchCode')(e.target.value.toUpperCase())}
            style={{ height: '36px', width: '130px', fontSize: '0.85rem' }} />
        </label>
      </div>
      <div style={muted}>
        IGST applies when the client's State differs from the company's State; CGST + SGST when it is the same.
        The Default Branch ID is used for clients whose executive's branch has no Branch ID (otherwise “HO”).
      </div>
      {mismatch && <div style={{ ...muted, color: '#d97706' }}>Note: IGST % or CGST % + SGST % does not equal GST %.</div>}

      <TextWithClaude field="notes" title="Notes" value={form.notes} onChange={set('notes')} />
      <TextWithClaude field="terms" title="Terms & Conditions" value={form.terms} onChange={set('terms')} />

      <div>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving…' : 'Save Controls'}
        </button>
      </div>

      <div>
        <div style={{ ...label, marginBottom: '6px' }}>Invoice numbers this month</div>
        <div style={{ ...muted, marginBottom: '8px' }}>
          Format: Branch ID + month + year + running number (e.g. BLR1126253). Each branch restarts every month.
          To continue from an earlier series (e.g. Zoho), set the next number.
        </div>
        <div className="table-responsive">
          <table className="crm-table">
            <thead><tr><th>Branch ID</th><th>Branch</th><th>Next invoice</th><th>Set next number</th></tr></thead>
            <tbody>
              {branches.map(b => (
                <tr key={b.code}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.code}</td>
                  <td>{b.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{b.nextInvoice}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="number" min="1" max="99999" value={counters[b.code] || ''} placeholder={String(b.nextNumber)}
                        onChange={e => setCounters(prev => ({ ...prev, [b.code]: e.target.value }))}
                        style={{ width: '100px', height: '32px', fontSize: '0.8rem' }} />
                      <button type="button" className="btn-secondary" style={{ height: '32px' }} onClick={() => saveCounter(b.code)}>Set</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------- Client rows ----------------

const Status = ({ row }) => {
  if (!row.serviceValue) {
    return <span style={muted}>No Value (₹) in Service Master</span>;
  }
  if (row.recommended === 2) {
    return (
      <div>
        <div style={{ fontWeight: 600 }}>Balance {rupees(row.balance)}</div>
        <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>Invoice 2 recommended</div>
      </div>
    );
  }
  return <span style={{ fontSize: '0.8rem', color: 'var(--status-success, #16a34a)', fontWeight: 600 }}>Paid in full: Invoice 1</span>;
};

const ClientRow = ({ row, onGenerated }) => {
  const { showToast } = useToast();
  const [kind, setKind] = useState(row.invoice?.kind || row.recommended);
  const [busy, setBusy] = useState(false);
  const inv = row.invoice;

  const generate = async () => {
    if (kind === 2 && !row.serviceValue) {
      return showToast(`Invoice 2 needs the Value (₹) of '${row.serviceName}' in the Service Master.`, 'error');
    }
    if (inv && !window.confirm(`Re-issue ${inv.number} as Invoice ${kind} with the current details? The number and date stay the same.`)) return;
    setBusy(true);
    try {
      const saved = await generateInvoice(row.saleId, kind);
      onGenerated(row.saleId, saved);
      await downloadInvoicePdf(row.saleId, saved.number);
      showToast(`Invoice ${saved.number} ${inv ? 're-issued' : 'generated'}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = () => downloadInvoicePdf(row.saleId, inv.number).catch(err => showToast(err.message, 'error'));
  const taxes = row.taxes.map(t => `${t.name} ${t.percent}%`).join(' + ');

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{row.billTo || row.clientName || '—'}</div>
        <div style={muted}>
          {row.clientCategory}{row.clientCategory === 'Non-Individual' && row.clientName ? ` · ${row.clientName}` : ''}
          {row.gstin ? ` · GSTIN ${row.gstin}` : ''}
        </div>
        <div style={muted}>{[row.panNumber, row.clientState].filter(Boolean).join(' · ')}</div>
      </td>
      <td>
        <div>{row.serviceName || '—'}</div>
        <div style={muted}>{row.serviceTenure} · Signed {formatMoment(row.signedAt)}</div>
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{rupees(row.grossSales || row.total)}</div>
        <div style={muted}>Net Sale {rupees(row.netSales)} · {taxes}</div>
      </td>
      <td>
        <div>{rupees(row.serviceValue)}</div>
        {row.serviceValueFrom === 'clientInformation' && <div style={muted}>(as sold)</div>}
      </td>
      <td><Status row={row} /></td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
          {[1, 2].map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" name={`kind-${row.saleId}`} checked={kind === k} onChange={() => setKind(k)} />
              Invoice {k}{row.recommended === k ? ' ★' : ''}
            </label>
          ))}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
          <button type="button" className={inv ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={generate}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : inv ? <RefreshCw size={14} /> : <FileText size={14} />}
            {inv ? 'Re-issue' : 'Generate Invoice'}
          </button>
          {inv && (
            <button type="button" className="btn-secondary" onClick={download} title={`Issued ${formatMoment(inv.issuedAt)} by ${inv.generatedBy || '—'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              <Download size={14} /> {inv.number}
            </button>
          )}
          {!inv && <span style={muted}>Will be {row.branch.code}…{row.branch.source === 'fallback' ? ' (no Branch ID)' : ''}</span>}
        </div>
      </td>
    </tr>
  );
};

export const InvoiceBlock = () => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showControls, setShowControls] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadInvoiceBlock());
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.rows.filter(r => {
      if (filter === 'invoice2' && r.recommended !== 2) return false;
      if (filter === 'pending' && r.invoice) return false;
      if (filter === 'generated' && !r.invoice) return false;
      if (!q) return true;
      return [r.clientName, r.billTo, r.firmName, r.panNumber, r.serviceName, r.invoice?.number, r.submittedBy]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [data, query, filter]);

  const onGenerated = (saleId, saved) => setData(prev => ({
    ...prev, rows: prev.rows.map(r => (r.saleId === saleId ? { ...r, invoice: saved } : r))
  }));

  const fallbackCount = data ? data.rows.filter(r => !r.invoice && r.branch.source === 'fallback').length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Section
        icon={Receipt}
        title="Invoice Block"
        subtitle="Every client who has e-signed. Compare what they paid with the service's Value (₹) in the Service Master, pick Invoice 1 or Invoice 2, then Generate Invoice."
        actions={(
          <button type="button" className="btn-secondary" disabled={loading} onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        )}
      >
        {data && !data.company.state && (
          <Warning>The Company Profile has no State, so every invoice charges IGST. Set the State in the Company Profile block.</Warning>
        )}
        {data && !data.company.gstin && <Warning>The Company Profile has no GSTIN; it is printed on every tax invoice.</Warning>}
        {data && data.company.logoIsSvg && (
          <Warning>The Company Logo is an SVG, which cannot be printed in the PDF. Upload a PNG or JPG logo in the Company Profile.</Warning>
        )}
        {fallbackCount > 0 && (
          <Warning>
            {fallbackCount === 1 ? '1 client was' : `${fallbackCount} clients were`} sold by executives whose branch has no Branch ID,
            so {fallbackCount === 1 ? 'its invoice' : 'their invoices'} would be numbered “HO…”. Set Branch IDs in Branch Profiles, or a Default Branch ID in Invoice Controls.
          </Warning>
        )}

        <div className="paid-filters" style={{ alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, firm, PAN, service, invoice no."
              style={{ width: '100%', height: '36px', paddingLeft: '32px', fontSize: '0.83rem' }} />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ height: '36px', fontSize: '0.83rem' }}>
            {FILTERS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        {!data ? (
          <Empty>{loading ? 'Loading…' : 'Could not load the e-signed clients.'}</Empty>
        ) : rows.length === 0 ? (
          <Empty>{data.rows.length === 0 ? 'No client has e-signed yet.' : 'No client matches this search.'}</Empty>
        ) : (
          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Client (Bill To)</th><th>Service</th><th>Paid</th><th>Value (₹)</th><th>Status</th><th>Invoice</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => <ClientRow key={`${r.saleId}-${r.invoice?.kind || ''}`} row={r} onGenerated={onGenerated} />)}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        icon={SlidersHorizontal}
        title="Invoice Controls"
        subtitle="GST rates, Notes, Terms & Conditions and invoice numbering."
        actions={(
          <button type="button" className="btn-secondary" onClick={() => setShowControls(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {showControls ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showControls ? 'Hide' : 'Show'}
          </button>
        )}
      >
        {showControls && data && (
          <InvoiceControls
            settings={data.settings}
            branches={data.branches}
            onSaved={(settings) => { setData(prev => ({ ...prev, settings })); load(); }}
            onBranches={(branches) => setData(prev => ({ ...prev, branches }))}
          />
        )}
      </Section>
    </div>
  );
};
