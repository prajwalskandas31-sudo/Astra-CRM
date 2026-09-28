import React from 'react';
import { useCRM } from '../context/CRMContext';
import { Shield, Eye, Info } from 'lucide-react';

export const RoleSimulatorBanner = () => {
  const { simulatedRole, setSimulatedRole, users, currentUser, switchUser } = useCRM();

  const roles = ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive'];

  return (
    <div className="role-simulator-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
      <div className="role-simulator-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={16} color="var(--accent-primary)" />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Role Master Simulator (RBAC Test):</span>
        <span style={{ color: 'var(--text-muted)' }}>Switch role or profile to test data visibility</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Role buttons */}
        <div className="role-badges-group">
          {roles.map(r => (
            <button
              key={r}
              className={`role-sim-btn ${simulatedRole === r ? 'active' : ''}`}
              onClick={() => setSimulatedRole(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Direct User Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active User:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            style={{
              fontSize: '0.76rem',
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            {users?.filter(u => u.status === 'Active').map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
