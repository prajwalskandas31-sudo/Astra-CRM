import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { tableSheet, writeReport } from '../lib/reportExcel';
import { useToast } from './ToastNotification';
import { MailX, RefreshCw, Download, CheckCircle2, AlertCircle, Clock, Search, Undo2 } from 'lucide-react';
import {
  getEmailFailures, scanEmailBounces, markEmailFailureReviewed, unmarkEmailFailureReviewed
} from '../services/emailService';
import { promptAsync } from './ConfirmDialog';

const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px' };
// The mailbox is re-read automatically when the last check is older than this
const AUTO_SCAN_MS = 60 * 60 * 1000;

const KIND_STYLE = {
  Bounced: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'Not sent': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'No valid Email ID': { color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  Delayed: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' }
};

const FILTERS = [
  { value: 'open', label: 'Needs follow-up' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Resolved / reviewed' }
];

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const isOpen = (r) => !r.resolved && !r.review;

const Pill = ({ kind }) => {
  const s = KIND_STYLE[kind] || KIND_STYLE['Not sent'];
  return (
    <span style={{ color: s.color, background: s.bg, padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {kind}
    </span>
  );
};

/**
 * Email Block → Failed Email Deliveries: every client email the CRM attempted that did not reach the client
 * (refused by the mail server, no valid Email ID, or bounced back into the sender mailbox).
 */
export const EmailFailuresReport = () => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('open');
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');

  const scan = useCallback(async (quiet) => {
    setScanning(true);
    try {
      const res = await scanEmailBounces();
      setData(res);
      setError('');
      if (!quiet) {
        if (res.scan?.error) showToast(res.scan.error, 'error');
        else showToast(`Mailbox checked: ${res.scan.checked} bounce message${res.scan.checked === 1 ? '' : 's'} read.`, 'success');
      }
    } catch (err) {
      if (!quiet) showToast(err.message, 'error');
    } finally {
      setScanning(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getEmailFailures();
        if (cancelled) return;
        setData(res);
        const last = res.scan?.at ? new Date(res.scan.at).getTime() : 0;
        if (Date.now() - last > AUTO_SCAN_MS) scan(true);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [scan]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows || []).filter(r =>
      (filter === 'all' || (filter === 'open' ? isOpen(r) : !isOpen(r))) &&
      (!source || r.source === source) &&
      (!q || [r.clientName, r.to, r.error, r.subject].some(v => String(v || '').toLowerCase().includes(q)))
    );
  }, [data, filter, source, query]);

  const review = async (row) => {
    let note = '';
    if (!row.review) {
      note = await promptAsync(`Follow-up note for ${row.clientName || row.to} (optional):`, '');
      if (note === null) return;
    }
    setBusyId(row.id);
    try {
      if (row.review) await unmarkEmailFailureReviewed(row.id);
      else await markEmailFailureReviewed(row.id, note);
      setData(await getEmailFailures());
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  };

  const exportExcel = () => {
    const today = new Date().toISOString().slice(0, 10);
    const records = rows.map(r => ({
      'Date': when(r.at),
      'Client': r.clientName || '(not matched to a client)',
      'Email ID': r.to || '',
      'Email': r.source,
      'Subject': r.subject || '',
      'Problem': r.kind,
      'Status Code': r.status || '',
      'Failure Details': r.error || '',
      'Attempted By': r.attemptedBy || '',
      'Resolved': r.resolved || '',
      'Reviewed By': r.review ? `${r.review.by} (${when(r.review.at)})` : '',
      'Follow-up Note': r.review?.note || ''
    }));
    const sheet = tableSheet({
      title: 'Failed Email Deliveries', subtitle: `As on ${today}`, records,
      header: ['Date', 'Client', 'Email ID', 'Email', 'Subject', 'Problem', 'Status Code', 'Failure Details', 'Attempted By', 'Resolved', 'Reviewed By', 'Follow-up Note'],
      cols: [18, 24, 30, 20, 28, 16, 12, 60, 18, 36, 26, 36]
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Failed Emails');
    writeReport(wb, `Failed Email Deliveries ${today}.xlsx`);
  };

  const summary = data?.summary;
  const sources = Object.keys(summary?.bySource || {});

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MailX size={16} color="#ef4444" /> Failed Email Deliveries
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '720px' }}>
            Clients whose Welcome Kit, invoice or service-expiry email did not reach them: refused by the mail server,
            no valid Email ID, or bounced back into the sender mailbox. Correct the Email ID and resend, then mark the row as reviewed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-secondary" style={btn} onClick={() => scan(false)} disabled={scanning}>
            <RefreshCw size={14} className={scanning ? 'spin' : ''} /> {scanning ? 'Checking mailbox…' : 'Check mailbox for bounces'}
          </button>
          <button type="button" className="btn-secondary" style={btn} onClick={exportExcel} disabled={!rows.length}>
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        {error && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}><AlertCircle size={13} /> {error}</div>}
        {!data && !error && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading…</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <Stat label="Need follow-up" value={summary.open} color={summary.open ? '#ef4444' : '#10b981'} />
              <Stat label="Clients affected" value={summary.clients} />
              {sources.map(s => <Stat key={s} label={s} value={summary.bySource[s]} small />)}
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} />
              {data.scan
                ? data.scan.error
                  ? <span style={{ color: '#f59e0b' }}>Last mailbox check {when(data.scan.at)}: {data.scan.error}</span>
                  : <>Mailbox last checked for bounces {when(data.scan.at)} ({data.scan.checked} bounce message{data.scan.checked === 1 ? '' : 's'} in the last 90 days)</>
                : 'The mailbox has not been checked for bounces yet.'}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
                {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={source} onChange={e => setSource(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All emails</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ position: 'relative', flex: '1 1 220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, email ID or reason"
                  style={{ paddingLeft: '30px', width: '100%' }} />
              </div>
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ verticalAlign: 'middle' }} />{' '}
                {filter === 'open' ? 'No failed client emails need follow-up.' : 'No failed emails match.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="crm-table">
                  <thead>
                    <tr><th>Date</th><th>Client</th><th>Email ID</th><th>Email</th><th>Problem</th><th>Failure Details</th><th>Follow-up</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} style={{ opacity: isOpen(r) ? 1 : 0.65 }}>
                        <td style={{ whiteSpace: 'nowrap' }}>{when(r.at)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {r.clientName || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Not matched to a client</span>}
                          {r.attemptedBy && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>by {r.attemptedBy}</div>}
                        </td>
                        <td>{r.to || <span style={{ color: 'var(--text-muted)' }}>none on file</span>}</td>
                        <td>
                          {r.source}
                          {r.subject && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title={r.subject}>“{r.subject}”</div>}
                        </td>
                        <td><Pill kind={r.kind} />{r.status && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>code {r.status}</div>}</td>
                        <td style={{ maxWidth: '360px', fontSize: '0.78rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.error}</td>
                        <td style={{ fontSize: '0.76rem', minWidth: '170px' }}>
                          {r.resolved && <div style={{ color: '#10b981', ...btn }}><CheckCircle2 size={12} /> {r.resolved}</div>}
                          {r.review && (
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Reviewed by {r.review.by}, {when(r.review.at)}
                              {r.review.note && <div style={{ fontStyle: 'italic' }}>“{r.review.note}”</div>}
                            </div>
                          )}
                          {!r.resolved && (
                            <button type="button" className="btn-secondary" style={{ ...btn, padding: '3px 8px', fontSize: '0.74rem', marginTop: '4px' }}
                              disabled={busyId === r.id} onClick={() => review(r)}>
                              {r.review ? <><Undo2 size={12} /> Reopen</> : <><CheckCircle2 size={12} /> Mark reviewed</>}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, color, small }) => (
  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', background: 'var(--bg-card)' }}>
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: small ? '1.05rem' : '1.35rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
  </div>
);
