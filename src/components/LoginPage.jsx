import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Mail, Lock, LogIn, Command, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const { loginError, handleLogin } = useCRM();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sampleCredentials = [
    {
      role: 'Super Admin',
      email: 'superadmin@company.com',
      password: 'admin123',
      badge: 'Full Authority',
      color: '#6e56cf'
    },
    {
      role: 'Admin',
      email: 'admin@company.com',
      password: 'admin123',
      badge: 'Admin Access',
      color: '#3e63dd'
    },
    {
      role: 'Manager',
      email: 'vikram.manager@company.com',
      password: 'manager123',
      badge: 'Supervision',
      color: '#29a383'
    },
    {
      role: 'Team Leader',
      email: 'priya.tl@company.com',
      password: 'tl123',
      badge: 'Executive Oversight',
      color: '#d97706'
    },
    {
      role: 'Executive',
      email: 'tajayvarma76@gmail.com',
      password: 'executive123',
      badge: 'Personal Pipeline',
      color: '#05a2c5'
    }
  ];

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(email, password);
    setIsSubmitting(false);
  };

  const fillQuickCreds = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    handleLogin(cred.email, cred.password);
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
        maxWidth: '960px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '28px',
        alignItems: 'center'
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

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Enterprise Lead & User Management Platform. Select a role below for 1-click test login:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sampleCredentials.map(cred => (
              <button
                key={cred.role}
                onClick={() => fillQuickCreds(cred)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
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
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    <code>{cred.email}</code>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge" style={{ backgroundColor: `${cred.color}12`, color: cred.color, border: `1px solid ${cred.color}25`, fontSize: '0.72rem' }}>
                    {cred.badge}
                  </span>
                  <ArrowRight size={13} color="var(--text-muted)" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="directory-card" style={{ padding: '30px', border: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={20} color="var(--accent)" /> Secure Login
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Authenticate with Python FastAPI Security Service.
          </p>

          {loginError && (
            <div className="alert-box alert-warning" style={{ marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="superadmin@company.com"
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
          </form>
        </div>
      </div>
    </div>
  );
};
