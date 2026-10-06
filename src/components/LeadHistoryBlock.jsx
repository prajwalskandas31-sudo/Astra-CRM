import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  History,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  User,
  Phone,
  Globe,
  Clock,
  Filter
} from 'lucide-react';

export const LeadHistoryBlock = () => {
  const { leads, users, currentUser, simulatedRole } = useCRM();
  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  const [search, setSearch] = useState('');
  const [historyUserFilter, setHistoryUserFilter] = useState(() => 
    (simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin' ? 'ALL' : 'SELF')
  );
  const [dispFilter, setDispFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const effectiveUserId =
    isSuperAdmin && historyUserFilter !== 'SELF' && historyUserFilter !== 'ALL'
      ? historyUserFilter
      : currentUser?.id;

  const effectiveUserName =
    historyUserFilter === 'ALL'
      ? 'All Representatives & Users'
      : isSuperAdmin && historyUserFilter !== 'SELF'
        ? users?.find(u => u.id === historyUserFilter)?.name || 'Selected User'
        : currentUser?.name || 'You';

  const historyLeads = useMemo(() => {
    if (isSuperAdmin && historyUserFilter === 'ALL') {
      return leads.filter(l => l && (l.assignedToId || l.assignedToName || (l.history && l.history.length > 0)));
    }

    const targetId = effectiveUserId;
    const targetName = (
      isSuperAdmin && historyUserFilter !== 'SELF'
        ? users?.find(u => u.id === historyUserFilter)?.name
        : currentUser?.name
    ) || '';
    const targetNameLow = targetName.trim().toLowerCase();

    return leads.filter(l => {
      if (!l) return false;
      const currentlyAssigned =
        l.assignedToId === targetId ||
        l.assigned_user_id === targetId ||
        (targetNameLow &&
          (l.assignedToName || '').trim().toLowerCase() === targetNameLow);
      const appearsInHistory =
        !currentlyAssigned &&
        targetNameLow.length > 0 &&
        (l.history || []).some(
          h =>
            (h.text || '').toLowerCase().includes(targetNameLow) ||
            (h.by || '').toLowerCase().includes(targetNameLow)
        );
      return currentlyAssigned || appearsInHistory;
    });
  }, [leads, effectiveUserId, historyUserFilter, users, currentUser, isSuperAdmin]);

  const uniqueDispositions = useMemo(() => {
    const s = new Set(historyLeads.map(l => l.disposition || 'New Lead'));
    return ['All', ...Array.from(s).sort()];
  }, [historyLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return historyLeads.filter(l => {
      if (dispFilter !== 'All' && (l.disposition || 'New Lead') !== dispFilter) return false;
      const firstDate = l.history?.[0]?.date || l.createdAt || '';
      if (dateFrom && firstDate && firstDate < dateFrom) return false;
      if (dateTo && firstDate && firstDate > dateTo) return false;
      if (q) {
        const haystack = [
          l.contactPerson, l.phone, l.language, l.disposition,
          l.assignedToName, l.assignedToEmail,
          ...(l.history || []).map(h => h.text || ''),
          ...(l.history || []).map(h => h.by || '')
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [historyLeads, search, dispFilter, dateFrom, dateTo]);

  const toggleRow = id => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dispColor = disp => {
    const map = {
      'New Lead': '#3b82f6', 'Interested': '#10b981', 'Call Back Later': '#f59e0b',
      'Give Demo Call': '#8b5cf6', 'Follow Up': '#6366f1', 'Not Interested': '#ef4444',
      'Commitment': '#06b6d4', 'Paid / Converted': '#10b981'
    };
    return map[disp] || 'var(--accent-primary)';
  };

  return (
    <div className="directory-card" id="lead-history-block" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <History size={18} color="var(--accent-primary)" />
            Lead Assignment History
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isSuperAdmin
              ? <span>All past &amp; present assignments. Viewing: <strong style={{ color: 'var(--accent-primary)' }}>{effectiveUserName}</strong></span>
              : 'Your complete lead assignment history — current & past.'}
          </p>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <User size={14} color="var(--text-muted)" />
            <select
              value={historyUserFilter}
              onChange={e => { setHistoryUserFilter(e.target.value); setExpandedRows(new Set()); }}
              style={{ fontSize: '0.8rem', padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', minWidth: '230px' }}
            >
              <option value="ALL">🌐 All Users &amp; Assigned Leads</option>
              <option value="SELF">My Assigned Leads ({currentUser?.name})</option>
              <optgroup label="Filter by Specific User">
                {(users || []).map(u => {
                  const userCount = leads.filter(l => l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.toLowerCase() === (u.name || '').toLowerCase())).length;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {userCount} Leads
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary, rgba(255,255,255,0.02))' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, phone, disposition, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px', width: '100%', fontSize: '0.83rem', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1 }}>
              <X size={13} />
            </button>
          )}
        </div>
        <select value={dispFilter} onChange={e => setDispFilter(e.target.value)} style={{ fontSize: '0.8rem', padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', height: '36px' }}>
          {uniqueDispositions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" onClick={() => setShowFilters(f => !f)} className="btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px', height: '36px', display: 'flex', alignItems: 'center', gap: '5px', borderColor: showFilters ? 'var(--accent-primary)' : 'var(--border-color)', color: showFilters ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
          <Filter size={13} /> Date Filter {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ background: 'var(--accent-soft)', color: 'var(--accent-primary)', borderRadius: 'var(--radius-full)', padding: '3px 10px', fontWeight: 700, fontSize: '0.82rem' }}>{filteredLeads.length}</span>
          of {historyLeads.length} leads
        </div>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px 20px', background: 'rgba(139,92,246, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '0.8rem', padding: '5px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '0.8rem', padding: '5px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="btn-secondary" style={{ fontSize: '0.76rem', padding: '4px 10px', height: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={12} /> Clear Dates
            </button>
          )}
        </div>
      )}

      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>CONTACT NAME</th>
              <th>PHONE</th>
              <th>LANGUAGE</th>
              <th>DISPOSITION</th>
              <th>ASSIGNED TO</th>
              <th>FIRST ASSIGNED</th>
              <th>TIMELINE</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <History size={28} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: '0.88rem' }}>
                      {search || dispFilter !== 'All' || dateFrom || dateTo ? 'No leads match your search / filter criteria.' : 'No assignment history found for this user.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeads.map(l => {
                const isExpanded = expandedRows.has(l.id);
                const firstDate = l.history?.[0]?.date || l.createdAt || '—';
                const dispCol = dispColor(l.disposition || 'New Lead');
                return (
                  <React.Fragment key={l.id}>
                    <tr style={{ cursor: 'pointer', transition: 'background 0.15s', background: isExpanded ? 'var(--accent-soft)' : undefined }} onClick={() => toggleRow(l.id)} title="Click to expand interaction history">
                      <td style={{ fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{isExpanded ? <ChevronUp size={13} color="var(--accent-primary)" /> : <ChevronDown size={13} color="var(--text-muted)" />}{l.contactPerson || '—'}</div></td>
                      <td><span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.84rem' }}><Phone size={11} color="var(--text-muted)" />{l.phone || '—'}</span></td>
                      <td><span className="badge" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Globe size={10} />{l.language || 'English'}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="badge" style={{ background: dispCol + '18', color: dispCol, border: '1px solid ' + dispCol + '44', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Tag size={10} />{l.disposition || 'New Lead'}</span>
                          {l.dispositionScheduledAt && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={9} /> {l.dispositionScheduledAt}</span>}
                        </div>
                      </td>
                      <td><span style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} color="var(--text-muted)" />{l.assignedToName || '—'}</span></td>
                      <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={11} />{firstDate}</span></td>
                      <td><span style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '2px 9px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{(l.history || []).length} {(l.history || []).length === 1 ? 'entry' : 'entries'}</span></td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: '14px 28px 18px 28px', background: 'linear-gradient(to right, var(--accent-soft), transparent)', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                              <History size={13} color="var(--accent-primary)" />
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interaction & Assignment Timeline</span>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px' }}>— {l.contactPerson}</span>
                            </div>
                            {(l.history || []).length === 0 ? (
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No interaction log entries recorded yet.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'var(--border-color)', borderRadius: '1px' }} />
                                {[...(l.history || [])].reverse().map((h, i) => (
                                  <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative', paddingLeft: '20px' }}>
                                    <div style={{ position: 'absolute', left: '3px', top: '8px', width: '10px', height: '10px', borderRadius: '50%', background: i === 0 ? 'var(--accent-primary)' : 'var(--border-color)', border: '2px solid var(--bg-card, #1a1a2e)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                        <p style={{ margin: 0, fontSize: '0.81rem', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{h.text || '(No description)'}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={9} /> {h.date || '—'}{h.time && <><Clock size={9} style={{ marginLeft: '4px' }} /> {h.time}</>}</span>
                                          {h.by && <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>by {h.by}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredLeads.length > 0 && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          <span>Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredLeads.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{historyLeads.length}</strong> historical leads{isSuperAdmin && historyUserFilter !== 'SELF' && <> for <strong style={{ color: 'var(--accent-primary)' }}>{effectiveUserName}</strong></>}</span>
          <span style={{ fontStyle: 'italic' }}>Click any row to expand the interaction timeline.</span>
        </div>
      )}
    </div>
  );
};
