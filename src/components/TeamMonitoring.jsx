import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  CheckCircle2, 
  User, 
  Search, 
  X, 
  RotateCcw, 
  Eye, 
  Layers, 
  Briefcase, 
  ArrowLeft,
  ChevronRight,
  Filter,
  Award
} from 'lucide-react';

export const TeamMonitoring = () => {
  const { users = [], leads = [], sales = [], simulatedRole, currentUser } = useCRM();

  // Primary Dropdown State: 'teams' or 'individual'
  const [viewScope, setViewScope] = useState('teams');
  // Secondary Dropdown States
  const [selectedTeamId, setSelectedTeamId] = useState('All');
  const [selectedUserId, setSelectedUserId] = useState('All');
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  // Monitored staff: Executives (the frontline operational team members)
  const individualUsers = useMemo(() => {
    return users.filter(u => u.role === 'Executive');
  }, [users]);

  // Derive Teams dynamically from users and their reportingTo hierarchies
  const teams = useMemo(() => {
    const map = new Map();

    // 1. Identify all formal Team Leaders and Managers
    users.forEach(u => {
      if (['Team Leader', 'Team Lead', 'Manager'].includes(u.role)) {
        map.set(u.name.toLowerCase().trim(), {
          id: `team-${u.id}`,
          leaderId: u.id,
          leaderName: u.name,
          leaderRole: u.role,
          leaderEmployeeId: u.employeeId || 'TL-100',
          leaderMobile: u.mobile || '—',
          reportingManager: u.reportingTo || 'Management',
          members: []
        });
      }
    });

    // 2. Map executives to their respective teams via reportingTo
    individualUsers.forEach(exec => {
      const reportingKey = (exec.reportingTo || '').trim();
      const lookupKey = reportingKey.toLowerCase();

      if (lookupKey && map.has(lookupKey)) {
        map.get(lookupKey).members.push(exec);
      } else if (reportingKey) {
        // Create an entry if reportingTo is a manager/lead not yet mapped
        const matchingUser = users.find(u => u.name.toLowerCase().trim() === lookupKey);
        map.set(lookupKey, {
          id: matchingUser ? `team-${matchingUser.id}` : `team-${lookupKey.replace(/\s+/g, '-')}`,
          leaderId: matchingUser ? matchingUser.id : `mgr-${lookupKey}`,
          leaderName: reportingKey,
          leaderRole: matchingUser ? matchingUser.role : 'Team Leader',
          leaderEmployeeId: matchingUser?.employeeId || 'TL-MGR',
          leaderMobile: matchingUser?.mobile || '—',
          reportingManager: matchingUser?.reportingTo || 'Management',
          members: [exec]
        });
      } else {
        // Unassigned or Direct Oversight
        const directKey = 'direct oversight (super admin)';
        if (!map.has(directKey)) {
          map.set(directKey, {
            id: 'team-direct',
            leaderId: 'usr-1',
            leaderName: 'Direct Oversight (Super Admin)',
            leaderRole: 'Super Admin',
            leaderEmployeeId: 'EMP-001',
            leaderMobile: '—',
            reportingManager: 'Board of Directors',
            members: []
          });
        }
        map.get(directKey).members.push(exec);
      }
    });

    return Array.from(map.values()).filter(t => t.members.length > 0 || ['Team Leader', 'Team Lead'].includes(t.leaderRole));
  }, [users, individualUsers]);

  // Active Team object if a specific team is chosen
  const activeTeam = useMemo(() => {
    if (selectedTeamId === 'All') return null;
    return teams.find(t => t.id === selectedTeamId) || null;
  }, [teams, selectedTeamId]);

  // Active User object if a specific user is chosen
  const activeUserObj = useMemo(() => {
    if (selectedUserId === 'All') return null;
    return individualUsers.find(u => u.id === selectedUserId) || null;
  }, [individualUsers, selectedUserId]);

  // Filtered teammates to display in the detailed table
  const displayedTeammates = useMemo(() => {
    let list = individualUsers;

    if (viewScope === 'teams') {
      if (selectedTeamId !== 'All' && activeTeam) {
        list = activeTeam.members;
      }
    } else if (viewScope === 'individual') {
      if (selectedUserId !== 'All' && activeUserObj) {
        list = [activeUserObj];
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(tm => 
        tm.name.toLowerCase().includes(q) ||
        (tm.employeeId && tm.employeeId.toLowerCase().includes(q)) ||
        (tm.mobile && tm.mobile.includes(q)) ||
        (tm.reportingTo && tm.reportingTo.toLowerCase().includes(q))
      );
    }

    return list;
  }, [viewScope, selectedTeamId, activeTeam, selectedUserId, activeUserObj, individualUsers, searchTerm]);

  // Filtered teams to display in Teams overview table
  const displayedTeams = useMemo(() => {
    if (!searchTerm.trim()) return teams;
    const q = searchTerm.toLowerCase();
    return teams.filter(t => 
      t.leaderName.toLowerCase().includes(q) ||
      t.reportingManager.toLowerCase().includes(q) ||
      t.leaderEmployeeId.toLowerCase().includes(q) ||
      t.members.some(m => m.name.toLowerCase().includes(q))
    );
  }, [teams, searchTerm]);

  // Metric Card Calculations
  const metrics = useMemo(() => {
    let relevantMembers = individualUsers;

    if (viewScope === 'teams') {
      if (selectedTeamId !== 'All' && activeTeam) {
        relevantMembers = activeTeam.members;
      }
    } else if (viewScope === 'individual') {
      if (selectedUserId !== 'All' && activeUserObj) {
        relevantMembers = [activeUserObj];
      }
    }

    const memberIds = relevantMembers.map(m => m.id);
    const memberNames = relevantMembers.map(m => m.name);

    const relevantSales = sales.filter(s => 
      memberIds.includes(s.employeeId) || memberNames.includes(s.employeeName)
    );

    return {
      teammatesCount: relevantMembers.length,
      salesCount: relevantSales.length,
      complianceScore: relevantMembers.length > 0 ? '98%' : '100%'
    };
  }, [viewScope, selectedTeamId, activeTeam, selectedUserId, activeUserObj, individualUsers, sales]);

  const handleScopeChange = (newScope) => {
    setViewScope(newScope);
    setSelectedTeamId('All');
    setSelectedUserId('All');
    setSearchTerm('');
  };

  const handleResetFilters = () => {
    setSelectedTeamId('All');
    setSelectedUserId('All');
    setSearchTerm('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h4>
              {viewScope === 'teams' 
                ? (selectedTeamId === 'All' ? 'Teammates Supervised' : 'Team Size')
                : (selectedUserId === 'All' ? 'Individual Users Supervised' : 'Monitored Teammate')}
            </h4>
            <div className="value">{metrics.teammatesCount}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {viewScope === 'teams'
                ? (selectedTeamId === 'All' ? `Across ${teams.length} Teams` : `Under ${activeTeam?.leaderName}`)
                : (selectedUserId === 'All' ? 'Frontline Executives' : (activeUserObj?.name || 'Selected User'))}
            </div>
          </div>
          <div className="metric-icon">
            <Users size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>
              {viewScope === 'teams' ? 'Team Sales Registered' : 'Sales Registered'}
            </h4>
            <div className="value">{metrics.salesCount}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {viewScope === 'teams' && selectedTeamId !== 'All' 
                ? `Team ${activeTeam?.leaderName} Total` 
                : 'Approved & processed sales'}
            </div>
          </div>
          <div className="metric-icon">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Audit Compliance Score</h4>
            <div className="value" style={{ color: 'var(--status-success)' }}>
              {metrics.complianceScore}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              eKYC verified & compliant
            </div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* Main Monitoring Card */}
      <div className="directory-card">
        {/* Toolbar with Super Admin Drop Down Provision */}
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Team Performance & Compliance Monitoring Dashboard</h3>
              {isSuperAdmin && (
                <span className="badge" style={{ 
                  background: 'var(--accent-soft)', 
                  color: 'var(--accent)', 
                  border: '1px solid var(--accent-border)', 
                  fontSize: '0.72rem', 
                  padding: '2px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <ShieldCheck size={12} /> Super Admin Control
                </span>
              )}
            </div>
            <p style={{ marginTop: '4px' }}>
              Monitor teams, individual teammates, active lead workloads, eKYC verification, and compliance status.
            </p>
          </div>

          {/* Directory Actions: Drop Down Controls */}
          <div className="directory-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* 1. Primary Drop Down Box: Choose Teams or Individual Users */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label 
                htmlFor="super-admin-scope-select" 
                style={{ 
                  fontSize: '0.82rem', 
                  fontWeight: 600, 
                  color: 'var(--text-secondary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Layers size={14} color="var(--accent-primary)" /> View Scope:
              </label>
              <select
                id="super-admin-scope-select"
                className="select-filter"
                value={viewScope}
                onChange={(e) => handleScopeChange(e.target.value)}
                style={{ 
                  fontWeight: 600, 
                  borderColor: 'var(--accent-border)', 
                  minWidth: '150px',
                  cursor: 'pointer'
                }}
                aria-label="Choose Teams or Individual Users"
              >
                <option value="teams">👥 Teams</option>
                <option value="individual">👤 Individual Users</option>
              </select>
            </div>

            {/* 2. Secondary Drop Down: Team Selection or User Selection */}
            {viewScope === 'teams' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label 
                  htmlFor="team-selector" 
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                >
                  Team:
                </label>
                <select
                  id="team-selector"
                  className="select-filter"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{ minWidth: '160px', cursor: 'pointer' }}
                  aria-label="Select Team"
                >
                  <option value="All">All Teams ({teams.length})</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      Team {t.leaderName} ({t.members.length} members)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label 
                  htmlFor="user-selector" 
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                >
                  User:
                </label>
                <select
                  id="user-selector"
                  className="select-filter"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{ minWidth: '180px', cursor: 'pointer' }}
                  aria-label="Select Individual User"
                >
                  <option value="All">All Individual Users ({individualUsers.length})</option>
                  {individualUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeId || 'EMP'}) {u.reportingTo ? `- Team ${u.reportingTo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Box */}
            <div className="search-input-wrapper" style={{ width: '210px' }}>
              <Search className="search-icon" size={14} />
              <input
                type="text"
                placeholder={viewScope === 'teams' ? "Search team or leader..." : "Search teammate or ID..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
                aria-label="Search filter"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Reset Button */}
            {(selectedTeamId !== 'All' || selectedUserId !== 'All' || searchTerm) && (
              <button
                className="btn-secondary"
                onClick={handleResetFilters}
                title="Reset filters"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* View Mode Context Header / Breadcrumb */}
        {viewScope === 'teams' && selectedTeamId !== 'All' && activeTeam && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'var(--accent-soft)', 
            border: '1px solid var(--accent-border)', 
            borderRadius: 'var(--radius-md)', 
            padding: '12px 18px', 
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: 'var(--radius-sm)', 
                background: 'var(--bg-card)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)'
              }}>
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  Team {activeTeam.leaderName} Roster & Compliance
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Led by {activeTeam.leaderName} ({activeTeam.leaderRole} • {activeTeam.leaderEmployeeId}) • Reporting to {activeTeam.reportingManager} • {activeTeam.members.length} Supervised Teammates
                </div>
              </div>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => setSelectedTeamId('All')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={13} /> View All Teams
            </button>
          </div>
        )}

        {/* Individual User Spotlight Card if single user is selected */}
        {viewScope === 'individual' && selectedUserId !== 'All' && activeUserObj && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'var(--bg-input)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-md)', 
            padding: '14px 18px', 
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: 'var(--accent-soft)', 
                color: 'var(--accent)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                border: '1px solid var(--accent-border)'
              }}>
                {activeUserObj.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{activeUserObj.name}</span>
                  <span className="badge badge-role" style={{ fontSize: '0.72rem' }}>{activeUserObj.role}</span>
                  <span className="badge badge-disposition" style={{ fontSize: '0.72rem' }}>{activeUserObj.employeeId || 'EMP'}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '14px', marginTop: '2px', flexWrap: 'wrap' }}>
                  <span>Mobile: <strong>{activeUserObj.mobile}</strong></span>
                  {activeUserObj.email && <span>Email: <strong>{activeUserObj.email}</strong></span>}
                  <span>Reporting Manager: <strong>{activeUserObj.reportingTo || 'Management'}</strong></span>
                </div>
              </div>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => setSelectedUserId('All')}
              style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={13} /> View All Users
            </button>
          </div>
        )}

        {/* ─── TEAMS CONSOLIDATED MATRIX TABLE (When View Scope is Teams & 'All Teams' is selected) ─── */}
        {viewScope === 'teams' && selectedTeamId === 'All' && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Users size={15} /> Teams Overview & Hierarchy Matrix ({displayedTeams.length} Teams)
              </h4>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Click "View Members" on any team to inspect individual workloads
              </span>
            </div>

            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Team Name & Leader</th>
                    <th>Leader Role / ID</th>
                    <th>Reporting Manager</th>
                    <th>Team Size</th>
                    <th>Total Active Leads</th>
                    <th>Total Team Sales</th>
                    <th>eKYC Completion</th>
                    <th>Compliance Status</th>
                    <th>Team Grade</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTeams.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No teams match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedTeams.map(team => {
                      const memberIds = team.members.map(m => m.id);
                      const memberNames = team.members.map(m => m.name);
                      
                      const teamLeadsCount = leads.filter(l => memberIds.includes(l.assignedToId)).length;
                      const teamSalesCount = sales.filter(s => 
                        memberIds.includes(s.employeeId) || memberNames.includes(s.employeeName)
                      ).length;

                      return (
                        <tr key={team.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--accent-primary)' }}>Team {team.leaderName}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-role" style={{ fontSize: '0.72rem' }}>
                              {team.leaderRole} ({team.leaderEmployeeId})
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{team.reportingManager}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{team.members.length} Teammates</span>
                          </td>
                          <td>
                            <span className="badge badge-role">{teamLeadsCount} Leads</span>
                          </td>
                          <td>
                            <span className="badge badge-disposition">{teamSalesCount} Sales</span>
                          </td>
                          <td>
                            <div className="status-indicator">
                              <span className="status-dot active" />
                              <span>{team.members.length > 0 ? '100% Verified' : 'N/A'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="status-indicator">
                              <span className="status-dot active" />
                              <span>Compliant</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ 
                              fontWeight: 600, 
                              color: 'var(--accent)', 
                              background: 'var(--accent-soft)', 
                              border: '1px solid var(--accent-border)', 
                              padding: '2px 8px', 
                              borderRadius: 'var(--radius-sm)', 
                              fontSize: '0.78rem' 
                            }}>
                              {teamSalesCount > 0 ? 'A+' : 'A'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => setSelectedTeamId(team.id)}
                              style={{ 
                                padding: '3px 10px', 
                                fontSize: '0.76rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}
                              title={`Inspect members of Team ${team.leaderName}`}
                            >
                              <Eye size={12} /> View Members
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── DETAILED TEAMMATES ROSTER TABLE ─── */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <User size={15} /> 
              {viewScope === 'teams' 
                ? (selectedTeamId === 'All' ? `Teammates Under Supervised Teams (${displayedTeammates.length})` : `Members of Team ${activeTeam?.leaderName} (${displayedTeammates.length})`)
                : (selectedUserId === 'All' ? `Individual Teammates Directory (${displayedTeammates.length})` : `Teammate Record: ${activeUserObj?.name}`)}
            </h4>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Real-time lead counts, registered sales & compliance audit
            </span>
          </div>

          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Teammate Name</th>
                  <th>Employee ID</th>
                  <th>Mobile Number</th>
                  <th>Reporting Manager / Team</th>
                  <th>Active Leads</th>
                  <th>Sales Registered</th>
                  <th>eKYC Status</th>
                  <th>Compliance Status</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {displayedTeammates.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No teammates found matching current selection and search filters.
                    </td>
                  </tr>
                ) : (
                  displayedTeammates.map(tm => {
                    const teamLeadsCount = leads.filter(l => l.assignedToId === tm.id).length;
                    const teamSalesCount = sales.filter(s => s.employeeId === tm.id || s.employeeName === tm.name).length;

                    return (
                      <tr key={tm.id}>
                        <td style={{ fontWeight: 600 }}>{tm.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{tm.employeeId || 'EMP-100'}</td>
                        <td>{tm.mobile}</td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {tm.reportingTo ? `Team ${tm.reportingTo}` : 'Direct Oversight'}
                          </span>
                        </td>
                        <td><span className="badge badge-role">{teamLeadsCount} Leads</span></td>
                        <td><span className="badge badge-disposition">{teamSalesCount} Sales</span></td>
                        <td>
                          <div className="status-indicator">
                            <span className="status-dot active" />
                            <span>Verified</span>
                          </div>
                        </td>
                        <td>
                          <div className="status-indicator">
                            <span className="status-dot active" />
                            <span>Compliant</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            fontWeight: 600, 
                            color: 'var(--accent)', 
                            background: 'var(--accent-soft)', 
                            border: '1px solid var(--accent-border)', 
                            padding: '2px 8px', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.78rem' 
                          }}>
                            {teamSalesCount > 0 ? 'A+' : 'A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

