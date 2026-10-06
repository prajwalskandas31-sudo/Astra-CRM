import React from 'react';
import { useCRM } from '../context/CRMContext';
import { LayoutDashboard, Users, Shield, TrendingUp, CheckCircle, Sliders, Layers, Command, Upload, PieChart, Key, History } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { simulatedRole, sales, leadRequests, hasPermission } = useCRM();

  const pendingSalesCount = sales.filter(s => s.status.includes('Pending')).length;
  const pendingRequestsCount = leadRequests?.filter(r => r.status === 'Pending').length || 0;

  const navItems = [
    {
      id: 'dashboard',
      label: 'CRM Dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'lead-history',
      label: 'Lead History (Block 5)',
      icon: History
    },
    {
      id: 'directory',
      label: 'User Directory',
      icon: Users
    },
    {
      id: 'dispositions',
      label: 'Dispositions (Block 2)',
      icon: Layers
    },
    {
      id: 'lead-upload',
      label: 'Lead Upload & Reports',
      icon: Upload
    },
    {
      id: 'lead-summary',
      label: 'Lead Summary (Block 4)',
      icon: PieChart,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null
    },
    {
      id: 'team-monitoring',
      label: 'Team Monitoring',
      icon: TrendingUp
    },
    {
      id: 'sale-approvals',
      label: 'Sale Approvals',
      icon: CheckCircle,
      badge: pendingSalesCount > 0 ? pendingSalesCount : null
    },
    {
      id: 'lead-reassignment',
      label: 'Lead Reassignment',
      icon: Layers
    },
    {
      id: 'system-settings',
      label: 'System & UI Settings',
      icon: Sliders
    },
    {
      id: 'custom-roles',
      label: 'Custom Roles (Annexure-I)',
      icon: Shield
    },
    {
      id: 'feature-access',
      label: 'Feature Access Block',
      icon: Key
    }
  ];

  // Role does not inherently restrict features; visibility is driven strictly by permissions
  const visibleNavItems = navItems.filter(item => hasPermission(item.id));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <Command size={18} />
        </div>
        <div className="brand-info">
          <h1>Astra CRM</h1>
          <span className="build-tag">Enterprise V1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {visibleNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: '0.74rem', color: '#9A9A96', textAlign: 'center' }}>
          Role: <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>{simulatedRole}</strong>
        </div>
      </div>
    </aside>
  );
};
