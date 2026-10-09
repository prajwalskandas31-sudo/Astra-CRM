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
            <button className="btn-secondary" style={{ padding: '8px', borderRadius: '9999px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Pending Approvals">
              <Bell size={15} />
              {pendingSalesCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: '#f43f5e',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
                }}>
                  {pendingSalesCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Logged in User Profile Badge */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          background: 'rgba(16, 18, 26, 0.85)', 
          padding: '4px 14px 4px 6px', 
          borderRadius: '9999px', 
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)'
        }}>
          <div className="avatar-circle">
            <User size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
              {currentUser?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.71rem', color: 'var(--accent)', fontWeight: 500 }}>
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
