import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import {
  ShieldAlert,
  Users,
  Search,
  Filter,
  Trash2,
  UserCheck,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  PieChart,
  PhoneCall,
  PhoneOff,
  AlertCircle,
  X
} from 'lucide-react';

export const LeadSummarySuperAdmin = () => {
  const {
    simulatedRole,
    users,
    leads,
    dispositions,
    leadRequests,
    assignmentInstances,
    submitLeadRequest,
    fulfillLeadRequest,
    deleteAssignmentFiles,
    reassignAssignmentFile,
    granularReassignLeads,
    granularDeleteLeads,
    assignLeadsByLanguage
  } = useCRM();

  const { addToast } = useToast();

  // Filters State
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState('ALL');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('ALL');
  const [selectedDispositionFilter, setSelectedDispositionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Density
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // File Batch Selection State
  const [selectedInstanceIds, setSelectedInstanceIds] = useState([]);
  
  // Modals State
  const [activeInstanceModal, setActiveInstanceModal] = useState(null);
  const [selectedGranularLeadIds, setSelectedGranularLeadIds] = useState([]);
  
  const [showFulfillModal, setShowFulfillModal] = useState(null);
  const [fulfillTargetUserId, setFulfillTargetUserId] = useState('');
  const [fulfillQuantity, setFulfillQuantity] = useState(20);

  const [showReassignFileModal, setShowReassignFileModal] = useState(null);
  const [reassignFileTargetUserId, setReassignFileTargetUserId] = useState('');

  const [showGranularReassignModal, setShowGranularReassignModal] = useState(false);
  const [granularTargetUserId, setGranularTargetUserId] = useState('');

  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newReqLanguage, setNewReqLanguage] = useState('English');
  const [newReqQty, setNewReqQty] = useState(25);
  const [newReqNote, setNewReqNote] = useState('');

  // Role Security Check
  if (simulatedRole !== 'Super Admin') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', marginTop: '2rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: '#ef4444', marginBottom: '1rem' }}>
          <ShieldAlert size={48} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          Access Restricted — Super Admin Panel Only
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          Block 4: Lead Summary is strictly reserved for the Super Admin role. Please switch your active role simulator to Super Admin in the top banner to access this view.
        </p>
      </div>
    );
  }

  // Derive unique lists for filter dropdowns
  const availableLanguages = useMemo(() => {
    const langs = new Set(['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada']);
    leads.forEach(l => l.language && langs.add(l.language));
    return Array.from(langs);
  }, [leads]);

  const availableTeams = ['ALL', 'Sales Team North', 'Corporate Accounts', 'West Zone Team', 'Team Alpha', 'Sales Team South'];

  // All leads combined with assignment history filtering
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (selectedUserFilter !== 'ALL' && lead.assignedToId !== selectedUserFilter) return false;
      if (selectedLanguageFilter !== 'ALL' && lead.language?.toLowerCase() !== selectedLanguageFilter.toLowerCase()) return false;
      if (selectedDispositionFilter !== 'ALL' && lead.disposition !== selectedDispositionFilter) return false;
      if (selectedDateFilter) {
        const leadHistoryDates = (lead.history || []).map(h => h.date);
        const matchesDate = leadHistoryDates.some(d => d.includes(selectedDateFilter));
        if (!matchesDate) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = lead.clientName?.toLowerCase().includes(q) || lead.contactPerson?.toLowerCase().includes(q) || lead.phone?.includes(q) || lead.id?.toLowerCase().includes(q);
        if (!matchName) return false;
      }
      return true;
    });
  }, [leads, selectedUserFilter, selectedLanguageFilter, selectedDispositionFilter, selectedDateFilter, searchQuery]);

  // Paginated Leads
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Handle Instance Checkbox selection
  const toggleInstanceSelection = (instId) => {
    setSelectedInstanceIds(prev =>
      prev.includes(instId) ? prev.filter(id => id !== instId) : [...prev, instId]
    );
  };

  const toggleSelectAllInstances = () => {
    if (selectedInstanceIds.length === assignmentInstances.length) {
      setSelectedInstanceIds([]);
    } else {
      setSelectedInstanceIds(assignmentInstances.map(i => i.id));
    }
  };

  // Handle Batch Deletion
  const handleDeleteSelectedInstances = () => {
    if (selectedInstanceIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedInstanceIds.length} assignment file(s)? Associated leads will be deleted.`)) {
      deleteAssignmentFiles(selectedInstanceIds);
      addToast(`Deleted ${selectedInstanceIds.length} assignment file(s)`, 'success');
      setSelectedInstanceIds([]);
    }
  };

  // Handle Fulfill Request
  const handleConfirmFulfillRequest = () => {
    if (!showFulfillModal) return;
    const targetUser = users.find(u => u.id === fulfillTargetUserId) || users.find(u => u.name === showFulfillModal.requestedByName);
    
    fulfillLeadRequest(showFulfillModal.id, fulfillQuantity, targetUser?.id, showFulfillModal.language);
    addToast(`Fulfilled request for ${showFulfillModal.requestedByName}. Request auto-disappeared from panel.`, 'success');
    setShowFulfillModal(null);
  };

  // Handle Batch Reassign
  const handleConfirmReassignFile = () => {
    if (!showReassignFileModal || !reassignFileTargetUserId) return;
    reassignAssignmentFile(showReassignFileModal.id, reassignFileTargetUserId);
    const targetUser = users.find(u => u.id === reassignFileTargetUserId);
    addToast(`Reassigned file batch to ${targetUser?.name || 'User'}`, 'success');
    setShowReassignFileModal(null);
  };

  // Handle Granular Lead Selection inside Instance Modal
  const toggleGranularLeadSelection = (leadId) => {
    setSelectedGranularLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleGranularReassign = () => {
    if (selectedGranularLeadIds.length === 0 || !granularTargetUserId) return;
    granularReassignLeads(selectedGranularLeadIds, granularTargetUserId);
    const targetUser = users.find(u => u.id === granularTargetUserId);
    addToast(`Reassigned ${selectedGranularLeadIds.length} lead(s) to ${targetUser?.name}`, 'success');
    setSelectedGranularLeadIds([]);
    setShowGranularReassignModal(false);
  };

  const handleGranularDelete = () => {
    if (selectedGranularLeadIds.length === 0) return;
    if (window.confirm(`Permanently delete ${selectedGranularLeadIds.length} selected lead(s)?`)) {
      granularDeleteLeads(selectedGranularLeadIds);
      addToast(`Deleted ${selectedGranularLeadIds.length} lead(s)`, 'success');
      setSelectedGranularLeadIds([]);
    }
  };

  const handleCreateNewRequest = (e) => {
    e.preventDefault();
    submitLeadRequest(newReqLanguage, newReqQty, newReqNote);
    addToast(`Submitted inbound request for ${newReqQty} ${newReqLanguage} leads`, 'info');
    setShowNewRequestModal(false);
    setNewReqNote('');
  };

  // Helper stats for active instance modal
  const instanceStats = useMemo(() => {
    if (!activeInstanceModal) return null;
    const instLeads = leads.filter(l => l.assignedToId === activeInstanceModal.assignedToId || (activeInstanceModal.leadIds || []).includes(l.id));
    const total = instLeads.length;
    const dialed = instLeads.filter(l => l.disposition && l.disposition !== 'New Lead').length;
    const uncontacted = total - dialed;

    const dispositionBreakdown = {};
    dispositions.forEach(d => { dispositionBreakdown[d.name] = 0; });
    instLeads.forEach(l => {
      const disp = l.disposition || 'New Lead';
      dispositionBreakdown[disp] = (dispositionBreakdown[disp] || 0) + 1;
    });

    return { total, dialed, uncontacted, instLeads, dispositionBreakdown };
  }, [activeInstanceModal, leads, dispositions]);

  return (
    <div className="lead-summary-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner / Hero Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)', border: '1px solid rgba(147, 51, 234, 0.3)', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Sparkles size={14} /> BLOCK 4: SUPER ADMIN LEAD MANAGEMENT
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Lead Summary & Post-Assignment Operations Hub
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Track inbound lead requests, monitor real-time disposition metrics, and perform batch or granular lead reassignments & deletions.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowNewRequestModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Send size={15} /> Simulate Inbound Lead Request
          </button>
        </div>
      </div>

      {/* Sub-Block 2: Inbound Lead Requests Queue (With Auto-Disappear Rule) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.5rem', borderRadius: '8px' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Inbound Lead Requests Queue
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auto-Disappear Rule: Requests automatically disappear upon Super Admin assignment fulfillment.
              </span>
            </div>
          </div>
          <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
            {leadRequests.length} Pending Request{leadRequests.length !== 1 ? 's' : ''}
          </span>
        </div>

        {leadRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <CheckCircle2 size={36} style={{ color: '#10b981', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem auto' }} />
            All inbound lead requests have been fulfilled! (Queue cleared via Auto-Disappear Rule)
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {leadRequests.map(req => (
              <div key={req.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{req.requestedByName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.role} • {req.team}</div>
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>{req.language}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '0.5rem 0', background: 'rgba(255, 255, 255, 0.03)', padding: '0.5rem', borderRadius: '6px' }}>
                    Requested: <strong style={{ color: 'var(--accent)' }}>{req.quantity} leads</strong>
                    {req.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', italic: 'true' }}>"{req.note}"</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requested: {req.date}</span>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => {
                      setShowFulfillModal(req);
                      const defaultTarget = users.find(u => u.name === req.requestedByName)?.id || users[0]?.id;
                      setFulfillTargetUserId(defaultTarget);
                      setFulfillQuantity(req.quantity);
                    }}
                    style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <UserCheck size={14} /> Fulfill & Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-Block 3 & 4: Lead Assignment History, Advanced Filtering & Real-time Disposition Tracking */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Lead Assignment History & Advanced Multi-Criteria Filtering
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Filter history datewise, language wise, teamwise, user wise, or by disposition (individually or in combination).
            </span>
          </div>

          {/* View Density / Pagination Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>View Density:</span>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ width: '110px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={500}>500 / page</option>
              <option value={1000}>1000 / page</option>
            </select>
          </div>
        </div>

        {/* Multi-Criteria Filters Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          
          {/* User Filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Filter by User</label>
            <select
              className="form-select"
              value={selectedUserFilter}
              onChange={(e) => { setSelectedUserFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.8rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            >
              <option value="ALL">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Date Lookup */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Date Lookup</label>
            <input
              type="date"
              className="form-control"
              value={selectedDateFilter}
              onChange={(e) => { setSelectedDateFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.8rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            />
          </div>

          {/* Language Filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Language Wise</label>
            <select
              className="form-select"
              value={selectedLanguageFilter}
              onChange={(e) => { setSelectedLanguageFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.8rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            >
              <option value="ALL">All Languages</option>
              {availableLanguages.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Teamwise Filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Teamwise</label>
            <select
              className="form-select"
              value={selectedTeamFilter}
              onChange={(e) => { setSelectedTeamFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.8rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            >
              {availableTeams.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Teams' : t}</option>
              ))}
            </select>
          </div>

          {/* Disposition Filter */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>User Disposition</label>
            <select
              className="form-select"
              value={selectedDispositionFilter}
              onChange={(e) => { setSelectedDispositionFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.8rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
            >
              <option value="ALL">All Dispositions</option>
              {dispositions.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Search Lead / Batch</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search name/phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ fontSize: '0.8rem', paddingLeft: '2rem', width: '100%', background: '#121318', color: '#F5F5F4', border: '1px solid #2A2D37' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* File Level Batch Operations Toolbar (Sub-block 5) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={16} style={{ color: 'var(--accent)' }} />
            <span>Assignment Instance Files ({assignmentInstances.length})</span>
            {selectedInstanceIds.length > 0 && (
              <span className="badge badge-purple" style={{ marginLeft: '0.5rem' }}>
                {selectedInstanceIds.length} Selected
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedInstanceIds.length > 0 && (
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDeleteSelectedInstances}
                style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Trash2 size={14} /> Delete Selected File(s)
              </button>
            )}
          </div>
        </div>

        {/* Assignment Instance Files Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedInstanceIds.length === assignmentInstances.length && assignmentInstances.length > 0}
                    onChange={toggleSelectAllInstances}
                  />
                </th>
                <th>Instance File / Batch</th>
                <th>Assigned To</th>
                <th>Language</th>
                <th>Team</th>
                <th>Date Assigned</th>
                <th>Total Leads</th>
                <th>Dialed / Uncontacted</th>
                <th>Actions (File Level)</th>
              </tr>
            </thead>
            <tbody>
              {assignmentInstances.map(inst => {
                const instLeads = leads.filter(l => l.assignedToId === inst.assignedToId || (inst.leadIds || []).includes(l.id));
                const total = instLeads.length || inst.totalLeads;
                const dialed = instLeads.filter(l => l.disposition && l.disposition !== 'New Lead').length;
                const uncontacted = total - dialed;
                const isSelected = selectedInstanceIds.includes(inst.id);

                return (
                  <tr key={inst.id} style={{ background: isSelected ? 'rgba(147, 51, 234, 0.08)' : 'transparent' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleInstanceSelection(inst.id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileSpreadsheet size={15} style={{ color: '#10b981' }} />
                        {inst.batchName}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assigned by: {inst.assignedBy}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>{inst.assignedToName}</strong>
                    </td>
                    <td>
                      <span className="badge badge-purple">{inst.language}</span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{inst.team}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{inst.date}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{total}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem' }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>{dialed} Dialed</span>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{uncontacted} Left</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setActiveInstanceModal(inst)}
                          title="Open Real-time Disposition Tracking & Granular Operations"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Eye size={13} /> View Instance
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setShowReassignFileModal(inst); setReassignFileTargetUserId(inst.assignedToId); }}
                          title="Reassign entire file of leads to another user"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Reassign File
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            if (window.confirm(`Delete assignment file '${inst.batchName}'?`)) {
                              deleteAssignmentFiles([inst.id]);
                              addToast(`Deleted assignment file '${inst.batchName}'`, 'success');
                            }
                          }}
                          title="Delete file level instance"
                          style={{ padding: '0.25rem 0.4rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Master Leads & Advanced Filtered Table */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Filtered Leads Audit Table ({filteredLeads.length} total matched)
            </h4>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead ID</th>
                  <th>Client / Contact</th>
                  <th>Phone Number</th>
                  <th>Language</th>
                  <th>Assigned Owner</th>
                  <th>Current Disposition</th>
                  <th>Last Logged History</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{lead.id}</code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lead.clientName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.contactPerson}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{lead.phone}</td>
                    <td><span className="badge badge-purple">{lead.language}</span></td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{lead.assignedToName}</strong></td>
                    <td>
                      <span className={`badge ${lead.disposition === 'Paid / Converted' || lead.disposition === 'Interested' ? 'badge-success' : lead.disposition === 'Not Interested' ? 'badge-danger' : lead.disposition === 'New Lead' ? 'badge-info' : 'badge-warning'}`}>
                        {lead.disposition}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                      {lead.history && lead.history.length > 0 ? lead.history[lead.history.length - 1].text : 'No activity logged'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredLeads.length)} to {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads
            </span>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', padding: '0 0.5rem' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Sub-Block 4 & 5 Modal: Instance Real-Time Tracking & Granular Lead Operations */}
      {activeInstanceModal && instanceStats && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600 }}>
                  <PieChart size={14} /> REAL-TIME DISPOSITION & INSTANCE TRACKING
                </div>
                <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {activeInstanceModal.batchName}
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Assigned To: <strong style={{ color: 'var(--text-main)' }}>{activeInstanceModal.assignedToName}</strong> • Language: <strong>{activeInstanceModal.language}</strong> • Date: <strong>{activeInstanceModal.date}</strong>
                </div>
              </div>

              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setActiveInstanceModal(null); setSelectedGranularLeadIds([]); }}
                style={{ padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Instance Real-Time Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Leads Uploaded</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{instanceStats.total}</div>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <PhoneCall size={14} /> Dialed Leads
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>{instanceStats.dialed}</div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <PhoneOff size={14} /> Uncontacted Left
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>{instanceStats.uncontacted}</div>
              </div>
            </div>

            {/* Disposition Status Breakdown */}
            <div style={{ marginBottom: '1.25rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Disposition Status Breakdown (Updated by Assigned User)
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(instanceStats.dispositionBreakdown).map(([dispName, count]) => (
                  <div key={dispName} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{dispName}:</span>
                    <strong style={{ color: count > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{count}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Granular Lead Operations Toolbar (Sub-block 5) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', background: 'rgba(147, 51, 234, 0.08)', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={15} style={{ color: 'var(--accent)' }} />
                <span>Granular Lead Operations ({selectedGranularLeadIds.length} lead(s) selected)</span>
              </div>

              {selectedGranularLeadIds.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowGranularReassignModal(true)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Reassign Selected ({selectedGranularLeadIds.length})
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={handleGranularDelete}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Delete Selected ({selectedGranularLeadIds.length})
                  </button>
                </div>
              )}
            </div>

            {/* Instance Leads List Table */}
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedGranularLeadIds.length === instanceStats.instLeads.length && instanceStats.instLeads.length > 0}
                        onChange={() => {
                          if (selectedGranularLeadIds.length === instanceStats.instLeads.length) {
                            setSelectedGranularLeadIds([]);
                          } else {
                            setSelectedGranularLeadIds(instanceStats.instLeads.map(l => l.id));
                          }
                        }}
                      />
                    </th>
                    <th>Lead ID</th>
                    <th>Client Name</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Disposition Status</th>
                  </tr>
                </thead>
                <tbody>
                  {instanceStats.instLeads.map(l => (
                    <tr key={l.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedGranularLeadIds.includes(l.id)}
                          onChange={() => toggleGranularLeadSelection(l.id)}
                        />
                      </td>
                      <td><code>{l.id}</code></td>
                      <td><strong>{l.clientName}</strong></td>
                      <td>{l.contactPerson}</td>
                      <td>{l.phone}</td>
                      <td>
                        <span className={`badge ${l.disposition === 'New Lead' ? 'badge-info' : 'badge-success'}`}>
                          {l.disposition || 'New Lead'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* Fulfill Inbound Request Modal */}
      {showFulfillModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Fulfill Inbound Lead Request</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Assign requested {showFulfillModal.quantity} ({showFulfillModal.language}) leads to target user. Request will automatically disappear upon confirmation.
            </p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target User</label>
              <select
                className="form-select"
                value={fulfillTargetUserId}
                onChange={(e) => setFulfillTargetUserId(e.target.value)}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity to Assign</label>
              <input
                type="number"
                className="form-control"
                value={fulfillQuantity}
                onChange={(e) => setFulfillQuantity(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowFulfillModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleConfirmFulfillRequest}>Confirm & Fulfill</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign File Level Modal */}
      {showReassignFileModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Reassign Assignment File</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Reassign entire batch file <strong>'{showReassignFileModal.batchName}'</strong> to another user.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reassign To User</label>
              <select
                className="form-select"
                value={reassignFileTargetUserId}
                onChange={(e) => setReassignFileTargetUserId(e.target.value)}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowReassignFileModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmReassignFile}>Confirm Reassign</button>
            </div>
          </div>
        </div>
      )}

      {/* Granular Lead Reassign Modal */}
      {showGranularReassignModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Granular Lead Reassignment</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Reassign {selectedGranularLeadIds.length} selected lead(s) to target user.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target User</label>
              <select
                className="form-select"
                value={granularTargetUserId}
                onChange={(e) => setGranularTargetUserId(e.target.value)}
              >
                <option value="">Select target user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowGranularReassignModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!granularTargetUserId} onClick={handleGranularReassign}>Confirm Reassign</button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate New Request Modal */}
      {showNewRequestModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Submit Inbound Lead Request</h3>
            <form onSubmit={handleCreateNewRequest}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Language Requested</label>
                <select className="form-select" value={newReqLanguage} onChange={(e) => setNewReqLanguage(e.target.value)}>
                  {availableLanguages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lead Quantity</label>
                <input type="number" className="form-control" value={newReqQty} onChange={(e) => setNewReqQty(e.target.value)} min={1} max={1000} />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note / Context</label>
                <textarea className="form-control" rows={2} value={newReqNote} onChange={(e) => setNewReqNote(e.target.value)} placeholder="e.g. Campaign request..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewRequestModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LeadSummarySuperAdmin;
