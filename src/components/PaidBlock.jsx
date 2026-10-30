import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { SERVICE_TENURES } from './ClientInformationModal';
import { TradeCallBroadcasts } from './TradeCallBroadcasts';
import {
  getTenureProgress,
  isTenureOver,
  todayKey,
  EXPIRING_SOON_DAYS,
  DEMO_TENURE_DAYS,
  PAID_STATUS_EXPIRED
} from '../services/serviceTenure';
import {
  BadgeIndianRupee,
  Users,
  CheckCircle2,
  AlarmClock,
  CalendarX2,
  Search,
  X,
  Phone,
  Mail,
  Layers,
  Trash2
} from 'lucide-react';

const STATUS_FILTERS = ['All', 'Active', 'Expiring Soon', PAID_STATUS_EXPIRED];

// Display status: the stored status, or "Service Expired" if the hourly check has not run since the tenure ended
const getDisplayStatus = (record, today) => {
  if (record.status === PAID_STATUS_EXPIRED || isTenureOver(record, today)) return PAID_STATUS_EXPIRED;
  const progress = getTenureProgress(record, today);
  if (progress && progress.left <= EXPIRING_SOON_DAYS) return 'Expiring Soon';
  return 'Active';
};

const STATUS_TONE = {
  Active: 'success',
  'Expiring Soon': 'warning',
  [PAID_STATUS_EXPIRED]: 'danger'
};

const tenureRank = (tenure) => {
  const i = SERVICE_TENURES.indexOf(tenure);
  return i === -1 ? SERVICE_TENURES.length : i;
};

const formatDate = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="badge"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone})`, border: `1px solid var(--status-${tone}-border)`, fontSize: '0.74rem', fontWeight: 700 }}
    >
      {status}
    </span>
  );
};

const TenureCell = ({ record, status, today }) => {
  const progress = getTenureProgress(record, today);
  if (!progress) {
    return <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Tenure length unknown</span>;
  }
  const tone = STATUS_TONE[status];
  return (
    <div className="paid-tenure">
      <div className="paid-tenure-bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress.percent}%`, background: `var(--status-${tone})` }} />
      </div>
      <span className="paid-tenure-label">
        {status === PAID_STATUS_EXPIRED
          ? `Ended ${formatDate(record.serviceEndDate)}`
          : `${progress.left} day${progress.left === 1 ? '' : 's'} left · day ${progress.used} of ${progress.total}`}
      </span>
    </div>
  );
};

export const PaidBlock = () => {
  const { paidClients = [], currentUser, simulatedRole, deletePaidClient } = useCRM();
  const { showToast } = useToast();
  const today = todayKey();

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';
  const seesAll = isSuperAdmin || simulatedRole === 'Admin' || currentUser?.role === 'Admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');

  // Executives, Team Leaders and Managers see the clients whose sales they registered
  const visibleClients = useMemo(
    () => paidClients
      .filter(p => seesAll || p.submittedByUserId === currentUser?.id)
      .map(p => ({ ...p, displayStatus: getDisplayStatus(p, today) })),
    [paidClients, seesAll, currentUser?.id, today]
  );

  const serviceNames = useMemo(
    () => [...new Set(visibleClients.map(p => p.serviceName))].sort((a, b) => a.localeCompare(b)),
    [visibleClients]
  );

  const filteredClients = visibleClients.filter(p => {
    if (statusFilter !== 'All' && p.displayStatus !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.clientName, p.firmName, p.phone, p.email, p.panNumber, p.documentId]
      .some(v => v && String(v).toLowerCase().includes(q));
  });

  // Service name → service tenure → clients (soonest end date first)
  const grouped = useMemo(() => {
    const byService = new Map();
    filteredClients
      .filter(p => serviceFilter === 'All' || p.serviceName === serviceFilter)
      .forEach(p => {
        if (!byService.has(p.serviceName)) byService.set(p.serviceName, new Map());
        const byTenure = byService.get(p.serviceName);
        if (!byTenure.has(p.serviceTenure)) byTenure.set(p.serviceTenure, []);
        byTenure.get(p.serviceTenure).push(p);
      });
    return [...byService.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([serviceName, byTenure]) => ({
        serviceName,
        count: [...byTenure.values()].reduce((n, list) => n + list.length, 0),
        tenures: [...byTenure.entries()]
          .sort(([a], [b]) => tenureRank(a) - tenureRank(b) || a.localeCompare(b))
          .map(([tenure, clients]) => ({
            tenure,
            clients: [...clients].sort((a, b) => (a.serviceEndDate || '9999').localeCompare(b.serviceEndDate || '9999'))
          }))
      }));
  }, [filteredClients, serviceFilter]);

  const countBy = (status) => visibleClients.filter(p => p.displayStatus === status).length;

  const handleDelete = (record) => {
    if (!window.confirm(`Remove ${record.clientName} from the Paid block? Their E-Sign record is kept.`)) return;
    deletePaidClient(record.id);
    showToast(`${record.clientName} removed from the Paid block.`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h4>Paid Clients</h4>
            <div className="value">{visibleClients.length}</div>
          </div>
          <div className="metric-icon"><Users size={18} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h4>Active Services</h4>
            <div className="value" style={{ color: 'var(--status-success)' }}>{countBy('Active') + countBy('Expiring Soon')}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h4>Expiring in {EXPIRING_SOON_DAYS} Days</h4>
            <div className="value" style={{ color: 'var(--status-warning)' }}>{countBy('Expiring Soon')}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', borderColor: 'var(--status-warning-border)' }}>
            <AlarmClock size={18} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h4>Service Expired</h4>
            <div className="value" style={{ color: 'var(--status-danger)' }}>{countBy(PAID_STATUS_EXPIRED)}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)' }}>
            <CalendarX2 size={18} />
          </div>
        </div>
      </div>

      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BadgeIndianRupee size={18} color="var(--accent)" /> Paid
            </h3>
            <p>
              Clients are added here automatically when they complete e-KYC &amp; E-Sign. Service runs from the e-sign date for the
              tenure on their Client Information page{seesAll ? '' : ' (showing the sales you registered)'}.
            </p>
          </div>
        </div>

        <div className="paid-filters">
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by client, phone, email, PAN or document ID..."
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
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize: '0.8rem', padding: '6px 10px', height: '36px' }} aria-label="Filter by status">
            {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
          </select>
        </div>

        {serviceNames.length > 0 && (
          <div className="paid-service-tabs" role="tablist" aria-label="Service name">
            {['All', ...serviceNames].map(name => {
              const count = name === 'All' ? filteredClients.length : filteredClients.filter(p => p.serviceName === name).length;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={serviceFilter === name}
                  className={`paid-service-tab${serviceFilter === name ? ' active' : ''}`}
                  onClick={() => setServiceFilter(name)}
                >
                  {name === 'All' ? 'All Services' : name}
                  <span className="paid-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {grouped.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {visibleClients.length === 0
              ? 'No paid clients yet. A client appears here as soon as Leegality reports their e-KYC & E-Sign as completed.'
              : 'No paid clients match these filters.'}
          </div>
        ) : grouped.map(service => (
          <section key={service.serviceName} className="paid-service">
            <h4 className="paid-service-title">
              <Layers size={15} /> {service.serviceName}
              <span className="paid-count">{service.count} client{service.count === 1 ? '' : 's'}</span>
            </h4>

            {service.tenures.map(({ tenure, clients }) => (
              <div key={tenure} className="paid-tenure-group">
                <div className="paid-tenure-title">
                  Service Tenure: <strong>{tenure}</strong>
                  {tenure === 'Demo' && <span style={{ color: 'var(--text-muted)' }}> ({DEMO_TENURE_DAYS} days)</span>}
                  <span className="paid-count">{clients.length}</span>
                </div>
                <div className="table-responsive">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Contact</th>
                        <th>PAN</th>
                        <th>Service Tenure</th>
                        <th>Start (E-Signed)</th>
                        <th>Ends</th>
                        <th>Tenure Tracking</th>
                        <th>Status</th>
                        <th>Registered By</th>
                        {isSuperAdmin && <th aria-label="Actions" />}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{[p.clientPrefix, p.clientName].filter(Boolean).join(' ') || '—'}</div>
                            {p.firmName && p.firmName !== p.clientName && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{p.firmName}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                              {p.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} color="var(--text-muted)" />{p.phone}</span>}
                              {p.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}><Mail size={11} />{p.email}</span>}
                              {!p.phone && !p.email && '—'}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.panNumber || '—'}</td>
                          <td><span className="badge" style={{ fontSize: '0.74rem' }}>{p.serviceTenure}</span></td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(p.serviceStartDate)}</td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatDate(p.serviceEndDate)}</td>
                          <td><TenureCell record={p} status={p.displayStatus} today={today} /></td>
                          <td><StatusBadge status={p.displayStatus} /></td>
                          <td style={{ fontSize: '0.8rem' }}>{p.submittedBy || '—'}</td>
                          {isSuperAdmin && (
                            <td>
                              <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleDelete(p)} title="Remove from the Paid block" aria-label={`Remove ${p.clientName} from the Paid block`}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {seesAll && <TradeCallBroadcasts />}
    </div>
  );
};
