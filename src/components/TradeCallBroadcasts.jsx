import React, { useEffect, useState, useCallback } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { API_BASE_URL, isBackendEnabled, readErrorDetail } from '../services/backendConfig';
import { Send, RefreshCw, Bot, ShieldCheck, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const REFRESH_MS = 30 * 1000;

const STATUS_TONE = { Sent: 'success', 'Partly sent': 'warning', Failed: 'danger', 'Not sent': 'danger' };

const Tone = ({ tone, children }) => (
  <span
    className="badge"
    style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)`, fontSize: '0.72rem', fontWeight: 700 }}
  >
    {children}
  </span>
);

const formatTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Trade Call Broadcasts: calls posted to each service's Telegram bot go out as SMS to that
 * service's active Paid clients. The sending happens on the server; this panel shows its state.
 */
export const TradeCallBroadcasts = () => {
  const { authToken, services: crmServices = [], currentUser, simulatedRole } = useCRM();
  const { showToast } = useToast();
  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';
  const [data, setData] = useState(null);
  const [testService, setTestService] = useState('');
  const [testCall, setTestCall] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!authToken || !isBackendEnabled()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/broadcasts`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
      setData(await res.json());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load trade call broadcasts.');
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Sends from the CRM to the SMS_TEST_RECIPIENT numbers only; clients never receive a test
  const sendTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/broadcasts/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ service: testService, call: testCall })
      });
      if (!res.ok) throw new Error(await readErrorDetail(res, `Server returned ${res.status}`));
      const record = await res.json();
      if (record.status === 'Sent') showToast(`Test SMS accepted by the gateway for ${record.sent} number(s).`, 'success');
      else showToast(`Test SMS ${record.status.toLowerCase()}: ${record.error || `${record.failed} failed`}`, 'error');
      setOpenId(record.id);
      load();
    } catch (err) {
      showToast(err.message || 'Test SMS failed.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const config = data?.config;
  const services = data?.services || [];
  const broadcasts = data?.broadcasts || [];

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} color="var(--accent)" /> Trade Call Broadcasts
          </h3>
          <p>
            A call posted to a service's Telegram bot goes out as SMS to every active Paid client on that service.
            Expired clients are skipped.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <div style={{ color: 'var(--status-danger)', fontSize: '0.85rem' }}><AlertTriangle size={14} /> {error}</div>}

        {config && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.82rem' }}>
            {config.smsReady ? <Tone tone="success">SMS gateway ready</Tone> : <Tone tone="danger">SMS gateway not configured</Tone>}
            {config.sender && <span>Sender <strong>{config.sender}</strong> · route <strong>{config.service}</strong></span>}
            {config.testRecipients.length > 0 && <Tone tone="warning">Test mode: only {config.testRecipients.join(', ')} receive SMS</Tone>}
            {config.dryRun && <Tone tone="warning">Dry run: no SMS is sent</Tone>}
            {config.blockedHours && <span style={{ color: 'var(--text-muted)' }}>No SMS {config.blockedHours} (carrier rule for route {config.service})</span>}
            {config.problems.map(p => <span key={p} style={{ color: 'var(--status-danger)' }}>{p}</span>)}
          </div>
        )}

        {isSuperAdmin && (
          <form onSubmit={sendTest} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
            <select value={testService} onChange={e => setTestService(e.target.value)} required aria-label="Service for the test SMS" style={{ fontSize: '0.82rem', padding: '6px 10px', height: '36px' }}>
              <option value="">Service…</option>
              {crmServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <textarea
              value={testCall}
              onChange={e => setTestCall(e.target.value)}
              required
              rows={2}
              placeholder="e.g. NIFTY 24500 CE Buy 120 SL 100 Tgt 150"
              aria-label="Trade call text for the test SMS"
              style={{ flex: '1 1 260px', minWidth: 0, fontSize: '0.82rem', padding: '6px 10px' }}
            />
            <button type="submit" className="btn-primary" disabled={testing || !config?.testRecipients?.length} title={config?.testRecipients?.length ? '' : 'Set SMS_TEST_RECIPIENT in backend/.env first'}>
              {testing ? 'Sending…' : 'Send test SMS'}
            </button>
          </form>
        )}

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr><th>Service</th><th>Telegram bot</th><th>Bot status</th><th>Active clients</th></tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Telegram bots configured yet (TELEGRAM_BOTS in backend/.env).</td></tr>
              )}
              {services.map(s => (
                <tr key={s.service}>
                  <td style={{ fontWeight: 600 }}>{s.service}</td>
                  <td>{s.botUsername ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Bot size={14} /> @{s.botUsername}</span> : '—'}</td>
                  <td>{s.running && !s.error ? <Tone tone="success">Listening</Tone> : <Tone tone="danger">{s.error || 'Starting…'}</Tone>}</td>
                  <td>{s.activeClients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.senders?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.82rem' }}>
            <ShieldCheck size={14} color="var(--status-success)" /> Verified senders:
            {data.senders.map(s => (
              <span key={s.telegramUserId} className="badge" style={{ fontSize: '0.74rem', opacity: s.stillAllowed ? 1 : 0.5 }}>
                {s.name || 'Telegram user'} · {s.phone}{s.stillAllowed ? '' : ' (revoked)'}
              </span>
            ))}
          </div>
        )}

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr><th aria-label="Details" /><th>Time</th><th>Service</th><th>Call</th><th>Result</th><th>Delivered to gateway</th></tr>
            </thead>
            <tbody>
              {broadcasts.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No trade calls broadcast yet.</td></tr>
              )}
              {broadcasts.map(b => (
                <React.Fragment key={b.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                    <td>{openId === b.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatTime(b.createdAt)}</td>
                    <td style={{ fontSize: '0.82rem' }}>{b.service}</td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '360px', whiteSpace: 'pre-wrap' }}>{b.call}</td>
                    <td>
                      <Tone tone={STATUS_TONE[b.status] || 'warning'}>{b.status}</Tone>
                      {b.testMode && <span style={{ marginLeft: 6, fontSize: '0.72rem' }}>test</span>}
                      {b.dryRun && <span style={{ marginLeft: 6, fontSize: '0.72rem' }}>dry run</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{b.status === 'Not sent' ? '—' : `${b.sent} of ${b.sent + b.failed}`}</td>
                  </tr>
                  {openId === b.id && (
                    <tr>
                      <td />
                      <td colSpan={5} style={{ fontSize: '0.8rem' }}>
                        <div style={{ marginBottom: 6 }}>
                          Posted by {b.postedBy?.name || 'Telegram user'} ({b.postedBy?.phone}) · {b.activeClients} active client(s)
                        </div>
                        {b.error && <div style={{ color: 'var(--status-danger)', marginBottom: 6 }}>{b.error}</div>}
                        <div style={{ marginBottom: 6 }}>SMS text: <code style={{ whiteSpace: 'pre-wrap' }}>{b.message}</code></div>
                        {b.results.map((r, i) => (
                          <div key={i} style={{ color: r.ok ? 'inherit' : 'var(--status-danger)' }}>
                            {r.ok ? '✓' : '✗'} {r.clientName} · {r.phone}{r.ok ? '' : ` · ${r.status} ${r.response || ''}`}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
