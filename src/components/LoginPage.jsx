import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { Mail, Lock, LogIn, Command, Shield, ShieldCheck, ShieldAlert, Wifi, Eye, EyeOff, Copy, Check, Key, UserCheck, ArrowUpRight } from 'lucide-react';

export const LoginPage = () => {
  const { loginError, handleLogin, users = [], leads = [], detectedIP, ipDetecting, prefetchIP } = useCRM();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [autofillNotice, setAutofillNotice] = useState('');

  // Pre-fetch IP as soon as login page mounts so it's ready when user submits
  useEffect(() => {
    prefetchIP();
  }, []);

  const defaultRoleConfigs = [
    {
      role: 'Super Admin',
      name: 'Srinivas R',
      email: 'superadmin@company.com',
      mobile: '+91 98765 43210',
      password: 'superadmin123',
      altPass: 'admin123',
      badge: 'Full Authority',
      color: '#6e56cf',
      scope: 'Unrestricted Access (Settings, IP Guard, Lead Deletion, Reassignments)'
    },
    {
      role: 'Admin',
      name: 'Rajesh Kumar',
      email: 'admin@company.com',
      mobile: '+91 98765 43211',
      password: 'admin123',
      badge: 'Admin Access',
      color: '#3e63dd',
      scope: 'Management, User Admin, Reporting, Sales Approval'
    },
    {
      role: 'Manager',
      name: 'Vikram Seth',
      email: 'vikram.manager@company.com',
      mobile: '+91 98765 43212',
      password: 'manager123',
      altPass: 'admin123',
      badge: 'Supervision',
      color: '#29a383',
      scope: 'Team Oversight, Lead Reallocation, Pipeline Monitoring'
    },
    {
      role: 'Team Leader',
      name: 'Priya Nair',
      email: 'priya.tl@company.com',
      mobile: '+91 98765 43213',
      password: 'tl123',
      altPass: 'admin123',
      badge: 'Executive Oversight',
      color: '#d97706',
      scope: 'Executive Supervision, Call Dispositions, Daily Targets'
    },
    {
      role: 'Executive (ABHINAYA M)',
      name: 'ABHINAYA M',
      email: 'abhinaya@company.com',
      mobile: '+91 98765 43214',
      password: 'executive123',
      altPass: 'admin123',
      badge: 'Default Target',
      color: '#05a2c5',
      scope: 'Assigned Leads, Calling Shortcuts, Disposition Logging, Sale Bookings'
    },
    {
      role: 'Executive (AKSHATA)',
      name: 'AKSHATA',
      email: 'tajayvarma76@gmail.com',
      mobile: '+91 98765 43216',
      password: 'executive123',
      altPass: 'admin123',
      badge: 'Personal Pipeline',
      color: '#05a2c5',
      scope: 'Personal Pipeline, Calling Shortcuts, Disposition Logging'
    }
  ];

  // Identify newly created users (users not in the initial base 9)
  const baseIds = ['usr-1', 'usr-2', 'usr-3', 'usr-4', 'usr-5', 'usr-6', 'usr-7', 'usr-8', 'usr-9'];
  const customUsers = (users || []).filter(u => u.status === 'Active' && !baseIds.includes(u.id));

  const onSubmit = async (e) => {
    e.preventDefault();
    setAutofillNotice('');
    setIsSubmitting(true);
    await handleLogin(identifier, password);
    setIsSubmitting(false);
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Safe helper that ONLY loads the text into form fields without submitting
  const loadCredentialsToForm = (ident, pass, label) => {
    setIdentifier(ident);
    setPassword(pass);
    setAutofillNotice(`Credentials loaded for ${label}. Click "Sign In to CRM" to authenticate.`);
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
        maxWidth: '1060px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '28px',
        alignItems: 'start'
      }}>
        {/* Left Side: RBAC Role Directory & Credentials Matrix */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div className="brand-logo" style={{ width: '38px', height: '38px' }}>
              <Command size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Astra CRM</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="badge badge-disposition" style={{ fontSize: '0.72rem' }}>
                  Enterprise RBAC Enforced
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Manual Credential Verification
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
            Production Role-Based Access Control is active. To authenticate, enter your assigned Username/Email and Password in the sign-in form. Single-click instant login has been disabled for audit security.
          </p>

          {/* Newly Created Users Section */}
          {customUsers.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Custom User Profiles ({customUsers.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customUsers.map(u => {
                  const userLeadCount = leads.filter(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase()))).length;
                  const userPass = u.password || '123456';
                  return (
                    <div
                      key={u.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: 'var(--radius-md)',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                          {u.name} <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>({u.role})</span>
                        </div>
                        <span className="badge" style={{ backgroundColor: '#10b98118', color: '#10b981', border: '1px solid #10b98130', fontSize: '0.72rem', fontWeight: 700 }}>
                          {userLeadCount} Assigned Leads
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', marginTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>User:</span>
                          <code style={{ fontWeight: 600 }}>{u.email || u.name}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email || u.name, `c-u-${u.id}`)}
                            title="Copy username"
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {copiedKey === `c-u-${u.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Pass:</span>
                          <code style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{userPass}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(userPass, `c-p-${u.id}`)}
                            title="Copy password"
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {copiedKey === `c-p-${u.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => loadCredentialsToForm(u.email || u.name, userPass, u.name)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}
                        >
                          <ArrowUpRight size={12} /> Fill into Form
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard Pre-defined Roles Directory */}
          <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Profile-Based Credentials Directory:</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'none' }}>
              6 System Roles
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {defaultRoleConfigs.map(cred => {
              const matchedU = users.find(u => u.email === cred.email);
              const count = matchedU ? leads.filter(l => !l.isUnassigned && (l.assignedToId === matchedU.id || l.assigned_user_id === matchedU.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (matchedU.name || '').trim().toLowerCase()))).length : 0;

              return (
                <div
                  key={cred.role}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cred.color }} />
                      <span>{cred.name}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>• {cred.role}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {count > 0 && (
                        <span className="badge" style={{ backgroundColor: '#3b82f618', color: '#3b82f6', fontSize: '0.68rem' }}>
                          {count} Leads
                        </span>
                      )}
                      <span className="badge" style={{ backgroundColor: `${cred.color}15`, color: cred.color, border: `1px solid ${cred.color}30`, fontSize: '0.68rem', fontWeight: 600 }}>
                        {cred.badge}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', fontSize: '0.74rem', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Login:</span>
                      <code style={{ fontSize: '0.72rem' }}>{cred.email}</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cred.email, `u-${cred.role}`)}
                        title="Copy email"
                        style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        {copiedKey === `u-${cred.role}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '4px 8px', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Password:</span>
                      <code style={{ fontWeight: 600, color: cred.color, fontSize: '0.72rem' }}>{cred.password}</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(cred.password, `p-${cred.role}`)}
                        title="Copy password"
                        style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        {copiedKey === `p-${cred.role}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
                      {cred.scope}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadCredentialsToForm(cred.email, cred.password, cred.name)}
                      style={{
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}
                    >
                      <ArrowUpRight size={11} /> Fill Form
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Secure Login Form Card */}
        <div className="directory-card" style={{ padding: '30px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={20} color="var(--accent)" /> Direct Sign In
            </h2>
            <span className="badge" style={{ backgroundColor: '#10b98115', color: '#10b981', border: '1px solid #10b98130', fontSize: '0.72rem' }}>
              🔒 Protected
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Enter your authorized User Name, Email, or Mobile Number and Password.
          </p>

          {/* IP Shield Status Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            backgroundColor: detectedIP ? '#10b98110' : '#f59e0b10',
            border: `1px solid ${detectedIP ? '#10b98130' : '#f59e0b30'}`,
            fontSize: '0.76rem'
          }}>
            {ipDetecting ? (
              <>
                <Wifi size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={{ color: '#f59e0b' }}>Detecting network IP address...</span>
              </>
            ) : detectedIP ? (
              <>
                <ShieldCheck size={13} color="#10b981" style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  Your IP: <code style={{ fontWeight: 700, color: '#10b981' }}>{detectedIP}</code>
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  🔒 IP Guard Active
                </span>
              </>
            ) : (
              <>
                <ShieldAlert size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={{ color: '#f59e0b' }}>IP detection unavailable — restriction bypassed</span>
              </>
            )}
          </div>

          {autofillNotice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '14px',
              backgroundColor: 'var(--accent-primary-10, #3b82f615)',
              border: '1px solid var(--accent-primary)',
              fontSize: '0.76rem',
              color: 'var(--text-primary)'
            }}>
              <Key size={14} color="var(--accent-primary)" />
              <span>{autofillNotice}</span>
            </div>
          )}

          {loginError && (
            <div className="alert-box alert-warning" style={{
              marginBottom: '16px',
              borderColor: loginError.includes('Access Denied') || loginError.includes('Suspended') ? '#ef4444' : undefined,
              backgroundColor: loginError.includes('Access Denied') || loginError.includes('Suspended') ? '#ef444410' : undefined
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>User Name, Email, or Mobile</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. superadmin@company.com or Srinivas R"
                  style={{ paddingLeft: '36px' }}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  style={{ paddingLeft: '36px' }}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !identifier || !password}
              style={{
                justifyContent: 'center',
                height: '42px',
                marginTop: '8px',
                fontSize: '0.88rem',
                fontWeight: 600
              }}
            >
              {isSubmitting ? 'Verifying Credentials...' : 'Sign In to CRM'}
            </button>

            <div style={{
              marginTop: '12px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <Shield size={14} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>RBAC Compliance Policy:</strong> Instant 1-click login bypass has been removed. All sessions require valid credentials verified against company RBAC policies and IP authorization.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
