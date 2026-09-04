import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { PhoneCall, PhoneOff, Sparkles, Tag } from 'lucide-react';

export const CRMDashboard = () => {
  const { leads, dispositions, updateLeadDisposition, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [selectedDispFilter, setSelectedDispFilter] = useState('All');
  const [activeCallLead, setActiveCallLead] = useState(null);
  const [callNotes, setCallNotes] = useState('');
  const [selectedOutcomeDisp, setSelectedOutcomeDisp] = useState('');

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

  const handleSimulateCallDisconnect = (lead) => {
    setActiveCallLead(lead);
    setSelectedOutcomeDisp(lead.disposition || dispositions[0]?.name || 'Interested');
    setCallNotes('');
  };

  const handlePostCallSubmit = (e) => {
    e.preventDefault();
    if (!activeCallLead || !selectedOutcomeDisp) return;

    updateLeadDisposition(activeCallLead.id, selectedOutcomeDisp, callNotes);
    showToast(`Lead '${activeCallLead.clientName}' updated to disposition [${selectedOutcomeDisp}].`, 'success');
    setActiveCallLead(null);
    setCallNotes('');
  };

  const handleQuickShortcutClick = (lead, dispName) => {
    updateLeadDisposition(lead.id, dispName, 'Updated via Dashboard Dynamic Shortcut Button');
    showToast(`Lead '${lead.clientName}' disposition set to '${dispName}'`, 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Dynamic Disposition Shortcut Buttons Bar */}
      <div className="directory-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--accent-primary)" /> Dynamic Disposition Shortcut Bar
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any disposition button to filter pipeline leads or apply instant updates.
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
            Immediately after call disconnect, users update disposition status. Click "Call Disconnect" on any lead row to test the post-call outcome window.
          </span>
        </div>
      </div>

      {/* Leads Table */}
      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Assigned Leads Pipeline</h3>
            <p>Role Scope: {simulatedRole} • Live dispositions pipeline</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Client / Company</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Assigned Owner</th>
                <th>Current Disposition</th>
                <th>Post-Call Action</th>
                <th>Quick Updater</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No leads found matching filter '{selectedDispFilter}'.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.clientName}</td>
                    <td>{l.contactPerson}</td>
                    <td>{l.phone}</td>
                    <td><span className="badge badge-role">{l.assignedToName}</span></td>
                    <td>
                      <span className="badge badge-disposition">
                        <Tag size={11} /> {l.disposition || 'New Lead'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => handleSimulateCallDisconnect(l)}
                      >
                        <PhoneOff size={12} /> Call Disconnect
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {dispositions.slice(0, 4).map(disp => (
                          <button
                            key={disp.id}
                            className="btn-outline"
                            style={{ padding: '3px 9px', fontSize: '0.72rem', borderRadius: 'var(--radius-full)' }}
                            onClick={() => handleQuickShortcutClick(l, disp.name)}
                            title={`Instantly set disposition to ${disp.name}`}
                          >
                            {disp.name}
                          </button>
                        ))}
                      </div>
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
                <PhoneCall size={18} color="var(--accent-primary)" /> Post-Call Disconnect Outcome
              </h3>
              <button className="modal-close-btn" onClick={() => setActiveCallLead(null)}>×</button>
            </div>
            <form onSubmit={handlePostCallSubmit}>
              <div className="modal-body">
                <div className="alert-box alert-info" style={{ marginBottom: '14px' }}>
                  Updating result for lead: <strong>{activeCallLead.clientName}</strong> ({activeCallLead.contactPerson})
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontWeight: 600 }}>Select Disposition Outcome:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                    {dispositions.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedOutcomeDisp(d.name)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: selectedOutcomeDisp === d.name ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedOutcomeDisp === d.name ? 'var(--accent-soft)' : 'var(--bg-input)',
                          color: selectedOutcomeDisp === d.name ? 'var(--accent-primary)' : 'var(--text-primary)',
                          fontWeight: selectedOutcomeDisp === d.name ? 600 : 400,
                          textAlign: 'left',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Tag size={12} /> {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Post-Call Interaction Notes</label>
                  <textarea
                    rows={3}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Enter discussion notes, callback time, or client requests..."
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
