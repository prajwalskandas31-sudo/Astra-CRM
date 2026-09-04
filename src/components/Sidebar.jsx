import React from 'react';
import { useCRM } from '../context/CRMContext';
import { LayoutDashboard, Users, Shield, TrendingUp, CheckCircle, Sliders, Layers, Command } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { simulatedRole, sales } = useCRM();

  const pendingSalesCount = sales.filter(s => s.status.includes('Pending')).length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'CRM Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
    },
    {
      id: 'directory',
      label: 'User Directory',
      icon: Users,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
    },
    {
      id: 'dispositions',
      label: 'Dispositions (Block 2)',
      icon: Layers,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
    },
    {
      id: 'team-monitoring',
      label: 'Team Monitoring',
      icon: TrendingUp,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader']
    },
    {
      id: 'sale-approvals',
      label: 'Sale Approvals',
      icon: CheckCircle,
      badge: pendingSalesCount > 0 ? pendingSalesCount : null,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
    },
    {
      id: 'lead-reassignment',
      label: 'Lead Reassignment',
      icon: Layers,
      allowedRoles: ['Super Admin', 'Admin']
    },
    {
      id: 'system-settings',
      label: 'System & UI Settings',
      icon: Sliders,
      allowedRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
    },
    {
      id: 'custom-roles',
      label: 'Custom Roles (Annexure-I)',
      icon: Shield,
      allowedRoles: ['Super Admin']
    }
  ];

  const visibleNavItems = navItems.filter(item => item.allowedRoles.includes(simulatedRole));

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
