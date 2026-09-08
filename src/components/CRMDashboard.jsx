import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { PhoneCall, PhoneOff, Sparkles, Tag, Calendar, UserCheck, Layers } from 'lucide-react';

export const CRMDashboard = () => {
  const { leads, dispositions, updateLeadDisposition, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [selectedDispFilter, setSelectedDispFilter] = useState('All');
  const [activeCallLead, setActiveCallLead] = useState(null);
  const [callNotes, setCallNotes] = useState('');
  const [selectedOutcomeDisp, setSelectedOutcomeDisp] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  const scopedLeads = leads.filter(l => {
    if (simulatedRole === 'Executive') {
      return l.assignedToName === 'ABHINAYA M' || l.assignedToName === 'AJAY' || l.assignedToName === 'AKSHATA' || l.assignedToName === 'ANITHA';
    }
    return true;
  });

  const filteredLeads = scopedLeads.filter(l => {
    if (selectedDispFilter === 'All') return true;
    return l.disposition === selectedDispFilter;
  });

  // Dynamic counter sync for 'New Lead' status (Block 2 & Block 3 Report requirement)
  const newLeadsCount = scopedLeads.filter(l => l.disposition === 'New Lead').length;

  const selectedDispObj = dispositions.find(d => d.name === selectedOutcomeDisp);
  const requiresDateTime = selectedDispObj?.requiresDateTimePicker || false;

  const handleSimulateCallDisconnect = (lead) => {
    setActiveCallLead(lead);
    const initialDisp = lead.disposition || dispositions[0]?.name || 'New Lead';
    setSelectedOutcomeDisp(initialDisp);
    setScheduledDateTime(lead.dispositionScheduledAt || '');
    setCallNotes('');
  };

  const handlePostCallSubmit = (e) => {
    e.preventDefault();
    if (!activeCallLead || !selectedOutcomeDisp) return;

    if (requiresDateTime && !scheduledDateTime) {
      showToast('Please select a Date and Time for this disposition stage.', 'warning');
      return;
    }

    // Format date string nicely if datetime-local format
    let formattedDateTime = scheduledDateTime;
    if (scheduledDateTime && scheduledDateTime.includes('T')) {
      const [dPart, tPart] = scheduledDateTime.split('T');
      formattedDateTime = `${dPart} ${tPart}`;
    }

    updateLeadDisposition(activeCallLead.id, selectedOutcomeDisp, callNotes, formattedDateTime);
    showToast(`Lead '${activeCallLead.contactPerson}' updated to disposition [${selectedOutcomeDisp}].`, 'success');
    setActiveCallLead(null);
    setCallNotes('');
    setScheduledDateTime('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Report Counter Sync Banner (Block 2 & Block 3 Integration) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="directory-card" style={{ padding: '16px 20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Block 2 Report Counter Sync
              </span>
              <h3 style={{ fontSize: '1.4rem', marginTop: '4px', color: '#3b82f6', fontWeight: 700 }}>
                {newLeadsCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>New Leads</span>
              </h3>
            </div>
            <UserCheck size={28} color="#3b82f6" style={{ opacity: 0.8 }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Default disposition assigned on upload & pipeline assignment. Auto-synced with Block 3 Report block.
          </p>
        </div>

        <div className="directory-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Active Leads Pipeline
              </span>
              <h3 style={{ fontSize: '1.4rem', marginTop: '4px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                {scopedLeads.length} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Leads</span>
              </h3>
            </div>
            <Layers size={28} color="var(--accent-primary)" style={{ opacity: 0.8 }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Role scope: {simulatedRole} • Live disposition distribution.
          </p>
        </div>
      </div>

      {/* Dynamic Disposition Shortcut Buttons Bar */}
      <div className="directory-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--accent-primary)" /> Dynamic Disposition Shortcut Bar
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any disposition button created by Super Admin to filter assigned leads in real-time.
            </p>
          </div>

          <span className="badge badge-active" style={{ fontSize: '0.74rem' }}>
            {dispositions.length} Active Shortcuts
          </span>
        </div>

        {/* Shortcut Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            className={`btn-secondary ${selectedDispFilter === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedDispFilter('All')}
            style={{ borderRadius: 'var(--radius-full)', padding: '5px 12px', fontSize: '0.8rem' }}
          >
            All Dispositions ({scopedLeads.length})
          </button>

          {dispositions.map(disp => {
            const count = scopedLeads.filter(l => l.disposition === disp.name).length;
            const isSelected = selectedDispFilter === disp.name;

            return (
              <button
                key={disp.id}
                className={`btn-secondary ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedDispFilter(disp.name)}
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-color)',
                  backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-input)',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)'
                }}
              >
                <Tag size={12} /> {disp.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Post-Call Workflow Alert Banner */}
      <div className="alert-box alert-info" style={{ margin: 0, padding: '12px 16px', alignItems: 'center' }}>
        <PhoneOff size={18} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '0.86rem' }}>Post-Call Disconnect Workflow (Block 2 Core):</strong>
          <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-secondary)' }}>
            Users manually update disposition status after completing a sales call. Click "Call Disconnect" on any lead row below to trigger post-call disposition & date/time selection.
          </span>
        </div>
      </div>

      {/* Leads Table - Strict Block 2 Schema (5 Columns) */}
      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Assigned Leads Pipeline</h3>
            <p>Configured Disposition List Schema • Strict 5 Columns (Deprecated fields removed)</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>CONTACT NAME</th>
                <th>CONTACT NUMBER</th>
                <th>LANGUAGE</th>
                <th>CURRENT DISPOSITION</th>
                <th>POST CALL ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No leads found matching disposition filter '{selectedDispFilter}'.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(l => (
                  <tr key={l.id}>
                    {/* 1. CONTACT NAME */}
                    <td style={{ fontWeight: 600 }}>{l.contactPerson}</td>

                    {/* 2. CONTACT NUMBER */}
                    <td>{l.phone}</td>

                    {/* 3. LANGUAGE */}
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.76rem' }}>
                        {l.language || 'English'}
                      </span>
                    </td>

                    {/* 4. CURRENT DISPOSITION + Scheduled Date/Time directly underneath */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span className="badge badge-disposition" style={{ fontSize: '0.8rem' }}>
                          <Tag size={11} /> {l.disposition || 'New Lead'}
                        </span>
                        {l.dispositionScheduledAt && (
                          <div style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Calendar size={11} color="var(--accent-primary)" /> {l.dispositionScheduledAt}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. POST CALL ACTION */}
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                        onClick={() => handleSimulateCallDisconnect(l)}
                      >
                        <PhoneOff size={13} /> Call Disconnect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-Call Disconnect Modal */}
      {activeCallLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PhoneCall size={18} color="var(--accent-primary)" /> Post-Call Outcome & Disposition
              </h3>
              <button className="modal-close-btn" onClick={() => setActiveCallLead(null)}>×</button>
            </div>
            <form onSubmit={handlePostCallSubmit}>
              <div className="modal-body">
                <div className="alert-box alert-info" style={{ marginBottom: '14px' }}>
                  Updating outcome for: <strong>{activeCallLead.contactPerson}</strong> ({activeCallLead.phone}) • Language: <strong>{activeCallLead.language || 'English'}</strong>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600 }}>Select Disposition Outcome:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                    {dispositions.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedOutcomeDisp(d.name)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: selectedOutcomeDisp === d.name ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedOutcomeDisp === d.name ? 'var(--accent-soft)' : 'var(--bg-input)',
                          color: selectedOutcomeDisp === d.name ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontWeight: selectedOutcomeDisp === d.name ? 600 : 400,
                          textAlign: 'left',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Tag size={12} /> {d.name}
                        </span>
                        {d.requiresDateTimePicker && (
                          <Calendar size={12} color="var(--warning-color, #f59e0b)" title="Requires Date & Time Picker" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Date & Time Picker prompt if Super Admin enabled for selected disposition */}
                {requiresDateTime && (
                  <div className="form-group" style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.84rem' }}>
                      <Calendar size={15} /> Scheduled Date & Time Required *
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Super Admin has mandated a Date & Time selection for disposition '{selectedOutcomeDisp}'.
                    </p>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontWeight: 600 }}>Post-Call Interaction Notes</label>
                  <textarea
                    rows={3}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Enter discussion summary, follow-up requirements, or client feedback..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setActiveCallLead(null)}>Cancel</button>
                <button type="submit" className="btn-primary">
                  Save Disposition Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

