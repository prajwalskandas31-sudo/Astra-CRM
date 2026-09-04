import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

const DEFAULT_USERS = [
  { id: 'usr-1', name: 'Srinivas R', email: 'superadmin@company.com', mobile: '+91 98765 43210', role: 'Super Admin', status: 'Active', reportingTo: 'Board of Directors', expiryDate: '27-07-2028', employeeId: 'EMP-001', adminAccessEnabled: true },
  { id: 'usr-2', name: 'Rajesh Kumar', email: 'admin@company.com', mobile: '+91 98765 43211', role: 'Admin', status: 'Active', reportingTo: 'Srinivas R', expiryDate: '27-07-2028', employeeId: 'EMP-002', adminAccessEnabled: true },
  { id: 'usr-3', name: 'Vikram Seth', email: 'vikram.manager@company.com', mobile: '+91 98765 43212', role: 'Manager', status: 'Active', reportingTo: 'Rajesh Kumar', expiryDate: '15-12-2027', employeeId: 'MGR-101', adminAccessEnabled: false },
  { id: 'usr-4', name: 'Priya Nair', email: 'priya.tl@company.com', mobile: '+91 98765 43213', role: 'Team Leader', status: 'Active', reportingTo: 'Vikram Seth', expiryDate: '15-12-2027', employeeId: 'TL-201', adminAccessEnabled: false },
  { id: 'usr-5', name: 'ABHINAYA M', email: 'abhinaya@company.com', mobile: '+91 98765 43214', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-301', adminAccessEnabled: false },
  { id: 'usr-6', name: 'AJAY', email: 'ajay@company.com', mobile: '+91 98765 43215', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-302', adminAccessEnabled: false },
  { id: 'usr-7', name: 'AKSHATA', email: 'tajayvarma76@gmail.com', mobile: '+91 98765 43216', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-303', adminAccessEnabled: false },
  { id: 'usr-8', name: 'ANITHA', email: 'anitha@company.com', mobile: '+91 98765 43217', role: 'Executive', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-304', adminAccessEnabled: false },
  { id: 'usr-9', name: 'Kiran Verma', email: 'kiran.v@company.com', mobile: '+91 98765 43218', role: 'Executive', status: 'Inactive', reportingTo: 'Priya Nair', expiryDate: '01-01-2025', employeeId: 'EXEC-305', adminAccessEnabled: false }
];

const DEFAULT_DISPOSITIONS = [
  { id: 'disp-1', name: 'Interested', description: 'Client showed interest in product offering', color: 'emerald', isDefault: true },
  { id: 'disp-2', name: 'New Lead', description: 'Fresh inbound query awaiting callback', color: 'blue', isDefault: true },
  { id: 'disp-3', name: 'Call Back Later', description: 'Requested follow-up at specific time slot', color: 'amber', isDefault: true },
  { id: 'disp-4', name: 'Meeting Scheduled', description: 'Demo or executive discussion scheduled', color: 'purple', isDefault: false },
  { id: 'disp-5', name: 'Closed Won', description: 'Deal finalized and sent to sale workflow', color: 'emerald', isDefault: false },
  { id: 'disp-6', name: 'Not Interested', description: 'Declined service offering', color: 'rose', isDefault: false }
];

const DEFAULT_LEADS = [
  { id: 'LD-1001', clientName: 'Apex Financial Services', contactPerson: 'Rohan Mehta', phone: '+91 91234 56789', assignedToId: 'usr-7', assignedToName: 'AKSHATA', disposition: 'Interested', value: '₹4,50,000', history: [{ date: '2026-09-01', text: 'Initial discovery call logged.' }] },
  { id: 'LD-1002', clientName: 'Zenith Logistics', contactPerson: 'Kavita Rao', phone: '+91 91234 56790', assignedToId: 'usr-5', assignedToName: 'ABHINAYA M', disposition: 'Meeting Scheduled', value: '₹12,00,000', history: [{ date: '2026-09-02', text: 'Product demo scheduled.' }] },
  { id: 'LD-1003', clientName: 'Vanguard Healthcare', contactPerson: 'Dr. Suresh Patil', phone: '+91 91234 56791', assignedToId: 'usr-6', assignedToName: 'AJAY', disposition: 'Call Back Later', value: '₹8,20,000', history: [{ date: '2026-09-03', text: 'Callback requested after board review.' }] },
  { id: 'LD-1004', clientName: 'Nexus Digital Media', contactPerson: 'Neha Sharma', phone: '+91 91234 56792', assignedToId: 'usr-8', assignedToName: 'ANITHA', disposition: 'New Lead', value: '₹3,00,000', history: [{ date: '2026-09-04', text: 'Inbound website lead assigned.' }] },
  { id: 'LD-1005', clientName: 'Starlight Tech Ltd', contactPerson: 'Amit Gupta', phone: '+91 91234 56793', assignedToId: 'usr-7', assignedToName: 'AKSHATA', disposition: 'Closed Won', value: '₹15,00,000', history: [{ date: '2026-09-04', text: 'Contract signed.' }] }
];

const DEFAULT_SALES = [
  { id: 'SL-501', date: '2026-09-04', clientName: 'Starlight Tech Ltd', amount: '₹15,00,000', employeeName: 'AKSHATA', employeeId: 'usr-7', mitcStatus: 'Verified', complianceStatus: 'Compliant', status: 'Pending Super Admin Approval', stage: 'Sale Submitted' },
  { id: 'SL-502', date: '2026-09-03', clientName: 'Orbital Cloud Solutions', amount: '₹7,50,000', employeeName: 'ABHINAYA M', employeeId: 'usr-5', mitcStatus: 'Verified', complianceStatus: 'Compliant', status: 'Approved (eKYC Stage)', stage: 'eKYC Approved' }
];

const DEFAULT_CUSTOM_ROLES = [
  { id: 'cr-1', roleName: 'Senior Regional Manager', level: 'Level 1 (Top)', accessScope: 'Regional' },
  { id: 'cr-2', roleName: 'Compliance Inspector', level: 'Level 2 (Mid)', accessScope: 'Global' }
];

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('crm_token') || '');
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('crm_user') || 'null'));
  const [loginError, setLoginError] = useState('');

  const [users, setUsers] = useState(DEFAULT_USERS);
  const [leads, setLeads] = useState(DEFAULT_LEADS);
  const [sales, setSales] = useState(DEFAULT_SALES);
  const [dispositions, setDispositions] = useState(DEFAULT_DISPOSITIONS);
  const [customRoles, setCustomRoles] = useState(DEFAULT_CUSTOM_ROLES);

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
    if (!authToken) return;
    try {
      const [uRes, lRes, sRes, dRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/leads`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/sales`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/dispositions`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/custom-roles`, { headers: authHeaders() })
      ]);

      if (uRes.ok) setUsers(await uRes.json());
      if (lRes.ok) setLeads(await lRes.json());
      if (sRes.ok) setSales(await sRes.json());
      if (dRes.ok) setDispositions(await dRes.json());
      if (rRes.ok) setCustomRoles(await rRes.json());
    } catch (err) {
      console.log('Operating in standalone interactive mode (FastAPI backend offline).');
    }
  };

  useEffect(() => {
    if (authToken) {
      refreshData();
    }
  }, [authToken]);

  // Login handler with backend attempt & seamless live fallback
  const handleLogin = async (email, password) => {
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        localStorage.setItem('crm_token', data.access_token);
        localStorage.setItem('crm_user', JSON.stringify(data.user));
        return true;
      }
    } catch (err) {
      // Backend not running on live link - fall back to interactive mock mode
    }

    // Interactive standalone fallback login
    const matchedUser = DEFAULT_USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) || {
      id: 'usr-demo',
      name: email.split('@')[0].toUpperCase(),
      email: email,
      role: email.includes('superadmin') ? 'Super Admin' : email.includes('admin') ? 'Admin' : email.includes('manager') ? 'Manager' : email.includes('tl') ? 'Team Leader' : 'Executive',
      status: 'Active'
    };

    const token = 'demo_token_' + Date.now();
    setAuthToken(token);
    setCurrentUser(matchedUser);
    localStorage.setItem('crm_token', token);
    localStorage.setItem('crm_user', JSON.stringify(matchedUser));
    return true;
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
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

    // Standalone fallback action
    const newUserObj = {
      id: 'usr-' + (users.length + 1),
      ...userData,
      status: 'Active',
      expiryDate: '27-07-2028',
      employeeId: 'EMP-' + Math.floor(100 + Math.random() * 900)
    };
    setUsers(prev => [newUserObj, ...prev]);
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

  const deleteUser = (userId, targetUserId = null) => {
    const userLeads = leads.filter(l => l.assignedToId === userId);
    if (userLeads.length > 0 && !targetUserId) {
      return { success: false, requiresReassignment: true, leadCount: userLeads.length };
    }

    if (targetUserId) {
      const targetUser = users.find(u => u.id === targetUserId);
      setLeads(prev => prev.map(l => l.assignedToId === userId ? { ...l, assignedToId: targetUserId, assignedToName: targetUser?.name || 'Reassigned User' } : l));
    }

    setUsers(prev => prev.filter(u => u.id !== userId));
    return { success: true };
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

  // Post-Call Lead Outcome Update
  const updateLeadDisposition = async (leadId, dispositionName, callNotes = '') => {
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}/disposition`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dispositionName, callNotes })
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const todayStr = new Date().toISOString().split('T')[0];
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const newHistory = [...(l.history || []), { date: todayStr, text: `Disposition set to [${dispositionName}]. ${callNotes}` }];
        return { ...l, disposition: dispositionName, history: newHistory };
      }
      return l;
    }));
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
      id: 'cr-' + (customRoles.length + 1),
      ...roleData
    };
    setCustomRoles(prev => [...prev, newRole]);
  };

  return (
    <CRMContext.Provider value={{
      authToken,
      currentUser,
      simulatedRole: currentUser?.role || 'Executive',
      loginError,
      handleLogin,
      handleLogout,
      users,
      leads,
      sales,
      dispositions,
      customRoles,
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
      deleteUser,
      registerSale,
      approveSale,
      rejectSale,
      addCustomRole
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);
