import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { X, UserPlus, Users, AlertCircle } from 'lucide-react';

export const UserModal = ({ isOpen, onClose, userToEdit = null }) => {
  const { users, customRoles, addUser, updateUser } = useCRM();
  const { showToast } = useToast();

  const [mode, setMode] = useState('single');
  const [formData, setFormData] = useState({
    name: userToEdit ? userToEdit.name : '',
    mobile: userToEdit ? userToEdit.mobile : '',
    password: '',
    role: userToEdit ? userToEdit.role : 'Executive',
    email: userToEdit ? userToEdit.email : '',
    reportingTo: userToEdit ? userToEdit.reportingTo : '',
    employeeId: userToEdit ? userToEdit.employeeId : ''
  });

  const [bulkText, setBulkText] = useState('');

  if (!isOpen) return null;

  const managementUsers = users.filter(u => ['Super Admin', 'Admin', 'Manager', 'Team Leader'].includes(u.role));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'single') {
      if (!formData.name || !formData.mobile) {
        showToast('Please provide User Name and Contact Number.', 'warning');
        return;
      }

      if (formData.role === 'Executive' && !formData.reportingTo) {
        showToast('Executive assignment rule: Please select a Reporting Team Leader or Manager.', 'warning');
        return;
      }

      if (userToEdit) {
        updateUser(userToEdit.id, formData);
        showToast(`User '${formData.name}' details updated.`, 'success');
      } else {
        addUser(formData);
        showToast(`User '${formData.name}' created successfully.`, 'success');
      }
    } else {
      const lines = bulkText.split('\n').filter(l => l.trim().length > 0);
      let count = 0;
      lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts[0] && parts[1]) {
          addUser({
            name: parts[0],
            mobile: parts[1],
            email: parts[2] || '',
            role: parts[3] || 'Executive',
            reportingTo: 'Sreenivasulu'
          });
          count++;
        }
      });
      showToast(`Imported ${count} users successfully.`, 'success');
    }

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{userToEdit ? 'Edit User Details' : 'Add Users'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {!userToEdit && (
          <div style={{ padding: '10px 20px', background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
            <button
              className={`btn-secondary ${mode === 'single' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'single' ? 'var(--accent-primary)' : 'var(--border-color)' }}
              onClick={() => setMode('single')}
            >
              <UserPlus size={15} /> Single User Creation
            </button>
            <button
              className={`btn-secondary ${mode === 'bulk' ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'bulk' ? 'var(--accent-primary)' : 'var(--border-color)' }}
              onClick={() => setMode('bulk')}
            >
              <Users size={15} /> Add Bulk Users
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {mode === 'single' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>User Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. ABHINAYA M"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Number *</label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="e.g. 7331113490"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password {!userToEdit && '*'}</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={userToEdit ? 'Leave blank to keep unchanged' : '••••••••'}
                    required={!userToEdit}
                  />
                </div>

                <div className="form-group">
                  <label>Role * (Role Master)</label>
                  <select name="role" value={formData.role} onChange={handleChange} required>
                    <option value="Executive">Executive</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                    {customRoles.map(cr => (
                      <option key={cr.id} value={cr.roleName}>{cr.roleName} (Custom)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Email ID</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="anithaani4336@gmail.com"
                  />
                </div>

                <div className="form-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleChange}
                    placeholder="e.g. EMP-105"
                  />
                </div>

                {formData.role === 'Executive' && (
                  <div className="form-group" style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)' }}>
                    <label style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <AlertCircle size={15} /> Executive Team Assignment:
                    </label>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Selecting Executive role requires selecting a Team Leader or Manager.
                    </div>
                    <select
                      name="reportingTo"
                      value={formData.reportingTo}
                      onChange={handleChange}
                      style={{ background: 'var(--bg-card)' }}
                      required
                    >
                      <option value="">-- Select Reporting Manager --</option>
                      {managementUsers.map(m => (
                        <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label>Bulk User Data (CSV Format)</label>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Format per line: <code>Name, Contact Number, Email, Role</code>
                </div>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`ABHINAYA M, 7331113490, abhinaya@gmail.com, Executive\nAJAY, 9390616049, tajayvarma76@gmail.com, Executive`}
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {userToEdit ? 'Save Changes' : (mode === 'single' ? 'Submit User' : 'Import Bulk Users')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
