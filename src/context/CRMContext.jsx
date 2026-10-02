import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

// ─── IP Detection & Restriction Utilities ───────────────────────────────────
// Fetches the user's current public IP from a free, no-auth API.
async function detectPublicIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.ip || null;
    }
  } catch (_) {}
  try {
    const res2 = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });
    if (res2.ok) {
      const data2 = await res2.json();
      return data2.ip || null;
    }
  } catch (_) {}
  return null;
}

// Load the global IP registry from localStorage
function loadIPRegistry() {
  try {
    const raw = localStorage.getItem('crm_ip_registry');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {}; // { userId: [{ ip, registeredAt, label }] }
}

// Save the global IP registry to localStorage
function saveIPRegistry(registry) {
  localStorage.setItem('crm_ip_registry', JSON.stringify(registry));
}

const DEFAULT_USERS = [
  { id: 'usr-1', name: 'Srinivas R', email: 'superadmin@company.com', mobile: '+91 98765 43210', role: 'Super Admin', status: 'Active', reportingTo: 'Board of Directors', expiryDate: '27-07-2028', employeeId: 'EMP-001', adminAccessEnabled: true, bankAccountNumber: '91234567890123', ifscCode: 'HDFC0000123', bankNameAndBranch: 'HDFC Bank, MG Road Branch', familyReferenceNumber: '+91 98765 43219', referredBy: 'Board of Directors' },
  { id: 'usr-2', name: 'Rajesh Kumar', email: 'admin@company.com', mobile: '+91 98765 43211', role: 'Admin', status: 'Active', reportingTo: 'Srinivas R', expiryDate: '27-07-2028', employeeId: 'EMP-002', adminAccessEnabled: true, bankAccountNumber: '91234567890124', ifscCode: 'SBIN0001452', bankNameAndBranch: 'State Bank of India, Indiranagar Branch', familyReferenceNumber: '+91 98765 43220', referredBy: 'Srinivas R (EMP-001)' },
  { id: 'usr-3', name: 'Vikram Seth', email: 'vikram.manager@company.com', mobile: '+91 98765 43212', role: 'Manager', status: 'Active', reportingTo: 'Rajesh Kumar', expiryDate: '15-12-2027', employeeId: 'MGR-101', adminAccessEnabled: false, bankAccountNumber: '91234567890125', ifscCode: 'ICIC0000456', bankNameAndBranch: 'ICICI Bank, Koramangala Branch', familyReferenceNumber: '+91 98765 43221', referredBy: 'Srinivas R (EMP-001)' },
  { id: 'usr-4', name: 'Priya Nair', email: 'priya.tl@company.com', mobile: '+91 98765 43213', role: 'Team Leader', status: 'Active', reportingTo: 'Vikram Seth', expiryDate: '15-12-2027', employeeId: 'TL-201', adminAccessEnabled: false, bankAccountNumber: '91234567890126', ifscCode: 'UTIB0000789', bankNameAndBranch: 'Axis Bank, Whitefield Branch', familyReferenceNumber: '+91 98765 43222', referredBy: 'Vikram Seth (MGR-101)' },
  { 
    id: 'usr-5', 
    name: 'ABHINAYA M', 
    email: 'abhinaya@company.com', 
    mobile: '+91 98765 43214', 
    role: 'Executive', 
    status: 'Active', 
    reportingTo: 'Priya Nair', 
    expiryDate: '10-10-2026', 
    employeeId: 'EXEC-301', 
    adminAccessEnabled: false, 
    bankAccountNumber: '91234567890127', 
    ifscCode: 'HDFC0000456', 
    bankNameAndBranch: 'HDFC Bank, HSR Layout Branch', 
    familyReferenceNumber: '+91 98765 43223', 
    referredBy: 'Priya Nair (TL-201)'
  },
  { 
    id: 'usr-6', 
    name: 'AJAY', 
    email: 'ajay@company.com', 
    mobile: '+91 98765 43215', 
    role: 'Executive', 
    status: 'Active', 
    reportingTo: 'Priya Nair', 
    expiryDate: '10-10-2026', 
    employeeId: 'EXEC-302', 
    adminAccessEnabled: false, 
    bankAccountNumber: '91234567890128', 
    ifscCode: 'KKBK0000987', 
    bankNameAndBranch: 'Kotak Mahindra Bank, Jayanagar Branch', 
    familyReferenceNumber: '+91 98765 43224', 
    referredBy: 'Priya Nair (TL-201)'
  },
  { id: 'usr-7', name: 'AKSHATA', email: 'tajayvarma76@gmail.com', mobile: '+91 98765 43216', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-303', adminAccessEnabled: false, bankAccountNumber: '91234567890129', ifscCode: 'BARB0KORAMA', bankNameAndBranch: 'Bank of Baroda, Electronic City', familyReferenceNumber: '+91 98765 43225', referredBy: 'Priya Nair (TL-201)' },
  { id: 'usr-8', name: 'ANITHA', email: 'anitha@company.com', mobile: '+91 98765 43217', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-304', adminAccessEnabled: false, bankAccountNumber: '91234567890130', ifscCode: 'PUNB0001234', bankNameAndBranch: 'Punjab National Bank, BTM Layout', familyReferenceNumber: '+91 98765 43226', referredBy: 'Priya Nair (TL-201)' },
  { id: 'usr-9', name: 'Kiran Verma', email: 'kiran.v@company.com', mobile: '+91 98765 43218', role: 'Executive', status: 'Inactive', reportingTo: 'Priya Nair', expiryDate: '01-01-2025', employeeId: 'EXEC-305', adminAccessEnabled: false, bankAccountNumber: '91234567890131', ifscCode: 'HDFC0000999', bankNameAndBranch: 'HDFC Bank, Malleshwaram Branch', familyReferenceNumber: '+91 98765 43227', referredBy: 'Priya Nair (TL-201)' }
];

const DEFAULT_DOCUMENT_TYPES = [
  { id: 'doctype-1', name: 'Aadhar Card', required: true, description: 'Government issued Aadhaar identification card' },
  { id: 'doctype-2', name: 'PAN Card', required: true, description: 'Permanent Account Number card for taxation' },
  { id: 'doctype-3', name: '10th Marks Card', required: true, description: 'Secondary School Leaving Certificate / 10th standard marks memo' },
  { id: 'doctype-4', name: 'Resume / CV', required: false, description: 'Updated professional resume or curriculum vitae' },
  { id: 'doctype-5', name: 'Graduation Certificate', required: false, description: 'Degree convocation or provisional passing certificate' }
];

const DEFAULT_USER_CUSTOM_FIELDS = [
  {
    id: 'ucf-1',
    fieldName: 'Emergency Contact Details',
    subField1Name: 'Contact Person Name',
    subField2Name: 'Emergency Mobile Number'
  },
  {
    id: 'ucf-2',
    fieldName: 'Previous Employment History',
    subField1Name: 'Previous Company Name',
    subField2Name: 'Past Designation / Experience'
  }
];

const DEFAULT_DISPOSITIONS = [
  { id: 'disp-1', name: 'New Lead', requiresDateTimePicker: false, color: 'blue', isDefault: true },
  { id: 'disp-2', name: 'Interested', requiresDateTimePicker: false, color: 'emerald', isDefault: true },
  { id: 'disp-3', name: 'Call Back Later', requiresDateTimePicker: true, color: 'amber', isDefault: true },
  { id: 'disp-4', name: 'Give Demo Call', requiresDateTimePicker: true, color: 'purple', isDefault: true },
  { id: 'disp-5', name: 'Follow Up', requiresDateTimePicker: true, color: 'indigo', isDefault: true },
  { id: 'disp-6', name: 'Not Interested', requiresDateTimePicker: false, color: 'rose', isDefault: false },
  { id: 'disp-7', name: 'Commitment', requiresDateTimePicker: false, color: 'cyan', isDefault: false },
  { id: 'disp-8', name: 'Paid / Converted', requiresDateTimePicker: false, color: 'emerald', isDefault: false }
];

const DEFAULT_LEADS = [];

const DEFAULT_SALES = [];

const DEFAULT_CUSTOM_ROLES = [
  { id: 'cr-1', roleName: 'Senior Regional Manager', level: 'Level 1 (Top)', accessScope: 'Regional' },
  { id: 'cr-2', roleName: 'Compliance Inspector', level: 'Level 2 (Mid)', accessScope: 'Global' }
];

const DEFAULT_LEAD_REQUESTS = [];

const DEFAULT_ASSIGNMENT_INSTANCES = [];

const DATA_STORAGE_VERSION = '2026_09_29_v6_ip_restriction';

if (typeof window !== 'undefined' && localStorage.getItem('crm_storage_version') !== DATA_STORAGE_VERSION) {
  localStorage.removeItem('crm_leads');
  localStorage.removeItem('crm_assignment_instances');
  localStorage.removeItem('crm_master_records');
  localStorage.removeItem('crm_sales');
  localStorage.removeItem('crm_lead_requests');
  localStorage.removeItem('crm_users');
  localStorage.setItem('crm_storage_version', DATA_STORAGE_VERSION);
}

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('crm_token') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    const savedToken = localStorage.getItem('crm_token');
    const saved = localStorage.getItem('crm_user');
    if (savedToken && saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      } catch (e) {}
    }
    return savedToken ? DEFAULT_USERS[0] : null;
  });
  const [simulatedRole, setSimulatedRoleState] = useState(() => {
    const savedSimRole = localStorage.getItem('crm_simulated_role');
    if (savedSimRole) return savedSimRole;
    return currentUser?.role || 'Super Admin';
  });
  const [loginError, setLoginError] = useState('');

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('crm_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_USERS;
  });

  const [documentTypes, setDocumentTypes] = useState(() => {
    const saved = localStorage.getItem('crm_document_types');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_DOCUMENT_TYPES;
  });

  useEffect(() => {
    localStorage.setItem('crm_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('crm_document_types', JSON.stringify(documentTypes));
  }, [documentTypes]);

  const [userCustomFields, setUserCustomFields] = useState(() => {
    const saved = localStorage.getItem('crm_user_custom_fields');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_USER_CUSTOM_FIELDS;
  });

  useEffect(() => {
    localStorage.setItem('crm_user_custom_fields', JSON.stringify(userCustomFields));
  }, [userCustomFields]);

  const [customRoles, setCustomRoles] = useState(() => {
    const saved = localStorage.getItem('crm_custom_roles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_CUSTOM_ROLES;
  });

  useEffect(() => {
    localStorage.setItem('crm_custom_roles', JSON.stringify(customRoles));
  }, [customRoles]);

  // User_Shortcut_Settings relational mapping table: [{ userId, dispositionId, isEnabled }]
  const [userShortcutSettings, setUserShortcutSettings] = useState(() => {
    const saved = localStorage.getItem('crm_user_shortcut_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('crm_user_shortcut_settings', JSON.stringify(userShortcutSettings));
  }, [userShortcutSettings]);

  const setSimulatedRole = (newRole, targetUserId = null) => {
    setSimulatedRoleState(newRole);
    localStorage.setItem('crm_simulated_role', newRole);
    let matchedUser = null;
    if (targetUserId) {
      matchedUser = (users || []).find(u => u.id === targetUserId) || DEFAULT_USERS.find(u => u.id === targetUserId);
    }
    if (!matchedUser) {
      if (currentUser?.role === newRole) {
        matchedUser = currentUser;
      } else {
        // Find active users matching newRole
        const roleUsers = (users || []).filter(u => u.role === newRole && u.status === 'Active');
        if (roleUsers.length > 0) {
          // If any user of this role has leads assigned, prioritize them so user sees their leads
          const userWithLeads = roleUsers.find(u => 
            (leads || []).some(l => !l.isUnassigned && (l.assignedToId === u.id || l.assigned_user_id === u.id || (l.assignedToName && l.assignedToName.trim().toLowerCase() === (u.name || '').trim().toLowerCase())))
          );
          matchedUser = userWithLeads || roleUsers[0];
        } else {
          matchedUser = DEFAULT_USERS.find(u => u.role === newRole);
        }
      }
    }
    if (matchedUser) {
      setCurrentUser(matchedUser);
      localStorage.setItem('crm_user', JSON.stringify(matchedUser));
    }
  };

  const switchUser = (userId) => {
    const targetUser = (users || []).find(u => u.id === userId) || DEFAULT_USERS.find(u => u.id === userId);
    if (targetUser) {
      setCurrentUser(targetUser);
      setSimulatedRoleState(targetUser.role || 'Executive');
      localStorage.setItem('crm_user', JSON.stringify(targetUser));
      localStorage.setItem('crm_simulated_role', targetUser.role || 'Executive');
    }
  };

  const isShortcutEnabled = (userId, dispositionId) => {
    const effectiveUserId = userId || currentUser?.id || 'usr-1';
    const entry = userShortcutSettings.find(s => s.userId === effectiveUserId && s.dispositionId === dispositionId);
    return entry ? entry.isEnabled : true;
  };

  const setUserShortcut = (userId, dispositionId, isEnabled) => {
    const effectiveUserId = userId || currentUser?.id || 'usr-1';
    setUserShortcutSettings(prev => {
      const idx = prev.findIndex(s => s.userId === effectiveUserId && s.dispositionId === dispositionId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isEnabled };
        return updated;
      }
      return [...prev, { userId: effectiveUserId, dispositionId, isEnabled }];
    });
  };

  const toggleUserShortcut = (userId, dispositionId) => {
    const effectiveUserId = userId || currentUser?.id || 'usr-1';
    const current = isShortcutEnabled(effectiveUserId, dispositionId);
    setUserShortcut(effectiveUserId, dispositionId, !current);
  };

  const [leads, setLeads] = useState(() => {
    const saved = localStorage.getItem('crm_leads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_LEADS;
  });

  useEffect(() => {
    localStorage.setItem('crm_leads', JSON.stringify(leads));
  }, [leads]);

  const [sales, setSales] = useState(() => {
    const saved = localStorage.getItem('crm_sales');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_SALES;
  });

  useEffect(() => {
    localStorage.setItem('crm_sales', JSON.stringify(sales));
  }, [sales]);

  const [dispositions, setDispositions] = useState(DEFAULT_DISPOSITIONS);

  const [leadRequests, setLeadRequests] = useState(() => {
    const saved = localStorage.getItem('crm_lead_requests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_LEAD_REQUESTS;
  });

  useEffect(() => {
    localStorage.setItem('crm_lead_requests', JSON.stringify(leadRequests));
  }, [leadRequests]);

  const [assignmentInstances, setAssignmentInstances] = useState(() => {
    const saved = localStorage.getItem('crm_assignment_instances');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_ASSIGNMENT_INSTANCES;
  });

  useEffect(() => {
    localStorage.setItem('crm_assignment_instances', JSON.stringify(assignmentInstances));
  }, [assignmentInstances]);

  const [masterRecords, setMasterRecords] = useState(() => {
    const saved = localStorage.getItem('crm_master_records');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('crm_master_records', JSON.stringify(masterRecords));
  }, [masterRecords]);

  // Theme & UX settings
  const [themeMode, setThemeMode] = useState('dark');
  const [accentColor, setAccentColor] = useState('purple');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [themeMode, accentColor]);

  // Auth Header helper
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  });

  // Fetch initial data when authenticated (with graceful fallback to default state)
  const refreshData = async () => {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!authToken || !isLocalhost) return;
    try {
      const [uRes, lRes, sRes, dRes, rRes, dtRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/leads`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/sales`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/dispositions`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/custom-roles`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/document-types`, { headers: authHeaders() })
      ]);

      if (uRes.ok) {
        const data = await uRes.json();
        if (Array.isArray(data) && data.length > 0) setUsers(data);
      }
      if (lRes.ok) {
        const data = await lRes.json();
        // Never wipe out rich localStorage leads with empty array from cold backend
        if (Array.isArray(data) && data.length > 0) setLeads(data);
      }
      if (sRes.ok) {
        const data = await sRes.json();
        if (Array.isArray(data) && data.length > 0) setSales(data);
      }
      if (dRes.ok) {
        const data = await dRes.json();
        if (Array.isArray(data) && data.length > 0) setDispositions(data);
      }
      if (rRes.ok) {
        const data = await rRes.json();
        if (Array.isArray(data) && data.length > 0) setCustomRoles(data);
      }
      if (dtRes.ok) {
        const data = await dtRes.json();
        if (Array.isArray(data) && data.length > 0) setDocumentTypes(data);
      }
    } catch (err) {
      console.log('Operating in standalone interactive mode (FastAPI backend offline).');
    }
  };

  useEffect(() => {
    if (authToken) {
      refreshData();
    }
  }, [authToken]);

  // ─── IP Restriction State ──────────────────────────────────────────────────
  const [detectedIP, setDetectedIP] = useState(null);
  const [ipDetecting, setIPDetecting] = useState(false);

  // Expose detected IP (pre-fetched when login page loads)
  const prefetchIP = async () => {
    if (detectedIP) return detectedIP;
    setIPDetecting(true);
    const ip = await detectPublicIP();
    setDetectedIP(ip);
    setIPDetecting(false);
    return ip;
  };

  // Get all allowed IPs for a user from registry
  const getUserAllowedIPs = (userId) => {
    const registry = loadIPRegistry();
    return registry[userId] || [];
  };

  // Reset/revoke all IPs for a user (Super Admin action)
  const resetUserIPs = (userId) => {
    const registry = loadIPRegistry();
    delete registry[userId];
    saveIPRegistry(registry);
  };

  // Manually add an IP for a user (Super Admin action)
  const addIPToUser = (userId, ip, label = 'Manual') => {
    const registry = loadIPRegistry();
    if (!registry[userId]) registry[userId] = [];
    const already = registry[userId].some(e => e.ip === ip);
    if (!already) {
      registry[userId].push({ ip, registeredAt: new Date().toISOString(), label });
      saveIPRegistry(registry);
    }
  };

  // Login handler with backend attempt, IP restriction, & seamless live fallback
  const handleLogin = async (identifier, password) => {
    setLoginError('');
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanDigits = (identifier || '').replace(/\D/g, '');

    // ── Step 1: Detect public IP ────────────────────────────────────────────
    let currentIP = detectedIP;
    if (!currentIP) {
      setIPDetecting(true);
      currentIP = await detectPublicIP();
      setDetectedIP(currentIP);
      setIPDetecting(false);
    }

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier, password })
        });

        if (res.ok) {
          const data = await res.json();
          setAuthToken(data.access_token);
          setCurrentUser(data.user);
          setSimulatedRoleState(data.user?.role || 'Executive');
          localStorage.setItem('crm_token', data.access_token);
          localStorage.setItem('crm_user', JSON.stringify(data.user));
          localStorage.setItem('crm_simulated_role', data.user?.role || 'Executive');
          return true;
        }
      } catch (err) {
        // Backend not running on live link - fall back to interactive mock mode
      }
    }

    // Helper to test if a candidate user matches identifier (by Email, Name, Mobile, or Employee ID)
    const matchesUser = (u) => {
      if (!u) return false;
      const uEmail = (u.email || '').trim().toLowerCase();
      const uName = (u.name || '').trim().toLowerCase();
      const uEmpId = (u.employeeId || '').trim().toLowerCase();
      const uMobileDigits = (u.mobile || '').replace(/\D/g, '');

      if (cleanId && uEmail && uEmail === cleanId) return true;
      if (cleanId && uName && uName === cleanId) return true;
      if (cleanId && uEmpId && uEmpId === cleanId) return true;
      if (cleanDigits && uMobileDigits && (uMobileDigits === cleanDigits || uMobileDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uMobileDigits))) return true;
      return false;
    };

    // Check custom and persisted users list first, then default users
    let matchedUser = (users || []).find(matchesUser) || DEFAULT_USERS.find(matchesUser);

    if (!matchedUser && cleanId) {
      matchedUser = (users || []).find(u => (u.name || '').trim().toLowerCase().startsWith(cleanId)) ||
                    DEFAULT_USERS.find(u => (u.name || '').trim().toLowerCase().startsWith(cleanId));
    }

    if (!matchedUser) {
      matchedUser = {
        id: 'usr-' + Date.now(),
        name: identifier.includes('@') ? identifier.split('@')[0] : identifier,
        email: identifier.includes('@') ? identifier : `${cleanId.replace(/[^a-z0-9]/g, '') || 'user'}@company.com`,
        mobile: cleanDigits || '+91 98765 00000',
        role: identifier.toLowerCase().includes('superadmin') ? 'Super Admin' :
              identifier.toLowerCase().includes('admin') ? 'Admin' :
              identifier.toLowerCase().includes('manager') ? 'Manager' :
              identifier.toLowerCase().includes('tl') ? 'Team Leader' : 'Executive',
        status: 'Active'
      };
      setUsers(prev => [matchedUser, ...(prev || [])]);
    }

    // ── Step 2: IP Restriction Check ────────────────────────────────────────
    // Super Admin is always exempt from IP restrictions
    const isSuperAdmin = matchedUser.role === 'Super Admin';
    if (!isSuperAdmin && currentIP) {
      const registry = loadIPRegistry();
      const userIPs = registry[matchedUser.id] || [];

      if (userIPs.length === 0) {
        // First login: auto-register this IP
        const newRegistry = { ...registry };
        newRegistry[matchedUser.id] = [{
          ip: currentIP,
          registeredAt: new Date().toISOString(),
          label: 'Auto-registered on first login'
        }];
        saveIPRegistry(newRegistry);
        // Show info toast (non-blocking)
        console.info(`[IP Guard] First login for ${matchedUser.name}. IP ${currentIP} registered.`);
      } else {
        // Subsequent logins: check if IP is whitelisted
        const isAllowed = userIPs.some(entry => entry.ip === currentIP);
        if (!isAllowed) {
          setLoginError(
            `🔒 Access Denied: Your current IP address (${currentIP}) is not authorised for this account. ` +
            `Only pre-registered IPs can access this account. Contact your Super Admin to reset or whitelist your new IP.`
          );
          return false;
        }
      }
    }

    // ── Step 3: Grant Access ────────────────────────────────────────────────
    const token = 'demo_token_' + Date.now();
    setAuthToken(token);
    setCurrentUser(matchedUser);
    setSimulatedRoleState(matchedUser.role || 'Executive');
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(matchedUser));
    localStorage.setItem('crm_simulated_role', matchedUser.role || 'Executive');
    return true;
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    setSimulatedRoleState('Executive');
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_simulated_role');
  };

  // User Actions
  const addUser = async (userData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(userData)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    // Standalone fallback action - ensure unique ID and clean credentials
    const cleanName = (userData.name || 'User').trim();
    const fallbackEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@company.com`;
    const uniqueId = 'usr-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);

    const newUserObj = {
      id: uniqueId,
      ...userData,
      name: cleanName,
      email: (userData.email && userData.email.trim()) ? userData.email.trim() : fallbackEmail,
      password: userData.password || '123456',
      status: 'Active',
      expiryDate: userData.expiryDate || '27-07-2028',
      employeeId: userData.employeeId || ('EMP-' + Math.floor(100 + Math.random() * 900)),
      documents: userData.documents || [],
      customFieldValues: userData.customFieldValues || {}
    };
    setUsers(prev => [newUserObj, ...(prev || [])]);
    return newUserObj;
  };

  const updateUser = async (userId, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updatedFields } : u));
  };

  const toggleUserStatus = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle-status`, {
        method: 'PUT',
        headers: authHeaders()
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u));
  };

  const changeUserPassword = async (userId, newPassword) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}
  };

  const deleteUser = async (userId, targetUserId = null) => {
    const userToDelete = (users || []).find(u => u.id === userId) || DEFAULT_USERS.find(u => u.id === userId);
    if (!userToDelete) return { success: false, error: 'User not found' };

    // Identify all active leads held by this user
    const userLeads = (leads || []).filter(l => {
      if (!l || l.isUnassigned || l.assignedToId === 'unassigned' || l.assignedToName === 'Unassigned') return false;
      return (
        l.assignedToId === userId ||
        l.assigned_user_id === userId ||
        (userToDelete.email && l.assignedToEmail && l.assignedToEmail.toLowerCase() === userToDelete.email.toLowerCase()) ||
        (userToDelete.name && l.assignedToName && l.assignedToName.trim().toLowerCase() === userToDelete.name.trim().toLowerCase())
      );
    });

    if (userLeads.length > 0 && !targetUserId) {
      return { success: false, requiresReassignment: true, leadCount: userLeads.length, userToDelete };
    }

    let targetUser = null;
    if (targetUserId) {
      targetUser = (users || []).find(u => u.id === targetUserId) || DEFAULT_USERS.find(u => u.id === targetUserId);
      if (!targetUser) {
        return { success: false, error: 'Target user not found' };
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Reassign leads if targetUser exists
    if (targetUser && userLeads.length > 0) {
      const reassignedLeadIds = new Set(userLeads.map(l => l.id));

      setLeads(prevLeads => {
        const updated = (prevLeads || []).map(l => {
          if (reassignedLeadIds.has(l.id)) {
            const newHistory = [
              ...(l.history || []),
              {
                date: todayStr,
                time: nowTime,
                text: `Reassigned from ${userToDelete.name} to ${targetUser.name} due to account deletion`,
                by: currentUser?.name || 'Super Admin'
              }
            ];
            return {
              ...l,
              assignedToId: targetUser.id,
              assigned_user_id: targetUser.id,
              assignedToName: targetUser.name,
              assignedToEmail: targetUser.email || '',
              assignedToRole: targetUser.role || 'Executive',
              isUnassigned: false,
              history: newHistory
            };
          }
          return l;
        });
        localStorage.setItem('crm_leads', JSON.stringify(updated));
        return updated;
      });

      // 2. Update assignmentInstances so reports / logs reflect the transfer
      setAssignmentInstances(prevInst => {
        const updatedInst = (prevInst || []).map(inst => {
          if (inst.assignedToId === userId || inst.assigned_user_id === userId) {
            return {
              ...inst,
              assignedToId: targetUser.id,
              assigned_user_id: targetUser.id,
              assignedToName: targetUser.name,
              assignedToEmail: targetUser.email || '',
              role: targetUser.role || 'Executive'
            };
          }
          return inst;
        });
        localStorage.setItem('crm_assignment_instances', JSON.stringify(updatedInst));
        return updatedInst;
      });
    }

    // 3. Remove user from users state & localStorage
    setUsers(prevUsers => {
      const updatedUsers = (prevUsers || []).filter(u => u.id !== userId);
      localStorage.setItem('crm_users', JSON.stringify(updatedUsers));
      return updatedUsers;
    });

    // 4. If currently active user was the deleted user, switch to Super Admin
    if (currentUser?.id === userId) {
      const fallbackUser = (users || []).find(u => u.id !== userId && u.role === 'Super Admin') || DEFAULT_USERS[0];
      setCurrentUser(fallbackUser);
      setSimulatedRoleState(fallbackUser.role || 'Super Admin');
      localStorage.setItem('crm_user', JSON.stringify(fallbackUser));
      localStorage.setItem('crm_simulated_role', fallbackUser.role || 'Super Admin');
    }

    // 5. Backend sync attempt if running
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocalhost) {
      try {
        if (targetUserId) {
          await fetch(`${API_BASE_URL}/users/${userId}/reassign-and-delete`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ targetUserId })
          });
        }
      } catch (e) {}
    }

    return { 
      success: true, 
      reassignedCount: userLeads.length, 
      targetUserName: targetUser?.name 
    };
  };

  const purgeAllData = () => {
    localStorage.removeItem('crm_leads');
    localStorage.removeItem('crm_assignment_instances');
    localStorage.removeItem('crm_master_records');
    localStorage.removeItem('crm_sales');
    localStorage.removeItem('crm_lead_requests');
    localStorage.removeItem('crm_users');
    setLeads([]);
    setAssignmentInstances([]);
    setMasterRecords([]);
    setSales([]);
    setLeadRequests([]);
    setUsers(DEFAULT_USERS);
  };

  // ==========================================
  // Document Types Configuration (Super Admin, Max 10 slots)
  // ==========================================
  const addDocumentType = async (docTypeData) => {
    if (documentTypes.length >= 10) {
      return { success: false, message: 'Maximum limit of 10 document types reached.' };
    }
    const newDocType = {
      id: 'doctype-' + Date.now(),
      name: (docTypeData.name || '').trim(),
      required: !!docTypeData.required,
      description: (docTypeData.description || '').trim()
    };
    try {
      const res = await fetch(`${API_BASE_URL}/document-types`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newDocType)
      });
      if (res.ok) {
        const saved = await res.json();
        setDocumentTypes(prev => [...prev, saved]);
        return { success: true, docType: saved };
      }
    } catch (err) {}

    setDocumentTypes(prev => [...prev, newDocType]);
    return { success: true, docType: newDocType };
  };

  const updateDocumentType = async (id, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE_URL}/document-types/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        const saved = await res.json();
        setDocumentTypes(prev => prev.map(dt => dt.id === id ? { ...dt, ...saved } : dt));
        return { success: true };
      }
    } catch (err) {}

    setDocumentTypes(prev => prev.map(dt => dt.id === id ? { ...dt, ...updatedFields } : dt));
    return { success: true };
  };

  const deleteDocumentType = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/document-types/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
    } catch (err) {}

    setDocumentTypes(prev => prev.filter(dt => dt.id !== id));
    return { success: true };
  };

  // ==========================================
  // User Custom Fields Configuration (Super Admin, Max 20 slots, each with 2 sub-fields)
  // ==========================================
  const addUserCustomField = async (fieldData) => {
    if (userCustomFields.length >= 20) {
      return { success: false, message: 'Maximum limit of 20 custom fields reached.' };
    }
    const fieldName = (fieldData.fieldName || '').trim();
    const subField1Name = (fieldData.subField1Name || '').trim();
    const subField2Name = (fieldData.subField2Name || '').trim();

    if (!fieldName) {
      return { success: false, message: 'Custom field name is required.' };
    }
    if (!subField1Name || !subField2Name) {
      return { success: false, message: 'Both sub-field names are required.' };
    }

    const newField = {
      id: 'ucf-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
      fieldName,
      subField1Name,
      subField2Name
    };

    try {
      const res = await fetch(`${API_BASE_URL}/user-custom-fields`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newField)
      });
      if (res.ok) {
        const saved = await res.json();
        setUserCustomFields(prev => [...prev, saved]);
        return { success: true, field: saved };
      }
    } catch (err) {}

    setUserCustomFields(prev => [...prev, newField]);
    return { success: true, field: newField };
  };

  const updateUserCustomField = async (id, updatedFields) => {
    const fieldName = (updatedFields.fieldName || '').trim();
    const subField1Name = (updatedFields.subField1Name || '').trim();
    const subField2Name = (updatedFields.subField2Name || '').trim();

    if (!fieldName || !subField1Name || !subField2Name) {
      return { success: false, message: 'Field name and both sub-field names are required.' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/user-custom-fields/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ fieldName, subField1Name, subField2Name })
      });
      if (res.ok) {
        const saved = await res.json();
        setUserCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...saved } : f));
        return { success: true };
      }
    } catch (err) {}

    setUserCustomFields(prev => prev.map(f => f.id === id ? { ...f, fieldName, subField1Name, subField2Name } : f));
    return { success: true };
  };

  const deleteUserCustomField = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/user-custom-fields/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
    } catch (err) {}

    setUserCustomFields(prev => prev.filter(f => f.id !== id));
    return { success: true };
  };

  // ==========================================
  // Employee Documents Upload & Direct Storage (Owner's DB)
  // ==========================================
  const uploadUserDocument = async (userId, docPayload) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newDoc = {
      id: 'doc-' + Date.now(),
      documentTypeId: docPayload.documentTypeId,
      documentName: docPayload.documentName,
      fileName: docPayload.fileName,
      fileType: docPayload.fileType,
      fileSize: docPayload.fileSize,
      fileData: docPayload.fileData,
      uploadedAt: nowStr
    };

    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(docPayload)
      });
      if (res.ok) {
        const savedDoc = await res.json();
        setUsers(prev => prev.map(u => {
          if (u.id !== userId) return u;
          const userDocs = u.documents ? [...u.documents] : [];
          const existingIdx = userDocs.findIndex(d => d.documentTypeId === savedDoc.documentTypeId);
          if (existingIdx >= 0) {
            userDocs[existingIdx] = savedDoc;
          } else {
            userDocs.push(savedDoc);
          }
          return { ...u, documents: userDocs };
        }));
        return { success: true, doc: savedDoc };
      }
    } catch (err) {}

    // Standalone fallback
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const userDocs = u.documents ? [...u.documents] : [];
      const existingIdx = userDocs.findIndex(d => d.documentTypeId === newDoc.documentTypeId);
      if (existingIdx >= 0) {
        userDocs[existingIdx] = newDoc;
      } else {
        userDocs.push(newDoc);
      }
      return { ...u, documents: userDocs };
    }));
    return { success: true, doc: newDoc };
  };

  const deleteUserDocument = async (userId, docId) => {
    try {
      await fetch(`${API_BASE_URL}/users/${userId}/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
    } catch (err) {}

    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return { ...u, documents: (u.documents || []).filter(d => d.id !== docId) };
    }));
    return { success: true };
  };

  const downloadUserDocument = (doc, userName = '') => {
    if (!doc || !doc.fileData) return;
    try {
      const link = document.createElement('a');
      link.href = doc.fileData;
      const ext = doc.fileName ? doc.fileName.split('.').pop() : (doc.fileType?.includes('pdf') ? 'pdf' : 'png');
      const cleanUser = userName ? `${userName.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
      const cleanDoc = (doc.documentName || 'Document').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = doc.fileName || `${cleanUser}${cleanDoc}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Document download failed:', e);
    }
  };

  // Dispositions Management
  const addDisposition = async (dispData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dispositions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(dispData)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const newDisp = {
      id: 'disp-' + (dispositions.length + 1),
      requiresDateTimePicker: false,
      ...dispData,
      isDefault: false
    };
    setDispositions(prev => [...prev, newDisp]);
  };

  const updateDisposition = async (dispId, updatedFields) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dispositions/${dispId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setDispositions(prev => prev.map(d => d.id === dispId ? { ...d, ...updatedFields } : d));
  };

  const deleteDisposition = async (dispId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dispositions/${dispId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setDispositions(prev => prev.filter(d => d.id !== dispId));
  };

  // Post-Call Lead Outcome Update with Date/Time Support
  const updateLeadDisposition = async (leadId, dispositionName, callNotes = '', scheduledDateTime = '') => {
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}/disposition`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dispositionName, callNotes, scheduledDateTime })
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const todayStr = new Date().toISOString().split('T')[0];
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const timeLog = scheduledDateTime ? ` Scheduled for: ${scheduledDateTime}.` : '';
        const newHistory = [...(l.history || []), { date: todayStr, text: `Disposition set to [${dispositionName}].${timeLog} ${callNotes}` }];
        return { ...l, disposition: dispositionName, dispositionScheduledAt: scheduledDateTime || '', history: newHistory };
      }
      return l;
    }));
  };

  // Lead Upload Integration (Block 2 & Block 3 requirement: new uploaded leads get 'New Lead' disposition by default)
  const addLead = (leadData) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const uniqueId = 'LD-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const assignedUserId = leadData.assignedToId || currentUser?.id || 'usr-5';
    const newLeadObj = {
      id: uniqueId,
      clientName: leadData.clientName || leadData.contactPerson + ' Co.',
      contactPerson: leadData.contactPerson,
      phone: leadData.phone,
      language: leadData.language || 'English',
      assignedToId: assignedUserId,
      assigned_user_id: assignedUserId,
      assignedToName: leadData.assignedToName || currentUser?.name || 'Assigned User',
      disposition: 'New Lead', // Default status per Block 2 specification
      dispositionScheduledAt: '',
      value: leadData.value || '₹5,00,000',
      history: [{ date: todayStr, text: 'Uploaded & assigned with default disposition [New Lead].' }]
    };
    setLeads(prev => [newLeadObj, ...prev]);
    return newLeadObj;
  };

  const addMasterRecords = (newRecords) => {
    setMasterRecords(prev => [...prev, ...newRecords]);
  };

  const assignLeadsByLanguage = (language, quantity, targetUserId) => {
    const targetUser = (users || []).find(u => u.id === targetUserId) || DEFAULT_USERS.find(u => u.id === targetUserId);
    if (!targetUser) {
      return { success: false, error: 'Allocation prevented: Target user not found in Block 1 Hierarchy.', assigned: 0 };
    }

    if (quantity === undefined || quantity === null || String(quantity).trim() === '') {
      return { success: false, error: 'Quantity Validation: Assign Quantity cannot be empty.', assigned: 0 };
    }

    const numToAssign = Number(quantity);
    if (!Number.isInteger(numToAssign) || numToAssign <= 0) {
      return { success: false, error: 'Quantity Validation: Assign Quantity must be a valid positive integer greater than zero.', assigned: 0 };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const langKey = (language || '').trim().toLowerCase();

    // Query unassigned leads matching requested language strictly
    const matchingLeads = leads.filter(l => 
      ((l.language || '').trim().toLowerCase() === langKey || langKey === 'all') && 
      (l.isUnassigned || !l.assignedToId || l.assignedToName === 'Unassigned' || l.assignedToId === 'unassigned' || !l.assigned_user_id)
    );

    const availableCount = matchingLeads.length;

    // Quantity Validation: Prevent allocation if exceeds total number of unassigned leads available
    if (numToAssign > availableCount) {
      return {
        success: false,
        error: `Quantity Validation: Cannot allocate ${numToAssign} lead(s). Requested quantity exceeds total unassigned leads (${availableCount}) available for language '${language}'.`,
        available: availableCount,
        requested: numToAssign,
        assigned: 0
      };
    }

    // Select exactly N leads (where N = Assign Quantity)
    const leadsToAssign = matchingLeads.slice(0, numToAssign);
    const assignedCount = leadsToAssign.length;
    if (assignedCount !== numToAssign) {
      return {
        success: false,
        error: `Quantity Validation: Unable to select exactly ${numToAssign} leads for allocation.`,
        available: availableCount,
        requested: numToAssign,
        assigned: 0
      };
    }

    const assignedLeadIds = new Set(leadsToAssign.map(l => l.id));

    setLeads(prev => prev.map(l => {
      if (assignedLeadIds.has(l.id)) {
        return {
          ...l,
          assignedToId: targetUser.id,
          assigned_user_id: targetUser.id,
          assignedToName: targetUser.name,
          assignedToEmail: targetUser.email || '',
          assignedToRole: targetUser.role || 'Executive',
          isUnassigned: false,
          disposition: l.disposition || 'New Lead',
          history: [
            ...(l.history || []),
            { date: todayStr, text: `Allocated to ${targetUser.name} (${targetUser.role}) via Language-Based Lead Assignment Engine [${language}]. Batch size: exactly ${assignedCount} leads.` }
          ]
        };
      }
      return l;
    }));

    const newInstance = {
      id: 'inst-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      fileName: `Assignment_${language}_Qty${assignedCount}_${todayStr}.csv`,
      language: language,
      quantity: assignedCount,
      assignedToId: targetUser.id,
      assigned_user_id: targetUser.id,
      assignedToName: targetUser.name,
      assignedToEmail: targetUser.email || '',
      role: targetUser.role || 'Executive',
      date: todayStr,
      leadIds: Array.from(assignedLeadIds)
    };

    setAssignmentInstances(prev => [newInstance, ...prev]);

    const resObj = {
      success: true,
      assigned: assignedCount,
      count: assignedCount,
      available: availableCount,
      remainingUnassigned: availableCount - assignedCount,
      targetUser: targetUser,
      language: language,
      error: null
    };
    resObj.valueOf = () => assignedCount;
    resObj[Symbol.toPrimitive] = () => assignedCount;

    return resObj;
  };

  const addBulkLeads = (newLeadsArray) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const baseTime = Date.now();
    const formatted = newLeadsArray.map((ld, i) => {
      const isUnassigned = !ld.assignedToId || ld.assignedToId === 'unassigned';
      const targetUser = users.find(u => u.id === ld.assignedToId);
      return {
        id: `LD-${baseTime}-${i}-${Math.floor(Math.random() * 10000)}`,
        clientName: ld.contactPerson + ' Org',
        contactPerson: ld.contactPerson,
        phone: ld.phone,
        language: ld.language || 'English',
        assignedToId: isUnassigned ? null : ld.assignedToId,
        assigned_user_id: isUnassigned ? null : ld.assignedToId,
        assignedToName: isUnassigned ? 'Unassigned' : (targetUser?.name || ld.assignedToName || 'User'),
        isUnassigned: isUnassigned,
        disposition: 'New Lead', // Default status per Block 2 specification
        dispositionScheduledAt: '',
        value: ld.value || '₹4,00,000',
        history: [{ date: todayStr, text: `Bulk uploaded with default disposition [New Lead]. ${isUnassigned ? 'Marked Unassigned.' : `Assigned to ${targetUser?.name || 'User'}.`}` }]
      };
    });
    setLeads(prev => [...formatted, ...prev]);
    return formatted;
  };

  const reassignLeads = async (fromUserId, toUserId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/leads/reassign`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fromUserId, toUserId })
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const targetUser = users.find(u => u.id === toUserId);
    const todayStr = new Date().toISOString().split('T')[0];

    setLeads(prev => prev.map(l => {
      if (l.id === fromUserId || l.assignedToId === fromUserId) {
        const newHistory = [...(l.history || []), { date: todayStr, text: `Reassigned to ${targetUser?.name || 'New Owner'}` }];
        return { ...l, assignedToId: toUserId, assignedToName: targetUser?.name || 'Reassigned User', history: newHistory };
      }
      return l;
    }));
  };

  const reassignLeadsFiltered = ({ fromUserId, toUserId, quantity, language, date, dateMode = 'single', startDate, endDate }) => {
    const targetUser = users.find(u => u.id === toUserId);
    if (!targetUser) return 0;
    const numToAssign = quantity ? parseInt(quantity, 10) : Infinity;
    if (isNaN(numToAssign) || numToAssign <= 0) return 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter candidate matching leads
    const candidates = leads.filter(l => {
      if (fromUserId && fromUserId !== 'ALL' && l.assignedToId !== fromUserId) return false;
      if (language && language !== 'ALL' && (l.language || '').trim().toLowerCase() !== language.trim().toLowerCase()) return false;

      if (dateMode === 'range' || (!date && (startDate || endDate))) {
        if (startDate || endDate) {
          const dates = [];
          if (l.assignedDate) dates.push(l.assignedDate);
          if (l.date) dates.push(l.date);
          (l.history || []).forEach(h => {
            if (h.date) dates.push(h.date);
          });
          if (dates.length === 0) return false;
          const matchesRange = dates.some(d => {
            const dStr = String(d).slice(0, 10);
            if (startDate && dStr < startDate) return false;
            if (endDate && dStr > endDate) return false;
            return true;
          });
          if (!matchesRange) return false;
        }
      } else if (date) {
        const hasMatchingDate = (l.history || []).some(h => (h.date || '').includes(date)) || 
                                (l.date && String(l.date).includes(date)) ||
                                (l.assignedDate && String(l.assignedDate).includes(date));
        if (!hasMatchingDate) return false;
      }
      return true;
    });

    const leadsToReassign = candidates.slice(0, numToAssign);
    if (leadsToReassign.length === 0) return 0;

    const targetIds = new Set(leadsToReassign.map(l => l.id));

    let dateDesc = 'Any';
    if (dateMode === 'range' && (startDate || endDate)) {
      if (startDate && endDate) dateDesc = `${startDate} to ${endDate}`;
      else if (startDate) dateDesc = `From ${startDate}`;
      else if (endDate) dateDesc = `Until ${endDate}`;
    } else if (date) {
      dateDesc = date;
    }

    setLeads(prev => prev.map(l => {
      if (targetIds.has(l.id)) {
        const newHistory = [
          ...(l.history || []),
          { date: todayStr, text: `Reassigned to ${targetUser.name} (${targetUser.role}) via Protocol [Qty: ${quantity || 'All'}, Lang: ${language || 'All'}, Date: ${dateDesc}].` }
        ];
        return {
          ...l,
          assignedToId: targetUser.id,
          assigned_user_id: targetUser.id,
          assignedToName: targetUser.name,
          assignedToEmail: targetUser.email || '',
          assignedToRole: targetUser.role || 'Executive',
          isUnassigned: false,
          history: newHistory
        };
      }
      return l;
    }));

    return leadsToReassign.length;
  };

  // Sales Workflow
  const registerSale = async (saleData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(saleData)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const todayStr = new Date().toISOString().split('T')[0];
    const newSale = {
      id: 'SL-' + Math.floor(500 + Math.random() * 500),
      date: todayStr,
      ...saleData,
      status: 'Pending Super Admin Approval',
      stage: 'Sale Submitted'
    };
    setSales(prev => [newSale, ...prev]);
  };

  const approveSale = async (saleId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales/${saleId}/approve`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'Approved (eKYC Stage)', stage: 'eKYC Approved' } : s));
  };

  const rejectSale = async (saleId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales/${saleId}/reject`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: 'Rejected by Super Admin', stage: 'Rejected' } : s));
  };

  // Custom Roles
  const addCustomRole = async (roleData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/custom-roles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(roleData)
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const newRole = {
      id: 'cr-' + Date.now(),
      ...roleData
    };
    setCustomRoles(prev => [...prev, newRole]);
    return { success: true };
  };

  const deleteCustomRole = async (roleId) => {
    try {
      await fetch(`${API_BASE_URL}/custom-roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
    } catch (err) {}

    setCustomRoles(prev => prev.filter(cr => cr.id !== roleId));
    return { success: true };
  };

  // Block 4: Lead Requests & File / Granular Operations
  const submitLeadRequest = (language, quantity, note = '') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newReq = {
      id: 'req-' + Math.floor(100 + Math.random() * 900),
      requestedByUserId: currentUser?.id || 'usr-5',
      requestedByName: currentUser?.name || 'Executive User',
      role: currentUser?.role || 'Executive',
      team: 'Sales Team',
      language: language || 'English',
      quantity: parseInt(quantity, 10) || 20,
      date: todayStr,
      status: 'Pending',
      note: note
    };
    setLeadRequests(prev => [newReq, ...prev]);
    return newReq;
  };

  const fulfillLeadRequest = (requestId, quantity, targetUserId, language) => {
    // Fulfill request and perform auto-disappear rule
    setLeadRequests(prev => prev.filter(r => r.id !== requestId));
    let assigned = 0;
    const reqQty = parseInt(quantity, 10) || 0;
    if (targetUserId && language) {
      assigned = assignLeadsByLanguage(language, reqQty, targetUserId);
    }
    return { assigned, requested: reqQty };
  };

  const discardLeadRequest = (requestId) => {
    setLeadRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const deleteAssignmentFiles = (instanceIds) => {
    const idsToDelete = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
    
    // Find all lead IDs linked to these instances
    const targetInstances = assignmentInstances.filter(i => idsToDelete.includes(i.id));
    const leadIdsToRemove = targetInstances.flatMap(i => i.leadIds || []);

    // Remove instances
    setAssignmentInstances(prev => prev.filter(i => !idsToDelete.includes(i.id)));

    // Remove associated leads if any
    if (leadIdsToRemove.length > 0) {
      setLeads(prev => prev.filter(l => !leadIdsToRemove.includes(l.id)));
    }
  };

  const reassignAssignmentFile = (instanceId, targetUserId) => {
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    const todayStr = new Date().toISOString().split('T')[0];

    setAssignmentInstances(prev => prev.map(inst => {
      if (inst.id === instanceId) {
        // Reassign all leads in this instance
        if (inst.leadIds && inst.leadIds.length > 0) {
          setLeads(lPrev => lPrev.map(l => {
            if (inst.leadIds.includes(l.id)) {
              return {
                ...l,
                assignedToId: targetUser.id,
                assignedToName: targetUser.name,
                history: [...(l.history || []), { date: todayStr, text: `Batch assignment file reassigned to ${targetUser.name} by Super Admin` }]
              };
            }
            return l;
          }));
        }
        return { ...inst, assignedToId: targetUser.id, assignedToName: targetUser.name };
      }
      return inst;
    }));
  };

  const granularReassignLeads = (leadIds, targetUserId) => {
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;
    const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
    const todayStr = new Date().toISOString().split('T')[0];

    setLeads(prev => prev.map(l => {
      if (ids.includes(l.id)) {
        return {
          ...l,
          assignedToId: targetUser.id,
          assigned_user_id: targetUser.id,
          assignedToName: targetUser.name,
          assignedToEmail: targetUser.email || '',
          assignedToRole: targetUser.role || 'Executive',
          history: [...(l.history || []), { date: todayStr, text: `Granularly reassigned to ${targetUser.name} by Super Admin` }]
        };
      }
      return l;
    }));

    // Update assignmentInstances to remove reassigned lead IDs from their source instance file
    setAssignmentInstances(prev => prev.map(inst => {
      if (inst.leadIds && inst.leadIds.some(id => ids.includes(id))) {
        const remainingLeadIds = inst.leadIds.filter(id => !ids.includes(id));
        return {
          ...inst,
          leadIds: remainingLeadIds,
          quantity: remainingLeadIds.length,
          totalLeads: remainingLeadIds.length
        };
      }
      return inst;
    }));
  };

  const granularDeleteLeads = (leadIds) => {
    const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));

    // Update assignmentInstances to remove deleted lead IDs from their instance file
    setAssignmentInstances(prev => prev.map(inst => {
      if (inst.leadIds && inst.leadIds.some(id => ids.includes(id))) {
        const remainingLeadIds = inst.leadIds.filter(id => !ids.includes(id));
        return {
          ...inst,
          leadIds: remainingLeadIds,
          quantity: remainingLeadIds.length,
          totalLeads: remainingLeadIds.length
        };
      }
      return inst;
    }));
  };

  return (
    <CRMContext.Provider value={{
      authToken,
      currentUser,
      simulatedRole,
      setSimulatedRole,
      switchUser,
      loginError,
      handleLogin,
      handleLogout,
      users,
      leads,
      sales,
      dispositions,
      customRoles,
      leadRequests,
      assignmentInstances,
      themeMode,
      setThemeMode,
      accentColor,
      setAccentColor,
      addUser,
      updateUser,
      toggleUserStatus,
      changeUserPassword,
      addDisposition,
      updateDisposition,
      deleteDisposition,
      updateLeadDisposition,
      reassignLeads,
      reassignLeadsFiltered,
      deleteUser,
      purgeAllData,
      registerSale,
      approveSale,
      rejectSale,
      addCustomRole,
      deleteCustomRole,
      addLead,
      addBulkLeads,
      masterRecords,
      addMasterRecords,
      assignLeadsByLanguage,
      submitLeadRequest,
      fulfillLeadRequest,
      discardLeadRequest,
      deleteAssignmentFiles,
      reassignAssignmentFile,
      granularReassignLeads,
      granularDeleteLeads,
      documentTypes,
      addDocumentType,
      updateDocumentType,
      deleteDocumentType,
      uploadUserDocument,
      deleteUserDocument,
      downloadUserDocument,
      userCustomFields,
      addUserCustomField,
      updateUserCustomField,
      deleteUserCustomField,
      userShortcutSettings,
      isShortcutEnabled,
      setUserShortcut,
      toggleUserShortcut,
      // ─── IP Restriction ─────────────────────────────────────
      detectedIP,
      ipDetecting,
      prefetchIP,
      getUserAllowedIPs,
      resetUserIPs,
      addIPToUser
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);

