import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { PackagePlus, Search, AlertCircle, Download, Send, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  loadExtendedService, assignExtendedService, resendExtendedServiceInvoice, downloadExtendedServiceInvoice
} from '../services/extendedServiceService';
import { confirmAsync } from './ConfirmDialog';

const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDay = (key) => {
  if (!key) return '—';
  const [y, m, d] = String(key).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const serviceValue = (s) => Number(String(s?.value ?? '').replace(/[₹,\s]/g, '')) || 0;

/**
 * Extended Service Block: enter a Net Value Limit, see every client whose paid Net Value over the last 12 months
 * crossed it (with their e-Sign date), and assign any Service Master service. Assigning puts the service live
 * (Paid / Telegram), generates its invoice and emails it to the client from the Email Block's sender.
 */
export const ExtendedServiceBlock = () => {
  const { services = [] } = useCRM();
  const { showToast } = useToast();
  const [limitInput, setLimitInput] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState({}); // clientKey -> serviceId
  const [busy, setBusy] = useState('');

  const load = useCallback(async (limit = null) => {
    setLoading(true);
    try {
      const res = await loadExtendedService(limit);
      setData(res);
      setLimitInput(prev => (limit === null ? String(res.limit || '') : prev));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(null); }, [load]);

  const applyLimit = (e) => {
    e?.preventDefault();
    const n = Number(String(limitInput).replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      showToast('Enter the Net Value Limit as an amount in ₹.', 'error');
      return;
    }
    load(n);
  };

  const pricedServices = useMemo(() => services.filter(s => (s.name || '').trim()), [services]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.clients || []).filter(c =>
      !q || [c.clientName, c.panNumber, c.phone, c.email].some(v => String(v || '').toLowerCase().includes(q)));
  }, [data, query]);

  const handleAssign = async (client) => {
    const serviceId = picked[client.clientKey];
    const service = pricedServices.find(s => s.id === serviceId);
    if (!service) {
      showToast('Pick a service from the Service Master first.', 'error');
      return;
    }
    if (!serviceValue(service)) {
      showToast(`'${service.name}' has no Value (₹) in the Service Master; set one so the invoice can be issued.`, 'error');
      return;
    }
    if (!await confirmAsync(`Assign '${service.name}' to ${client.clientName}?\n\nThe service goes live in Paid / Telegram, an invoice for ${inr(serviceValue(service))} (GST included) is generated, and it is emailed to ${client.email || 'the client'}.`, { confirmLabel: 'Assign service' })) return;
    setBusy(client.clientKey);
    try {
      const res = await assignExtendedService({ clientKey: client.clientKey, serviceId, limit: data.limit });
      if (res.emailStatus === 'sent') {
        showToast(`${service.name} assigned to ${client.clientName}. Invoice ${res.invoiceNumber} emailed to ${res.emailedTo}.`, 'success');
      } else {
        showToast(`${service.name} assigned and invoice ${res.invoiceNumber} generated, but the email failed: ${res.emailError}. Use Resend.`, 'error');
      }
      setPicked(p => ({ ...p, [client.clientKey]: '' }));
      await load(data.limit);
    } catch (err) {
      showToast(`Not assigned: ${err.message}`, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleResend = async (a) => {
    setBusy(a.id);
    try {
      const res = await resendExtendedServiceInvoice(a.id);
      if (res.emailStatus === 'sent') showToast(`Invoice ${res.invoiceNumber} emailed to ${res.emailedTo}.`, 'success');
      else showToast(`Email failed again: ${res.emailError}`, 'error');
      await load(data.limit);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackagePlus size={18} color="var(--accent)" /> Extended Service Block
          </h3>
          <p>
            Clients whose paid Net Value over the last 12 months{data ? ` (${formatDay(data.from)} – ${formatDay(data.to)})` : ''} is above
            the limit. Assigning a service puts it live in Paid / Telegram, generates its invoice at the Service Master value and emails it to the client.
          </p>
        </div>
      </div>

      <form onSubmit={applyLimit} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="ext-limit" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Net Value Limit (₹)</label>
          <input id="ext-limit" type="number" min="0" step="1" value={limitInput} onChange={e => setLimitInput(e.target.value)}
            placeholder="e.g. 100000" style={{ minWidth: '200px' }} />
        </div>
        <button type="submit" className="btn-primary" style={btn} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Show Clients
        </button>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, PAN, phone…"
            style={{ paddingLeft: '30px', width: '100%' }} />
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        {data && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--accent)' }}>{data.clients.length}</strong> client(s) above {inr(data.limit)}
        </span>}
      </form>

      {error && <p style={{ color: '#ef4444', padding: '0 20px', ...btn }}><AlertCircle size={15} /> {error}</p>}

      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>PAN / Phone</th>
              <th>Net Value (12 months)</th>
              <th>e-Sign Date</th>
              <th>Assign Service (Service Master)</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>{loading ? 'Loading…' : 'Enter a Net Value Limit.'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No client's paid Net Value over the last 12 months is above {inr(data.limit)}.
              </td></tr>
            ) : rows.map(c => (
              <tr key={c.clientKey}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.clientName || '—'}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{c.email || 'no email'}</div>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{c.panNumber || '—'}<br />{c.phone || ''}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{inr(c.netValue)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={c.sales.map(s => `${s.paymentDate}: ${inr(s.netSales)} ${s.serviceName}`).join('\n')}>
                    {c.sales.length} payment{c.sales.length === 1 ? '' : 's'}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {formatDay(c.eSignDate)}
                  {c.firstESignDate && c.firstESignDate !== c.eSignDate && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>first {formatDay(c.firstESignDate)}</div>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={picked[c.clientKey] || ''} onChange={e => setPicked(p => ({ ...p, [c.clientKey]: e.target.value }))}
                      aria-label={`Service for ${c.clientName}`} style={{ minWidth: '180px' }}>
                      <option value="">— Select service —</option>
                      {pricedServices.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{serviceValue(s) ? ` (${inr(serviceValue(s))})` : ' (no value set)'}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-primary" style={{ ...btn, padding: '5px 10px', fontSize: '0.78rem' }}
                      disabled={!picked[c.clientKey] || busy === c.clientKey} onClick={() => handleAssign(c)}>
                      <Send size={12} /> {busy === c.clientKey ? 'Assigning…' : 'Assign & Email Invoice'}
                    </button>
                  </div>
                </td>
                <td style={{ fontSize: '0.78rem', minWidth: '220px' }}>
                  {c.assignments.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None yet</span> : c.assignments.map(a => (
                    <div key={a.id} style={{ marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{a.serviceName} · {inr(a.total)}</div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {formatDay(a.assignedAt)} · Invoice {a.invoiceNumber} · until {formatDay(a.serviceEndDate)}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                        {a.emailStatus === 'sent'
                          ? <span style={{ color: '#10b981', ...btn }}><CheckCircle2 size={12} /> Emailed to {a.emailedTo}</span>
                          : <span style={{ color: '#ef4444' }} title={a.emailError || ''}>Email not sent</span>}
                        <button type="button" className="btn-secondary" style={{ ...btn, padding: '2px 7px', fontSize: '0.72rem' }}
                          onClick={() => downloadExtendedServiceInvoice(a.id, a.invoiceNumber).catch(err => showToast(err.message, 'error'))}>
                          <Download size={11} /> PDF
                        </button>
                        {a.emailStatus !== 'sent' && (
                          <button type="button" className="btn-secondary" style={{ ...btn, padding: '2px 7px', fontSize: '0.72rem' }}
                            disabled={busy === a.id} onClick={() => handleResend(a)}>
                            <Send size={11} /> {busy === a.id ? 'Sending…' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExtendedServiceBlock;
