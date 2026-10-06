import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  Award, 
  Layers, 
  Sparkles,
  Info,
  ChevronRight,
  UserCheck
} from 'lucide-react';

export const CustomRolesBuilder = () => {
  const { 
    customRoles = [], 
    addCustomRole, 
    deleteCustomRole, 
    hasPermission,
    users = []
  } = useCRM();
  const { showToast } = useToast();

  const canManageCustomRoles = hasPermission('custom-roles');

  const [roleForm, setRoleForm] = useState({ 
    roleName: '',
    level: 'Level 2 (Mid)',
    accessScope: 'Regional',
    description: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');

  const handleAddRole = async (e) => {
    e.preventDefault();
    const trimmedName = roleForm.roleName.trim();
    if (!trimmedName) {
      showToast('Please enter a valid role title.', 'warning');
      return;
    }

    // Check duplicate
    const exists = customRoles.some(
      r => (r.roleName || '').trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      showToast(`A custom role with title "${trimmedName}" already exists.`, 'warning');
      return;
    }

    const res = await addCustomRole({
      roleName: trimmedName,
      level: roleForm.level,
      accessScope: roleForm.accessScope,
      description: roleForm.description.trim() || 'Custom role provisioned under Annexure-I'
    });

    if (res?.success !== false) {
      showToast(`Custom Role "${trimmedName}" provisioned successfully!`, 'success');
      setRoleForm({ 
        roleName: '', 
        level: 'Level 2 (Mid)', 
        accessScope: 'Regional', 
        description: '' 
      });
    } else {
      showToast('Failed to create custom role.', 'error');
    }
  };

  const handleDeleteRole = async (role) => {
    if (window.confirm(`Are you sure you want to delete custom role "${role.roleName}"? This action cannot be undone.`)) {
      await deleteCustomRole(role.id);
      showToast(`Custom Role "${role.roleName}" deleted successfully.`, 'info');
    }
  };

  // Filter roles
  const filteredRoles = customRoles.filter(role => {
    const matchesSearch = (role.roleName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.accessScope || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (role.level || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'ALL' || (role.level || '').includes(filterLevel);
    return matchesSearch && matchesLevel;
  });

  // Calculate assigned users for role
  const getAssignedCount = (roleName) => {
    if (!roleName) return 0;
    return (users || []).filter(u => (u.role || '').toLowerCase() === roleName.toLowerCase()).length;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header Banner */}
      <div 
        className="directory-card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(110, 86, 207, 0.08) 0%, rgba(20, 20, 24, 0.6) 100%)',
          borderColor: 'rgba(110, 86, 207, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: 'rgba(110, 86, 207, 0.18)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--accent-primary)' 
              }}
            >
              <Shield size={20} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Custom Roles Builder (Annexure-I)
            </h2>
            <span 
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '999px',
                background: 'rgba(110, 86, 207, 0.2)',
                color: '#a78bfa',
                border: '1px solid rgba(110, 86, 207, 0.3)',
                letterSpacing: '0.05em'
              }}
            >
              Annexure-I Standard
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Provision bespoke organizational roles, configure custom operational hierarchies, and establish operational access scopes across your CRM structure under Annexure-I governance.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div 
            style={{ 
              padding: '12px 18px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '10px', 
              border: '1px solid var(--border-color)',
              minWidth: '120px'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Custom Roles
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
              {customRoles.length}
            </div>
          </div>

          <div 
            style={{ 
              padding: '12px 18px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '10px', 
              border: '1px solid var(--border-color)',
              minWidth: '120px'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              RBAC Governance
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span className="status-dot active" style={{ width: '8px', height: '8px' }} />
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Permission Gate Warning if User Lacks Rights */}
      {!canManageCustomRoles && (
        <div 
          className="alert-box alert-warning"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '16px 20px',
            borderRadius: '10px'
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '4px' }}>
              Role Provisioning Restricted
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              You currently do not have administrative authorization to provision or modify custom role matrices. 
              Contact your Super Administrator to enable the <strong>'Custom Roles Builder (Annexure-I)'</strong> permission inside the Feature Access Block.
            </div>
          </div>
        </div>
      )}

      {/* Role Creation Form Card */}
      {canManageCustomRoles && (
        <div className="directory-card" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Award size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              Provision New Custom Role
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Enter the role designation, assign hierarchy classification, and designate operational scope. Once created, this role is immediately selectable in User Directory onboarding and Feature Access configurations.
          </p>

          <form onSubmit={handleAddRole}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Role Title / Designation *</label>
                <input
                  type="text"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })}
                  placeholder="e.g. Senior Regional Manager"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hierarchy Level</label>
                <select
                  value={roleForm.level}
                  onChange={(e) => setRoleForm({ ...roleForm, level: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="Level 1 (Top)">Level 1 (Top - Executive / C-Suite)</option>
                  <option value="Level 2 (Mid)">Level 2 (Mid - Regional / Area Head)</option>
                  <option value="Level 3 (Operational)">Level 3 (Operational - Team Lead / Supervisor)</option>
                  <option value="Level 4 (Field)">Level 4 (Field / Specialist / Agent)</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Access Scope</label>
                <select
                  value={roleForm.accessScope}
                  onChange={(e) => setRoleForm({ ...roleForm, accessScope: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="Global">Global (All Territories & Pipelines)</option>
                  <option value="Regional">Regional (Multi-Branch Jurisdiction)</option>
                  <option value="Branch">Branch (Single Location Specific)</option>
                  <option value="Team">Team (Assigned Pod / Unit Only)</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operational Scope Notes</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="e.g. Oversight of zonal sales & QA"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ 
                  padding: '10px 22px', 
                  fontSize: '0.86rem', 
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={16} /> Provision Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Roles Table & Directory */}
      <div className="directory-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-primary)" />
              Configured Custom Roles Matrix
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Showing {filteredRoles.length} of {customRoles.length} provisioned role profiles.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Search custom roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  width: '100%'
                }}
              />
            </div>

            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)'
              }}
            >
              <option value="ALL">All Levels</option>
              <option value="Level 1">Level 1 (Top)</option>
              <option value="Level 2">Level 2 (Mid)</option>
              <option value="Level 3">Level 3 (Operational)</option>
              <option value="Level 4">Level 4 (Field)</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>No.</th>
                <th>Role Designation</th>
                <th>Hierarchy Level</th>
                <th>Operational Scope</th>
                <th>Active Personnel</th>
                <th>Status</th>
                {canManageCustomRoles && <th style={{ width: '90px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td 
                    colSpan={canManageCustomRoles ? 7 : 6} 
                    style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Shield size={32} style={{ opacity: 0.3 }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                        {searchQuery ? 'No custom roles match your filter criteria.' : 'No custom roles provisioned yet.'}
                      </div>
                      <div style={{ fontSize: '0.78rem' }}>
                        {canManageCustomRoles ? 'Use the form above to provision your first Annexure-I role.' : 'Contact administrator for access.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((cr, idx) => {
                  const assignedCount = getAssignedCount(cr.roleName);
                  return (
                    <tr key={cr.id || idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div 
                            style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '6px', 
                              background: 'rgba(110, 86, 207, 0.12)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: 'var(--accent-primary)',
                              flexShrink: 0
                            }}
                          >
                            <Shield size={14} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                              {cr.roleName}
                            </div>
                            {cr.description && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {cr.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: cr.level?.includes('Level 1') ? 'rgba(234, 179, 8, 0.12)' : 'rgba(110, 86, 207, 0.12)',
                            color: cr.level?.includes('Level 1') ? '#facc15' : '#c4b5fd',
                            border: `1px solid ${cr.level?.includes('Level 1') ? 'rgba(234, 179, 8, 0.3)' : 'rgba(110, 86, 207, 0.25)'}`,
                            fontWeight: 500
                          }}
                        >
                          {cr.level || 'Level 2 (Mid)'}
                        </span>
                      </td>

                      <td>
                        <span 
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            fontWeight: 500
                          }}
                        >
                          {cr.accessScope || 'Regional'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <Users size={13} />
                          <span>{assignedCount} {assignedCount === 1 ? 'user' : 'users'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="status-indicator">
                          <span className="status-dot active" />
                          <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>Active</span>
                        </div>
                      </td>

                      {canManageCustomRoles && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ 
                              padding: '4px 9px', 
                              fontSize: '0.74rem', 
                              borderRadius: 'var(--radius-sm)', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                            onClick={() => handleDeleteRole(cr)}
                            title={`Delete Custom Role "${cr.roleName}"`}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Annexure-I Architecture Reference Callout */}
      <div 
        className="directory-card"
        style={{
          padding: '20px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--border-color)',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start'
        }}
      >
        <Info size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text-main)' }}>Annexure-I Architecture & Feature Access Policy:</strong>
          <br />
          Roles provisioned under this builder reflect organization-level hierarchy definitions. To assign granular capabilities (such as lead upload, sale approvals, or team monitoring) to users with these roles, navigate to the <strong>Feature Access Block</strong> where individual and role-wide permission toggles can be calibrated.
        </div>
      </div>
    </div>
  );
};
