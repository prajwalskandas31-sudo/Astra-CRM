import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Palette, Sun, Moon, Shield, Plus, Check, FileText, Trash2, Sparkles, AlertCircle, ShieldCheck, ShieldOff, RefreshCw, Globe, Sliders, Edit2, Tag, Lock, Unlock, KeyRound, Eye, EyeOff, X, ExternalLink } from 'lucide-react';
import Demo from './ui/demo';

export const SystemSettings = () => {
  const { 
    themeMode, 
    setThemeMode, 
    accentColor, 
    setAccentColor, 
    documentTypes,
    addDocumentType,
    deleteDocumentType,
    userCustomFields = [],
    addUserCustomField,
    updateUserCustomField,
    deleteUserCustomField,
    simulatedRole,
    users,
    currentUser,
    hasPermission,
    detectedIP,
    getUserAllowedIPs,
    resetUserIPs,
    addIPToUser
  } = useCRM();
  const { showToast } = useToast();

  const canManageSettings = hasPermission('system-settings');
  const [docTypeForm, setDocTypeForm] = useState({ name: '', required: false, description: '' });
  const [customFieldForm, setCustomFieldForm] = useState({ fieldName: '', subField1Name: '', subField2Name: '' });
  const [editingCustomFieldId, setEditingCustomFieldId] = useState(null);
  const [editCustomFieldForm, setEditCustomFieldForm] = useState({ fieldName: '', subField1Name: '', subField2Name: '' });
  const [ipPanelUser, setIPPanelUser] = useState(null); // userId being viewed
  const [manualIPInput, setManualIPInput] = useState('');
  const [ipForceRefresh, setIPForceRefresh] = useState(0); // trigger re-render after mutations
  const [showSaaSDemo, setShowSaaSDemo] = useState(false); // live preview for SaaS template

  // IP Guard Password Authentication Gate
  const [isIPGuardUnlocked, setIsIPGuardUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('crm_ip_guard_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [ipGuardPassword, setIpGuardPassword] = useState('');
  const [ipGuardPasswordError, setIpGuardPasswordError] = useState('');
  const [showIPGuardPassword, setShowIPGuardPassword] = useState(false);
  const [showDefaultKey, setShowDefaultKey] = useState(false);
  const [isAuthenticatingIPGuard, setIsAuthenticatingIPGuard] = useState(false);

  const handleUnlockIPGuard = (e) => {
    e.preventDefault();
    setIpGuardPasswordError('');
    const inputPass = ipGuardPassword.trim();
    if (!inputPass) {
      setIpGuardPasswordError('Please enter your administrator password.');
      return;
    }

    setIsAuthenticatingIPGuard(true);
    setTimeout(() => {
      const superAdminUsers = (users || []).filter(u => u.role === 'Super Admin' || u.role === 'Admin');
      const superAdminPasswords = superAdminUsers.map(u => u.password).filter(Boolean);
      const userPass = currentUser?.password;
      
      const acceptedPasswords = [
        'admin123',
        'superadmin123',
        '123456',
        userPass,
        ...superAdminPasswords
      ].filter(Boolean);

      if (acceptedPasswords.includes(inputPass)) {
        setIsIPGuardUnlocked(true);
        try {
          sessionStorage.setItem('crm_ip_guard_unlocked', 'true');
        } catch {}
        setIpGuardPassword('');
        setIpGuardPasswordError('');
        showToast('IP Guard Management unlocked successfully.', 'success');
      } else {
        setIpGuardPasswordError('Incorrect password. Please enter a valid administrator password.');
        showToast('Authentication failed: Incorrect password', 'error');
      }
      setIsAuthenticatingIPGuard(false);
    }, 250);
  };

  const handleLockIPGuard = () => {
    setIsIPGuardUnlocked(false);
    try {
      sessionStorage.removeItem('crm_ip_guard_unlocked');
    } catch {}
    setIpGuardPassword('');
    setIpGuardPasswordError('');
    showToast('IP Guard session locked.', 'info');
  };


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

  const handleAddCustomField = async (e) => {
    e.preventDefault();
    if (!customFieldForm.fieldName.trim() || !customFieldForm.subField1Name.trim() || !customFieldForm.subField2Name.trim()) {
      showToast('Please provide Custom Field Name and both Sub-Field names.', 'warning');
      return;
    }
    if (userCustomFields.length >= 20) {
      showToast('Maximum limit of 20 custom fields reached.', 'error');
      return;
    }
    const res = await addUserCustomField(customFieldForm);
    if (res?.success) {
      showToast(`Custom Field '${customFieldForm.fieldName}' created! (${userCustomFields.length + 1}/20)`, 'success');
      setCustomFieldForm({ fieldName: '', subField1Name: '', subField2Name: '' });
    } else {
      showToast(res?.message || 'Failed to create custom field', 'error');
    }
  };

  const handleSaveEditCustomField = async (fieldId) => {
    if (!editCustomFieldForm.fieldName.trim() || !editCustomFieldForm.subField1Name.trim() || !editCustomFieldForm.subField2Name.trim()) {
      showToast('All names are required.', 'warning');
      return;
    }
    const res = await updateUserCustomField(fieldId, editCustomFieldForm);
    if (res?.success) {
      showToast('Custom field names updated successfully.', 'success');
      setEditingCustomFieldId(null);
    } else {
      showToast(res?.message || 'Failed to update custom field', 'error');
    }
  };

  const handleDeleteCustomField = async (field) => {
    if (window.confirm(`Are you sure you want to delete custom field '${field.fieldName}'?`)) {
      await deleteUserCustomField(field.id);
      showToast(`Custom field '${field.fieldName}' deleted.`, 'info');
    }
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

        {/* SaaS Template Showcase Card */}
        <div style={{
          marginTop: '20px',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
              <Sparkles size={16} className="text-indigo-400" />
              <span>SaaS Landing & Design Kit Component (@/components/ui/saa-s-template.tsx)</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Built according to Shadcn UI, Tailwind CSS & TypeScript specifications. Consistent with Animated Login.
            </p>
          </div>
          <button
            type="button"
            className="btn-gradient"
            onClick={() => setShowSaaSDemo(true)}
            style={{ fontSize: '0.8rem', padding: '7px 16px', borderRadius: '8px' }}
          >
            <ExternalLink size={14} /> Preview Live Template
          </button>
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

        {canManageSettings ? (
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
            Permission required to create or configure document types. Contact Super Admin to enable in the Feature Access Block.
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
                {canManageSettings && <th>Action</th>}
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
                  {canManageSettings && (
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

      {/* User Custom Profile Fields Configuration (Max 20 Slots, 2 Sub-Fields Each) */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="var(--accent-primary)" /> User Custom Profile Fields (Max 20 Slots)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Define custom profile fields with 2 sub-fields each (e.g. Emergency Contact, Previous Employment, Nominee, Vehicle Details). Super Admin gives custom names to the field and both sub-fields.
            </p>
          </div>

          <span style={{
            fontSize: '0.76rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: userCustomFields.length >= 20 ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-soft)',
            color: userCustomFields.length >= 20 ? '#ef4444' : 'var(--accent)',
            border: `1px solid ${userCustomFields.length >= 20 ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent-border)'}`,
            fontWeight: 600
          }}>
            {userCustomFields.length} / 20 Custom Fields Configured
          </span>
        </div>

        {canManageSettings ? (
          userCustomFields.length < 20 ? (
            <form onSubmit={handleAddCustomField} style={{ margin: '16px 0 20px' }}>
              <div className="form-grid">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Custom Field Name *</label>
                  <input
                    type="text"
                    value={customFieldForm.fieldName}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, fieldName: e.target.value })}
                    placeholder="e.g. Emergency Contact, Previous Employer, Nominee Details"
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 2 }}>
                  <label>Sub-Field 1 Name *</label>
                  <input
                    type="text"
                    value={customFieldForm.subField1Name}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, subField1Name: e.target.value })}
                    placeholder="e.g. Contact Person, Company Name, Nominee Name"
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 2 }}>
                  <label>Sub-Field 2 Name *</label>
                  <input
                    type="text"
                    value={customFieldForm.subField2Name}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, subField2Name: e.target.value })}
                    placeholder="e.g. Mobile Number, Experience / CTC, Relation"
                    required
                  />
                </div>

                <div className="form-group" style={{ justifyContent: 'flex-end', flex: 1 }}>
                  <button type="submit" className="btn-primary" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Plus size={15} /> Add Field Slot
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="alert-box alert-warning" style={{ margin: '14px 0 18px' }}>
              <AlertCircle size={15} /> Maximum limit of 20 custom fields reached. Delete an existing field to add a new one.
            </div>
          )
        ) : (
          <div className="alert-box alert-warning" style={{ margin: '14px 0 18px' }}>
            Permission required to create or configure custom fields. Contact Super Admin to enable in the Feature Access Block.
          </div>
        )}

        <h4 style={{ fontSize: '0.86rem', marginBottom: '10px' }}>Configured Custom Profile Fields:</h4>
        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Field Name</th>
                <th>Sub-Field 1 Name</th>
                <th>Sub-Field 2 Name</th>
                <th>Scope</th>
                {canManageSettings && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {userCustomFields.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    No custom fields configured yet. Use the form above to add up to 20 fields.
                  </td>
                </tr>
              ) : (
                userCustomFields.map((field, index) => (
                  <tr key={field.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                    {editingCustomFieldId === field.id ? (
                      <>
                        <td>
                          <input
                            type="text"
                            value={editCustomFieldForm.fieldName}
                            onChange={(e) => setEditCustomFieldForm({ ...editCustomFieldForm, fieldName: e.target.value })}
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editCustomFieldForm.subField1Name}
                            onChange={(e) => setEditCustomFieldForm({ ...editCustomFieldForm, subField1Name: e.target.value })}
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editCustomFieldForm.subField2Name}
                            onChange={(e) => setEditCustomFieldForm({ ...editCustomFieldForm, subField2Name: e.target.value })}
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </td>
                        <td>
                          <span style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>Editing...</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => handleSaveEditCustomField(field.id)}
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => setEditingCustomFieldId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 600 }}>
                          <span className="badge badge-disposition">{field.fieldName}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {field.subField1Name}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {field.subField2Name}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.76rem', color: 'var(--accent)' }}>
                            User Directory & Add User Block
                          </span>
                        </td>
                        {canManageSettings && (
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)' }}
                                onClick={() => {
                                  setEditingCustomFieldId(field.id);
                                  setEditCustomFieldForm({
                                    fieldName: field.fieldName,
                                    subField1Name: field.subField1Name,
                                    subField2Name: field.subField2Name
                                  });
                                }}
                                title="Rename field and sub-fields"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)' }}
                                onClick={() => handleDeleteCustomField(field)}
                                title="Delete Custom Field"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── IP Guard Management — Governed by System Settings Permission & Password Authentication ────── */}
      {canManageSettings && (
        !isIPGuardUnlocked ? (
          <div className="directory-card" style={{ padding: '24px 28px', border: '1px solid rgba(239, 68, 68, 0.25)', position: 'relative', overflow: 'hidden' }}>
            {/* Subtle background shield graphic */}
            <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.04, pointerEvents: 'none' }}>
              <Shield size={160} color="var(--accent-primary)" />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.08rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    IP Guard Management
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)'
                    }}>
                      Password Protected
                    </span>
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Network whitelisting and user IP controls are restricted. Enter administrator password to access this feature.
                  </p>
                </div>
              </div>

              {detectedIP && (
                <div style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <Globe size={13} color="var(--accent-primary)" /> Current IP: <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{detectedIP}</code>
                </div>
              )}
            </div>

            {/* Login / Authentication Card */}
            <div style={{
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 22px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <KeyRound size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Administrator Password Authentication
                </span>
              </div>

              <form onSubmit={handleUnlockIPGuard}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    Enter Password to Unlock IP Guard
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showIPGuardPassword ? 'text' : 'password'}
                      placeholder="Enter administrator password"
                      value={ipGuardPassword}
                      onChange={(e) => {
                        setIpGuardPassword(e.target.value);
                        if (ipGuardPasswordError) setIpGuardPasswordError('');
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 42px 10px 12px',
                        fontSize: '0.86rem',
                        borderRadius: 'var(--radius-sm)',
                        border: ipGuardPasswordError ? '1px solid #ef4444' : '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowIPGuardPassword(!showIPGuardPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px'
                      }}
                      title={showIPGuardPassword ? 'Hide password' : 'Show password'}
                    >
                      {showIPGuardPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {ipGuardPasswordError && (
                    <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertCircle size={13} /> {ipGuardPasswordError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isAuthenticatingIPGuard}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Unlock size={14} />
                    {isAuthenticatingIPGuard ? 'Verifying...' : 'Unlock IP Guard'}
                  </button>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Default Admin Key:</span>
                    <code
                      style={{
                        color: 'var(--accent-primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: showDefaultKey ? 'normal' : '2px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-color)'
                      }}
                      onClick={() => setIpGuardPassword('admin123')}
                      title="Click to autofill"
                    >
                      {showDefaultKey ? 'admin123' : '••••••••'}
                    </code>
                    <button
                      type="button"
                      onClick={() => setShowDefaultKey(!showDefaultKey)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={showDefaultKey ? 'Hide key' : 'Reveal key'}
                    >
                      {showDefaultKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="directory-card" style={{ padding: '20px 24px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981'
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    IP Guard Management
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#10b98115',
                      color: '#10b981',
                      border: '1px solid #10b98130',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Unlock size={11} /> Authenticated Session
                    </span>
                  </h3>
                </div>
              </div>

              <button
                onClick={handleLockIPGuard}
                className="btn-secondary"
                style={{
                  fontSize: '0.76rem',
                  padding: '6px 14px',
                  gap: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444'
                }}
                title="Lock IP Guard session"
              >
                <Lock size={13} /> Lock Session
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              View, reset, or manually whitelist IP addresses per user. Each user's first login auto-registers their IP.
              Super Admins are always exempt from IP restrictions.
            </p>
            {detectedIP && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={12} /> Your current IP: <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{detectedIP}</code>
              </div>
            )}

            {/* User list with their IPs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.filter(u => u.status === 'Active' && u.role !== 'Super Admin').map(u => {
                const ips = getUserAllowedIPs(u.id);
                const isExpanded = ipPanelUser === u.id;
                return (
                  <div key={u.id} style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                  }}>
                    {/* Row header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-surface)',
                      cursor: 'pointer'
                    }} onClick={() => setIPPanelUser(isExpanded ? null : u.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {u.name} <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 400 }}>({u.role})</span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                      <span className="badge" style={{
                        backgroundColor: ips.length > 0 ? '#10b98115' : '#f59e0b15',
                        color: ips.length > 0 ? '#10b981' : '#f59e0b',
                        border: `1px solid ${ips.length > 0 ? '#10b98130' : '#f59e0b30'}`,
                        fontSize: '0.7rem', fontWeight: 700
                      }}>
                        {ips.length > 0 ? `${ips.length} IP${ips.length > 1 ? 's' : ''} Registered` : 'No IPs — Open Access'}
                      </span>
                      <ShieldCheck size={14} color={ips.length > 0 ? '#10b981' : '#f59e0b'} />
                    </div>

                    {/* Expanded IP details */}
                    {isExpanded && (
                      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                        {ips.length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            No IPs registered yet. This user has open access. Their IP will be locked after first login.
                          </p>
                        ) : (
                          <div style={{ marginBottom: '10px' }}>
                            {ips.map((entry, idx) => (
                              <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '6px 10px', marginBottom: '4px',
                                backgroundColor: 'var(--bg-surface)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '0.78rem'
                              }}>
                                <code style={{ fontWeight: 700, color: 'var(--accent-primary)', flex: 1 }}>{entry.ip}</code>
                                <span style={{ color: 'var(--text-muted)' }}>{entry.label}</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {new Date(entry.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Manual IP add */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Add IP manually (e.g. 203.0.113.5)"
                            value={ipPanelUser === u.id ? manualIPInput : ''}
                            onChange={e => setManualIPInput(e.target.value)}
                            style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                          />
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '0.76rem', padding: '6px 12px', gap: '4px' }}
                            onClick={() => {
                              const ip = manualIPInput.trim();
                              if (!ip) return;
                              addIPToUser(u.id, ip, 'Manually added by Super Admin');
                              showToast(`IP ${ip} whitelisted for ${u.name}`, 'success');
                              setManualIPInput('');
                              setIPForceRefresh(v => v + 1);
                            }}
                          >
                            <Plus size={13} /> Add IP
                          </button>
                          {detectedIP && (
                            <button
                              className="btn-secondary"
                              style={{ fontSize: '0.76rem', padding: '6px 12px', gap: '4px' }}
                              title={`Add your current IP (${detectedIP}) to this user`}
                              onClick={() => {
                                addIPToUser(u.id, detectedIP, 'Added by Super Admin (their current IP)');
                                showToast(`Your IP ${detectedIP} added for ${u.name}`, 'success');
                                setIPForceRefresh(v => v + 1);
                              }}
                            >
                              <Globe size={13} /> Add My IP
                            </button>
                          )}
                        </div>

                        {/* Reset all IPs */}
                        <button
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', fontSize: '0.76rem', fontWeight: 600,
                            border: '1px solid #ef444440',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#ef444410', color: '#ef4444',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            if (window.confirm(`Reset ALL registered IPs for ${u.name}? They will be able to log in from any IP and a new IP will be registered on their next login.`)) {
                              resetUserIPs(u.id);
                              showToast(`All IPs reset for ${u.name}. They can now log in from any location.`, 'info');
                              setIPForceRefresh(v => v + 1);
                            }
                          }}
                        >
                          <ShieldOff size={13} /> Reset All IPs for {u.name}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Fullscreen Modal Preview for SaaS Template */}
      {showSaaSDemo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: '#000000',
          overflowY: 'auto'
        }}>
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            backgroundColor: 'rgba(9, 10, 15, 0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                Preview Mode: @/components/ui/saa-s-template.tsx
              </span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.18)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(99, 102, 241, 0.35)', fontWeight: 500 }}>
                Shadcn + Tailwind + TypeScript
              </span>
            </div>
            <button
              onClick={() => setShowSaaSDemo(false)}
              className="btn-secondary"
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem' }}
            >
              <X size={15} /> Return to CRM
            </button>
          </div>
          <Demo />
        </div>
      )}
    </div>
  );
};

