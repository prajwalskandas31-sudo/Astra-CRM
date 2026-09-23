import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Palette, Sun, Moon, Shield, Plus, Check, FileText, Trash2, Sparkles, AlertCircle } from 'lucide-react';

export const SystemSettings = () => {
  const { 
    themeMode, 
    setThemeMode, 
    accentColor, 
    setAccentColor, 
    customRoles, 
    addCustomRole, 
    documentTypes,
    addDocumentType,
    deleteDocumentType,
    simulatedRole 
  } = useCRM();
  const { showToast } = useToast();

  const [roleForm, setRoleForm] = useState({ roleName: '' });
  const [docTypeForm, setDocTypeForm] = useState({ name: '', required: false, description: '' });

  const handleAddDocType = async (e) => {
    e.preventDefault();
    if (!docTypeForm.name.trim()) return;
    if (documentTypes.length >= 10) {
      showToast('Maximum limit of 10 document types reached.', 'error');
      return;
    }
    const res = await addDocumentType(docTypeForm);
    if (res?.success) {
      showToast(`Document slot '${docTypeForm.name}' created! (Total: ${documentTypes.length + 1}/10)`, 'success');
      setDocTypeForm({ name: '', required: false, description: '' });
    } else {
      showToast(res?.message || 'Failed to create document type', 'error');
    }
  };

  const handleDeleteDocType = (dt) => {
    if (window.confirm(`Delete document slot '${dt.name}'?`)) {
      deleteDocumentType(dt.id);
      showToast(`Document slot '${dt.name}' removed.`, 'info');
    }
  };

  const handleAddRole = (e) => {
    e.preventDefault();
    if (!roleForm.roleName) return;
    addCustomRole(roleForm);
    showToast(`Custom Role '${roleForm.roleName}' created!`, 'success');
    setRoleForm({ roleName: '' });
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customRoles.map(cr => (
                <tr key={cr.id}>
                  <td style={{ fontWeight: 600 }}>{cr.roleName}</td>
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

      {/* Employee Document Types Manager (Similar to Dispositions, Max 10 slots) */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-primary)" /> Employee Document Configuration (Max 10 Slots)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Define custom document categories (similar to creating dispositions) such as Aadhar, PAN, 10th marks card, etc. Uploaded files (.pdf, .jpg, .png) are saved directly in the Owner's Database.
            </p>
          </div>

          <span style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: documentTypes.length >= 10 ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-soft)',
            color: documentTypes.length >= 10 ? '#ef4444' : 'var(--accent)',
            border: `1px solid ${documentTypes.length >= 10 ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent-border)'}`,
            fontWeight: 600
          }}>
            {documentTypes.length} / 10 Document Types Configured
          </span>
        </div>

        {simulatedRole === 'Super Admin' ? (
          documentTypes.length < 10 ? (
            <form onSubmit={handleAddDocType} style={{ margin: '16px 0 20px' }}>
              <div className="form-grid">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Document Slot Name *</label>
                  <input
                    type="text"
                    value={docTypeForm.name}
                    onChange={(e) => setDocTypeForm({ ...docTypeForm, name: e.target.value })}
                    placeholder="e.g. 10th Marks Card, PAN Card, Aadhar, Relieving Letter..."
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 3 }}>
                  <label>Description / Verification Criteria</label>
                  <input
                    type="text"
                    value={docTypeForm.description}
                    onChange={(e) => setDocTypeForm({ ...docTypeForm, description: e.target.value })}
                    placeholder="e.g. Government issued ID / Educational Certificate"
                  />
                </div>

                <div className="form-group" style={{ justifyContent: 'center', minWidth: '120px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: 'auto', marginBottom: '8px', fontSize: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={docTypeForm.required}
                      onChange={(e) => setDocTypeForm({ ...docTypeForm, required: e.target.checked })}
                    />
                    <span>Mandatory</span>
                  </label>
                </div>

                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-primary" style={{ marginTop: 'auto' }}>
                    <Plus size={15} /> Create Document
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="alert-box alert-warning" style={{ margin: '14px 0 18px' }}>
              <AlertCircle size={15} /> Maximum limit of 10 custom document types reached. Delete an existing type to add a new one.
            </div>
          )
        ) : (
          <div className="alert-box alert-warning" style={{ margin: '14px 0 18px' }}>
            Super Admin permission is required to create or configure document types.
          </div>
        )}

        <h4 style={{ fontSize: '0.86rem', marginBottom: '10px' }}>Configured Document Types:</h4>
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Document Type Name</th>
                <th>Requirement</th>
                <th>Description</th>
                <th>Storage Scope</th>
                {simulatedRole === 'Super Admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {documentTypes.map((dt, index) => (
                <tr key={dt.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                  <td style={{ fontWeight: 600 }}>
                    <span className="badge badge-disposition">{dt.name}</span>
                  </td>
                  <td>
                    {dt.required ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        Mandatory
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Optional
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {dt.description || '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.76rem', color: 'var(--accent)' }}>
                      Owner's Database Direct
                    </span>
                  </td>
                  {simulatedRole === 'Super Admin' && (
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)' }}
                        onClick={() => handleDeleteDocType(dt)}
                        title="Delete Document Type"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

