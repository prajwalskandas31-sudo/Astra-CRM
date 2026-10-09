import React from 'react';
import { useCRM } from '../context/CRMContext';
import { Shield, Eye, Info } from 'lucide-react';

export const RoleSimulatorBanner = () => {
  const { simulatedRole, setSimulatedRole, users = [], currentUser, switchUser, leads = [] } = useCRM();

  const roles = ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive'];

  const handleRoleClick = (role) => {
    // If the active user already has this role, retain them!
    if (currentUser?.role === role) {
      setSimulatedRole(role, currentUser.id);
      return;
    }
    // Find active users with this role
    const matchingUsers = users.filter(u => u.status === 'Active' && u.role === role);
    // Prioritize an active user that has assigned leads
    const userWithLeads = matchingUsers.find(u => 
      leads.some(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase())))
    );
    const chosenUser = userWithLeads || matchingUsers[0];
    setSimulatedRole(role, chosenUser?.id);
  };

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
              onClick={() => handleRoleClick(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Direct User Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Profile:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            style={{
              fontSize: '0.76rem',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(12, 13, 19, 0.9)',
              border: '1px solid var(--accent-border, rgba(99, 102, 241, 0.35))',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            {users?.filter(u => u.status === 'Active').map(u => {
              const count = leads.filter(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase()))).length;
              return (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) — {count} Leads
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
};
