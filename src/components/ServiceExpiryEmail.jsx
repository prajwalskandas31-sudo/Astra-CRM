import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from './ToastNotification';
import { CalendarX2, Save, RotateCcw, Send, RefreshCw, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import {
  getServiceExpiry, saveServiceExpiry, runServiceExpiryCheck, sendServiceExpiryTest, resendServiceExpiryEmail
} from '../services/emailService';

const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px' };
const TEMPLATE_FIELDS = ['subject', 'body'];

const STATUS = {
  sent: { color: '#10b981', icon: CheckCircle2, label: 'Sent' },
  failed: { color: '#ef4444', icon: AlertCircle, label: 'Failed' },
  skipped: { color: 'var(--text-muted)', icon: MinusCircle, label: 'Not sent' }
};

const formatDay = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Email Block → Service Expiry Email. On the day a Paid client's service tenure ends, the server disables
 * them in the Telegram Control Block and emails this message to their registered Email ID.
 */
export const ServiceExpiryEmail = ({ canEdit }) => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const apply = (d) => {
    setData(d);
    setDraft({ subject: d.subject, body: d.body });
  };

  const load = useCallback(async () => {
    try {
      apply(await getServiceExpiry());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = data && TEMPLATE_FIELDS.some(k => draft[k] !== data[k]);

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      if (success) showToast(success(res), 'success');
      return res;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const toggle = async () => {
    const enabled = !data.enabled;
    if (enabled && dirty && !window.confirm('Your template changes are not saved yet. Turn on automatic emails with the saved template?')) return;
    const res = await run('toggle', () => saveServiceExpiry({ enabled }),
      () => (enabled ? 'Service Expiry Email turned on. Clients are emailed the day their service ends.' : 'Service Expiry Email turned off.'));
    // Only the switch changed on the server; an unsaved draft stays in the form
    if (res) setData(res);
  };

  const save = async (e) => {
    e.preventDefault();
    const res = await run('save', () => saveServiceExpiry(draft), () => 'Service Expiry Email template saved.');
    if (res) apply(res);
  };

  const test = () => run('test', () => sendServiceExpiryTest(),
    r => `Test sent to ${r.to} with sample client details. Check that inbox.`);

  const checkNow = async () => {
    const res = await run('check', () => runServiceExpiryCheck(), r => {
      const sent = r.emails.filter(e => e.status === 'sent').length;
      return `Check done: ${r.disabled.length} client${r.disabled.length === 1 ? '' : 's'} disabled in Telegram Control, ${sent} email${sent === 1 ? '' : 's'} sent.`;
    });
    if (res) load();
  };

  const resend = async (entry) => {
    if (!window.confirm(`Send the Service Expiry Email to ${entry.clientName}${entry.to ? ` (${entry.to})` : ''} now?`)) return;
    const res = await run(`resend-${entry.id}`, () => resendServiceExpiryEmail(entry.paidId), r => `Service Expiry Email sent to ${r.to}.`);
    if (res) load();
  };

  const header = (
    <div style={{ padding: '20px 20px 0' }}>
      <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CalendarX2 size={16} color="var(--accent)" /> Service Expiry Email
      </h4>
      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        On the day a client's service tenure ends (the "Ends" date in the Paid block), they are disabled in the Telegram Control
        Block so trade calls stop, and this email goes to the Email ID on their Client Information Page.
      </p>
    </div>
  );

  if (error) {
    return (
      <div style={{ borderTop: '1px solid var(--border-color)' }}>
        {header}
        <p style={{ color: '#ef4444', padding: '12px 20px', margin: 0, ...btn }}><AlertCircle size={16} /> {error}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      {header}

      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
          border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: canEdit ? 'pointer' : 'default', margin: 0 }}>
            <input type="checkbox" checked={!!data.enabled} disabled={!canEdit || busy === 'toggle'} onChange={toggle} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Send automatically when a service expires
            </span>
            <span className="badge" style={{
              fontSize: '0.72rem',
              color: data.enabled ? 'var(--status-success)' : 'var(--text-muted)',
              background: data.enabled ? 'var(--status-success-bg)' : 'transparent'
            }}>
              {data.enabled ? 'On' : 'Off'}
            </span>
          </label>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {data.expiredCount} expired client{data.expiredCount === 1 ? '' : 's'} · {data.emailedCount} emailed · checked every {data.checkMinutes} min
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '8px 2px 0' }}>
          Telegram disabling always happens on expiry. Emails go from {data.senderEmail || 'the Sender Email ID above'}, once per client,
          and only to clients whose service ended in the last {data.catchUpDays} days, so turning this on never mails clients who expired long ago.
        </p>
      </div>

      <form onSubmit={save} style={{ padding: '16px 20px 20px' }}>
        <div className="form-group">
          <label htmlFor="expiry-subject">Subject</label>
          <input id="expiry-subject" type="text" value={draft.subject} readOnly={!canEdit}
            onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label htmlFor="expiry-body">Email template</label>
          <textarea id="expiry-body" rows={10} value={draft.body} readOnly={!canEdit}
            placeholder="Paste or write the email sent when a client's service expires"
            onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '8px 2px 0', lineHeight: 1.6 }}>
          Placeholders, replaced for each client:{' '}
          {data.placeholders.map(p => <code key={p} style={{ marginRight: '6px' }}>{`{${p}}`}</code>)}
        </p>
        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={btn} onClick={test}
              disabled={busy === 'test' || dirty || !data.senderEmail}
              title={dirty ? 'Save the template first' : `Sends the template with sample details to ${data.senderEmail || 'the Sender Email ID'}`}>
              <Send size={14} /> {busy === 'test' ? 'Sending…' : 'Send Test'}
            </button>
            <button type="button" className="btn-secondary" style={btn} onClick={checkNow} disabled={busy === 'check'}
              title="Disable expired clients and send any emails that are due now, instead of waiting for the next check">
              <RefreshCw size={14} /> {busy === 'check' ? 'Checking…' : 'Check Now'}
            </button>
            <button type="button" className="btn-secondary" style={btn} disabled={!dirty} onClick={() => apply(data)}>
              <RotateCcw size={14} /> Discard
            </button>
            <button type="submit" className="btn-primary" style={btn} disabled={!dirty || busy === 'save'}>
              <Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        )}
      </form>

      {data.log.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="crm-table">
            <thead>
              <tr><th>When</th><th>Client</th><th>Service</th><th>Ended</th><th>To</th><th>Status</th><th>By</th>{canEdit && <th aria-label="Actions" />}</tr>
            </thead>
            <tbody>
              {data.log.map(e => {
                const s = STATUS[e.status] || STATUS.skipped;
                const Icon = s.icon;
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.sentAt).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600 }}>{e.clientName}</td>
                    <td>{e.serviceName}{e.serviceTenure ? ` (${e.serviceTenure})` : ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDay(e.endDate)}</td>
                    <td>{e.to || '—'}</td>
                    <td title={e.error || ''}>
                      <span style={{ color: s.color, ...btn }}><Icon size={13} /> {s.label}</span>
                      {e.error && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '280px' }}>{e.error}</div>}
                    </td>
                    <td>{e.sentBy}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.74rem', ...btn }}
                          disabled={busy === `resend-${e.id}`} onClick={() => resend(e)}
                          title={e.status === 'sent' ? 'Send it again' : 'Try sending now'}>
                          <Send size={12} /> {e.status === 'sent' ? 'Resend' : 'Send now'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceExpiryEmail;
