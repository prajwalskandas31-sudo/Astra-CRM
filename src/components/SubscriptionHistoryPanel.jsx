import React from 'react';
import { History, CheckCircle2, Clock, XCircle, Link2 } from 'lucide-react';
import { formatDay, SUB_ACTIVE, SUB_PENDING, SUB_EXPIRED } from '../services/subscriptionHistory';

const STATUS_STYLE = {
  [SUB_ACTIVE]: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', Icon: CheckCircle2, label: 'Active' },
  [SUB_PENDING]: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', Icon: Clock, label: 'Pending' },
  [SUB_EXPIRED]: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.30)', Icon: XCircle, label: 'Expired' }
};

const rupees = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString('en-IN')}` : '';
};

/**
 * Old Client view on the Client Information Page: every service this client has had, live ones first.
 */
export const SubscriptionHistoryPanel = ({ history }) => {
  const counts = history.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {});

  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <History size={16} color="var(--accent-primary)" />
        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Subscription History
        </h4>
        {[SUB_ACTIVE, SUB_PENDING, SUB_EXPIRED].filter(s => counts[s]).map(s => (
          <span key={s} style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_STYLE[s].color }}>
            {counts[s]} {STATUS_STYLE[s].label}
          </span>
        ))}
      </div>

      {history.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          No earlier service found for this client's lead, phone numbers or PAN. Check the PAN, or choose New Client.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
          {history.map(e => {
            const st = STATUS_STYLE[e.status];
            const amount = rupees(e.amount);
            return (
              <div key={`${e.source}-${e.id}`} style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px',
                padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${st.border}`, background: st.bg,
                opacity: e.status === SUB_EXPIRED ? 0.8 : 1
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700,
                  color: st.color, minWidth: '72px'
                }}>
                  <st.Icon size={13} /> {st.label}
                </span>
                <span style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>{e.serviceName}</span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {e.serviceTenure ? ` · ${e.serviceTenure}` : ''}{amount ? ` · ${amount}` : ''}
                    {` · ${e.clientType === 'Old Client' ? 'Old Client payment' : 'New Client sale'}`}
                  </span>
                  {e.expiryInherited && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <Link2 size={11} /> joined an active subscription
                    </span>
                  )}
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {e.status === SUB_PENDING
                    ? (e.pendingStage || 'Awaiting approval')
                    : <>
                        {e.startDate ? `${formatDay(e.startDate)} → ` : ''}
                        <strong style={{ color: e.status === SUB_ACTIVE ? st.color : 'var(--text-secondary)' }}>
                          {e.status === SUB_ACTIVE ? 'Expires' : 'Expired'} {formatDay(e.endDate)}
                        </strong>
                      </>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubscriptionHistoryPanel;
