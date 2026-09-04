import React from 'react';
import { useCRM } from '../context/CRMContext';
import { Shield, Eye, Info } from 'lucide-react';

export const RoleSimulatorBanner = () => {
  const { simulatedRole, setSimulatedRole } = useCRM();

  const roles = ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive'];

  return (
    <div className="role-simulator-bar">
      <div className="role-simulator-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={16} color="var(--accent-primary)" />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Role Master Simulator (RBAC Test):</span>
        <span style={{ color: 'var(--text-muted)' }}>Switch active view to test permission boundaries & data visibility</span>
      </div>

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
    </div>
  );
};
