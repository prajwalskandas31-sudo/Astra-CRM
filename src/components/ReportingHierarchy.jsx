import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Users, Check } from 'lucide-react';

// Senior first; roles not listed here sort after these
const ROLE_RANK = { 'Super Admin': 0, Admin: 1, Manager: 2, 'Team Leader': 3, 'Team Lead': 3, Executive: 4 };
const LEADER_ROLES = ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Team Lead'];

const ROLE_COLOR = {
  'Super Admin': '#ef4444',
  Admin: '#f59e0b',
  Manager: '#3b82f6',
  'Team Leader': '#10b981',
  'Team Lead': '#10b981',
  Executive: '#a855f7'
};

const key = (name) => String(name || '').trim().toLowerCase();
const rank = (u) => ROLE_RANK[u.role] ?? 9;
const byRank = (a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name));

/**
 * Who reports to whom, built from each user's "Reporting To" (a name). Leaders (Admins, Managers, Team
 * Leaders) are shown as a tree; executives are summarised as a count under their leader.
 */
export const buildHierarchy = (users) => {
  const byName = new Map(users.map(u => [key(u.name), u]));
  const children = new Map(users.map(u => [u.id, []]));
  const roots = [];
  users.forEach(u => {
    const boss = byName.get(key(u.reportingTo));
    if (boss && boss.id !== u.id) children.get(boss.id).push(u);
    else roots.push(u);
  });
  children.forEach(list => list.sort(byRank));
  roots.sort(byRank);
  // A user's chain of command, nearest first (guards against reporting loops)
  const chainOf = (user) => {
    const chain = [];
    const seen = new Set([user.id]);
    let boss = byName.get(key(user.reportingTo));
    while (boss && !seen.has(boss.id)) {
      chain.push(boss);
      seen.add(boss.id);
      boss = byName.get(key(boss.reportingTo));
    }
    return chain;
  };
  return { byName, children, roots, chainOf };
};

/** "Exec → Team Leader A → Manager B → Super Admin C" for the selected supervisor. */
export const ReportingChain = ({ users, supervisorName, newUserLabel = 'New user' }) => {
  const { byName, chainOf } = useMemo(() => buildHierarchy(users), [users]);
  const boss = byName.get(key(supervisorName));
  if (!boss) return null;
  const chain = [boss, ...chainOf(boss)];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '0.76rem', marginTop: '8px' }}>
      <span style={{ color: 'var(--text-muted)' }}>Reporting line:</span>
      <span style={{ fontWeight: 600 }}>{newUserLabel}</span>
      {chain.map(u => (
        <React.Fragment key={u.id}>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ fontWeight: 600 }}>{u.name}</span>
          <span style={{ color: ROLE_COLOR[u.role] || 'var(--text-muted)', fontSize: '0.7rem' }}>({u.role})</span>
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * The organisation's reporting hierarchy, for the Add/Edit User modal. Users in `selectableRoles` can be
 * clicked to pick them as the new user's supervisor; the current pick and its chain are highlighted.
 */
export const ReportingHierarchy = ({ users, selectedName, onSelect, selectableRoles = LEADER_ROLES, excludeId }) => {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const { byName, children, roots, chainOf } = useMemo(() => buildHierarchy(users), [users]);

  const selected = byName.get(key(selectedName));
  const highlighted = useMemo(
    () => new Set(selected ? [selected.id, ...chainOf(selected).map(u => u.id)] : []),
    [selected, chainOf]
  );

  // The user being edited and everyone under them can't become their supervisor (it would make a loop)
  const blocked = useMemo(() => {
    const out = new Set();
    const walk = (id) => {
      if (out.has(id)) return;
      out.add(id);
      (children.get(id) || []).forEach(c => walk(c.id));
    };
    if (excludeId) walk(excludeId);
    return out;
  }, [children, excludeId]);

  const leaders = (list) => list.filter(u => LEADER_ROLES.includes(u.role));
  const members = (list) => list.filter(u => !LEADER_ROLES.includes(u.role));
  const teamSize = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    return (children.get(id) || []).reduce((n, c) => n + 1 + teamSize(c.id, seen), 0);
  };

  const toggle = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderNode = (user, depth, path) => {
    if (path.has(user.id)) return null;
    const nextPath = new Set(path).add(user.id);
    const kids = children.get(user.id) || [];
    const subLeaders = leaders(kids);
    const execs = members(kids);
    const canPick = onSelect && selectableRoles.includes(user.role) && !blocked.has(user.id) && user.status !== 'Inactive';
    const isSelected = selected?.id === user.id;
    const onChain = highlighted.has(user.id);
    const isCollapsed = collapsed.has(user.id);
    const color = ROLE_COLOR[user.role] || 'var(--text-muted)';
    return (
      <li key={user.id} style={{ listStyle: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: `${depth * 18}px`, minHeight: '28px' }}>
          {subLeaders.length > 0 ? (
            <button type="button" onClick={() => toggle(user.id)} aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : <span style={{ width: '14px', flexShrink: 0 }} />}
          <button
            type="button"
            disabled={!canPick}
            onClick={() => canPick && onSelect(user.name)}
            title={canPick ? `Report to ${user.name}` : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '6px', textAlign: 'left',
              border: `1px solid ${isSelected ? 'var(--accent-primary)' : onChain ? 'var(--accent-border)' : 'transparent'}`,
              background: isSelected ? 'var(--accent-soft)' : 'transparent',
              cursor: canPick ? 'pointer' : 'default', color: 'var(--text-primary)', fontSize: '0.8rem',
              opacity: user.status === 'Inactive' ? 0.55 : 1
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontWeight: onChain ? 700 : 500 }}>{user.name}</span>
            <span style={{ color, fontSize: '0.7rem' }}>{user.role}</span>
            {user.employeeId && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{user.employeeId}</span>}
            {isSelected && <Check size={13} color="var(--accent-primary)" />}
          </button>
          {execs.length > 0 && (
            <span title={execs.map(e => e.name).join('\n')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0 7px' }}>
              <Users size={10} /> {execs.length} executive{execs.length === 1 ? '' : 's'}
            </span>
          )}
          {subLeaders.length > 0 && isCollapsed && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{teamSize(user.id)} in team</span>
          )}
        </div>
        {!isCollapsed && subLeaders.length > 0 && (
          <ul style={{ margin: 0, padding: 0 }}>{subLeaders.map(c => renderNode(c, depth + 1, nextPath))}</ul>
        )}
      </li>
    );
  };

  const leaderRoots = leaders(roots);
  const strayExecs = members(roots);

  return (
    <div style={{ marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <GitBranch size={14} color="var(--accent-primary)" /> Reporting Hierarchy
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          {onSelect ? '— who reports to whom; click a name to select' : '— who reports to whom'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 10px 10px', maxHeight: '260px', overflowY: 'auto' }}>
          {leaderRoots.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '4px 0' }}>No Admins, Managers or Team Leaders yet.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0 }}>{leaderRoots.map(u => renderNode(u, 0, new Set()))}</ul>
          )}
          {strayExecs.length > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }} title={strayExecs.map(e => e.name).join('\n')}>
              {strayExecs.length} executive{strayExecs.length === 1 ? '' : 's'} not assigned to anyone yet.
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {['Super Admin', 'Admin', 'Manager', 'Team Leader'].map(r => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ROLE_COLOR[r] }} /> {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
