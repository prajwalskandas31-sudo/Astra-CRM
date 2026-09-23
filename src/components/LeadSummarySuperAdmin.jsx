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
    try {
      const targetUser = users.find(u => u.id === fulfillTargetUserId) || users.find(u => u.name === showFulfillModal.requestedByName);
      
      const result = fulfillLeadRequest(showFulfillModal.id, fulfillQuantity, targetUser?.id, showFulfillModal.language);
      const { assigned, requested } = result || {};

      if (assigned >= requested) {
        addToast(`Leads assigned successfully to ${showFulfillModal.requestedByName}.`, 'success');
      } else {
        const notAssigned = (requested || 0) - (assigned || 0);
        addToast(
          `${assigned} lead(s) assigned to ${showFulfillModal.requestedByName}. ${notAssigned} lead(s) could not be assigned due to insufficient available leads.`,
          assigned > 0 ? 'warning' : 'error'
        );
      }
    } catch (err) {
      console.error('Error fulfilling request:', err);
    } finally {
      setShowFulfillModal(null);
    }
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
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <div style={{ background: 'rgba(110, 86, 207, 0.12)', color: 'var(--accent)', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}>
                <Filter size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Assignment History & Multi-Criteria Filtering
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '2rem' }}>
              Filter by user, date, language, team, or disposition — individually or in combination.
            </p>
          </div>

          {/* View Density */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-app)', padding: '0.35rem 0.6rem 0.35rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <Layers size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>Rows per page</span>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ width: '100px', padding: '0.3rem 0.5rem', fontSize: '0.78rem', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
        </div>

        {/* Multi-Criteria Filters Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>

          {/* User Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={11} /> Assigned User
            </label>
            <select
              className="form-select"
              value={selectedUserFilter}
              onChange={(e) => { setSelectedUserFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', width: '100%', fontWeight: selectedUserFilter !== 'ALL' ? 600 : 400 }}
            >
              <option value="ALL">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Date Lookup */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={11} /> Date Lookup
            </label>
            <input
              type="date"
              className="form-control"
              value={selectedDateFilter}
              onChange={(e) => { setSelectedDateFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', width: '100%', fontWeight: selectedDateFilter ? 600 : 400 }}
            />
          </div>

          {/* Language Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Sparkles size={11} /> Language
            </label>
            <select
              className="form-select"
              value={selectedLanguageFilter}
              onChange={(e) => { setSelectedLanguageFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', width: '100%', fontWeight: selectedLanguageFilter !== 'ALL' ? 600 : 400 }}
            >
              <option value="ALL">All Languages</option>
              {availableLanguages.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Teamwise Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Users size={11} /> Team
            </label>
            <select
              className="form-select"
              value={selectedTeamFilter}
              onChange={(e) => { setSelectedTeamFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', width: '100%', fontWeight: selectedTeamFilter !== 'ALL' ? 600 : 400 }}
            >
              {availableTeams.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Teams' : t}</option>
              ))}
            </select>
          </div>

          {/* Disposition Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle2 size={11} /> Disposition
            </label>
            <select
              className="form-select"
              value={selectedDispositionFilter}
              onChange={(e) => { setSelectedDispositionFilter(e.target.value); setCurrentPage(1); }}
              style={{ fontSize: '0.82rem', width: '100%', fontWeight: selectedDispositionFilter !== 'ALL' ? 600 : 400 }}
            >
              <option value="ALL">All Dispositions</option>
              {dispositions.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Search size={11} /> Search
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Name, phone, ID…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ fontSize: '0.82rem', paddingLeft: '2.1rem', width: '100%', fontWeight: searchQuery ? 600 : 400 }}
              />
              <Search size={13} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* File Level Batch Operations Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(110, 86, 207, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)', padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid rgba(110, 86, 207, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(110, 86, 207, 0.15)', color: 'var(--accent)', padding: '0.35rem', borderRadius: '7px', display: 'flex' }}>
              <FileSpreadsheet size={15} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Assignment Instance Files</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({assignmentInstances.length} total)</span>
            </div>
            {selectedInstanceIds.length > 0 && (
              <span className="badge badge-purple">
                {selectedInstanceIds.length} selected
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
                <Trash2 size={13} /> Delete Selected
              </button>
            )}
          </div>
        </div>

        {/* Assignment Instance Files Table */}
        <div className="table-container">
          <table className="table" style={{ fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ width: '44px', textAlign: 'center', padding: '0.85rem 0.5rem', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedInstanceIds.length === assignmentInstances.length && assignmentInstances.length > 0}
                      onChange={toggleSelectAllInstances}
                      title="Select all assignment instance files"
                      aria-label="Select all"
                    />
                  </div>
                </th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Source File</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Instance / Batch</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Assigned To</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', verticalAlign: 'middle' }}>Language</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', verticalAlign: 'middle' }}>Team</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Date Assigned</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>Leads</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Dialed / Remaining</th>
                <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>Actions</th>
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
                  <tr key={inst.id} style={{ background: isSelected ? 'rgba(110, 86, 207, 0.08)' : 'transparent', transition: 'background 0.15s ease', borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent' }}>
                    <td style={{ textAlign: 'center', padding: '0.85rem 0.5rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleInstanceSelection(inst.id)}
                          title={`Select ${inst.batchName}`}
                          aria-label={`Select ${inst.batchName}`}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.28rem 0.65rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.22)', maxWidth: '210px' }}>
                        <FileSpreadsheet size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inst.sourceFileName || inst.batchName}>
                          {inst.sourceFileName || inst.batchName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <FileSpreadsheet size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>{inst.batchName}</span>
                        </div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', paddingLeft: '1.25rem' }}>
                          <span>by <strong style={{ color: 'var(--text-secondary)' }}>{inst.assignedBy}</strong></span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)',
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          letterSpacing: '0.02em'
                        }}>
                          {inst.assignedToName?.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text-main)', letterSpacing: '0.01em' }}>
                          {inst.assignedToName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <span className="badge badge-purple" style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem' }}>
                        {inst.language}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', padding: '0.85rem 1rem', maxWidth: '140px', verticalAlign: 'middle' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={12} style={{ opacity: 0.6 }} />
                        {inst.team}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.85rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle', fontFamily: 'monospace' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={12} style={{ opacity: 0.6 }} />
                        {inst.date}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '12px',
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--text-main)'
                      }}>
                        {total}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: '#10b981',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '20px'
                        }} title="Dialed / Contacted">
                          ✓ {dialed}
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: '#f59e0b',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '20px'
                        }} title="Remaining / Uncontacted">
                          ⏳ {uncontacted}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setActiveInstanceModal(inst)}
                          title="View Real-time Disposition Tracking"
                          style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setShowReassignFileModal(inst); setReassignFileTargetUserId(inst.assignedToId); }}
                          title="Reassign entire file to another user"
                          style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                        >
                          <UserCheck size={12} /> Reassign
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            if (window.confirm(`Delete assignment file '${inst.batchName}'?`)) {
                              deleteAssignmentFiles([inst.id]);
                              addToast(`Deleted assignment file '${inst.batchName}'`, 'success');
                            }
                          }}
                          title="Delete this file"
                          style={{ padding: '0.28rem 0.45rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={12} />
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
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '0.35rem', borderRadius: '7px', display: 'flex' }}>
                <AlertCircle size={15} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                  Filtered Leads Audit Table
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{filteredLeads.length} leads matched current filters</span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-app)', padding: '0.25rem 0.65rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              Page {currentPage} / {totalPages}
            </span>
          </div>

          <div className="table-container">
            <table className="table" style={{ fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>Lead ID</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem' }}>Client / Contact</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>Phone Number</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem' }}>Language</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>Assigned Owner</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem' }}>Disposition</th>
                  <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.75rem 1rem' }}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map(lead => (
                  <tr key={lead.id} style={{ transition: 'background 0.12s ease' }}>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <code style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.15rem 0.45rem', borderRadius: '5px', fontWeight: 600 }}>{lead.id}</code>
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>{lead.clientName}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{lead.contactPerson}</div>
                    </td>
                    <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>{lead.phone}</td>
                    <td style={{ padding: '0.9rem 1rem' }}><span className="badge badge-purple" style={{ fontSize: '0.71rem' }}>{lead.language}</span></td>
                    <td style={{ padding: '0.9rem 1rem' }}><span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{lead.assignedToName}</span></td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span className={`badge ${
                        lead.disposition === 'Paid / Converted' ? 'badge-success' :
                        lead.disposition === 'Interested' ? 'badge-success' :
                        lead.disposition === 'Not Interested' ? 'badge-danger' :
                        lead.disposition === 'New Lead' ? 'badge-info' :
                        lead.disposition === 'Call Back Later' ? 'badge-warning' :
                        'badge-warning'
                      }`} style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        {lead.disposition}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.77rem', color: 'var(--text-muted)', maxWidth: '260px', padding: '0.9rem 1rem' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.history && lead.history.length > 0 ? lead.history[lead.history.length - 1].text : <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No activity logged</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-main)' }}>{Math.min((currentPage - 1) * pageSize + 1, filteredLeads.length)}</strong> – <strong style={{ color: 'var(--text-main)' }}>{Math.min(currentPage * pageSize, filteredLeads.length)}</strong> of <strong style={{ color: 'var(--text-main)' }}>{filteredLeads.length}</strong> leads
            </span>

            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', padding: '0.3rem 0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 600, minWidth: '60px', textAlign: 'center' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
              >
                Next <ChevronRight size={13} />
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
              <table className="table" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ width: '44px', textAlign: 'center', padding: '0.8rem 0.5rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          aria-label="Select all granular leads"
                        />
                      </div>
                    </th>
                    <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.8rem 1rem' }}>Lead ID</th>
                    <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.8rem 1rem' }}>Client Name</th>
                    <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.8rem 1rem' }}>Contact Person</th>
                    <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.8rem 1rem' }}>Phone</th>
                    <th style={{ fontSize: '0.68rem', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', padding: '0.8rem 1rem' }}>Disposition Status</th>
                  </tr>
                </thead>
                <tbody>
                  {instanceStats.instLeads.map(l => (
                    <tr key={l.id} style={{ transition: 'background 0.15s ease' }}>
                      <td style={{ textAlign: 'center', padding: '0.8rem 0.5rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedGranularLeadIds.includes(l.id)}
                            onChange={() => toggleGranularLeadSelection(l.id)}
                            aria-label={`Select lead ${l.id}`}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem 1rem' }}><code style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '0.15rem 0.45rem', borderRadius: '5px', fontWeight: 600 }}>{l.id}</code></td>
                      <td style={{ padding: '0.8rem 1rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{l.clientName}</strong></td>
                      <td style={{ padding: '0.8rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{l.contactPerson}</td>
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
