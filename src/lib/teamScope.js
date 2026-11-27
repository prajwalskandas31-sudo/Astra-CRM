// Who a user's numbers cover, shared by the CRM Dashboard overview and Team Performance Tracking.

export const norm = (s) => String(s || '').trim().toLowerCase();

/** Everyone who reports to `user`, directly or further down (reportingTo holds the manager's name). */
export const buildDescendants = (users) => {
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

/** True when a lead has no owner (these never count in anyone's pipeline). */
export const isUnassignedLead = (l) =>
  !!l.isUnassigned || !l.assignedToId || l.assignedToId === 'unassigned' || l.assignedToName === 'Unassigned';

/**
 * The people whose leads and calls a user sees on the dashboard:
 *  - Super Admin / Admin: the whole company
 *  - anyone with people reporting to them: themselves and everyone below them
 *  - everyone else: only themselves
 */
export const dashboardScope = ({ users = [], currentUser, role }) => {
  const active = users.filter(u => norm(u.status) !== 'inactive');
  const me = users.find(u => u.id === currentUser?.id) || currentUser || null;
  if (role === 'Super Admin' || role === 'Admin') {
    return { kind: 'company', label: 'Whole company', people: active };
  }
  const below = role === 'Executive' ? [] : buildDescendants(active)(me);
  if (below.length > 0) {
    return { kind: 'team', label: `Your team · ${below.length + 1} people`, people: me ? [me, ...below] : below };
  }
  return { kind: 'self', label: 'Your leads', people: me ? [me] : [] };
};

/** Filters leads to those owned by one of `people` (by id, or by name/email for older records). */
export const leadsOwnedBy = (leads, people, { company = false } = {}) => {
  if (company) return leads.filter(l => !isUnassignedLead(l));
  const ids = new Set();
  const names = new Set();
  const emails = new Set();
  people.forEach(p => {
    if (p?.id) ids.add(p.id);
    if (p?.name) names.add(norm(p.name));
    if (p?.email) emails.add(norm(p.email));
  });
  return leads.filter(l => {
    if (isUnassignedLead(l)) return false;
    return ids.has(l.assignedToId) || ids.has(l.assigned_user_id) ||
      names.has(norm(l.assignedToName)) || (!!l.assignedToEmail && emails.has(norm(l.assignedToEmail)));
  });
};
