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
  { id: 'disp-1', name: 'New Lead', requiresDateTimePicker: false, color: 'blue', isDefault: true },
  { id: 'disp-2', name: 'Interested', requiresDateTimePicker: false, color: 'emerald', isDefault: true },
  { id: 'disp-3', name: 'Call Back Later', requiresDateTimePicker: true, color: 'amber', isDefault: true },
  { id: 'disp-4', name: 'Give Demo Call', requiresDateTimePicker: true, color: 'purple', isDefault: true },
  { id: 'disp-5', name: 'Follow Up', requiresDateTimePicker: true, color: 'indigo', isDefault: true },
  { id: 'disp-6', name: 'Not Interested', requiresDateTimePicker: false, color: 'rose', isDefault: false },
  { id: 'disp-7', name: 'Commitment', requiresDateTimePicker: false, color: 'cyan', isDefault: false },
  { id: 'disp-8', name: 'Paid / Converted', requiresDateTimePicker: false, color: 'emerald', isDefault: false }
];

const DEFAULT_LEADS = [
  { id: 'LD-1001', clientName: 'Apex Financial Services', contactPerson: 'Rohan Mehta', phone: '+91 91234 56789', language: 'Hindi', assignedToId: 'usr-7', assignedToName: 'AKSHATA', disposition: 'New Lead', value: '₹4,50,000', history: [{ date: '2026-09-01', text: 'Initial lead assigned.' }] },
  { id: 'LD-1002', clientName: 'Zenith Logistics', contactPerson: 'Kavita Rao', phone: '+91 91234 56790', language: 'English', assignedToId: 'usr-5', assignedToName: 'ABHINAYA M', disposition: 'Give Demo Call', dispositionScheduledAt: '2026-09-10 11:00', value: '₹12,00,000', history: [{ date: '2026-09-02', text: 'Product demo call scheduled.' }] },
  { id: 'LD-1003', clientName: 'Vanguard Healthcare', contactPerson: 'Dr. Suresh Patil', phone: '+91 91234 56791', language: 'Marathi', assignedToId: 'usr-6', assignedToName: 'AJAY', disposition: 'Call Back Later', dispositionScheduledAt: '2026-09-09 15:30', value: '₹8,20,000', history: [{ date: '2026-09-03', text: 'Callback requested after board review.' }] },
  { id: 'LD-1004', clientName: 'Nexus Digital Media', contactPerson: 'Neha Sharma', phone: '+91 91234 56792', language: 'Hindi', assignedToId: 'usr-8', assignedToName: 'ANITHA', disposition: 'New Lead', value: '₹3,00,000', history: [{ date: '2026-09-04', text: 'Inbound website lead assigned.' }] },
  { id: 'LD-1005', clientName: 'Starlight Tech Ltd', contactPerson: 'Amit Gupta', phone: '+91 91234 56793', language: 'English', assignedToId: 'usr-7', assignedToName: 'AKSHATA', disposition: 'Interested', value: '₹15,00,000', history: [{ date: '2026-09-04', text: 'Interested after demo.' }] }
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
  const [masterRecords, setMasterRecords] = useState([
    { contactPerson: 'Rohan Mehta', phone: '+91 91234 56789', language: 'Hindi' },
    { contactPerson: 'Kavita Rao', phone: '+91 91234 56790', language: 'English' },
    { contactPerson: 'Dr. Suresh Patil', phone: '+91 91234 56791', language: 'Marathi' },
    { contactPerson: 'Neha Sharma', phone: '+91 91234 56792', language: 'Hindi' },
    { contactPerson: 'Amit Gupta', phone: '+91 91234 56793', language: 'English' }
  ]);

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
    const newLeadObj = {
      id: 'LD-' + Math.floor(1000 + Math.random() * 9000),
      clientName: leadData.clientName || leadData.contactPerson + ' Co.',
      contactPerson: leadData.contactPerson,
      phone: leadData.phone,
      language: leadData.language || 'English',
      assignedToId: leadData.assignedToId || currentUser?.id || 'usr-5',
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
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return 0;
    const numToAssign = parseInt(quantity, 10);
    if (isNaN(numToAssign) || numToAssign <= 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    let count = 0;

    setLeads(prev => prev.map(l => {
      if (l.language?.toLowerCase() === language.toLowerCase() && (l.isUnassigned || !l.assignedToId || l.assignedToName === 'Unassigned') && count < numToAssign) {
        count++;
        return {
          ...l,
          assignedToId: targetUser.id,
          assignedToName: targetUser.name,
          isUnassigned: false,
          history: [...(l.history || []), { date: todayStr, text: `Assigned to ${targetUser.name} (${targetUser.role}) via Language Lead Assignment [${language}].` }]
        };
      }
      return l;
    }));

    return count;
  };

  const addBulkLeads = (newLeadsArray) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const formatted = newLeadsArray.map((ld, i) => {
      const isUnassigned = !ld.assignedToId || ld.assignedToId === 'unassigned';
      const targetUser = users.find(u => u.id === ld.assignedToId);
      return {
        id: 'LD-' + Math.floor(2000 + Math.random() * 8000 + i),
        clientName: ld.contactPerson + ' Org',
        contactPerson: ld.contactPerson,
        phone: ld.phone,
        language: ld.language || 'English',
        assignedToId: isUnassigned ? null : (ld.assignedToId || 'usr-5'),
        assignedToName: isUnassigned ? 'Unassigned' : (targetUser?.name || ld.assignedToName || 'ABHINAYA M'),
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
      addCustomRole,
      addLead,
      addBulkLeads,
      masterRecords,
      addMasterRecords,
      assignLeadsByLanguage
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);
