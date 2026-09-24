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
  Landmark, 
  Eye, 
  FileText, 
  Download, 
  UploadCloud, 
  File,
  Edit2,
  Save,
  Check,
  Plus
} from 'lucide-react';

export const UserDirectory = () => {
  const { 
    users, 
    simulatedRole, 
    toggleUserStatus, 
    deleteUser, 
    toggleAdminAccess, 
    changeUserPassword, 
    downloadUserDocument,
    updateUser,
    uploadUserDocument,
    deleteUserDocument,
    documentTypes
  } = useCRM();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [roleFilter, setRoleFilter] = useState('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUserDetails, setViewingUserDetails] = useState(null);
  
  // User & Bank Profile inline editing state
  const [isEditingBankDetails, setIsEditingBankDetails] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    bankAccountNumber: '',
    ifscCode: '',
    bankNameAndBranch: '',
    familyReferenceNumber: '',
    referredBy: ''
  });

  // User & Bank Profile inline document upload state
  const [showUploadDocForm, setShowUploadDocForm] = useState(false);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState('');
  const [docFileToUpload, setDocFileToUpload] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  
  const [userToDelete, setUserToDelete] = useState(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const handleOpenBankProfile = (u) => {
    // Pick the freshest record from users list if present
    const freshUser = users.find(user => user.id === u.id) || u;
    setViewingUserDetails(freshUser);
    setIsEditingBankDetails(false);
    setShowUploadDocForm(false);
    setBankFormData({
      bankAccountNumber: freshUser.bankAccountNumber || '',
      ifscCode: freshUser.ifscCode || '',
      bankNameAndBranch: freshUser.bankNameAndBranch || '',
      familyReferenceNumber: freshUser.familyReferenceNumber || '',
      referredBy: freshUser.referredBy || ''
    });
    setSelectedDocTypeId(documentTypes[0]?.id || '');
    setDocFileToUpload(null);
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    if (!viewingUserDetails) return;
    await updateUser(viewingUserDetails.id, bankFormData);
    setViewingUserDetails(prev => ({ ...prev, ...bankFormData }));
    setIsEditingBankDetails(false);
    showToast('Bank details updated successfully.', 'success');
  };

  const handleDirectDocUpload = async (e) => {
    e.preventDefault();
    if (!viewingUserDetails || !docFileToUpload || !selectedDocTypeId) {
      showToast('Please select a document type and file to upload.', 'warning');
      return;
    }
    const docType = documentTypes.find(dt => dt.id === selectedDocTypeId);
    setIsUploadingDoc(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileData = event.target.result;
      const sizeStr = (docFileToUpload.size / 1024).toFixed(0) + ' KB';
      const docPayload = {
        documentTypeId: selectedDocTypeId,
        documentName: docType ? docType.name : 'Document',
        fileName: docFileToUpload.name,
        fileType: docFileToUpload.type,
        fileSize: sizeStr,
        fileData: fileData
      };

      const res = await uploadUserDocument(viewingUserDetails.id, docPayload);
      setIsUploadingDoc(false);
      if (res && res.success) {
        const updatedDocs = [...(viewingUserDetails.documents || [])];
        const existingIdx = updatedDocs.findIndex(d => d.documentTypeId === selectedDocTypeId);
        if (existingIdx >= 0) {
          updatedDocs[existingIdx] = res.doc;
        } else {
          updatedDocs.push(res.doc);
        }
        setViewingUserDetails(prev => ({ ...prev, documents: updatedDocs }));
        setShowUploadDocForm(false);
        setDocFileToUpload(null);
        showToast(`Document '${docPayload.documentName}' uploaded successfully.`, 'success');
      } else {
        showToast('Failed to upload document.', 'error');
      }
    };
    reader.onerror = () => {
      setIsUploadingDoc(false);
      showToast('Error reading file.', 'error');
    };
    reader.readAsDataURL(docFileToUpload);
  };

  const handleDirectDocDelete = async (docId, docName) => {
    if (!viewingUserDetails) return;
    if (window.confirm(`Are you sure you want to delete ${docName}?`)) {
      await deleteUserDocument(viewingUserDetails.id, docId);
      setViewingUserDetails(prev => ({
        ...prev,
        documents: (prev.documents || []).filter(d => d.id !== docId)
      }));
      showToast(`Document '${docName}' deleted.`, 'info');
    }
  };

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
                              minWidth: '175px',
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '4px'
                            }}>
                              <button
                                className="btn-secondary"
                                style={{ border: 'none', justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.8rem', gap: '6px' }}
                                onClick={() => { handleOpenBankProfile(u); setActiveDropdownId(null); }}
                              >
                                <Eye size={13} /> View Bank & Profile
                              </button>

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

      {/* User & Bank Details Profile Modal */}
      {viewingUserDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3>User & Bank Profile</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setViewingUserDetails(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {/* User Overview Header */}
              <div style={{
                background: 'var(--bg-table-head)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{viewingUserDetails.name}</h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    {viewingUserDetails.employeeId || 'EMP-' + viewingUserDetails.id} • {viewingUserDetails.role}
                  </div>
                </div>
                <span className="badge badge-role">{viewingUserDetails.status}</span>
              </div>

              {/* Basic Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Mobile Number:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.mobile || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Email ID:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.email || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Reporting Manager:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.reportingTo || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Account Expiry:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.expiryDate || '27-07-2028'}</strong>
                </div>
              </div>

              {/* Block 1: Bank Account Details (With Inline Edit Feature) */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                    <Landmark size={15} />
                    <span>Bank Account Details</span>
                  </div>

                  {!isEditingBankDetails ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setIsEditingBankDetails(true)}
                    >
                      <Edit2 size={12} /> Edit Bank Details
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}
                      onClick={() => setIsEditingBankDetails(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditingBankDetails ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bank Account Number:</span>
                      <strong style={{ letterSpacing: '0.5px', color: 'var(--text-primary)' }}>{viewingUserDetails.bankAccountNumber || 'Not Provided'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>IFSC Code:</span>
                      <strong style={{ letterSpacing: '0.5px', color: 'var(--text-primary)' }}>{viewingUserDetails.ifscCode || 'Not Provided'}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bank Name & Branch:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.bankNameAndBranch || 'Not Provided'}</strong>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveBankDetails} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.74rem' }}>Bank Account Number</label>
                        <input
                          type="text"
                          value={bankFormData.bankAccountNumber}
                          onChange={(e) => setBankFormData({ ...bankFormData, bankAccountNumber: e.target.value })}
                          placeholder="e.g. 91234567890123"
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.74rem' }}>IFSC Code</label>
                        <input
                          type="text"
                          value={bankFormData.ifscCode}
                          onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value })}
                          placeholder="e.g. HDFC0000123"
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.74rem' }}>Bank Name & Branch</label>
                      <input
                        type="text"
                        value={bankFormData.bankNameAndBranch}
                        onChange={(e) => setBankFormData({ ...bankFormData, bankNameAndBranch: e.target.value })}
                        placeholder="e.g. HDFC Bank, MG Road Branch"
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.74rem' }}>Family Reference Number</label>
                        <input
                          type="text"
                          value={bankFormData.familyReferenceNumber}
                          onChange={(e) => setBankFormData({ ...bankFormData, familyReferenceNumber: e.target.value })}
                          placeholder="e.g. +91 98765 43219"
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.74rem' }}>Referred By</label>
                        <input
                          type="text"
                          value={bankFormData.referredBy}
                          onChange={(e) => setBankFormData({ ...bankFormData, referredBy: e.target.value })}
                          placeholder="e.g. Board of Directors"
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setIsEditingBankDetails(false)}
                        style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ fontSize: '0.76rem', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Save size={12} /> Save Bank Details
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Block 2: Family Reference & Referral Details (View mode when not editing bank details) */}
              {!isEditingBankDetails && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '10px' }}>
                    <Users size={15} />
                    <span>Family Reference & Referral Information</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Family Reference Number:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.familyReferenceNumber || 'Not Provided'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Referred By:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{viewingUserDetails.referredBy || 'Not Provided'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Block 3: Employee Documents (With Direct Upload & Delete) */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>
                    <FileText size={15} />
                    <span>Employee Documents ({viewingUserDetails.documents?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowUploadDocForm(!showUploadDocForm)}
                  >
                    <Plus size={12} /> {showUploadDocForm ? 'Cancel Upload' : 'Upload Document'}
                  </button>
                </div>

                {/* Direct Upload Form inside User & Bank Profile */}
                {showUploadDocForm && (
                  <form onSubmit={handleDirectDocUpload} style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Upload Document for {viewingUserDetails.name}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.74rem' }}>Select Document Type *</label>
                      <select
                        value={selectedDocTypeId}
                        onChange={(e) => setSelectedDocTypeId(e.target.value)}
                        required
                        style={{ fontSize: '0.8rem' }}
                      >
                        {documentTypes.map(dt => (
                          <option key={dt.id} value={dt.id}>
                            {dt.name} {dt.required ? '(Mandatory)' : '(Optional)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.74rem' }}>Select Document File (PDF, PNG, JPG) *</label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setDocFileToUpload(e.target.files[0] || null)}
                        required
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setShowUploadDocForm(false); setDocFileToUpload(null); }}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isUploadingDoc || !docFileToUpload}
                        style={{ fontSize: '0.75rem', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <UploadCloud size={12} /> {isUploadingDoc ? 'Uploading...' : 'Save & Attach'}
                      </button>
                    </div>
                  </form>
                )}

                {(!viewingUserDetails.documents || viewingUserDetails.documents.length === 0) ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                    No documents uploaded yet for this employee. Click 'Upload Document' above to attach documents.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {viewingUserDetails.documents.map(doc => (
                      <div
                        key={doc.id}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            background: doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? '#ef4444' : '#10b981'
                          }}>
                            {doc.fileType?.includes('pdf') || doc.fileName?.endsWith('.pdf') ? 'PDF' : 'IMG'}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.documentName}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {doc.fileName} • {doc.fileSize}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                            onClick={() => downloadUserDocument(doc, viewingUserDetails.name)}
                            title="Download document directly from CRM"
                          >
                            <Download size={12} /> Download
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                            onClick={() => handleDirectDocDelete(doc.id, doc.documentName)}
                            title="Delete this document"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingUser(viewingUserDetails);
                  setIsAddModalOpen(true);
                  setViewingUserDetails(null);
                }}
              >
                Edit Account Details
              </button>
              <button type="button" className="btn-primary" onClick={() => setViewingUserDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

