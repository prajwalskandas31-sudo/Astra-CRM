import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { todayKey } from '../services/serviceTenure';
import {
  PhoneCall,
  Layers,
  IndianRupee,
  BadgeIndianRupee,
  CalendarDays,
  CalendarCheck,
  Users,
  User,
  Building2,
  RotateCcw
} from 'lucide-react';

/**
 * Team Performance Tracking: one block, a different view per role.
 *  - Executive: their own calls, leads by data set & disposition, net sales and paid clients
 *  - Team Leader / Manager: the same, added up over the executives under them, plus one row per executive
 *  - Admin: every team side by side, with a team or executive to drill into
 *  - Super Admin: the whole company, every team, and company-wide attendance for the day
 * Anyone with people reporting to them (directly or further down) marks those people's attendance here.
 *
 * Sources: calls = callStats (one count per user per day, kept when a call outcome is saved);
 * net sales = Net Sales on the Client Information page, by Payment Date (rejected sales left out);
 * paid clients = the Paid block, by e-sign date (service start); leads = the current lead pool.
 */

const LEADER_ROLES = new Set(['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Team Lead']);
const TEAM_LEAD_ROLES = new Set(['Team Leader', 'Team Lead']);
const NEW_LEAD = 'New Lead';

const ATTENDANCE = [
  { status: 'Present', short: 'P', tone: 'success' },
  { status: 'Half Day', short: 'HD', tone: 'warning' },
  { status: 'Leave', short: 'L', tone: 'accent' },
  { status: 'Absent', short: 'A', tone: 'danger' }
];
const ATTENDANCE_BY_STATUS = Object.fromEntries(ATTENDANCE.map(a => [a.status, a]));

const toneStyle = (tone, filled = true) => {
  if (tone === 'accent') {
    return { background: filled ? 'var(--accent-soft)' : 'transparent', color: 'var(--accent)', border: '1px solid var(--accent-border)' };
  }
  return {
    background: filled ? `var(--status-${tone}-bg)` : 'transparent',
    color: `var(--status-${tone})`,
    border: `1px solid var(--status-${tone}-border)`
  };
};

const norm = (s) => String(s || '').trim().toLowerCase();
const leadOwner = (l) => (l.isUnassigned ? null : l.assignedToId || l.assigned_user_id || null);
const dataSetOf = (l) => l.sourceFileName || l.sourceFile || l.batchName || 'Single entries';
const saleDate = (s) => s.fullClientInfo?.paymentDate || s.clientInfo?.paymentDate || s.date || '';
const isRejected = (s) => /reject/i.test(String(s.status || ''));
const paidDate = (p) => p.serviceStartDate || String(p.eSignedAt || p.createdAt || '').slice(0, 10);
const toNumber = (v) => {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const inRange = (date, from, to) => !!date && date >= from && date <= to;

const formatMoney = (n) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDay = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const daysBetween = (from, to) => {
  const [a, b] = [from, to].map(k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86400000) + 1;
};

/** Everyone who reports to `user`, directly or further down (reportingTo holds the manager's name). */
const buildDescendants = (users) => {
  const byManager = new Map();
  users.forEach(u => {
    const key = norm(u.reportingTo);
    if (!byManager.has(key)) byManager.set(key, []);
    byManager.get(key).push(u);
  });
  return (user) => {
    if (!user) return [];
    const seen = new Set([user.id]);
    const out = [];
    const queue = [user];
    while (queue.length) {
      const next = queue.pop();
      (byManager.get(norm(next.name)) || []).forEach(r => {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          out.push(r);
          queue.push(r);
        }
      });
    }
    return out;
  };
};

const emptyStats = () => ({ calls: 0, callsByDisposition: {}, netSales: 0, paid: 0, newLeads: 0, leads: 0, attendance: {} });

/* ─── Small pieces ─────────────────────────────────────────────────────── */

const Kpi = ({ icon: Icon, label, value, hint }) => (
  <div className="metric-card" style={{ gap: '12px' }}>
    <div className="metric-info" style={{ minWidth: 0 }}>
      <h4>{label}</h4>
      <div className="value" style={String(value).length > 9 ? { fontSize: 'clamp(1.25rem, 2.2vw, 1.6rem)', overflowWrap: 'anywhere' } : undefined}>{value}</div>
      {hint && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>{hint}</div>}
    </div>
    <div className="metric-icon"><Icon size={18} /></div>
  </div>
);

const AttendanceBadge = ({ status }) => {
  const a = ATTENDANCE_BY_STATUS[status];
  if (!a) return <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Not marked</span>;
  return <span className="badge" style={{ ...toneStyle(a.tone), fontSize: '0.74rem', fontWeight: 700 }}>{a.status}</span>;
};

const AttendanceSummary = ({ counts, singleDay }) => {
  if (singleDay) return <AttendanceBadge status={Object.keys(counts)[0]} />;
  const parts = ATTENDANCE.filter(a => counts[a.status]);
  if (!parts.length) return <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Not marked</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
      {parts.map(a => (
        <span key={a.status} className="badge" title={a.status} style={{ ...toneStyle(a.tone), fontSize: '0.72rem', fontWeight: 700 }}>
          {a.short} {counts[a.status]}
        </span>
      ))}
    </span>
  );
};

const Section = ({ title, subtitle, actions, children }) => (
  <div className="directory-card">
    <div className="directory-toolbar">
      <div className="directory-title-area">
        <h3 style={{ margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ marginTop: '4px' }}>{subtitle}</p>}
      </div>
      {actions && <div className="directory-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
    {children}
  </div>
);

const Empty = ({ children }) => (
  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{children}</div>
);

/* ─── Date range ───────────────────────────────────────────────────────── */

const DateRangeBar = ({ mode, setMode, from, to, setFrom, setTo }) => {
  const today = todayKey();
  return (
    <div className="directory-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <CalendarDays size={15} /> Period
      </span>
      <div role="group" aria-label="Period" style={{ display: 'inline-flex', gap: '6px' }}>
        {[['today', 'Today'], ['range', 'Custom range']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? 'btn-primary' : 'btn-secondary'}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'range' ? (
        <div style={{ display: 'inline-flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            From
            <input type="date" className="select-filter" value={from} max={to || today} onChange={e => setFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            To
            <input type="date" className="select-filter" value={to} min={from} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
      ) : (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatDay(today)}</span>
      )}
    </div>
  );
};

/* ─── Leads by data set × disposition ──────────────────────────────────── */

const DataSetTable = ({ leads, ownerIds, dispositions }) => {
  const { rows, columns, totals } = useMemo(() => {
    const byDataSet = new Map();
    const seen = new Map();
    leads.forEach(l => {
      const owner = leadOwner(l);
      if (!owner || !ownerIds.has(owner)) return;
      const ds = dataSetOf(l);
      const disp = l.disposition || NEW_LEAD;
      if (!byDataSet.has(ds)) byDataSet.set(ds, { name: ds, total: 0, counts: {} });
      const row = byDataSet.get(ds);
      row.total += 1;
      row.counts[disp] = (row.counts[disp] || 0) + 1;
      seen.set(disp, (seen.get(disp) || 0) + 1);
    });
    // New Lead (what is still available to call) first, then the configured order, then anything else
    const order = [NEW_LEAD, ...dispositions.map(d => d.name).filter(n => n !== NEW_LEAD)];
    const cols = [...order.filter(n => seen.has(n)), ...[...seen.keys()].filter(n => !order.includes(n))];
    if (!cols.includes(NEW_LEAD)) cols.unshift(NEW_LEAD);
    const list = [...byDataSet.values()].sort((a, b) => (b.counts[NEW_LEAD] || 0) - (a.counts[NEW_LEAD] || 0) || a.name.localeCompare(b.name));
    const tot = { total: 0, counts: {} };
    list.forEach(r => {
      tot.total += r.total;
      Object.entries(r.counts).forEach(([k, v]) => { tot.counts[k] = (tot.counts[k] || 0) + v; });
    });
    return { rows: list, columns: cols, totals: tot };
  }, [leads, ownerIds, dispositions]);

  return (
    <Section
      title="Leads by Data Set & Disposition"
      subtitle={`The current lead pool (not limited to the period). "${NEW_LEAD}" is what is still available to call.`}
    >
      {rows.length === 0 ? (
        <Empty>No leads are assigned here yet.</Empty>
      ) : (
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Data Set</th>
                {columns.map(c => (
                  <th key={c} style={{ textAlign: 'right', ...(c === NEW_LEAD ? { color: 'var(--status-success)' } : {}) }}>
                    {c === NEW_LEAD ? 'New Leads (available)' : c}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 600, wordBreak: 'break-word' }}>{r.name}</td>
                  {columns.map(c => (
                    <td key={c} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...(c === NEW_LEAD ? { fontWeight: 700, color: 'var(--status-success)' } : {}) }}>
                      {r.counts[c] || 0}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.total}</td>
                </tr>
              ))}
              {rows.length > 1 && (
                <tr>
                  <td style={{ fontWeight: 700 }}>All data sets</td>
                  {columns.map(c => (
                    <td key={c} style={{ textAlign: 'right', fontWeight: 700 }}>{totals.counts[c] || 0}</td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{totals.total}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
};

/* ─── Calls by outcome ─────────────────────────────────────────────────── */

const CallsByOutcome = ({ stats }) => {
  const entries = Object.entries(stats.callsByDisposition).sort((a, b) => b[1] - a[1]);
  return (
    <Section title="Calls by Outcome" subtitle="Each call outcome saved on the CRM Dashboard counts as one call.">
      {entries.length === 0 ? (
        <Empty>No calls in this period.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 18px 18px' }}>
          {entries.map(([disp, n]) => (
            <div key={disp} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 200px) 1fr auto', gap: '10px', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={disp}>{disp}</span>
              <span style={{ height: '8px', borderRadius: '4px', background: 'var(--accent-soft)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.max(4, Math.round((n / stats.calls) * 100))}%`, background: 'var(--accent)', borderRadius: '4px' }} />
              </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</strong>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

/* ─── People table (one row per executive) ─────────────────────────────── */

const PeopleTable = ({ title, subtitle, people, statsFor, singleDay }) => (
  <Section title={title} subtitle={subtitle}>
    {people.length === 0 ? (
      <Empty>Nobody is assigned here yet.</Empty>
    ) : (
      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Executive</th>
              <th>Reports To</th>
              <th>{singleDay ? 'Attendance' : 'Attendance (days)'}</th>
              <th style={{ textAlign: 'right' }}>Calls</th>
              <th style={{ textAlign: 'right' }}>New Leads</th>
              <th style={{ textAlign: 'right' }}>Net Sales</th>
              <th style={{ textAlign: 'right' }}>Paid Clients</th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => {
              const s = statsFor(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{p.employeeId || p.role}</div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{p.reportingTo || '—'}</td>
                  <td><AttendanceSummary counts={s.attendance} singleDay={singleDay} /></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.calls}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.newLeads}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(s.netSales)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.paid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Section>
);

/* ─── Team comparison (Admin / Super Admin) ────────────────────────────── */

const TeamComparison = ({ teams, sumStats, onOpen }) => (
  <Section title="Teams" subtitle="Each Team Leader's executives added up. Select a team to see its executives.">
    {teams.length === 0 ? (
      <Empty>No teams yet. Executives join a team through "Reports To" in the User Directory.</Empty>
    ) : (
      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Team</th>
              <th style={{ textAlign: 'right' }}>Executives</th>
              <th style={{ textAlign: 'right' }}>Calls</th>
              <th style={{ textAlign: 'right' }}>New Leads</th>
              <th style={{ textAlign: 'right' }}>Net Sales</th>
              <th style={{ textAlign: 'right' }}>Paid Clients</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams.map(t => {
              const s = sumStats(t.members.map(m => m.id));
              return (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.hint}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{t.members.length}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.calls}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.newLeads}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(s.netSales)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.paid}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem' }} onClick={() => onOpen(t.id)}>
                      View team
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Section>
);

/* ─── Attendance marking ───────────────────────────────────────────────── */

const AttendancePanel = ({ people, attendanceIndex, markAttendance, title, subtitle }) => {
  const { showToast } = useToast();
  const [date, setDate] = useState(todayKey());
  const [filter, setFilter] = useState('');

  const visible = people.filter(p => !filter.trim() || norm(p.name).includes(norm(filter)) || norm(p.employeeId).includes(norm(filter)));
  const recordFor = (id) => attendanceIndex.get(`${id}:${date}`);
  const unmarked = people.filter(p => !recordFor(p.id));
  const counts = ATTENDANCE.map(a => ({ ...a, n: people.filter(p => recordFor(p.id)?.status === a.status).length }));

  const mark = (person, status) => {
    const current = recordFor(person.id)?.status;
    markAttendance(person.id, date, current === status ? null : status);
  };

  const markRestPresent = () => {
    unmarked.forEach(p => markAttendance(p.id, date, 'Present'));
    showToast(`${unmarked.length} ${unmarked.length === 1 ? 'person' : 'people'} marked Present for ${formatDay(date)}.`, 'success');
  };

  return (
    <Section
      title={title}
      subtitle={subtitle}
      actions={(
        <>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            Date
            <input type="date" className="select-filter" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
          {people.length > 8 && (
            <input
              type="search"
              className="select-filter"
              placeholder="Find a person…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label="Find a person"
              style={{ width: '170px' }}
            />
          )}
          <button type="button" className="btn-secondary" disabled={!unmarked.length} onClick={markRestPresent} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Mark the rest Present ({unmarked.length})
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0 18px 12px' }}>
        {counts.map(a => (
          <span key={a.status} className="badge" style={{ ...toneStyle(a.tone), fontSize: '0.76rem', fontWeight: 600 }}>{a.status}: {a.n}</span>
        ))}
        <span className="badge" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
          Not marked: {unmarked.length}
        </span>
      </div>
      {visible.length === 0 ? (
        <Empty>{people.length ? 'Nobody matches that search.' : 'Nobody reports to you yet.'}</Empty>
      ) : (
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Attendance for {formatDay(date)}</th>
                <th>Marked By</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const rec = recordFor(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{p.employeeId || ''}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{p.role}</td>
                    <td>
                      <div role="group" aria-label={`Attendance for ${p.name}`} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {ATTENDANCE.map(a => {
                          const active = rec?.status === a.status;
                          return (
                            <button
                              key={a.status}
                              type="button"
                              aria-pressed={active}
                              title={active ? `Clear ${a.status}` : `Mark ${a.status}`}
                              onClick={() => mark(p, a.status)}
                              style={{
                                ...(active
                                  ? toneStyle(a.tone)
                                  : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }),
                                borderRadius: '9999px',
                                padding: '4px 12px',
                                fontSize: '0.76rem',
                                fontWeight: active ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              {a.status}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rec ? rec.markedByName || '—' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
};

/* ─── The block ────────────────────────────────────────────────────────── */

export const TeamPerformanceBlock = () => {
  const {
    users = [], leads = [], sales = [], paidClients = [], dispositions = [],
    callStats = [], attendance = [], markAttendance, currentUser, simulatedRole
  } = useCRM();

  const today = todayKey();
  const [mode, setMode] = useState('today');
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [scope, setScope] = useState('all'); // Admin / Super Admin: 'all', a team id, or 'user:<id>'

  const [from, to] = mode === 'today'
    ? [today, today]
    : [rangeFrom || today, rangeTo || rangeFrom || today].sort();
  const singleDay = from === to;

  const role = simulatedRole || currentUser?.role || 'Executive';
  const activeUsers = useMemo(() => users.filter(u => norm(u.status) !== 'inactive'), [users]);
  const descendantsOf = useMemo(() => buildDescendants(activeUsers), [activeUsers]);
  const me = useMemo(() => users.find(u => u.id === currentUser?.id) || currentUser, [users, currentUser]);
  const below = useMemo(() => descendantsOf(me), [descendantsOf, me]);

  const isSuperAdmin = role === 'Super Admin';
  const isAdmin = role === 'Admin';
  const view = isSuperAdmin ? 'super-admin' : isAdmin ? 'admin' : (role === 'Executive' || below.length === 0) ? 'executive' : 'team';

  // Every number for every person in the period, in one pass over each source
  const perUser = useMemo(() => {
    const map = new Map();
    const get = (id) => {
      if (!map.has(id)) map.set(id, emptyStats());
      return map.get(id);
    };
    callStats.forEach(c => {
      if (!c?.userId || !inRange(c.date, from, to)) return;
      const s = get(c.userId);
      s.calls += Number(c.total) || 0;
      Object.entries(c.byDisposition || {}).forEach(([k, v]) => { s.callsByDisposition[k] = (s.callsByDisposition[k] || 0) + (Number(v) || 0); });
    });
    sales.forEach(sale => {
      const owner = sale.submittedByUserId || sale.employeeId;
      if (!owner || isRejected(sale) || !inRange(saleDate(sale), from, to)) return;
      get(owner).netSales += toNumber(sale.netSales ?? sale.fullClientInfo?.netSales);
    });
    paidClients.forEach(p => {
      if (!p.submittedByUserId || !inRange(paidDate(p), from, to)) return;
      get(p.submittedByUserId).paid += 1;
    });
    leads.forEach(l => {
      const owner = leadOwner(l);
      if (!owner) return;
      const s = get(owner);
      s.leads += 1;
      if ((l.disposition || NEW_LEAD) === NEW_LEAD) s.newLeads += 1;
    });
    attendance.forEach(a => {
      if (!a?.userId || !inRange(a.date, from, to)) return;
      const s = get(a.userId);
      s.attendance[a.status] = (s.attendance[a.status] || 0) + 1;
    });
    return map;
  }, [callStats, sales, paidClients, leads, attendance, from, to]);

  const statsFor = (id) => perUser.get(id) || emptyStats();
  const sumStats = (ids) => ids.reduce((acc, id) => {
    const s = statsFor(id);
    acc.calls += s.calls;
    acc.netSales += s.netSales;
    acc.paid += s.paid;
    acc.newLeads += s.newLeads;
    acc.leads += s.leads;
    Object.entries(s.callsByDisposition).forEach(([k, v]) => { acc.callsByDisposition[k] = (acc.callsByDisposition[k] || 0) + v; });
    return acc;
  }, emptyStats());

  const attendanceIndex = useMemo(() => new Map(attendance.map(a => [a.id, a])), [attendance]);

  // Frontline people (not leaders) under someone
  const frontlineBelow = (user) => descendantsOf(user).filter(u => !LEADER_ROLES.has(u.role));
  const allFrontline = useMemo(() => activeUsers.filter(u => !LEADER_ROLES.has(u.role)), [activeUsers]);

  // Teams for the Admin / Super Admin views: one per Team Leader, plus executives under no Team Leader
  const teams = useMemo(() => {
    if (view !== 'admin' && view !== 'super-admin') return [];
    const leaders = activeUsers.filter(u => TEAM_LEAD_ROLES.has(u.role));
    const covered = new Set();
    const list = leaders.map(l => {
      const members = descendantsOf(l).filter(u => !LEADER_ROLES.has(u.role));
      members.forEach(m => covered.add(m.id));
      return { id: `team:${l.id}`, label: `Team ${l.name}`, hint: `Team Leader${l.reportingTo ? ` · reports to ${l.reportingTo}` : ''}`, members };
    });
    const rest = allFrontline.filter(u => !covered.has(u.id));
    if (rest.length) list.push({ id: 'team:none', label: 'Not under a Team Leader', hint: 'Executives reporting to a Manager, Admin or nobody', members: rest });
    return list;
  }, [view, activeUsers, descendantsOf, allFrontline]);

  const periodLabel = singleDay ? (from === today ? 'Today' : formatDay(from)) : `${formatDay(from)} – ${formatDay(to)} (${daysBetween(from, to)} days)`;

  const dateBar = (
    <DateRangeBar mode={mode} setMode={setMode} from={rangeFrom} to={rangeTo} setFrom={setRangeFrom} setTo={setRangeTo} />
  );

  const kpis = (stats, who) => (
    <div className="metrics-grid" style={{ marginBottom: 0 }}>
      <Kpi icon={PhoneCall} label="Calls Made" value={stats.calls.toLocaleString('en-IN')} hint={`${who} · ${periodLabel}`} />
      <Kpi icon={Layers} label="New Leads Available" value={stats.newLeads.toLocaleString('en-IN')} hint={`of ${stats.leads.toLocaleString('en-IN')} leads assigned now`} />
      <Kpi icon={IndianRupee} label="Net Sales" value={formatMoney(stats.netSales)} hint="Client Information page, by payment date" />
      <Kpi icon={BadgeIndianRupee} label="Paid Clients" value={stats.paid.toLocaleString('en-IN')} hint="Paid block, by e-sign date" />
    </div>
  );

  const attendancePeople = useMemo(() => {
    const people = isSuperAdmin ? activeUsers.filter(u => u.id !== me?.id) : below;
    return [...people].sort((a, b) => a.name.localeCompare(b.name));
  }, [isSuperAdmin, activeUsers, below, me?.id]);

  const attendancePanel = attendancePeople.length > 0 && typeof markAttendance === 'function' && (
    <AttendancePanel
      people={attendancePeople}
      attendanceIndex={attendanceIndex}
      markAttendance={markAttendance}
      title={isSuperAdmin ? 'Attendance: Everyone' : 'Attendance: Your Team'}
      subtitle={isSuperAdmin
        ? 'Mark attendance for anyone in the company. Click a marked status again to clear it.'
        : 'Mark attendance for everyone who reports to you, directly or through their Team Leader. Click a marked status again to clear it.'}
    />
  );

  /* Executive ─────────────────────────────────────────────────────────── */
  if (view === 'executive') {
    const mine = statsFor(me?.id);
    const ownIds = new Set([me?.id]);
    const myAttendance = me ? attendanceIndex.get(`${me.id}:${today}`) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Header icon={User} title="My Performance" text={`Your own numbers for the period, ${me?.name || ''}.`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <CalendarCheck size={15} /> Today: <AttendanceBadge status={myAttendance?.status} />
            {!singleDay && <> · Period: <AttendanceSummary counts={mine.attendance} /></>}
          </span>
        </Header>
        {dateBar}
        {kpis(mine, 'You')}
        <CallsByOutcome stats={mine} />
        <DataSetTable leads={leads} ownerIds={ownIds} dispositions={dispositions} />
        {attendancePanel}
      </div>
    );
  }

  /* Team Leader / Manager ─────────────────────────────────────────────── */
  if (view === 'team') {
    const members = frontlineBelow(me);
    const ids = members.map(m => m.id);
    const totals = sumStats(ids);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Header icon={Users} title="My Team's Performance" text={`${members.length} executive${members.length === 1 ? '' : 's'} under ${me?.name || 'you'}, added up.`} />
        {dateBar}
        {kpis(totals, `${members.length} executive${members.length === 1 ? '' : 's'}`)}
        <PeopleTable title="Executives" subtitle="Each executive's numbers for the period." people={members} statsFor={statsFor} singleDay={singleDay} />
        <DataSetTable leads={leads} ownerIds={new Set(ids)} dispositions={dispositions} />
        <CallsByOutcome stats={totals} />
        {attendancePanel}
      </div>
    );
  }

  /* Admin / Super Admin ───────────────────────────────────────────────── */
  const selectedTeam = teams.find(t => t.id === scope);
  const selectedUser = scope.startsWith('user:') ? activeUsers.find(u => u.id === scope.slice(5)) : null;
  const scopeMembers = selectedTeam ? selectedTeam.members : selectedUser ? [selectedUser] : allFrontline;
  const scopeIds = scopeMembers.map(m => m.id);
  const scopeTotals = sumStats(scopeIds);
  const scopeName = selectedTeam ? selectedTeam.label : selectedUser ? selectedUser.name : (isSuperAdmin ? 'Whole company' : 'All teams');
  const todaysAttendance = ATTENDANCE.map(a => ({ ...a, n: attendancePeople.filter(u => attendanceIndex.get(`${u.id}:${today}`)?.status === a.status).length }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Header
        icon={isSuperAdmin ? Building2 : Users}
        title={isSuperAdmin ? 'Company Performance' : 'All Teams'}
        text={isSuperAdmin
          ? `Every team and executive in the company (${allFrontline.length} executives, ${teams.length} team${teams.length === 1 ? '' : 's'}).`
          : `Compare teams and drill into any team or executive (${allFrontline.length} executives).`}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Show
          <select className="select-filter" value={scope} onChange={e => setScope(e.target.value)} style={{ minWidth: '200px' }} aria-label="Team or executive to show">
            <option value="all">{isSuperAdmin ? 'Whole company' : 'All teams'}</option>
            <optgroup label="Teams">
              {teams.map(t => <option key={t.id} value={t.id}>{t.label} ({t.members.length})</option>)}
            </optgroup>
            <optgroup label="Executives">
              {[...allFrontline].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                <option key={u.id} value={`user:${u.id}`}>{u.name}{u.reportingTo ? ` · ${u.reportingTo}` : ''}</option>
              ))}
            </optgroup>
          </select>
        </label>
        {scope !== 'all' && (
          <button type="button" className="btn-secondary" onClick={() => setScope('all')} style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RotateCcw size={13} /> {isSuperAdmin ? 'Whole company' : 'All teams'}
          </button>
        )}
      </Header>
      {dateBar}
      {kpis(scopeTotals, scopeName)}
      {isSuperAdmin && scope === 'all' && (
        <div className="directory-card" style={{ padding: '14px 18px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
            <CalendarCheck size={15} /> Attendance today, company-wide
          </span>
          {todaysAttendance.map(a => (
            <span key={a.status} className="badge" style={{ ...toneStyle(a.tone), fontSize: '0.76rem', fontWeight: 600 }}>{a.status}: {a.n}</span>
          ))}
          <span className="badge" style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            Not marked: {attendancePeople.length - todaysAttendance.reduce((n, a) => n + a.n, 0)}
          </span>
        </div>
      )}
      {scope === 'all' && <TeamComparison teams={teams} sumStats={sumStats} onOpen={setScope} />}
      {!selectedUser && (
        <PeopleTable
          title={selectedTeam ? `${selectedTeam.label}: Executives` : 'All Executives'}
          subtitle="Each executive's numbers for the period."
          people={[...scopeMembers].sort((a, b) => a.name.localeCompare(b.name))}
          statsFor={statsFor}
          singleDay={singleDay}
        />
      )}
      <DataSetTable leads={leads} ownerIds={new Set(scopeIds)} dispositions={dispositions} />
      <CallsByOutcome stats={scopeTotals} />
      {attendancePanel}
    </div>
  );
};

const Header = ({ icon: Icon, title, text, children }) => (
  <div className="directory-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div className="metric-icon" style={{ flexShrink: 0 }}><Icon size={18} /></div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{text}</p>
      </div>
    </div>
    {children && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>{children}</div>}
  </div>
);

export default TeamPerformanceBlock;
