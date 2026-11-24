import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from './ToastNotification';
import { FileSpreadsheet, Download, RefreshCw, Search, AlertCircle } from 'lucide-react';
import { getEmailDeliveryReport } from '../services/emailService';

const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const clientOf = (r) => r.clientName || r.to || '(unknown client)';

const STATUS_STYLE = {
  Sent: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  Failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
};

/** One sheet with every email, one with a line per client (sent / failed counts). */
export const buildDeliveryWorkbook = (rows) => {
  const all = [['Client', 'Email Type', 'Status', 'Date & Time', 'To', 'From', 'Failure Type', 'Details / Reason', 'Follow-up', 'Triggered By']];
  rows.forEach(r => all.push([clientOf(r), r.emailType, r.status, when(r.at), r.to, r.from || '', r.status === 'Failed' ? r.kind : '',
    r.detail || '', r.status === 'Failed' ? (r.resolved || r.reviewed || 'Open') : '', r.by || '']));

  const perClient = new Map();
  rows.forEach(r => {
    const key = clientOf(r).trim().toLowerCase();
    const c = perClient.get(key) || { client: clientOf(r), emails: new Set(), sent: 0, failed: 0, lastSent: '', lastFailed: '' };
    if (r.to) c.emails.add(r.to);
    if (r.status === 'Sent') {
      c.sent += 1;
      if ((r.at || '') > c.lastSent) c.lastSent = r.at;
    } else {
      c.failed += 1;
      if ((r.at || '') > c.lastFailed) c.lastFailed = r.at;
    }
    perClient.set(key, c);
  });
  const summary = [['Client', 'Email ID(s)', 'Emails Sent', 'Emails Failed', 'Total Emails', 'Last Sent', 'Last Failure']];
  [...perClient.values()].sort((a, b) => a.client.localeCompare(b.client)).forEach(c =>
    summary.push([c.client, [...c.emails].join(', '), c.sent, c.failed, c.sent + c.failed, when(c.lastSent || null), when(c.lastFailed || null)]));

  const wb = XLSX.utils.book_new();
  const allSheet = XLSX.utils.aoa_to_sheet(all);
  allSheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 8 }, { wch: 22 }, { wch: 28 }, { wch: 26 }, { wch: 18 }, { wch: 60 }, { wch: 30 }, { wch: 18 }];
  const sumSheet = XLSX.utils.aoa_to_sheet(summary);
  sumSheet['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, allSheet, 'All Emails');
  XLSX.utils.book_append_sheet(wb, sumSheet, 'By Client');
  return wb;
};

/**
 * Email Block → Email Delivery Report: the Recently Sent Welcome Kits and the Failed Email Deliveries (plus the
 * other client emails the CRM sends) in one list, per client and email, exported as one Excel file.
 */
export const EmailDeliveryReport = () => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getEmailDeliveryReport());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows || [])
      .filter(r => !status || r.status === status)
      .filter(r => !q || [r.clientName, r.to, r.emailType, r.detail].some(v => String(v || '').toLowerCase().includes(q)));
  }, [data, status, query]);

  const exportExcel = () => {
    const all = data?.rows || [];
    XLSX.writeFile(buildDeliveryWorkbook(all), `Email Delivery Report ${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Exported ${all.length} emails.`, 'success');
  };

  const s = data?.summary;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={16} color="var(--accent)" /> Email Delivery Report (Sent &amp; Failed)
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '720px' }}>
            Every email triggered to each client in one report: Welcome Kits sent and failed, Service Expiry emails, Old Client and
            Extended Service invoices, and bounces. "Export Excel" downloads the whole report (all emails, plus a by-client summary).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-secondary" style={btn} onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button type="button" className="btn-primary" style={btn} onClick={exportExcel} disabled={!data?.rows?.length}>
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        {error && <div style={{ color: '#ef4444', fontSize: '0.82rem', ...btn }}><AlertCircle size={13} /> {error}</div>}
        {!data && !error && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading…</div>}

        {data && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', marginBottom: '10px' }}>
              <span>Total: <strong>{s.total}</strong></span>
              <span style={{ color: '#10b981' }}>Sent: <strong>{s.sent}</strong></span>
              <span style={{ color: '#ef4444' }}>Failed: <strong>{s.failed}</strong></span>
              <span>Clients: <strong>{s.clients}</strong></span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
                <option value="">Sent and failed</option>
                <option value="Sent">Sent only</option>
                <option value="Failed">Failed only</option>
              </select>
              <div style={{ position: 'relative', flex: '1 1 220px' }}>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, email ID or type"
                  style={{ paddingLeft: '30px', width: '100%' }} />
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table className="crm-table">
                <thead>
                  <tr><th>Client</th><th>Email</th><th>Status</th><th>When</th><th>To</th><th>Details</th><th>By</th></tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No emails to show.</td></tr>
                  ) : rows.map(r => {
                    const st = STATUS_STYLE[r.status] || STATUS_STYLE.Failed;
                    return (
                      <tr key={`${r.status}-${r.id}`}>
                        <td style={{ fontWeight: 600 }}>{clientOf(r)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{r.emailType}</td>
                        <td>
                          <span style={{ color: st.color, background: st.bg, padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {r.status}{r.status === 'Failed' && r.kind ? ` · ${r.kind}` : ''}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{when(r.at)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{r.to || '—'}</td>
                        <td style={{ fontSize: '0.78rem', maxWidth: '360px' }}>
                          {r.detail || '—'}
                          {r.status === 'Failed' && (r.resolved || r.reviewed) && (
                            <div style={{ color: '#10b981', fontSize: '0.72rem' }}>{r.resolved || r.reviewed}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{r.by || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailDeliveryReport;
