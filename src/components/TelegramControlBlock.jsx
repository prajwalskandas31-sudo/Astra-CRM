import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { TradeCallBroadcasts } from './TradeCallBroadcasts';
import { TRADING_SEGMENTS, isTenureOver, PAID_STATUS_EXPIRED } from '../services/serviceTenure';
import { Send, Search, X } from 'lucide-react';

export { TRADING_SEGMENTS };

// Disabled on the day the service tenure ends (Paid block "Ends" date): no trade calls, boxes locked
const isDisabled = (p) => p.status === PAID_STATUS_EXPIRED || isTenureOver(p);

const formatDate = (key) => {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const TelegramControlBlock = () => {
  const { paidClients = [], togglePaidClientSegment } = useCRM();
  const [search, setSearch] = useState('');

  // Paid clients are the ones who completed E-Sign; their details come from the Client Information page
  const clients = useMemo(
    () => [...paidClients].sort((a, b) => (a.clientName || '').localeCompare(b.clientName || '')),
    [paidClients]
  );

  const disabledCount = clients.filter(isDisabled).length;

  const q = search.trim().toLowerCase();
  const filteredClients = q
    ? clients.filter(p => [p.clientName, p.phone, p.panNumber, p.serviceName, p.serviceTenure]
      .some(v => v && String(v).toLowerCase().includes(q)))
    : clients;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} color="var(--accent)" /> Telegram Control Block
            </h3>
            <p>
              Clients who have completed E-Sign, with details from their Client Information page.
              {' '}{clients.length} client{clients.length === 1 ? '' : 's'}
              {disabledCount > 0 && <>, {disabledCount} disabled because their service expired</>}.
              Clients are disabled automatically the day their service tenure ends.
            </p>
          </div>
        </div>

        <div className="paid-filters">
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by client, phone, PAN, service or tenure..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', width: '100%', fontSize: '0.83rem', height: '36px', boxSizing: 'border-box' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {clients.length === 0
              ? 'No clients have completed E-Sign yet.'
              : 'No clients match this search.'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Phone Number</th>
                  <th>PAN ID</th>
                  <th>Service Name</th>
                  <th>Service Tenure</th>
                  <th>Status</th>
                  {TRADING_SEGMENTS.map(seg => (
                    <th key={seg} style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{seg}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(p => {
                  const name = [p.clientPrefix, p.clientName].filter(Boolean).join(' ') || '—';
                  const disabled = isDisabled(p);
                  return (
                    <tr key={p.id} style={disabled ? { opacity: 0.6 } : undefined}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{p.phone || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.panNumber || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{p.serviceName || '—'}</td>
                      <td><span className="badge" style={{ fontSize: '0.74rem' }}>{p.serviceTenure || '—'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {disabled ? (
                          <span className="badge" title={`Service ended ${formatDate(p.serviceEndDate)}; trade calls stopped`}
                            style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: '1px solid var(--status-danger-border)' }}>
                            Disabled · Expired
                          </span>
                        ) : (
                          <span className="badge"
                            style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--status-success-bg)', color: 'var(--status-success)', border: '1px solid var(--status-success-border)' }}>
                            Active
                          </span>
                        )}
                      </td>
                      {TRADING_SEGMENTS.map(seg => (
                        <td key={seg} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!disabled && Array.isArray(p.segments) && p.segments.includes(seg)}
                            disabled={disabled}
                            onChange={() => togglePaidClientSegment(p.id, seg)}
                            aria-label={`${seg} for ${name}`}
                            title={disabled ? 'Service expired; renew the client to enable trade calls again' : undefined}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TradeCallBroadcasts />
    </div>
  );
};
