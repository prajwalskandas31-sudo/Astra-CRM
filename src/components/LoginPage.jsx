import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Mail, Lock, LogIn, Command, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const { loginError, handleLogin, users = [], leads = [] } = useCRM();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultRoleConfigs = [
    { role: 'Super Admin', email: 'superadmin@company.com', defaultPass: 'admin123', badge: 'Full Authority', color: '#6e56cf' },
    { role: 'Admin', email: 'admin@company.com', defaultPass: 'admin123', badge: 'Admin Access', color: '#3e63dd' },
    { role: 'Manager', email: 'vikram.manager@company.com', defaultPass: 'manager123', badge: 'Supervision', color: '#29a383' },
    { role: 'Team Leader', email: 'priya.tl@company.com', defaultPass: 'tl123', badge: 'Executive Oversight', color: '#d97706' },
    { role: 'Executive (ABHINAYA M)', email: 'abhinaya@company.com', defaultPass: 'executive123', badge: 'Default Target', color: '#05a2c5' },
    { role: 'Executive (AKSHATA)', email: 'tajayvarma76@gmail.com', defaultPass: 'executive123', badge: 'Personal Pipeline', color: '#05a2c5' }
  ];

  // Identify newly created users (users not in the initial base 9)
  const baseIds = ['usr-1', 'usr-2', 'usr-3', 'usr-4', 'usr-5', 'usr-6', 'usr-7', 'usr-8', 'usr-9'];
  const customUsers = (users || []).filter(u => u.status === 'Active' && !baseIds.includes(u.id));

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(identifier, password);
    setIsSubmitting(false);
  };

  const loginAsUser = (targetUser, pass = 'admin123') => {
    const cred = targetUser.email || targetUser.name || targetUser.mobile || targetUser.id;
    setIdentifier(cred);
    setPassword(targetUser.password || pass);
    handleLogin(cred, targetUser.password || pass);
  };

  const fillQuickCreds = (cred) => {
    setIdentifier(cred.email);
    setPassword(cred.defaultPass);
    handleLogin(cred.email, cred.defaultPass);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
      padding: '24px 20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1020px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '28px',
        alignItems: 'start'
      }}>
        {/* Left Side: Brand Info & Fast Role Selector */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div className="brand-logo" style={{ width: '36px', height: '36px' }}>
              <Command size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Astra CRM</h1>
              <span className="badge badge-disposition" style={{ fontSize: '0.72rem' }}>
                Enterprise V1.0 Architecture
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Enterprise Lead & User Management Platform. Click any profile below for 1-click test login:
          </p>

          {/* Newly Created Users Section (High Priority for testing assigned leads) */}
          {customUsers.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Newly Created User Profiles ({customUsers.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customUsers.map(u => {
                  const userLeadCount = leads.filter(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase()))).length;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => loginAsUser(u, u.password || '123456')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                          {u.name} ({u.role})
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <code>{u.email || u.name}</code> {u.mobile ? `• ${u.mobile}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ backgroundColor: '#10b98118', color: '#10b981', border: '1px solid #10b98130', fontSize: '0.74rem', fontWeight: 700 }}>
                          {userLeadCount} Assigned Leads
                        </span>
                        <ArrowRight size={14} color="var(--accent-primary)" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard Pre-defined Roles */}
          <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            System Pre-Defined Users:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {defaultRoleConfigs.map(cred => {
              const matchedU = users.find(u => u.email === cred.email);
              const count = matchedU ? leads.filter(l => !l.isUnassigned && (l.assignedToId === matchedU.id || l.assigned_user_id === matchedU.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (matchedU.name || '').trim().toLowerCase()))).length : 0;

              return (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => fillQuickCreds(cred)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 13px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'var(--transition)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cred.color }} />
                      {cred.role}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      <code>{cred.email}</code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {count > 0 && (
                      <span className="badge" style={{ backgroundColor: '#3b82f618', color: '#3b82f6', fontSize: '0.7rem' }}>
                        {count} Leads
                      </span>
                    )}
                    <span className="badge" style={{ backgroundColor: `${cred.color}12`, color: cred.color, border: `1px solid ${cred.color}25`, fontSize: '0.7rem' }}>
                      {cred.badge}
                    </span>
                    <ArrowRight size={13} color="var(--text-muted)" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="directory-card" style={{ padding: '30px', border: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={20} color="var(--accent)" /> Direct Sign In
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Sign in with User Name, Email, or Mobile Number.
          </p>

          {loginError && (
            <div className="alert-box alert-warning" style={{ marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>User Name, Email, or Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. atresh or superadmin@company.com or 9876543210"
                  style={{ paddingLeft: '36px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: '36px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ justifyContent: 'center', height: '40px', marginTop: '6px', fontSize: '0.86rem' }}
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to CRM'}
            </button>

            {/* Quick Helper dropdown for all active users */}
            <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Quick switch to any active profile:
              </span>
              <select
                onChange={(e) => {
                  const u = users.find(usr => usr.id === e.target.value);
                  if (u) loginAsUser(u);
                }}
                defaultValue=""
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value="" disabled>-- Select User Profile to Instant Login --</option>
                {users.filter(u => u.status === 'Active').map(u => {
                  const leadCount = leads.filter(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase()))).length;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {leadCount} Leads
                    </option>
                  );
                })}
              </select>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
