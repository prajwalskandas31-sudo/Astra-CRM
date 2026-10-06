import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { UserModal } from './UserModal';
import { LeadReassignmentModal } from './LeadReassignmentModal';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  UserPlus, 
  MoreVertical, 
  Key, 
  Trash2, 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Clock, 
  X, 
  Edit2,
  Sliders,
  FileText
} from 'lucide-react';

export const UserDirectory = () => {
  const { 
    users, 
    currentUser,
    leads,
    simulatedRole, 
    toggleUserStatus, 
    deleteUser, 
    purgeAllData,
    toggleAdminAccess, 
    changeUserPassword,
    hasPermission,
    CRM_FEATURES = [],
    updateUserPermission,
    grantAllPermissions,
    revokeAllOptionalPermissions,
    resetUserPermissionsToDefault
  } = useCRM();
  const { showToast } = useToast();

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [roleFilter, setRoleFilter] = useState('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [featureAccessUser, setFeatureAccessUser] = useState(null);

  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const activeCount = users.filter(u => u.status === 'Active').length;
  const inactiveCount = users.filter(u => u.status === 'Inactive').length;
  const adminCount = users.filter(u => u.role === 'Super Admin' || u.role === 'Admin').length;

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.mobile.includes(searchTerm) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.employeeId && user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' ? true : user.status === statusFilter;
    const matchesRole = roleFilter === 'All' ? true : user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleDeleteAttempt = (user) => {
    if (!hasPermission('delete-user')) {
      showToast('Permission Denied: You do not have permission to delete user accounts.', 'error');
      return;
    }

    if (user.id === currentUser?.id) {
      showToast('Action Denied: You cannot delete your own active Super Admin profile.', 'error');
      return;
    }

    setUserToDelete(user);
    setIsReassignModalOpen(true);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!newPasswordInput) return;
    changeUserPassword(passwordResetUser.id, newPasswordInput);
    showToast(`Password updated for '${passwordResetUser.name}'.`, 'success');
    setPasswordResetUser(null);
    setNewPasswordInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Executive Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h4>Total Users</h4>
            <div className="value">{users.length}</div>
          </div>
          <div className="metric-icon">
            <Users size={20} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Active Accounts</h4>
            <div className="value">{activeCount}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <UserCheck size={20} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Inactive / Deactivated</h4>
            <div className="value">{inactiveCount}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger)', borderColor: 'var(--status-danger-border)' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Administrators</h4>
            <div className="value">{adminCount}</div>
          </div>
          <div className="metric-icon">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      <div className="directory-card">
        {/* Toolbar Section */}
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>
              User Directory <span style={{ fontSize: '0.74rem', background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-border)' }}>{filteredUsers.length} total</span>
            </h3>
            <p>Manage accounts, reporting managers, and security permissions.</p>
          </div>

          <div className="directory-actions">
            {/* Search Box */}
            <div className="search-input-wrapper">
              <Search className="search-icon" size={15} />
              <input
                type="text"
                placeholder="Search name, mobile, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', paddingRight: searchTerm ? '30px' : '12px' }}
                aria-label="Search users"
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
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%'
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                className="select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Active">Active Users Only</option>
                <option value="Inactive">Inactive Users</option>
                <option value="All">All Users</option>
              </select>
            </div>

            {/* Role Filter */}
            <select
              className="select-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Team Leader">Team Leader</option>
              <option value="Executive">Executive</option>
            </select>

            <button className="btn-secondary" onClick={() => { setSearchTerm(''); setStatusFilter('Active'); setRoleFilter('All'); }} title="Refresh Directory">
              <RefreshCw size={15} />
            </button>

            {isSuperAdmin && (
              <button 
                className="btn-danger" 
                style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete ALL CRM leads and activity data now? This will reset all active leads, master records, and assignment instances.')) {
                    purgeAllData();
                    showToast('All CRM lead and activity data has been wiped.', 'info');
                  }
                }}
                title="Wipe and reset all leads data"
              >
                <Trash2 size={14} /> Clear All Data
              </button>
            )}
            {hasPermission('user-management') && (
              <button className="btn-primary" onClick={() => { setEditingUser(null); setIsAddModalOpen(true); }}>
                <UserPlus size={15} /> Add User
              </button>
            )}
          </div>
        </div>

        {/* Directory Data Table */}
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Mobile Number</th>
                <th>Reporting To</th>
                <th>Email</th>
                <th>Role</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Feature Access</th>
                {isSuperAdmin && <th>Admin Access</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No user accounts matched the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      {u.name}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        {u.employeeId && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{u.employeeId}</span>}
                        {u.documents && u.documents.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setManagingDocsUser(u)}
                            style={{
                              background: 'var(--accent-soft)',
                              border: '1px solid var(--accent-border)',
                              borderRadius: 'var(--radius-full)',
                              padding: '1px 6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.68rem',
                              color: 'var(--accent)',
                              fontWeight: 500
                            }}
                            title="View and download employee documents"
                          >
                            <FileText size={10} /> {u.documents.length} docs
                          </button>
                        )}
                        {u.customFieldValues && Object.values(u.customFieldValues).some(v => v?.sub1 || v?.sub2) && (
                          <span
                            style={{
                              background: 'var(--accent-soft)',
                              border: '1px solid var(--accent-border)',
                              borderRadius: 'var(--radius-full)',
                              padding: '1px 6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.68rem',
                              color: 'var(--accent)',
                              fontWeight: 500
                            }}
                            title="Custom profile fields populated for this user"
                          >
                            <Sliders size={9} /> Custom Fields
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{u.mobile}</td>
                    <td>{u.reportingTo || '—'}</td>
                    <td style={{ color: u.email ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {u.email || '—'}
                    </td>
                    <td>
                      <span className="badge badge-role">{u.role}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.expiryDate || '27-07-2027'}</td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${u.status === 'Active' ? 'active' : 'inactive'}`} />
                        <span>{u.status}</span>
                      </div>
                    </td>
                    {/* Feature Access & Permissions Column */}
                    <td>
                      {(() => {
                        const enabledCount = CRM_FEATURES.filter(f => hasPermission(f.id, u.id)).length;
                        const isAllGranted = enabledCount === CRM_FEATURES.length;
                        return (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setFeatureAccessUser(u)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              borderRadius: 'var(--radius-full)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isAllGranted ? '#10b981' : 'var(--accent-primary)',
                              borderColor: isAllGranted ? 'rgba(16,185,129,0.3)' : 'var(--border-color)',
                              background: isAllGranted ? 'rgba(16,185,129,0.08)' : 'var(--bg-input)'
                            }}
                            title="Click to view and configure feature permissions for this user"
                          >
                            <Key size={11} /> {enabledCount}/{CRM_FEATURES.length} {isAllGranted ? '★ All' : 'Features'}
                          </button>
                        );
                      })()}
                    </td>
                    {isSuperAdmin && (
                      <td>
                        {u.role === 'Admin' ? (
                          <button
                            className="btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-full)' }}
                            onClick={() => { toggleAdminAccess(u.id); showToast(`Updated admin access for '${u.name}'`, 'info'); }}
                          >
                            {u.adminAccessEnabled ? 'Granted (ON)' : 'Canceled (OFF)'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setActiveDropdownId(activeDropdownId === u.id ? null : u.id)}
                            title="More Actions"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {activeDropdownId === u.id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              backgroundColor: 'var(--bg-modal)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              boxShadow: 'var(--shadow-md)',
                              zIndex: 20,
                              minWidth: '185px',
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '4px'
                            }}>
                              <button
                                className="btn-secondary"
                                style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => {
                                  const freshUser = users.find(user => user.id === u.id) || u;
                                  setEditingUser(freshUser);
                                  setIsAddModalOpen(true);
                                  setActiveDropdownId(null);
                                }}
                              >
                                <Edit2 size={13} /> Edit Details
                              </button>

                              <button
                                className="btn-secondary"
                                style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => {
                                  setFeatureAccessUser(u);
                                  setActiveDropdownId(null);
                                }}
                              >
                                <Key size={13} color="var(--accent-primary)" /> Feature Permissions
                              </button>

                              <button
                                className="btn-secondary"
                                style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                                onClick={() => { toggleUserStatus(u.id); showToast(`User status toggled for '${u.name}'`, 'info'); setActiveDropdownId(null); }}
                              >
                                {u.status === 'Active' ? 'Set Inactive' : 'Set Active'}
                              </button>

                              {hasPermission('user-management') && (
                                <button
                                  className="btn-secondary"
                                  style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => { setPasswordResetUser(u); setActiveDropdownId(null); }}
                                >
                                  <Key size={13} /> Change Password
                                </button>
                              )}

                              {hasPermission('delete-user') && (
                                <button
                                  className="btn-danger"
                                  style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => { handleDeleteAttempt(u); setActiveDropdownId(null); }}
                                >
                                  <Trash2 size={13} /> Delete Account
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        userToEdit={editingUser}
      />

      <LeadReassignmentModal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        userToDelete={userToDelete}
        onReassignComplete={(info) => {
          setUserToDelete(null);
          if (info && info.hasLeads) {
            showToast(`Reassigned ${info.reassignedCount} leads to ${info.targetUserName} & deleted user '${info.deletedUserName}'.`, 'success');
          } else if (info) {
            showToast(`User '${info.deletedUserName}' deleted successfully.`, 'success');
          }
        }}
      />

      {passwordResetUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3><Key size={16} /> Change Password</h3>
              <button className="modal-close-btn" onClick={() => setPasswordResetUser(null)}>×</button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.84rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                  Set security password for <strong>{passwordResetUser.name}</strong> ({passwordResetUser.role}).
                </p>
                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setPasswordResetUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Feature Access Modal ──────────────────────────────── */}
      {featureAccessUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--accent-primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Feature Permissions: {featureAccessUser.name}</h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Role: {featureAccessUser.role} • Super Admin Permission Control</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setFeatureAccessUser(null)}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Active Features: <strong>{CRM_FEATURES.filter(f => hasPermission(f.id, featureAccessUser.id)).length}</strong> of <strong>{CRM_FEATURES.length}</strong>
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={() => {
                      grantAllPermissions(featureAccessUser.id);
                      showToast(`All features enabled for ${featureAccessUser.name}`, 'success');
                    }}
                  >
                    Grant All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={() => {
                      revokeAllOptionalPermissions(featureAccessUser.id);
                      showToast(`Optional features revoked for ${featureAccessUser.name}`, 'info');
                    }}
                  >
                    Revoke Optional
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={() => {
                      resetUserPermissionsToDefault(featureAccessUser.id);
                      showToast(`Reset permissions for ${featureAccessUser.name}`, 'info');
                    }}
                  >
                    Reset Baseline
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CRM_FEATURES.map(f => {
                  const isEnabled = hasPermission(f.id, featureAccessUser.id);
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isEnabled ? 'var(--bg-input)' : 'rgba(0,0,0,0.15)',
                        border: '1px solid ' + (isEnabled ? 'var(--border-color)' : 'rgba(239,68,68,0.2)')
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {f.name}
                          </span>
                          <span className="badge" style={{ fontSize: '0.65rem', padding: '0px 5px', color: isEnabled ? '#10b981' : '#ef4444' }}>
                            {isEnabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {f.description}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={isEnabled}
                        disabled={!isSuperAdmin}
                        onChange={() => {
                          updateUserPermission(featureAccessUser.id, f.id, !isEnabled);
                          showToast(`${!isEnabled ? 'Enabled' : 'Disabled'} '${f.name}' for ${featureAccessUser.name}`, !isEnabled ? 'success' : 'info');
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: isSuperAdmin ? 'pointer' : 'not-allowed' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-primary" onClick={() => setFeatureAccessUser(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

