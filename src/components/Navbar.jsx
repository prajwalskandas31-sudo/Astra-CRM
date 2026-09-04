import React from 'react';
import { useCRM } from '../context/CRMContext';
import { Bell, User, LogOut } from 'lucide-react';

export const Navbar = ({ currentTabTitle }) => {
  const { currentUser, handleLogout, sales } = useCRM();

  const pendingSalesCount = sales.filter(s => s.status.includes('Pending')).length;

  return (
    <header className="top-header">
      <div className="header-title-section">
        <h2>{currentTabTitle}</h2>
      </div>

      <div className="header-controls">
        {/* Pending Sales Notification for Super Admin */}
        {currentUser?.role === 'Super Admin' && (
          <div style={{ position: 'relative' }}>
            <button className="btn-secondary" style={{ padding: '6px', borderRadius: 'var(--radius-md)' }} title="Pending Approvals">
              <Bell size={16} />
              {pendingSalesCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  backgroundColor: '#e11d48',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {pendingSalesCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Logged in User Profile Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div className="avatar-circle">
            <User size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
              {currentUser?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 500 }}>
              {currentUser?.role}
            </div>
          </div>
        </div>

        {/* Sign Out Button (Plain Text-Button Treatment) */}
        <button
          onClick={handleLogout}
          className="btn-text-danger"
          title="Sign out of CRM session"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </header>
  );
};
