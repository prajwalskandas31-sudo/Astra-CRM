import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { PhoneCall, PhoneOff, Sparkles, Tag, Calendar, UserCheck, Layers, Sliders, Send, Clock, X, Check } from 'lucide-react';

export const CRMDashboard = () => {
  const { 
    leads, 
    dispositions, 
    updateLeadDisposition, 
    simulatedRole, 
    currentUser, 
    isShortcutEnabled, 
    toggleUserShortcut, 
    submitLeadRequest 
  } = useCRM();
  const { showToast } = useToast();

  const [selectedDispFilter, setSelectedDispFilter] = useState('All');
  const [activeCallLead, setActiveCallLead] = useState(null);
  const [callNotes, setCallNotes] = useState('');
  const [selectedOutcomeDisp, setSelectedOutcomeDisp] = useState('');
  const [postCallDate, setPostCallDate] = useState('');
  const [postCallTime, setPostCallTime] = useState('');
  const [timeHour, setTimeHour] = useState('10');
  const [timeMinute, setTimeMinute] = useState('00');
  const [timeAmPm, setTimeAmPm] = useState('AM');

  // Manage Shortcuts & Request Leads Modals
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  const [showRequestLeadsModal, setShowRequestLeadsModal] = useState(false);
  const [reqLanguage, setReqLanguage] = useState('Hindi');
  const [reqQty, setReqQty] = useState(25);
  const [reqNote, setReqNote] = useState('');

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
    const enabledDisps = dispositions.filter(d => isShortcutEnabled(currentUser?.id, d.id));
    const isLeadDispEnabled = lead.disposition && enabledDisps.some(d => d.name === lead.disposition);
    const initialDisp = isLeadDispEnabled 
      ? lead.disposition 
      : (enabledDisps[0]?.name || dispositions[0]?.name || 'New Lead');
    setSelectedOutcomeDisp(initialDisp);
    
    // Parse existing scheduled time if present
    if (lead.dispositionScheduledAt) {
      const parts = lead.dispositionScheduledAt.split(' ');
      setPostCallDate(parts[0] || '');
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        let hr = parseInt(timeParts[0], 10) || 10;
        const mn = timeParts[1] ? String(timeParts[1]).padStart(2, '0').slice(0, 2) : '00';
        let ampm = parts[2] || (hr >= 12 ? 'PM' : 'AM');
        if (hr > 12) hr -= 12;
        if (hr === 0) hr = 12;
        const hrStr = String(hr).padStart(2, '0');
        setTimeHour(hrStr);
        setTimeMinute(mn);
        setTimeAmPm(ampm.toUpperCase());
        setPostCallTime(`${hrStr}:${mn} ${ampm.toUpperCase()}`);
      } else {
        setTimeHour('10');
        setTimeMinute('00');
        setTimeAmPm('AM');
        setPostCallTime('10:00 AM');
      }
    } else {
      setPostCallDate('');
      setTimeHour('10');
      setTimeMinute('00');
      setTimeAmPm('AM');
      setPostCallTime('10:00 AM');
    }
    setCallNotes('');
  };

  const handlePostCallSubmit = (e) => {
    e.preventDefault();
    if (!activeCallLead || !selectedOutcomeDisp) return;

    const selectedOutcomeObj = dispositions.find(d => d.name === selectedOutcomeDisp);
    if (selectedOutcomeObj && !isShortcutEnabled(currentUser?.id, selectedOutcomeObj.id)) {
      showToast(`Disposition '${selectedOutcomeDisp}' is disabled in your shortcuts settings.`, 'warning');
      return;
    }

    const selectedTime = (timeHour && timeMinute && timeAmPm) ? `${timeHour}:${timeMinute} ${timeAmPm}` : postCallTime;

    if (requiresDateTime) {
      if (!postCallDate || !selectedTime) {
        showToast('Both Date and Time are mandatory for this disposition outcome.', 'warning');
        return;
      }
    }

    const formattedDateTime = (postCallDate && selectedTime) ? `${postCallDate} ${selectedTime}` : (postCallDate || '');

    updateLeadDisposition(activeCallLead.id, selectedOutcomeDisp, callNotes, formattedDateTime);
    showToast(`Lead '${activeCallLead.contactPerson}' updated to disposition [${selectedOutcomeDisp}].`, 'success');
    setActiveCallLead(null);
    setCallNotes('');
    setPostCallDate('');
    setPostCallTime('');
  };

  const handleLeadRequestSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(reqQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid lead quantity.', 'warning');
      return;
    }
    submitLeadRequest(reqLanguage, qty, reqNote);
    showToast(`Lead request for ${qty} ${reqLanguage} leads submitted to Super Admin.`, 'success');
    setShowRequestLeadsModal(false);
    setReqNote('');
  };

  // User-level shortcuts filter (User_Shortcut_Settings)
  const visibleDispositions = dispositions.filter(d => isShortcutEnabled(currentUser?.id, d.id));

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={16} color="var(--accent-primary)" /> Dynamic Disposition Shortcut Bar
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Personalized quick-action buttons for <strong>{currentUser?.name || 'User'}</strong> ({simulatedRole}).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowManageShortcuts(true)}
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Configure your personal disposition shortcut buttons"
            >
              <Sliders size={13} /> Manage Shortcuts
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowRequestLeadsModal(true)}
              style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Direct access to request inbound leads from Super Admin"
            >
              <Send size={13} /> Request Leads
            </button>
          </div>
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

          {visibleDispositions.map(disp => {
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

          {visibleDispositions.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
              All shortcuts currently toggled off. Click 'Manage Shortcuts' to enable buttons.
            </span>
          )}
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
                    {dispositions.map(d => {
                      const isEnabled = isShortcutEnabled(currentUser?.id, d.id);
                      const isSelected = selectedOutcomeDisp === d.name;

                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => {
                            if (!isEnabled) return;
                            setSelectedOutcomeDisp(d.name);
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'var(--accent-soft)' : (isEnabled ? 'var(--bg-input)' : 'rgba(255, 255, 255, 0.02)'),
                            color: isSelected ? 'var(--accent-primary)' : (isEnabled ? 'var(--text-primary)' : 'var(--text-muted)'),
                            fontWeight: isSelected ? 600 : 400,
                            textAlign: 'left',
                            fontSize: '0.82rem',
                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                            opacity: isEnabled ? 1 : 0.45,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px'
                          }}
                          title={isEnabled ? d.name : `${d.name} (Disabled in Manage Shortcuts)`}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Tag size={12} /> {d.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {!isEnabled && (
                              <span style={{ fontSize: '0.64rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                Disabled
                              </span>
                            )}
                            {d.requiresDateTimePicker && (
                              <Calendar size={12} color={isEnabled ? "var(--warning-color, #f59e0b)" : "var(--text-muted)"} title="Requires Date & Time Picker" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional Mandatory Date & Time Picker: Rendered directly below selection when Date & Time Compulsory flag is enabled */}
                {requiresDateTime && (
                  <div className="form-group" style={{
                    marginBottom: '16px',
                    padding: '14px 16px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.84rem', marginBottom: '4px' }}>
                      <Calendar size={15} /> Date & Time Compulsory *
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Super Admin has mandated both Date and Time for disposition '{selectedOutcomeDisp}'.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {/* 1. Date Picker Input */}
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                          <Calendar size={13} color="var(--accent-primary)" /> Date Picker Input *
                        </label>
                        <input
                          type="date"
                          value={postCallDate}
                          onChange={(e) => setPostCallDate(e.target.value)}
                          required
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>

                      {/* 2. Time Picker Input (Dropdown box of hrs, minutes, am, pm) */}
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                          <Clock size={13} color="var(--accent-primary)" /> Time Picker Input *
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          {/* Hours Dropdown */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>HRS</span>
                            <select
                              value={timeHour}
                              onChange={(e) => {
                                const h = e.target.value;
                                setTimeHour(h);
                                setPostCallTime(`${h}:${timeMinute} ${timeAmPm}`);
                              }}
                              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px', borderRadius: 'var(--radius-md)' }}
                              title="Hours"
                            >
                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>

                          {/* Minutes Dropdown */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>MIN</span>
                            <select
                              value={timeMinute}
                              onChange={(e) => {
                                const m = e.target.value;
                                setTimeMinute(m);
                                setPostCallTime(`${timeHour}:${m} ${timeAmPm}`);
                              }}
                              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px', borderRadius: 'var(--radius-md)' }}
                              title="Minutes"
                            >
                              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>

                          {/* AM / PM Dropdown */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>AM / PM</span>
                            <select
                              value={timeAmPm}
                              onChange={(e) => {
                                const ap = e.target.value;
                                setTimeAmPm(ap);
                                setPostCallTime(`${timeHour}:${timeMinute} ${ap}`);
                              }}
                              style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                              title="AM or PM"
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
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
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={
                    (selectedDispObj && !isShortcutEnabled(currentUser?.id, selectedDispObj.id)) ||
                    (requiresDateTime && (!postCallDate || !timeHour || !timeMinute || !timeAmPm))
                  }
                >
                  Save Disposition Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MANAGE SHORTCUTS MODAL (USER_SHORTCUT_SETTINGS ISOLATION)   */}
      {/* ============================================================ */}
      {showManageShortcuts && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0 }}>Manage Shortcuts Panel</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowManageShortcuts(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="alert-box alert-info" style={{ marginBottom: '14px', fontSize: '0.78rem' }}>
                <strong>Personal Workspace Configuration:</strong> Toggling off a shortcut removes that quick-action button exclusively from your screen ({currentUser?.name}). It does not alter central master data or affect any other user's workspace.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dispositions.map(disp => {
                  const isEnabled = isShortcutEnabled(currentUser?.id, disp.id);

                  return (
                    <div
                      key={disp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Tag size={14} color="var(--accent-primary)" />
                        <div>
                          <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{disp.name}</strong>
                          {disp.requiresDateTimePicker && (
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                              <Clock size={10} /> Date & Time Compulsory
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleUserShortcut(currentUser?.id, disp.id)}
                        className={isEnabled ? "btn-primary" : "btn-secondary"}
                        style={{
                          fontSize: '0.74rem',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          minWidth: '95px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        {isEnabled ? (
                          <>
                            <Check size={12} /> Active
                          </>
                        ) : (
                          'Disabled'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Preferences saved automatically to User_Shortcut_Settings.
              </span>
              <button type="button" className="btn-primary" onClick={() => setShowManageShortcuts(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* REQUEST LEADS MODAL (NON-ADMIN DIRECT INBOUND ACCESS)       */}
      {/* ============================================================ */}
      {showRequestLeadsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0 }}>Request Inbound Leads</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowRequestLeadsModal(false)}>×</button>
            </div>

            <form onSubmit={handleLeadRequestSubmit}>
              <div className="modal-body">
                <div className="alert-box alert-info" style={{ marginBottom: '14px', fontSize: '0.78rem' }}>
                  Submitting as: <strong>{currentUser?.name || 'User'}</strong> ({simulatedRole}). This sends an inbound allocation request directly to Super Admin Block 4 queue.
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Required Language *</label>
                  <select 
                    value={reqLanguage} 
                    onChange={(e) => setReqLanguage(e.target.value)}
                    required
                  >
                    <option value="Hindi">Hindi</option>
                    <option value="English">English</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Bengali">Bengali</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Requested Lead Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.82rem' }}>Campaign / Outreach Note</label>
                  <textarea
                    rows={3}
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="e.g. High dial volume expected today; need fresh inbound pipeline..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRequestLeadsModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={14} /> Send Request to Super Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

