import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

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
    referredBy: 'Priya Nair (TL-201)',
    documents: [
      {
        id: 'doc-1',
        documentTypeId: 'doctype-1',
        documentName: 'Aadhar Card',
        fileName: 'ABHINAYA_Aadhar_Card.pdf',
        fileType: 'application/pdf',
        fileSize: '310 KB',
        fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDM4L0ZpbHRlci9GbGF0ZURlY29kZT4+c3RyZWFtCnicK8nILFZwSSxJVSjJSFXILU5N1csq1ncNCnAN1HMNAABl/Ag8CmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NS4yOCAxMDAuMDBdL1Jlc291cmNlczw8L1Byb2NTZXRbL1BERi9UZXh0XT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEzNCAwMDAwMCBuIAowMDAwMDAwMDE2IDAwMDAwIG4gCjAwMDAwMDAyNTIgMDAwMDAgbiAKMDAwMDAwMDI5NyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDMgMCBSPj4Kc3RhcnR4cmVmCjM1OQolJUVPRg==',
        uploadedAt: '2026-09-21 11:15'
      },
      {
        id: 'doc-2',
        documentTypeId: 'doctype-3',
        documentName: '10th Marks Card',
        fileName: 'ABHINAYA_10th_Marks_Card.pdf',
        fileType: 'application/pdf',
        fileSize: '420 KB',
        fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDM4L0ZpbHRlci9GbGF0ZURlY29kZT4+c3RyZWFtCnicK8nILFZwSSxJVSjJSFXILU5N1csq1ncNCnAN1HMNAABl/Ag8CmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NS4yOCAxMDAuMDBdL1Jlc291cmNlczw8L1Byb2NTZXRbL1BERi9UZXh0XT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEzNCAwMDAwMCBuIAowMDAwMDAwMDE2IDAwMDAwIG4gCjAwMDAwMDAyNTIgMDAwMDAgbiAKMDAwMDAwMDI5NyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDMgMCBSPj4Kc3RhcnR4cmVmCjM1OQolJUVPRg==',
        uploadedAt: '2026-09-21 11:20'
      }
    ]
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
    referredBy: 'Priya Nair (TL-201)',
    documents: [
      {
        id: 'doc-3',
        documentTypeId: 'doctype-1',
        documentName: 'Aadhar Card',
        fileName: 'AJAY_Aadhar_Card.pdf',
        fileType: 'application/pdf',
        fileSize: '245 KB',
        fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDM4L0ZpbHRlci9GbGF0ZURlY29kZT4+c3RyZWFtCnicK8nILFZwSSxJVSjJSFXILU5N1csq1ncNCnAN1HMNAABl/Ag8CmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NS4yOCAxMDAuMDBdL1Jlc291cmNlczw8L1Byb2NTZXRbL1BERi9UZXh0XT4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEzNCAwMDAwMCBuIAowMDAwMDAwMDE2IDAwMDAwIG4gCjAwMDAwMDAyNTIgMDAwMDAgbiAKMDAwMDAwMDI5NyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDMgMCBSPj4Kc3RhcnR4cmVmCjM1OQolJUVPRg==',
        uploadedAt: '2026-09-20 14:30'
      },
      {
        id: 'doc-4',
        documentTypeId: 'doctype-2',
        documentName: 'PAN Card',
        fileName: 'AJAY_PAN_Card.png',
        fileType: 'image/png',
        fileSize: '118 KB',
        fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        uploadedAt: '2026-09-20 14:32'
      }
    ]
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

const DEFAULT_LEAD_REQUESTS = [
  {
    id: 'req-101',
    requestedByUserId: 'usr-6',
    requestedByName: 'AJAY',
    role: 'Executive',
    team: 'Team Alpha',
    language: 'Hindi',
    quantity: 30,
    date: '2026-09-18',
    status: 'Pending',
    note: 'High activity day; need extra Hindi leads.'
  },
  {
    id: 'req-102',
    requestedByUserId: 'usr-4',
    requestedByName: 'Priya Nair',
    role: 'Team Leader',
    team: 'Sales Team South',
    language: 'English',
    quantity: 50,
    date: '2026-09-19',
    status: 'Pending',
    note: 'Inbound requests from new campaign.'
  }
];

const DEFAULT_ASSIGNMENT_INSTANCES = [
  {
    id: 'inst-101',
    sourceFileName: 'Pan_India_Master_Leads_Sept.xlsx',
    batchName: 'Hindi_North_Leads_Batch_01.xlsx',
    assignedBy: 'Srinivas R',
    assignedToId: 'usr-7',
    assignedToName: 'AKSHATA',
    team: 'Sales Team North',
    language: 'Hindi',
    date: '2026-09-04',
    totalLeads: 2,
    leadIds: ['LD-1001', 'LD-1005'],
    status: 'Active'
  },
  {
    id: 'inst-102',
    sourceFileName: 'Q3_Corporate_MultiLang_Dump.csv',
    batchName: 'English_Corporate_Campaign.csv',
    assignedBy: 'Srinivas R',
    assignedToId: 'usr-5',
    assignedToName: 'ABHINAYA M',
    team: 'Corporate Accounts',
    language: 'English',
    date: '2026-09-02',
    totalLeads: 1,
    leadIds: ['LD-1002'],
    status: 'Active'
  },
  {
    id: 'inst-103',
    sourceFileName: 'Western_State_Consolidated.xlsx',
    batchName: 'Marathi_Regional_Leads.xlsx',
    assignedBy: 'Srinivas R',
    assignedToId: 'usr-6',
    assignedToName: 'AJAY',
    team: 'West Zone Team',
    language: 'Marathi',
    date: '2026-09-03',
    totalLeads: 1,
    leadIds: ['LD-1003'],
    status: 'Active'
  }
];

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(localStorage.getItem('crm_token') || '');
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('crm_user') || 'null'));
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

  const isShortcutEnabled = (userId, dispositionId) => {
    if (!userId) return true;
    const entry = userShortcutSettings.find(s => s.userId === userId && s.dispositionId === dispositionId);
    return entry ? entry.isEnabled : true;
  };

  const setUserShortcut = (userId, dispositionId, isEnabled) => {
    if (!userId) return;
    setUserShortcutSettings(prev => {
      const idx = prev.findIndex(s => s.userId === userId && s.dispositionId === dispositionId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isEnabled };
        return updated;
      }
      return [...prev, { userId, dispositionId, isEnabled }];
    });
  };

  const toggleUserShortcut = (userId, dispositionId) => {
    const current = isShortcutEnabled(userId, dispositionId);
    setUserShortcut(userId, dispositionId, !current);
  };

  const [leads, setLeads] = useState(DEFAULT_LEADS);
  const [sales, setSales] = useState(DEFAULT_SALES);
  const [dispositions, setDispositions] = useState(DEFAULT_DISPOSITIONS);
  const [leadRequests, setLeadRequests] = useState(DEFAULT_LEAD_REQUESTS);
  const [assignmentInstances, setAssignmentInstances] = useState(DEFAULT_ASSIGNMENT_INSTANCES);
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
      const [uRes, lRes, sRes, dRes, rRes, dtRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/leads`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/sales`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/dispositions`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/custom-roles`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/document-types`, { headers: authHeaders() })
      ]);

      if (uRes.ok) setUsers(await uRes.json());
      if (lRes.ok) setLeads(await lRes.json());
      if (sRes.ok) setSales(await sRes.json());
      if (dRes.ok) setDispositions(await dRes.json());
      if (rRes.ok) setCustomRoles(await rRes.json());
      if (dtRes.ok) setDocumentTypes(await dtRes.json());
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
      employeeId: userData.employeeId || ('EMP-' + Math.floor(100 + Math.random() * 900))
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
    const langKey = (language || '').toLowerCase();

    setLeads(prev => {
      let count = 0;
      const updated = prev.map(l => {
        if ((l.language || '').toLowerCase() === langKey && (l.isUnassigned || !l.assignedToId || l.assignedToName === 'Unassigned') && count < numToAssign) {
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
      });

      if (count < numToAssign) {
        const remaining = numToAssign - count;
        const newLeads = Array.from({ length: remaining }).map((_, i) => ({
          id: 'LD-' + Math.floor(2000 + Math.random() * 8000 + i),
          clientName: `${language} Client ${Math.floor(100 + Math.random() * 900)}`,
          contactPerson: `Lead Contact ${Math.floor(10 + Math.random() * 90)}`,
          phone: '+91 9' + Math.floor(100000000 + Math.random() * 900000000),
          language: language,
          assignedToId: targetUser.id,
          assignedToName: targetUser.name,
          isUnassigned: false,
          disposition: 'New Lead',
          dispositionScheduledAt: '',
          value: '₹' + (Math.floor(3 + Math.random() * 15)) + ',00,000',
          history: [{ date: todayStr, text: `Fulfilled and assigned to ${targetUser.name} (${targetUser.role}) via Inbound Lead Request.` }]
        }));
        return [...newLeads, ...updated];
      }

      return updated;
    });

    return numToAssign;
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

  const reassignLeadsFiltered = ({ fromUserId, toUserId, quantity, language, date }) => {
    const targetUser = users.find(u => u.id === toUserId);
    if (!targetUser) return 0;
    const numToAssign = quantity ? parseInt(quantity, 10) : Infinity;
    const todayStr = new Date().toISOString().split('T')[0];

    let count = 0;
    setLeads(prev => prev.map(l => {
      if (count >= numToAssign) return l;
      if (fromUserId && fromUserId !== 'ALL' && l.assignedToId !== fromUserId) return l;
      if (language && language !== 'ALL' && (l.language || '').toLowerCase() !== language.toLowerCase()) return l;
      if (date) {
        const hasMatchingDate = (l.history || []).some(h => (h.date || '').includes(date)) || 
                                (l.date && String(l.date).includes(date)) ||
                                (l.assignedDate && String(l.assignedDate).includes(date));
        if (!hasMatchingDate) return l;
      }

      count++;
      const newHistory = [
        ...(l.history || []),
        { date: todayStr, text: `Reassigned to ${targetUser.name} (${targetUser.role}) via Protocol [Qty: ${quantity || 'All'}, Lang: ${language || 'All'}, Date: ${date || 'Any'}].` }
      ];
      return {
        ...l,
        assignedToId: targetUser.id,
        assignedToName: targetUser.name,
        history: newHistory
      };
    }));

    return count;
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
          assignedToName: targetUser.name,
          history: [...(l.history || []), { date: todayStr, text: `Granularly reassigned to ${targetUser.name} by Super Admin` }]
        };
      }
      return l;
    }));
  };

  const granularDeleteLeads = (leadIds) => {
    const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
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
      userShortcutSettings,
      isShortcutEnabled,
      setUserShortcut,
      toggleUserShortcut
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);

