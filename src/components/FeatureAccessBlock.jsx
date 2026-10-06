import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import {
  ShieldCheck,
  Shield,
  Key,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  Sliders,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  History,
  Tag,
  Send,
  UserPlus,
  Trash2,
  FileText,
  Layers,
  TrendingUp,
  Upload,
  PieChart,
  CheckCircle,
  Eye,
  Settings,
  HelpCircle,
  Check,
  X,
  Copy
} from 'lucide-react';

const FEATURE_ICONS = {
  dashboard: LayoutDashboard,
  'lead-history': History,
  'disposition-shortcuts': Tag,
  'request-leads': Send,
  directory: Users,
  'user-management': UserPlus,
  'delete-user': Trash2,
  'employee-documents': FileText,
  dispositions: Layers,
  'team-monitoring': TrendingUp,
  'lead-reassignment': Layers,
  'lead-upload': Upload,
  'lead-upload-bulk': Upload,
  'lead-upload-reports': FileText,
  'sale-approvals': CheckCircle,
  'register-sale': CheckCircle2,
  'lead-summary': PieChart,
  'system-settings': Settings,
  'custom-roles': Shield,
  'feature-access': Key
};

export const FeatureAccessBlock = () => {
  const {
    users = [],
    currentUser,
    simulatedRole,
    switchUser,
    CRM_FEATURES = [],
    FEATURE_CATEGORIES = [],
    hasPermission,
    updateUserPermission,
    grantAllPermissions,
    revokeAllOptionalPermissions,
    resetUserPermissionsToDefault,
    userPermissions = {}
  } = useCRM();

  const { showToast } = useToast();

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  // Navigation / View modes: 'inspector' or 'matrix'
  const [viewMode, setViewMode] = useState('inspector');
  const [selectedUserId, setSelectedUserId] = useState(() => {
    // Default to the first non-superadmin user for quick testing, or currentUser
    const nonSuperAdmin = users.find(u => u.role !== 'Super Admin');
    return nonSuperAdmin ? nonSuperAdmin.id : (currentUser?.id || 'usr-1');
  });

  const [userSearch, setUserSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceCopyUserId, setSourceCopyUserId] = useState('');

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0] || currentUser;
  }, [users, selectedUserId, currentUser]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(q))
      );
    });
  }, [users, userSearch, roleFilter]);

  const filteredFeatures = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    return CRM_FEATURES.filter(f => {
      if (selectedCategory !== 'All' && f.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [CRM_FEATURES, featureSearch, selectedCategory]);

  const statsForSelectedUser = useMemo(() => {
    if (!selectedUser) return { enabled: 0, total: 0, percent: 0 };
    const total = CRM_FEATURES.length;
    let enabled = 0;
    CRM_FEATURES.forEach(f => {
      if (hasPermission(f.id, selectedUser.id)) enabled++;
    });
    const percent = total > 0 ? Math.round((enabled / total) * 100) : 0;
    return { enabled, total, percent };
  }, [selectedUser, CRM_FEATURES, userPermissions, simulatedRole]);

  // Handlers
  const handleToggle = (featureId) => {
    if (!isSuperAdmin) {
      showToast('Permission Denied: Only Super Admin can modify feature access.', 'error');
      return;
    }
    const currentVal = hasPermission(featureId, selectedUser.id);
    const newVal = !currentVal;
    updateUserPermission(selectedUser.id, featureId, newVal);
    showToast(
      `${newVal ? 'Enabled' : 'Disabled'} '${CRM_FEATURES.find(f => f.id === featureId)?.name}' for ${selectedUser.name}`,
      newVal ? 'success' : 'info'
    );
  };

  const handleGrantAll = () => {
    if (!isSuperAdmin) {
      showToast('Permission Denied: Super Admin only action.', 'error');
      return;
    }
    grantAllPermissions(selectedUser.id);
    showToast(`Full Super Admin Access Granted to '${selectedUser.name}'! All ${CRM_FEATURES.length} features enabled.`, 'success');
  };

  const handleRevokeAll = () => {
    if (!isSuperAdmin) {
      showToast('Permission Denied: Super Admin only action.', 'error');
      return;
    }
    revokeAllOptionalPermissions(selectedUser.id);
    showToast(`Optional features revoked for '${selectedUser.name}'. Core dashboard only.`, 'info');
  };

  const handleResetDefaults = () => {
    if (!isSuperAdmin) {
      showToast('Permission Denied: Super Admin only action.', 'error');
      return;
    }
    resetUserPermissionsToDefault(selectedUser.id);
    showToast(`Permissions for '${selectedUser.name}' reset to role default baseline (${selectedUser.role}).`, 'info');
  };

  const handleCategoryToggle = (category, enable) => {
    if (!isSuperAdmin) {
      showToast('Permission Denied: Super Admin only action.', 'error');
      return;
    }
    const catFeatures = CRM_FEATURES.filter(f => f.category === category);
    catFeatures.forEach(f => {
      updateUserPermission(selectedUser.id, f.id, enable);
    });
    showToast(`${enable ? 'Enabled' : 'Disabled'} all ${catFeatures.length} features in '${category}' for ${selectedUser.name}`, 'info');
  };

  const handleCopyPermissions = () => {
    if (!sourceCopyUserId) {
      showToast('Please select a source user to copy from.', 'warning');
      return;
    }
    CRM_FEATURES.forEach(f => {
      const srcPerm = hasPermission(f.id, sourceCopyUserId);
      updateUserPermission(selectedUser.id, f.id, srcPerm);
    });
    const srcUser = users.find(u => u.id === sourceCopyUserId);
    showToast(`Copied permissions from '${srcUser?.name}' to '${selectedUser.name}'.`, 'success');
    setShowCopyModal(false);
  };

  // Group features by category for inspector view
  const categorizedFeatures = useMemo(() => {
    const groups = {};
    FEATURE_CATEGORIES.forEach(cat => {
      groups[cat] = filteredFeatures.filter(f => f.category === cat);
    });
    return groups;
  }, [FEATURE_CATEGORIES, filteredFeatures]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Master Banner ─────────────────────────────────────────────────── */}
      <div className="directory-card" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 100%)', border: '1px solid var(--accent-border, rgba(139,92,246,0.3))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Feature Access &amp; Permissions Master Block
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Granular control over all CRM capabilities. <strong>User roles do not inherently restrict features</strong> — Super Admin can enable or disable individual features for any user.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setViewMode('inspector')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'inspector' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'inspector' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                User Permission Inspector
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'matrix' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'matrix' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                All Users Matrix Grid
              </button>
            </div>

            {isSuperAdmin && (
              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Key size={13} /> Super Admin Control Active
              </span>
            )}
          </div>
        </div>

        {/* Informative Rule Callout */}
        <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <Sparkles size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Permission Engine Rule:</strong> If all features are enabled for an Executive or Team Lead, that user gains access to <strong>all CRM capabilities available to the Super Admin</strong>. If a specific feature is toggled OFF, that feature is instantly locked and hidden from that user.
          </span>
        </div>
      </div>

      {viewMode === 'inspector' ? (
        /* ═══════════════════════════════════════════════════════════════════════
           VIEW MODE 1: USER PERMISSION INSPECTOR
           ═══════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: User Selection Drawer */}
          <div className="directory-card" style={{ padding: '16px', position: 'sticky', top: '20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--accent-primary)" /> Select User
                </h4>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{filteredUsers.length} Users</span>
              </div>

              {/* User search */}
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search user name or role..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', fontSize: '0.8rem', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Role Filter Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['All', 'Admin', 'Manager', 'Team Leader', 'Executive'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid ' + (roleFilter === r ? 'var(--accent-primary)' : 'var(--border-color)'),
                      background: roleFilter === r ? 'var(--accent-soft)' : 'var(--bg-input)',
                      color: roleFilter === r ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* User List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredUsers.map(u => {
                const isSelected = u.id === selectedUser?.id;
                let enabledCount = 0;
                CRM_FEATURES.forEach(f => {
                  if (hasPermission(f.id, u.id)) enabledCount++;
                });
                const isAllGranted = enabledCount === CRM_FEATURES.length;

                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'var(--accent-soft)' : 'var(--bg-input)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {u.name}
                      </span>
                      <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        {u.role}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>{u.employeeId || u.mobile}</span>
                      <span style={{ fontWeight: 600, color: isAllGranted ? '#10b981' : 'var(--text-secondary)' }}>
                        {enabledCount} / {CRM_FEATURES.length} features
                      </span>
                    </div>

                    {isAllGranted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        <Sparkles size={10} /> Full Super Admin Access
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected User Permissions Matrix & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {selectedUser && (
              <div className="directory-card" style={{ padding: '20px' }}>
                {/* User Detail Banner & Fast Action Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        {selectedUser.name}
                      </h3>
                      <span className="badge badge-role" style={{ fontSize: '0.76rem' }}>
                        {selectedUser.role}
                      </span>
                      <span className={`status-dot ${selectedUser.status === 'Active' ? 'active' : 'inactive'}`} />
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{selectedUser.status}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {selectedUser.email || 'No email registered'} • ID: {selectedUser.employeeId || 'EMP-N/A'} • Reporting to: {selectedUser.reportingTo || 'None'}
                    </p>
                  </div>

                  {/* Test Profile As User Action */}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      switchUser(selectedUser.id);
                      showToast(`Switched active profile to '${selectedUser.name}'. You are now viewing the CRM with their exact permissions.`, 'info');
                    }}
                    style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Simulate session as this user to immediately test feature visibility"
                  >
                    <Eye size={13} color="var(--accent-primary)" /> Test Profile Live
                  </button>
                </div>

                {/* Progress bar & Preset Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', margin: '16px 0' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                      <span><strong>Feature Access Coverage:</strong> {statsForSelectedUser.enabled} of {statsForSelectedUser.total} enabled</span>
                      <span style={{ fontWeight: 700, color: statsForSelectedUser.percent === 100 ? '#10b981' : 'var(--accent-primary)' }}>
                        {statsForSelectedUser.percent}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${statsForSelectedUser.percent}%`,
                          background: statsForSelectedUser.percent === 100 ? '#10b981' : 'var(--accent-primary)',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Bulk Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleGrantAll}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Enable all CRM features for this user (equal to Super Admin capabilities)"
                    >
                      <Sparkles size={13} /> Grant All Features
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleRevokeAll}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Revoke all optional features, leaving only the basic CRM pipeline"
                    >
                      <Lock size={13} /> Revoke Optional
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleResetDefaults}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Clear custom overrides and restore standard role defaults"
                    >
                      <RotateCcw size={13} /> Reset Baseline
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowCopyModal(true)}
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Clone permissions from another employee"
                    >
                      <Copy size={13} /> Copy From...
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar for features */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                  <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Filter features by name or keyword..."
                      value={featureSearch}
                      onChange={e => setFeatureSearch(e.target.value)}
                      style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', fontSize: '0.8rem', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card, #1e1e2d)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card, #1e1e2d)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', height: '32px' }}
                  >
                    <option value="All">All Categories ({CRM_FEATURES.length})</option>
                    {FEATURE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Categorized Features Accordion / Card Deck */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {FEATURE_CATEGORIES.map(cat => {
                    const featuresInCat = categorizedFeatures[cat] || [];
                    if (featuresInCat.length === 0) return null;

                    const allCatEnabled = featuresInCat.every(f => hasPermission(f.id, selectedUser.id));
                    const someCatEnabled = featuresInCat.some(f => hasPermission(f.id, selectedUser.id));

                    return (
                      <div key={cat} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        {/* Category Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-card, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sliders size={14} color="var(--accent-primary)" />
                            <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{cat}</span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>({featuresInCat.length} features)</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleCategoryToggle(cat, true)}
                              style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.72rem', cursor: 'pointer', padding: '2px 6px', fontWeight: 600 }}
                            >
                              Enable All
                            </button>
                            <span style={{ color: 'var(--border-color)' }}>|</span>
                            <button
                              type="button"
                              onClick={() => handleCategoryToggle(cat, false)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '2px 6px', fontWeight: 600 }}
                            >
                              Disable All
                            </button>
                          </div>
                        </div>

                        {/* Features List */}
                        <div style={{ display: 'flex', flexDirection: 'column', divideY: '1px solid var(--border-color)' }}>
                          {featuresInCat.map(f => {
                            const isEnabled = hasPermission(f.id, selectedUser.id);
                            const IconComp = FEATURE_ICONS[f.id] || Shield;
                            const isExplicitlyOverridden = userPermissions[selectedUser.id] && typeof userPermissions[selectedUser.id][f.id] === 'boolean';

                            return (
                              <div
                                key={f.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  borderBottom: '1px solid var(--border-color)',
                                  background: isEnabled ? 'transparent' : 'rgba(0,0,0,0.1)',
                                  transition: 'background 0.15s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, paddingRight: '16px' }}>
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      background: isEnabled ? 'var(--accent-soft)' : 'var(--bg-card, #1a1a2e)',
                                      border: isEnabled ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: isEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                                      flexShrink: 0,
                                      marginTop: '2px'
                                    }}
                                  >
                                    <IconComp size={16} />
                                  </div>

                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {f.name}
                                      </span>
                                      <span
                                        className="badge"
                                        style={{
                                          fontSize: '0.68rem',
                                          padding: '1px 6px',
                                          background: isEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                                          color: isEnabled ? '#10b981' : '#ef4444',
                                          border: isEnabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.2)'
                                        }}
                                      >
                                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                                      </span>
                                      {isExplicitlyOverridden && (
                                        <span style={{ fontSize: '0.66rem', color: 'var(--accent-primary)', background: 'var(--accent-soft)', padding: '1px 5px', borderRadius: '3px' }}>
                                          Custom Override
                                        </span>
                                      )}
                                    </div>
                                    <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                      {f.description}
                                    </p>
                                  </div>
                                </div>

                                {/* Custom Animated Toggle Switch */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                  <label
                                    style={{
                                      position: 'relative',
                                      display: 'inline-block',
                                      width: '46px',
                                      height: '24px',
                                      cursor: isSuperAdmin ? 'pointer' : 'not-allowed'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      disabled={!isSuperAdmin}
                                      onChange={() => handleToggle(f.id)}
                                      style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        borderRadius: '24px',
                                        backgroundColor: isEnabled ? 'var(--accent-primary)' : '#4b5563',
                                        transition: 'background-color 0.2s ease',
                                        boxShadow: isEnabled ? '0 0 8px rgba(139,92,246,0.4)' : 'none'
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: 'absolute',
                                          height: '18px',
                                          width: '18px',
                                          left: isEnabled ? '24px' : '3px',
                                          bottom: '3px',
                                          backgroundColor: '#ffffff',
                                          borderRadius: '50%',
                                          transition: 'left 0.2s ease',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        {isEnabled ? (
                                          <Check size={11} color="var(--accent-primary)" strokeWidth={3} />
                                        ) : (
                                          <X size={10} color="#6b7280" strokeWidth={3} />
                                        )}
                                      </span>
                                    </span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════════
           VIEW MODE 2: ALL USERS PERMISSION MATRIX GRID
           ═══════════════════════════════════════════════════════════════════════ */
        <div className="directory-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                High-Density Team Permissions Matrix
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Click any checkbox to immediately toggle that capability for that user. Changes save automatically.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search user..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '5px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: '650px', overflow: 'auto' }}>
            <table className="crm-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 3, minWidth: '180px' }}>
                    User Profile
                  </th>
                  <th style={{ position: 'sticky', left: '180px', background: 'var(--bg-card)', zIndex: 3, minWidth: '90px' }}>
                    Role
                  </th>
                  {CRM_FEATURES.map(f => (
                    <th key={f.id} style={{ minWidth: '120px', textAlign: 'center', padding: '8px 4px' }} title={f.description}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span>{f.name.split(' ')[0]}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>{f.id}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  let userEnabledCount = 0;
                  CRM_FEATURES.forEach(f => {
                    if (hasPermission(f.id, u.id)) userEnabledCount++;
                  });

                  return (
                    <tr key={u.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2, fontWeight: 600 }}>
                        {u.name}
                      </td>
                      <td style={{ position: 'sticky', left: '180px', background: 'var(--bg-card)', zIndex: 2 }}>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>{u.role}</span>
                      </td>
                      {CRM_FEATURES.map(f => {
                        const permitted = hasPermission(f.id, u.id);
                        return (
                          <td key={f.id} style={{ textAlign: 'center', padding: '6px' }}>
                            <input
                              type="checkbox"
                              checked={permitted}
                              disabled={!isSuperAdmin}
                              onChange={() => {
                                updateUserPermission(u.id, f.id, !permitted);
                                showToast(`${!permitted ? 'Granted' : 'Revoked'} ${f.name} for ${u.name}`, !permitted ? 'success' : 'info');
                              }}
                              style={{ width: '15px', height: '15px', cursor: isSuperAdmin ? 'pointer' : 'not-allowed', accentColor: 'var(--accent-primary)' }}
                              title={`${f.name} - ${permitted ? 'Enabled' : 'Disabled'}`}
                            />
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: userEnabledCount === CRM_FEATURES.length ? '#10b981' : 'var(--text-primary)' }}>
                        {userEnabledCount} / {CRM_FEATURES.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Copy Permissions From Another User ───────────────────────── */}
      {showCopyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Copy size={16} color="var(--accent-primary)" /> Copy Feature Permissions
              </h3>
              <button className="modal-close-btn" onClick={() => setShowCopyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Copy the complete set of enabled and disabled features from another user to <strong>{selectedUser.name}</strong> ({selectedUser.role}).
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Source User:</label>
                <select
                  value={sourceCopyUserId}
                  onChange={e => setSourceCopyUserId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', marginTop: '6px' }}
                >
                  <option value="">Select a user to copy from...</option>
                  {users.filter(u => u.id !== selectedUser.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCopyModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleCopyPermissions}>
                Copy &amp; Apply Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
