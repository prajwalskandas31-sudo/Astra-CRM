import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './ToastNotification';
import { useCRM } from '../context/CRMContext';
import { sendWelcomeKit, describeSend } from '../services/emailService';
import {
  searchClient, listGrievances, uploadGrievance, renameGrievance, downloadGrievance, downloadInvoice
} from '../services/clientMasterService';
import {
  Contact, Search, X, FileSignature, Receipt, Download, MessageSquareWarning, Upload, Pencil, Check, CalendarRange, Loader2,
  CheckCircle2, XCircle, Send
} from 'lucide-react';

// Client Master: look a client up by PAN or mobile number (backend/client_master.py).

const DETAIL_ROWS = [
  ['Client Type', 'clientType'],
  ['PAN Number', 'panNumber'],
  ['Client Category', 'clientCategory'],
  ['Client Name', d => [d.clientPrefix, d.clientName].filter(Boolean).join(' ')],
  ['Firm Name', 'firmName'],
  ['GSTIN', 'gstin'],
  ['Email', 'email'],
  ['Phone 1', 'phone1'],
  ['Phone 2', 'phone2'],
  ['State', 'clientState'],
  ['Payment Date', d => formatDay(d.paymentDate)],
  ['Service Name', 'serviceName'],
  ['Service Tenure', 'serviceTenure'],
  ['Service End Date', d => formatDay(d.serviceEndDate)],
  ['Transaction No(s).', d => (Array.isArray(d.transactionNumbers) ? d.transactionNumbers : [d.transactionNumbers]).filter(Boolean).join(', ')],
  ['Mode(s) of Payment', d => (d.paymentModes || []).map(m => `${m.mode || '—'}: ${rupees(m.amount)}`).join(', ')],
  ['Gross Sales', d => d.grossSales && rupees(d.grossSales)],
  ['Net Sales', d => d.netSales && rupees(d.netSales)],
  ['GST', d => d.gst && rupees(d.gst)],
  ['Sharing Present', d => d.employeeSharing && d.employeeSharing.shares.map(s => `${s.name} (${d.employeeSharing.mode === 'percentage' ? `${s.value}%` : rupees(s.value)})`).join(', ')],
  ['Submitted On', d => formatDay(d.submissionDate)]
];

const rupees = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : String(v ?? '');
};

function formatDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return value || '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const formatMoment = (value) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDay(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value)
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
};

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

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

const ClientDetails = ({ details }) => {
  const rows = DETAIL_ROWS
    .map(([label, get]) => [label, typeof get === 'function' ? get(details) : details[get]])
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px 24px', padding: '4px 20px 20px' }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 500, overflowWrap: 'anywhere', fontFamily: label === 'PAN Number' || label === 'GSTIN' ? 'monospace' : undefined }}>{value}</div>
        </div>
      ))}
    </div>
  );
};

const Grievances = ({ clientKey }) => {
  const { showToast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null); // { id, name }
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    if (from && to && from > to) return;
    setLoading(true);
    try {
      setData(await listGrievances(clientKey, from, to));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [clientKey, from, to, showToast]);

  useEffect(() => { load(); }, [load]);

  const left = data ? Math.max(0, data.maxPerDay - data.uploadedToday) : 0;

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length || !data) return;
    const tooBig = files.filter(f => f.size > data.maxFileBytes);
    const ok = files.filter(f => f.size <= data.maxFileBytes);
    if (tooBig.length) showToast(`Skipped (over ${formatSize(data.maxFileBytes)}): ${tooBig.map(f => f.name).join(', ')}`, 'error');
    if (ok.length > left) showToast(`Only ${left} more file${left === 1 ? '' : 's'} can be uploaded for this client today; the first ${left} will be uploaded.`, 'info');
    const batch = ok.slice(0, left);
    if (!batch.length) return;
    setUploading(true);
    let done = 0;
    try {
      for (const file of batch) {
        await uploadGrievance(clientKey, file);
        done += 1;
      }
      showToast(`${done} grievance file${done === 1 ? '' : 's'} uploaded.`, 'success');
    } catch (err) {
      showToast(`${done ? `${done} uploaded, then: ` : ''}${err.message}`, 'error');
    } finally {
      setUploading(false);
      load();
    }
  };

  const saveName = async () => {
    const name = editing?.name.trim();
    if (!name) return showToast('Enter a file name.', 'error');
    try {
      const updated = await renameGrievance(editing.id, name);
      setData(prev => ({ ...prev, files: prev.files.map(f => (f.id === updated.id ? updated : f)) }));
      setEditing(null);
      showToast(`Renamed to ${updated.fileName}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const download = (file) => downloadGrievance(file).catch(err => showToast(err.message, 'error'));
  const badRange = from && to && from > to;

  return (
    <Section
      icon={MessageSquareWarning}
      title="Grievance"
      subtitle={data ? `Up to ${data.maxPerDay} files per day for this client (${formatSize(data.maxFileBytes)} each). Uploaded today: ${data.uploadedToday} of ${data.maxPerDay}.` : 'Grievance files for this client.'}
      actions={(
        <>
          <input ref={fileInput} type="file" multiple hidden onChange={onFiles} />
          <button type="button" className="btn-primary" disabled={!data || uploading || left === 0} onClick={() => fileInput.current?.click()}
            title={left === 0 ? 'The daily limit is reached; upload more tomorrow.' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : left === 0 && data ? 'Daily limit reached' : 'Upload Files'}
          </button>
        </>
      )}
    >
      <div className="paid-filters" style={{ alignItems: 'flex-end' }}>
        <CalendarRange size={16} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          From
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={{ height: '36px', fontSize: '0.83rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          To
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={{ height: '36px', fontSize: '0.83rem' }} />
        </label>
        {(from || to) && (
          <button type="button" className="btn-secondary" style={{ height: '36px' }} onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button>
        )}
        {badRange && <span style={{ color: 'var(--status-danger)', fontSize: '0.8rem', marginBottom: '10px' }}>The From date is after the To date.</span>}
      </div>

      {!data || loading && !data.files.length ? (
        <Empty>Loading…</Empty>
      ) : data.files.length === 0 ? (
        <Empty>{data.total === 0 ? 'No grievance files uploaded for this client yet.' : 'No grievance files were uploaded in these dates.'}</Empty>
      ) : (
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr><th>File Name</th><th>Uploaded</th><th>Uploaded By</th><th>Size</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data.files.map(f => (
                <tr key={f.id}>
                  <td style={{ minWidth: '220px' }}>
                    {editing?.id === f.id ? (
                      <form onSubmit={e => { e.preventDefault(); saveName(); }} style={{ display: 'flex', gap: '6px' }}>
                        <input autoFocus value={editing.name} maxLength={150} onChange={e => setEditing({ ...editing, name: e.target.value })}
                          onKeyDown={e => e.key === 'Escape' && setEditing(null)} aria-label="New file name" style={{ flex: 1, height: '32px', fontSize: '0.83rem' }} />
                        <button type="submit" className="btn-primary" style={{ padding: '4px 8px' }} aria-label="Save name"><Check size={13} /></button>
                        <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditing(null)} aria-label="Cancel rename"><X size={13} /></button>
                      </form>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{f.fileName}</div>
                        {f.renamedBy && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Renamed by {f.renamedBy}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatMoment(f.uploadedAt)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{f.uploadedBy || '—'}</td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatSize(f.size)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditing({ id: f.id, name: f.fileName })} title="Change file name" aria-label={`Rename ${f.fileName}`}><Pencil size={13} /></button>
                      <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => download(f)} title="Download" aria-label={`Download ${f.fileName}`}><Download size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
};

// ─── Five-step client status (KRA → eKYC/MITC → Welcome Kit → Service → Expired) ───
const OK = '#10b981';
const BAD = '#ef4444';
const NEUTRAL = 'var(--text-muted)';

const StatusPill = ({ ok, children, tone }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
    color: tone || (ok ? OK : BAD), background: tone ? 'rgba(148,163,184,0.12)' : ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
  }}>
    {!tone && (ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />)} {children}
  </span>
);

const Step = ({ n, title, children, action }) => (
  <div style={{ flex: '1 1 180px', minWidth: '170px', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Step {n} · {title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>{children}</div>
    {action}
  </div>
);

const StepButton = ({ onClick, busy, children }) => (
  <button type="button" className="btn-secondary" onClick={onClick} disabled={busy}
    style={{ alignSelf: 'flex-start', padding: '3px 9px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
    {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {children}
  </button>
);

const ClientStatusOverview = ({ status, onChanged }) => {
  const { currentUser, sales = [], triggerEKycAndESign } = useCRM();
  const { showToast } = useToast();
  const [busy, setBusy] = useState('');
  if (!status) return null;
  const { kra, ekyc, welcomeKit, service, expired } = status;
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const ekycSale = sales.find(s => s.id === ekyc.saleId);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
      // The browser's sales reach the server within a few seconds; re-read the client after that
      setTimeout(() => onChanged?.(), 2500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const triggerEKyc = () => run('ekyc', async () => {
    const res = await triggerEKycAndESign(ekyc.saleId);
    showToast(`e-KYC & E-Sign link sent (Leegality Doc ID ${res.apiResult.documentId}).`, 'success');
  });
  const triggerKit = () => run('kit', async () => {
    const res = await sendWelcomeKit(welcomeKit.saleId);
    showToast(describeSend(res), 'success');
  });

  // e-KYC can be (re)sent while the latest sale is not signed and its link is not live
  const ekycPending = !ekyc.completed && !!ekyc.saleId && !ekyc.oldClientOnly &&
    (!ekyc.linkSent || ['Rejected by Client', 'Invitation Expired', 'Link Deleted'].includes(ekyc.eSignStatus));

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '0 20px 18px' }} aria-label="Client status overview">
      <Step n={1} title="KRA">
        <StatusPill ok={kra.completed}>{kra.completed ? 'KRA Completed' : 'KRA Not Completed'}</StatusPill>
        {kra.completed && kra.kycStatus && <span style={{ fontSize: '0.72rem', color: NEUTRAL }}>{kra.kycStatus}</span>}
      </Step>

      <Step n={2} title="eKYC / MITC" action={ekycPending && isSuperAdmin && ekycSale && (
        <StepButton onClick={triggerEKyc} busy={busy === 'ekyc'}>{ekyc.linkSent ? 'Re-send eKYC/MITC Link' : 'Trigger eKYC/MITC'}</StepButton>
      )}>
        {ekyc.oldClientOnly ? (
          <StatusPill tone={NEUTRAL}>Not required (Old Client)</StatusPill>
        ) : (
          <>
            <StatusPill ok={ekyc.completed}>{ekyc.completed ? 'eKYC/MITC Completed' : 'eKYC/MITC Not Completed'}</StatusPill>
            <StatusPill ok={ekyc.linkSent}>{ekyc.linkSent ? 'eKYC/MITC Link Sent' : 'eKYC/MITC Link Not Sent'}</StatusPill>
            {ekyc.completed && ekyc.signedAt && <span style={{ fontSize: '0.72rem', color: NEUTRAL }}>e-Signed {formatDay(ekyc.signedAt)}</span>}
            {ekycPending && !isSuperAdmin && <span style={{ fontSize: '0.72rem', color: NEUTRAL }}>A Super Admin can trigger it.</span>}
          </>
        )}
      </Step>

      <Step n={3} title="Welcome Kit" action={!welcomeKit.sent && welcomeKit.saleId && (
        <StepButton onClick={triggerKit} busy={busy === 'kit'}>Send Welcome Kit</StepButton>
      )}>
        <StatusPill ok={welcomeKit.sent}>{welcomeKit.sent ? 'Welcome Kit Sent' : 'Welcome Kit Not Sent'}</StatusPill>
        {welcomeKit.sent && <span style={{ fontSize: '0.72rem', color: NEUTRAL }}>{formatMoment(welcomeKit.sentAt)}{welcomeKit.to ? ` · ${welcomeKit.to}` : ''}</span>}
      </Step>

      <Step n={4} title="Service">
        <StatusPill ok={service.enabled}>{service.enabled ? 'Service Enabled' : 'Service Disabled'}</StatusPill>
        {service.services.map((x, i) => (
          <span key={i} style={{ fontSize: '0.72rem', color: NEUTRAL }}>
            {x.serviceName}{x.segments.length ? ` · ${x.segments.join(', ')}` : ' · no segment'}{x.endDate ? ` · until ${formatDay(x.endDate)}` : ''}
          </span>
        ))}
      </Step>

      <Step n={5} title="Expired">
        {!expired.hasService
          ? <StatusPill tone={NEUTRAL}>No service yet</StatusPill>
          : <StatusPill ok={!expired.expired}>{expired.expired ? 'Service Expired' : 'Not Expired'}</StatusPill>}
        {expired.hasService && expired.endDate && (
          <span style={{ fontSize: '0.72rem', color: NEUTRAL }}>{expired.expired ? 'Ended' : 'Ends'} {formatDay(expired.endDate)}</span>
        )}
      </Step>
    </div>
  );
};

export const ClientMasterBlock = () => {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const runSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError('');
    setResult(null);
    try {
      setResult(await searchClient(q));
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const reset = () => { setQuery(''); setResult(null); setError(''); };
  // Re-read the client after a trigger in the status overview (keeps the current result on failure)
  const refresh = async () => {
    if (!result?.query) return;
    try {
      setResult(await searchClient(result.query.value));
    } catch { /* keep what is shown */ }
  };
  const getInvoice = (inv) => downloadInvoice(inv).catch(err => showToast(err.message, 'error'));
  const name = result && ([result.client.clientPrefix, result.client.clientName].filter(Boolean).join(' ') || result.client.firmName || 'Client');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Section icon={Contact} title="Client MASTER" subtitle="Enter a client's PAN Number or Mobile Number to see what is on file for them.">
        <form onSubmit={runSearch} className="paid-filters">
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="PAN Number (ABCDE1234F) or Mobile Number (10 digits)"
              aria-label="PAN Number or Mobile Number"
              maxLength={30}
              style={{ paddingLeft: '32px', paddingRight: query ? '32px' : '12px', width: '100%', fontSize: '0.85rem', height: '38px', boxSizing: 'border-box' }}
            />
            {query && (
              <button type="button" onClick={reset} aria-label="Clear" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={searching || !query.trim()} style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
          </button>
        </form>
        {error && <div role="alert" style={{ margin: '0 20px 18px', color: 'var(--status-danger)', fontSize: '0.85rem' }}>{error}</div>}
        {result && <ClientStatusOverview status={result.status} onChanged={refresh} />}
      </Section>

      {result && (
        <>
          <Section icon={Contact} title={name} subtitle={`Client Information Page details (latest submission${result.submissions.length > 1 ? ` of ${result.submissions.length}` : ''}).`}>
            <ClientDetails details={result.client} />
            {result.submissions.length > 1 && (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead><tr><th>Submitted On</th><th>Client Type</th><th>Service</th><th>Tenure</th><th>Gross Sales</th><th>Submitted By</th><th>Status</th></tr></thead>
                  <tbody>
                    {result.submissions.map((s, i) => (
                      <tr key={s.saleId || s.leadId || i}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatDay(s.date) || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.details.clientType || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.details.serviceName || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.details.serviceTenure || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.details.grossSales ? rupees(s.details.grossSales) : '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.submittedBy || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{s.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section icon={FileSignature} title="Leegality Signing" subtitle="When this client signed the agreement on Leegality.">
            {result.leegality.length === 0 ? <Empty>No Leegality agreement has been signed by this client yet.</Empty> : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead><tr><th>Signed On</th><th>Document ID</th><th>Service</th><th>Tenure</th><th>Signature Type</th></tr></thead>
                  <tbody>
                    {result.leegality.map(r => (
                      <tr key={r.documentId}>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMoment(r.signedAt)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.documentId || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{r.serviceName || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{r.serviceTenure || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{r.signatureType || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section icon={Receipt} title="Invoices" subtitle="Invoices emailed to this client.">
            {result.invoices.length === 0 ? <Empty>No invoice has been emailed to this client yet.</Empty> : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead><tr><th>Invoice No.</th><th>Sent On</th><th>Sent To</th><th>Service</th><th>Amount</th><th aria-label="Download" /></tr></thead>
                  <tbody>
                    {result.invoices.map(inv => (
                      <tr key={inv.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatMoment(inv.sentAt)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{inv.emailedTo || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{[inv.serviceName, inv.serviceTenure && `(${inv.serviceTenure})`].filter(Boolean).join(' ') || '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{inv.grossSales ? rupees(inv.grossSales) : '—'}</td>
                        <td>
                          <button type="button" className="btn-secondary" onClick={() => getInvoice(inv)} style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                            <Download size={13} /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Grievances key={result.clientKey} clientKey={result.clientKey} />
        </>
      )}
    </div>
  );
};
