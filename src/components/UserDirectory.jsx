import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { UserModal } from './UserModal';
import { LeadReassignmentModal } from './LeadReassignmentModal';
import { Search, Filter, RefreshCw, UserPlus, MoreVertical, Key, Trash2, Users, ShieldCheck, UserCheck, Clock } from 'lucide-react';

export const UserDirectory = () => {
  const { users, simulatedRole, toggleUserStatus, deleteUser, toggleAdminAccess, changeUserPassword } = useCRM();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [roleFilter, setRoleFilter] = useState('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [userToDelete, setUserToDelete] = useState(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

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
    if (simulatedRole !== 'Super Admin') {
      showToast('Permission Denied: Super Admin only action', 'error');
      return;
    }

    const result = deleteUser(user.id);
    if (!result.success && result.requiresReassignment) {
      setUserToDelete(user);
      setIsReassignModalOpen(true);
    } else {
      showToast(`User '${user.name}' deleted successfully.`, 'success');
    }
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
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search name, mobile, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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

            {simulatedRole === 'Super Admin' && (
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
                {simulatedRole === 'Super Admin' && <th>Admin Access</th>}
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
                      {u.employeeId && <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{u.employeeId}</span>}
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
                    {simulatedRole === 'Super Admin' && (
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
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px' }}
                          onClick={() => setActiveDropdownId(activeDropdownId === u.id ? null : u.id)}
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
                            minWidth: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '4px'
                          }}>
                            <button
                              className="btn-secondary"
                              style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => { setEditingUser(u); setIsAddModalOpen(true); setActiveDropdownId(null); }}
                            >
                              Edit Details
                            </button>

                            <button
                              className="btn-secondary"
                              style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => { toggleUserStatus(u.id); showToast(`User status toggled for '${u.name}'`, 'info'); setActiveDropdownId(null); }}
                            >
                              {u.status === 'Active' ? 'Set Inactive' : 'Set Active'}
                            </button>

                            {simulatedRole === 'Super Admin' && (
                              <>
                                <button
                                  className="btn-secondary"
                                  style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => { setPasswordResetUser(u); setActiveDropdownId(null); }}
                                >
                                  <Key size={13} /> Change Password
                                </button>
                                <button
                                  className="btn-danger"
                                  style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem' }}
                                  onClick={() => { handleDeleteAttempt(u); setActiveDropdownId(null); }}
                                >
                                  <Trash2 size={13} /> Delete Account
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
        onReassignComplete={() => setUserToDelete(null)}
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
    </div>
  );
};
