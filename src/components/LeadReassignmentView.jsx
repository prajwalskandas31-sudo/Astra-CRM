import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Layers, ArrowRight, Calendar, Hash, Globe, Filter, CheckCircle2 } from 'lucide-react';

export const LeadReassignmentView = () => {
  const { users, leads, reassignLeadsFiltered, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [reassignQty, setReassignQty] = useState('');
  const [reassignLang, setReassignLang] = useState('ALL');
  const [dateMode, setDateMode] = useState('single'); // 'single' | 'range'
  const [reassignDate, setReassignDate] = useState('');
  const [reassignStartDate, setReassignStartDate] = useState('');
  const [reassignEndDate, setReassignEndDate] = useState('');

  // Extract available languages from leads
  const availableLanguages = useMemo(() => {
    const langs = new Set(['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi']);
    leads.forEach(l => l.language && langs.add(l.language));
    return Array.from(langs);
  }, [leads]);

  // Preview count of matching leads based on selected criteria
  const matchingLeadsCount = useMemo(() => {
    if (!fromUser) return 0;
    return leads.filter(l => {
      if (fromUser !== 'ALL' && l.assignedToId !== fromUser) return false;
      if (reassignLang !== 'ALL' && (l.language || '').toLowerCase() !== reassignLang.toLowerCase()) return false;
      
      if (dateMode === 'single') {
        if (reassignDate) {
          const hasMatchingDate = (l.history || []).some(h => (h.date || '').includes(reassignDate)) || 
                                  (l.date && String(l.date).includes(reassignDate)) ||
                                  (l.assignedDate && String(l.assignedDate).includes(reassignDate));
          if (!hasMatchingDate) return false;
        }
      } else {
        if (reassignStartDate || reassignEndDate) {
          const dates = [];
          if (l.assignedDate) dates.push(l.assignedDate);
          if (l.date) dates.push(l.date);
          (l.history || []).forEach(h => {
            if (h.date) dates.push(h.date);
          });
          if (dates.length === 0) return false;
          const matchesRange = dates.some(d => {
            const dStr = String(d).slice(0, 10);
            if (reassignStartDate && dStr < reassignStartDate) return false;
            if (reassignEndDate && dStr > reassignEndDate) return false;
            return true;
          });
          if (!matchesRange) return false;
        }
      }
      return true;
    }).length;
  }, [leads, fromUser, reassignLang, dateMode, reassignDate, reassignStartDate, reassignEndDate]);

  const handleManualReassignment = (e) => {
    e.preventDefault();
    if (!fromUser || !toUser) {
      showToast('Please select both Source User and Target User.', 'warning');
      return;
    }
    if (fromUser === toUser) {
      showToast('Source and Target user cannot be the same person.', 'warning');
      return;
    }

    if (matchingLeadsCount === 0) {
      showToast('No leads match the selected criteria (User, Language, Date).', 'warning');
      return;
    }

    const count = reassignLeadsFiltered({
      fromUserId: fromUser,
      toUserId: toUser,
      quantity: reassignQty ? parseInt(reassignQty, 10) : undefined,
      language: reassignLang,
      dateMode,
      date: dateMode === 'single' ? reassignDate : undefined,
      startDate: dateMode === 'range' ? reassignStartDate : undefined,
      endDate: dateMode === 'range' ? reassignEndDate : undefined
    });

    const target = users.find(u => u.id === toUser);
    showToast(`Successfully reassigned ${count} lead(s) to ${target?.name}.`, 'success');
    
    // Reset filters
    setReassignQty('');
    setReassignLang('ALL');
    setReassignDate('');
    setReassignStartDate('');
    setReassignEndDate('');
  };

  const setPresetRange = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'today') {
      setReassignStartDate(todayStr);
      setReassignEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setReassignStartDate(d.toISOString().split('T')[0]);
      setReassignEndDate(todayStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setReassignStartDate(d.toISOString().split('T')[0]);
      setReassignEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setReassignStartDate(firstDay);
      setReassignEndDate(todayStr);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Reassignment Panel */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-primary)" /> Lead Reassignment Protocol
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Super Admin and Admin can reassign leads based on <strong>Quantity</strong>, <strong>Language</strong>, and <strong>Date</strong> (Single Date or Date Range) filters.
        </p>

        {simulatedRole === 'Super Admin' || simulatedRole === 'Admin' ? (
          <form onSubmit={handleManualReassignment}>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              {/* Source User */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Reassign From (Source User) *</label>
                <select value={fromUser} onChange={(e) => setFromUser(e.target.value)} required>
                  <option value="">-- Choose Source User --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.status}) - {u.role}</option>
                  ))}
                </select>
              </div>

              {/* Target User */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Reassign To (Target User) *</label>
                <select value={toUser} onChange={(e) => setToUser(e.target.value)} required>
                  <option value="">-- Choose Active Target User --</option>
                  {users.filter(u => u.status === 'Active' && u.id !== fromUser).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={13} /> Quantity (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={reassignQty}
                  onChange={(e) => setReassignQty(e.target.value)}
                  placeholder="e.g. 15 (leave empty for all)"
                />
              </div>

              {/* Language */}
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={13} /> Language Filter
                </label>
                <select value={reassignLang} onChange={(e) => setReassignLang(e.target.value)}>
                  <option value="ALL">All Languages</option>
                  {availableLanguages.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter (Calendar Picker) */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'var(--bg-card, rgba(255,255,255,0.02))', padding: '14px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: 'var(--text-primary)' }}>
                    <Calendar size={15} color="var(--accent-primary)" /> Date Filter (Calendar Picker)
                  </label>
                  
                  {/* Mode Selector Tabs */}
                  <div style={{ display: 'inline-flex', background: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setDateMode('single')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        fontWeight: dateMode === 'single' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: dateMode === 'single' ? 'var(--accent-primary)' : 'transparent',
                        color: dateMode === 'single' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📅 Single Date
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode('range')}
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        fontWeight: dateMode === 'range' ? 600 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: dateMode === 'range' ? 'var(--accent-primary)' : 'transparent',
                        color: dateMode === 'range' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      📆 Range of Dates (From - To)
                    </button>
                  </div>
                </div>

                {dateMode === 'single' ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="date"
                        value={reassignDate}
                        onChange={(e) => setReassignDate(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                    </div>
                    {reassignDate && (
                      <button
                        type="button"
                        onClick={() => setReassignDate('')}
                        className="btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                        title="Clear Date"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>From (Start Date):</label>
                        <input
                          type="date"
                          value={reassignStartDate}
                          onChange={(e) => setReassignStartDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>To (End Date):</label>
                        <input
                          type="date"
                          value={reassignEndDate}
                          onChange={(e) => setReassignEndDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                    
                    {/* Quick Preset Range Filters */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
                        <button type="button" onClick={() => setPresetRange('today')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Today</button>
                        <button type="button" onClick={() => setPresetRange('last7')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Last 7 Days</button>
                        <button type="button" onClick={() => setPresetRange('last30')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>Last 30 Days</button>
                        <button type="button" onClick={() => setPresetRange('thisMonth')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>This Month</button>
                      </div>
                      {(reassignStartDate || reassignEndDate) && (
                        <button
                          type="button"
                          onClick={() => { setReassignStartDate(''); setReassignEndDate(''); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '2px 6px'
                          }}
                        >
                          Clear Date Range
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Matching leads live badge */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Matching Pool:</span>
                <span className="badge" style={{ padding: '6px 12px', fontSize: '0.82rem', background: matchingLeadsCount > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)', color: matchingLeadsCount > 0 ? '#10b981' : '#ef4444', width: 'fit-content' }}>
                  {fromUser ? `${matchingLeadsCount} matching lead(s) found` : 'Select Source User'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={!fromUser || !toUser || matchingLeadsCount === 0}
                style={{ padding: '10px 20px', fontSize: '0.85rem' }}
              >
                Execute Filtered Reassignment <ArrowRight size={15} />
              </button>
            </div>
          </form>
        ) : (
          <div className="alert-box alert-warning">
            Lead reassignment protocol is restricted to Super Admin and Admin roles.
          </div>
        )}
      </div>

      {/* Active Leads Table */}
      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Active Lead Directory & History Logs</h3>
            <p>Immutable audit trail maintained across reassignment transfers.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Contact Name</th>
                <th>Phone Number</th>
                <th>Language</th>
                <th>Owner</th>
                <th>Value</th>
                <th>Audit Log Trail</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.contactPerson}</td>
                  <td>{l.phone}</td>
                  <td><span className="badge" style={{ background: 'var(--bg-input)' }}>{l.language || 'English'}</span></td>
                  <td><span className="badge badge-role">{l.assignedToName}</span></td>
                  <td style={{ fontWeight: 700 }}>{l.value}</td>
                  <td>
                    <div style={{ fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {(l.history || []).map((h, i) => (
                        <div key={i} style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>[{h.date}]</span> {h.text}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeadReassignmentView;
