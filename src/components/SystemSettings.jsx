import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Palette, Sun, Moon, Shield, Plus, Check } from 'lucide-react';

export const SystemSettings = () => {
  const { themeMode, setThemeMode, accentColor, setAccentColor, customRoles, addCustomRole, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [roleForm, setRoleForm] = useState({ roleName: '', level: 'Level 2', accessScope: 'Departmental' });

  const handleAddRole = (e) => {
    e.preventDefault();
    if (!roleForm.roleName) return;
    addCustomRole(roleForm);
    showToast(`Custom Role '${roleForm.roleName}' created!`, 'success');
    setRoleForm({ roleName: '', level: 'Level 2', accessScope: 'Departmental' });
  };

  const colors = [
    { id: 'purple', label: 'Royal Violet', hex: '#6e56cf' },
    { id: 'blue', label: 'Cobalt Blue', hex: '#3e63dd' },
    { id: 'emerald', label: 'Emerald Green', hex: '#29a383' },
    { id: 'amber', label: 'Warm Amber', hex: '#d97706' },
    { id: 'rose', label: 'Deep Rose', hex: '#e11d48' },
    { id: 'cyan', label: 'Ocean Cyan', hex: '#05a2c5' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* UI/UX Appearance Settings */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={18} color="var(--accent-primary)" /> UI Appearance & Customization Settings
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Customize theme preferences and accent palettes for your session.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Accent Theme Palette:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {colors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setAccentColor(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: accentColor === c.id ? '1px solid ' + c.hex : '1px solid var(--border-color)',
                    backgroundColor: accentColor === c.id ? 'var(--accent-soft)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.82rem'
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.hex }} />
                  <span>{c.label}</span>
                  {accentColor === c.id && <Check size={13} style={{ marginLeft: 'auto', color: c.hex }} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Interface Display Mode:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className={`btn-secondary ${themeMode === 'dark' ? 'active' : ''}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center', borderColor: themeMode === 'dark' ? 'var(--accent-primary)' : 'var(--border-color)' }}
                onClick={() => setThemeMode('dark')}
              >
                <Moon size={16} /> Dark Mode (Default)
              </button>
              <button
                className={`btn-secondary ${themeMode === 'light' ? 'active' : ''}`}
                style={{ flex: 1, padding: '10px', justifyContent: 'center', borderColor: themeMode === 'light' ? 'var(--accent-primary)' : 'var(--border-color)' }}
                onClick={() => setThemeMode('light')}
              >
                <Sun size={16} /> Light Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Roles Builder */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color="var(--accent-primary)" /> Custom Roles Builder (Annexure-I)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Provision custom organizational roles and operational permissions.
        </p>

        {simulatedRole === 'Super Admin' ? (
          <form onSubmit={handleAddRole} style={{ marginBottom: '20px' }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Role Title *</label>
                <input
                  type="text"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })}
                  placeholder="e.g. Senior Regional Manager"
                  required
                />
              </div>

              <div className="form-group">
                <label>Hierarchy Level</label>
                <select
                  value={roleForm.level}
                  onChange={(e) => setRoleForm({ ...roleForm, level: e.target.value })}
                >
                  <option value="Level 1 (Top)">Level 1 (Top Level)</option>
                  <option value="Level 2 (Mid)">Level 2 (Mid Level)</option>
                  <option value="Level 3 (Operational)">Level 3 (Operational Level)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Access Scope</label>
                <select
                  value={roleForm.accessScope}
                  onChange={(e) => setRoleForm({ ...roleForm, accessScope: e.target.value })}
                >
                  <option value="Global">Global Enterprise</option>
                  <option value="Departmental">Departmental</option>
                  <option value="Regional">Regional / Branch</option>
                  <option value="Team Only">Team Only</option>
                </select>
              </div>

              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" style={{ marginTop: 'auto' }}>
                  <Plus size={15} /> Create Role
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="alert-box alert-warning">
            Super Admin permission is required to create or modify custom role matrices.
          </div>
        )}

        <h4 style={{ fontSize: '0.86rem', marginBottom: '10px' }}>Existing Custom Roles:</h4>
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Hierarchy Level</th>
                <th>Access Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customRoles.map(cr => (
                <tr key={cr.id}>
                  <td style={{ fontWeight: 600 }}>{cr.roleName}</td>
                  <td>{cr.level}</td>
                  <td>{cr.accessScope}</td>
                  <td>
                    <div className="status-indicator">
                      <span className="status-dot active" />
                      <span>Active</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
