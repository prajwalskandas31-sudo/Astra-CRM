import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { buildNavTree } from './Sidebar';
import { todayKey, toDateKey } from '../services/serviceTenure';
import { dashboardScope, leadsOwnedBy } from '../lib/teamScope';
import {
  PhoneCall, Users, UserCheck, CalendarClock, CalendarX2, ChevronRight, Activity, Coffee, Target
} from 'lucide-react';
import '../styles/dashboard.css';

const NEW_LEAD = 'New Lead';

// Disposition colour names (set in Settings → Dispositions) → stage stripe colours
const STAGE_COLORS = {
  blue: '#3b82f6', sky: '#0ea5e9', cyan: '#06b6d4', teal: '#14b8a6', emerald: '#10b981', green: '#22c55e',
  lime: '#84cc16', yellow: '#eab308', amber: '#f59e0b', orange: '#f97316', red: '#ef4444', rose: '#f43f5e',
  pink: '#ec4899', fuchsia: '#d946ef', purple: '#a855f7', violet: '#8b5cf6', indigo: '#6366f1',
  slate: '#64748b', gray: '#6b7280', grey: '#6b7280'
};
const stageColor = (c) => STAGE_COLORS[String(c || '').toLowerCase()] || (String(c || '').startsWith('#') ? c : 'var(--accent)');

const PERIODS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 }
];

// Blocks offered as Quick Access tiles, in this order (each shown only with Feature Access)
const QUICK_ACCESS = [
  { id: 'lead-upload', hint: 'Upload Excel sheets and lead reports' },
  { id: 'lead-history', hint: 'Every lead and who it went to' },
  { id: 'lead-summary', hint: 'Lead pool and pending requests' },
  { id: 'lead-reassignment', hint: 'Move leads between agents' },
  { id: 'sale-approvals', hint: 'Review submitted sales' },
  { id: 'esign-block', hint: 'e-KYC and e-sign status' },
  { id: 'paid-block', hint: 'Paid clients and service tenure' },
  { id: 'team-monitoring', hint: 'Teams, agents and e-sign progress' },
  { id: 'team-performance', hint: 'Calls, sales and attendance' },
  { id: 'client-master', hint: 'All client records' },
  { id: 'research-reports', hint: 'Published research reports' },
  { id: 'send-welcome-kit', hint: 'Email the client welcome kit' }
];

const NAV_ITEMS = (() => {
  const map = new Map();
  buildNavTree().forEach(n => {
    if (n.children) n.children.forEach(c => map.set(c.id, c));
    else {
      map.set(n.id, n);
      (n.subItems || []).forEach(c => map.set(c.id, c));
    }
  });
  return map;
})();

const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const pctOf = (part, whole) => (whole ? (part / whole) * 100 : 0);
const pctLabel = (p) => `${p >= 10 || p === 0 ? p.toFixed(1) : p.toFixed(2)}%`;

/** Half-donut gauge: share of leads already contacted (out of the role's leads). */
const Gauge = ({ value }) => {
  const v = Math.max(0, Math.min(100, value));
  const arc = 'M 12 100 A 88 88 0 0 1 188 100';
  return (
    <div className="dash-gauge" role="img" aria-label={`${pctLabel(v)} of leads contacted`}>
      <svg viewBox="0 0 200 110" aria-hidden="true">
        <path d={arc} pathLength="100" className="dash-gauge-track" />
        <path d={arc} pathLength="100" className="dash-gauge-fill" strokeDasharray={`${v} 100`} />
      </svg>
      <div className="dash-gauge-value">
        <strong>{pctLabel(v)}</strong>
        <span>Contacted</span>
      </div>
    </div>
  );
};

/**
 * The top of the CRM Dashboard: lead overview gauge, calls, agent activity, leads by stage and
 * Quick Access tiles. Numbers are scoped by role (own leads / own team / whole company).
 */
export const DashboardOverview = ({ onOpenBlock, onPickStage }) => {
  const {
    users = [], leads = [], dispositions = [], callStats = [], attendance = [],
    currentUser, simulatedRole, hasPermission
  } = useCRM();
  const [period, setPeriod] = useState('7d');

  const role = simulatedRole || currentUser?.role || 'Executive';
  const today = todayKey();

  const scope = useMemo(() => dashboardScope({ users, currentUser, role }), [users, currentUser, role]);
  const scopeIds = useMemo(() => new Set(scope.people.map(p => p.id)), [scope]);
  const scopeLeads = useMemo(
    () => leadsOwnedBy(leads, scope.people, { company: scope.kind === 'company' }),
    [leads, scope]
  );

  // Leads by stage, in the order dispositions are set up, plus any stage not in that list
  const stages = useMemo(() => {
    const counts = new Map();
    scopeLeads.forEach(l => {
      const d = l.disposition || NEW_LEAD;
      counts.set(d, (counts.get(d) || 0) + 1);
    });
    const known = dispositions.map(d => ({ name: d.name, color: stageColor(d.color), count: counts.get(d.name) || 0 }));
    const knownNames = new Set(dispositions.map(d => d.name));
    const extra = [...counts.entries()].filter(([name]) => !knownNames.has(name))
      .map(([name, count]) => ({ name, color: 'var(--text-muted)', count }));
    return [...known, ...extra];
  }, [scopeLeads, dispositions]);

  // Stages that hold leads, biggest first, for the stage-mix bar
  const topStages = useMemo(() => stages.filter(s => s.count > 0).sort((a, b) => b.count - a.count), [stages]);

  const total = scopeLeads.length;
  const newCount = scopeLeads.filter(l => (l.disposition || NEW_LEAD) === NEW_LEAD).length;
  const contacted = total - newCount;
  const dueToday = scopeLeads.filter(l => String(l.dispositionScheduledAt || '').startsWith(today)).length;
  const overdue = scopeLeads.filter(l => {
    const day = String(l.dispositionScheduledAt || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today;
  }).length;

  // Calls saved by the people in scope, for the chosen period
  const periodDays = PERIODS.find(p => p.id === period)?.days || 7;
  const fromKey = daysAgoKey(periodDays - 1);
  const { calls, callsToday, callersToday } = useMemo(() => {
    let inPeriod = 0;
    let todayTotal = 0;
    const callers = new Set();
    callStats.forEach(c => {
      if (!c?.userId || !scopeIds.has(c.userId) || !c.date) return;
      const n = Number(c.total) || 0;
      if (c.date >= fromKey && c.date <= today) inPeriod += n;
      if (c.date === today) {
        todayTotal += n;
        if (n > 0) callers.add(c.userId);
      }
    });
    return { calls: inPeriod, callsToday: todayTotal, callersToday: callers };
  }, [callStats, scopeIds, fromKey, today]);

  // Agent activity for leaders: who has called today, and today's attendance
  const agents = useMemo(
    () => scope.people.filter(p => p.id !== currentUser?.id && !['Super Admin', 'Admin'].includes(p.role)),
    [scope, currentUser]
  );
  const activity = useMemo(() => {
    const ids = new Set(agents.map(a => a.id));
    const todayMarks = attendance.filter(a => a?.date === today && ids.has(a.userId));
    const away = todayMarks.filter(a => a.status === 'Leave' || a.status === 'Absent').length;
    const present = todayMarks.filter(a => a.status === 'Present' || a.status === 'Half Day').length;
    const active = agents.filter(a => callersToday.has(a.id)).length;
    return { active, away, present, unmarked: agents.length - todayMarks.length };
  }, [agents, attendance, today, callersToday]);

  const tiles = QUICK_ACCESS
    .filter(t => NAV_ITEMS.has(t.id) && hasPermission(t.id))
    .map(t => ({ ...t, ...NAV_ITEMS.get(t.id) }));

  const showAgents = scope.kind !== 'self' && agents.length > 0;
  const canOpenPerformance = hasPermission('team-performance') && onOpenBlock;

  return (
    <section className="dash-overview" aria-label="Dashboard overview">
      <header className="dash-head">
        <div>
          <h2>Hello, {currentUser?.name?.split(' ')[0] || 'there'}</h2>
          <p>
            <span className="dash-scope-chip">{scope.label}</span>
            {' · '}{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="dash-periods" role="group" aria-label="Period for calls">
          {PERIODS.map(p => (
            <button key={p.id} type="button" className={period === p.id ? 'is-active' : ''} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-row">
            {/* Lead overview */}
            <article className="dash-card dash-overview-card">
              <div className="dash-card-head">
                <h3>Lead Overview</h3>
                {canOpenPerformance && (
                  <button type="button" className="dash-link" onClick={() => onOpenBlock('team-performance')}>View report</button>
                )}
              </div>
              <div className="dash-overview-body">
                <Gauge value={pctOf(contacted, total)} />
                <dl className="dash-figures">
                  <div><dt>Contacted</dt><dd>{fmt(contacted)}</dd></div>
                  <div><dt>Not yet called</dt><dd>{fmt(newCount)}</dd></div>
                  <div><dt>Total leads</dt><dd>{fmt(total)}</dd></div>
                </dl>
              </div>
              {topStages.length > 0 && (
                <div className="dash-mix">
                  <div className="dash-mix-bar" role="img" aria-label="Stage mix of these leads">
                    {topStages.map(s => (
                      <span key={s.name} style={{ width: `${pctOf(s.count, total)}%`, background: s.color }} title={`${s.name}: ${fmt(s.count)}`} />
                    ))}
                  </div>
                  <ul className="dash-mix-legend">
                    {topStages.slice(0, 5).map(s => (
                      <li key={s.name}><i style={{ background: s.color }} />{s.name} <strong>{fmt(s.count)}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            {/* Calls and activity */}
            <article className="dash-card dash-activity-card">
              <div className="dash-card-head">
                <h3>{showAgents ? 'Agent Activity' : 'My Activity'}</h3>
              </div>
              <div className="dash-stat-grid">
                <div className="dash-stat">
                  <span className="dash-stat-icon tone-accent"><PhoneCall size={16} /></span>
                  <strong>{fmt(calls)}</strong>
                  <span>Calls · {PERIODS.find(p => p.id === period)?.label.toLowerCase()}</span>
                </div>
                {showAgents ? (
                  <>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-success"><Activity size={16} /></span>
                      <strong>{activity.active}<small>/{agents.length}</small></strong>
                      <span>Agents calling today</span>
                    </div>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-info"><UserCheck size={16} /></span>
                      <strong>{activity.present}<small>/{agents.length}</small></strong>
                      <span>Present today{activity.unmarked > 0 ? ` · ${activity.unmarked} not marked` : ''}</span>
                    </div>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-warning"><Coffee size={16} /></span>
                      <strong>{activity.away}</strong>
                      <span>On leave / absent</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-success"><Target size={16} /></span>
                      <strong>{fmt(callsToday)}</strong>
                      <span>Calls today</span>
                    </div>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-info"><CalendarClock size={16} /></span>
                      <strong>{fmt(dueToday)}</strong>
                      <span>Follow-ups due today</span>
                    </div>
                    <div className="dash-stat">
                      <span className="dash-stat-icon tone-warning"><CalendarX2 size={16} /></span>
                      <strong>{fmt(overdue)}</strong>
                      <span>Follow-ups overdue</span>
                    </div>
                  </>
                )}
              </div>
            </article>
          </div>

          {tiles.length > 0 && onOpenBlock && (
            <div className="dash-quick">
              <h3 className="dash-section-title">Quick Access</h3>
              <div className="dash-tiles">
                {tiles.map(({ id, label, hint, icon: Icon }) => (
                  <button key={id} type="button" className="dash-tile" onClick={() => onOpenBlock(id)}>
                    <span className="dash-tile-icon">{Icon ? <Icon size={17} /> : <Users size={17} />}</span>
                    <span className="dash-tile-text">
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                    <ChevronRight size={15} className="dash-tile-arrow" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leads by stage */}
        <aside className="dash-card dash-stages" aria-label="Leads by stage">
          <div className="dash-card-head">
            <h3>Leads by Stage</h3>
            <span className="dash-muted">{fmt(total)} leads</span>
          </div>
          {total === 0 ? (
            <p className="dash-empty">No leads assigned yet.</p>
          ) : (
            <ul className="dash-stage-list">
              {stages.map(s => {
                const clickable = !!onPickStage && s.count > 0;
                const body = (
                  <>
                    <span className="dash-stage-main">
                      <strong>{fmt(s.count)}</strong>
                      <span>{s.name}</span>
                    </span>
                    <span className="dash-stage-pct">{pctLabel(pctOf(s.count, total))}</span>
                  </>
                );
                return (
                  <li key={s.name} style={{ '--stage': s.color }} className={s.count === 0 ? 'is-empty' : ''}>
                    {clickable ? (
                      <button type="button" onClick={() => onPickStage(s.name)} title={`Show ${s.name} leads in the pipeline`}>{body}</button>
                    ) : <div>{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
};

export default DashboardOverview;
