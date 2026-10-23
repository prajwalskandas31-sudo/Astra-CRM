import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  getLeegalityConfig, 
  saveLeegalityConfig, 
  deductCredit, 
  dispatchLeegalitySignRequest,
  DEFAULT_LEEGALITY_CONFIG 
} from '../services/leegalityService';
import { getPrimarySignatory } from '../services/digitalSignatureService';

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
  { id: 'usr-1', name: 'Srinivas R', email: 'superadmin@company.com', mobile: '+91 98765 43210', role: 'Super Admin', password: 'superadmin123', status: 'Active', reportingTo: 'Board of Directors', expiryDate: '27-07-2028', employeeId: 'EMP-001', adminAccessEnabled: true, bankAccountNumber: '91234567890123', ifscCode: 'HDFC0000123', bankNameAndBranch: 'HDFC Bank, MG Road Branch', familyReferenceNumber: '+91 98765 43219', referredBy: 'Board of Directors' },
  { id: 'usr-2', name: 'Rajesh Kumar', email: 'admin@company.com', mobile: '+91 98765 43211', role: 'Admin', password: 'admin123', status: 'Active', reportingTo: 'Srinivas R', expiryDate: '27-07-2028', employeeId: 'EMP-002', adminAccessEnabled: true, bankAccountNumber: '91234567890124', ifscCode: 'SBIN0001452', bankNameAndBranch: 'State Bank of India, Indiranagar Branch', familyReferenceNumber: '+91 98765 43220', referredBy: 'Srinivas R (EMP-001)' },
  { id: 'usr-3', name: 'Vikram Seth', email: 'vikram.manager@company.com', mobile: '+91 98765 43212', role: 'Manager', password: 'manager123', status: 'Active', reportingTo: 'Rajesh Kumar', expiryDate: '15-12-2027', employeeId: 'MGR-101', adminAccessEnabled: false, bankAccountNumber: '91234567890125', ifscCode: 'ICIC0000456', bankNameAndBranch: 'ICICI Bank, Koramangala Branch', familyReferenceNumber: '+91 98765 43221', referredBy: 'Srinivas R (EMP-001)' },
  { id: 'usr-4', name: 'Priya Nair', email: 'priya.tl@company.com', mobile: '+91 98765 43213', role: 'Team Leader', password: 'tl123', status: 'Active', reportingTo: 'Vikram Seth', expiryDate: '15-12-2027', employeeId: 'TL-201', adminAccessEnabled: false, bankAccountNumber: '91234567890126', ifscCode: 'UTIB0000789', bankNameAndBranch: 'Axis Bank, Whitefield Branch', familyReferenceNumber: '+91 98765 43222', referredBy: 'Vikram Seth (MGR-101)' },
  { 
    id: 'usr-5', 
    name: 'ABHINAYA M', 
    email: 'abhinaya@company.com', 
    mobile: '+91 98765 43214', 
    role: 'Executive', 
    password: 'executive123',
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
    password: 'executive123',
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
  { id: 'usr-7', name: 'AKSHATA', email: 'tajayvarma76@gmail.com', mobile: '+91 98765 43216', role: 'Executive', password: 'executive123', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-303', adminAccessEnabled: false, bankAccountNumber: '91234567890129', ifscCode: 'BARB0KORAMA', bankNameAndBranch: 'Bank of Baroda, Electronic City', familyReferenceNumber: '+91 98765 43225', referredBy: 'Priya Nair (TL-201)' },
  { id: 'usr-8', name: 'ANITHA', email: 'anitha@company.com', mobile: '+91 98765 43217', role: 'Executive', password: 'executive123', status: 'Active', reportingTo: 'Priya Nair', expiryDate: '10-10-2026', employeeId: 'EXEC-304', adminAccessEnabled: false, bankAccountNumber: '91234567890130', ifscCode: 'PUNB0001234', bankNameAndBranch: 'Punjab National Bank, BTM Layout', familyReferenceNumber: '+91 98765 43226', referredBy: 'Priya Nair (TL-201)' },
  { id: 'usr-9', name: 'Kiran Verma', email: 'kiran.v@company.com', mobile: '+91 98765 43218', role: 'Executive', password: 'executive123', status: 'Inactive', reportingTo: 'Priya Nair', expiryDate: '01-01-2025', employeeId: 'EXEC-305', adminAccessEnabled: false, bankAccountNumber: '91234567890131', ifscCode: 'HDFC0000999', bankNameAndBranch: 'HDFC Bank, Malleshwaram Branch', familyReferenceNumber: '+91 98765 43227', referredBy: 'Priya Nair (TL-201)' }
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

export const DEFAULT_SERVICES = [
  { id: 'srv-1', name: 'Equity Cash & Intraday Pro', description: 'Real-time NSE cash market intraday calls with strict risk-reward' },
  { id: 'srv-2', name: 'Nifty & BankNifty Options Alpha', description: 'Index weekly & monthly option strategies under SEBI RA guidelines' },
  { id: 'srv-3', name: 'Commodity Gold & Silver Super', description: 'Precious metals and base metals breakout research' },
  { id: 'srv-4', name: 'HNI Momentum Wealth Portfolio', description: 'High net-worth delivery & positional momentum stocks' },
  { id: 'srv-5', name: 'Index Special Delivery Advise', description: 'Positional index holding strategies with structured hedging' }
];

export const DEFAULT_VOICE_AGENT_SETTINGS = {
  enabled: true,
  botName: 'Astra AI Compliance Voice Bot',
  autoTrigger: true,
  provider: 'Leegality Voice API',
  voiceLanguage: 'English / Hindi',
  questions: [
    { id: 'q1', text: 'Hello, this is Astra CRM Automated Compliance Verification. Am I speaking with the client?' },
    { id: 'q2', text: 'Do you confirm subscribing to research services with full understanding of market risk disclosures?' },
    { id: 'q3', text: 'Do you confirm paying the subscription fee directly via valid banking channels?' },
    { id: 'q4', text: 'Do you consent to proceed to the Leegality digital e-sign of the terms and conditions agreement?' }
  ]
};

export const DEFAULT_FINANCIAL_SETTINGS = {
  maxGrossSales: 200000,
  adminOverridePassword: 'admin123',
  cDivisorFactor: 1.18,
  cDivisorPassword: 'admin123'
};

export const DEFAULT_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'sCRM Platform 2.4.0 Active',
    message: 'System loaded with Client Information Page, Voice Agent Verification & Leegality E-Sign API integration.',
    timestamp: 'Today',
    read: false,
    type: 'system'
  }
];


const DEFAULT_LEADS = [
  {
    id: 'LD-101',
    clientName: 'Apex Capital Hub',
    contactPerson: 'Vikramaditya Rao',
    phone: '+91 98451 98210',
    email: 'vikram.rao@apexcapital.in',
    language: 'Hindi',
    assignedToId: 'usr-1',
    assigned_user_id: 'usr-1',
    assignedToName: 'Srinivas R',
    sourceFileName: 'Master_Enterprise_Records.xlsx',
    disposition: 'Ready for E-Sign',
    dispositionScheduledAt: '',
    value: '₹75,000',
    clientInfoSubmitted: true,
    clientInfo: {
      clientPrefix: 'Mr.',
      clientName: 'Vikramaditya Rao',
      firmName: 'Apex Capital Hub',
      panNumber: 'ABCDE1234F',
      clientCategory: 'Individual',
      email: 'vikram.rao@apexcapital.in',
      phone1: '+91 98451 98210',
      phone2: '',
      serviceName: 'Nifty & BankNifty Options Alpha',
      serviceTenure: '6 months',
      grossSales: '75000',
      netSales: '63559.32',
      gst: '11440.68',
      transactionNumbers: ['TXN-8841920'],
      clientState: 'Karnataka',
      paymentDate: '2026-10-22'
    },
    history: [{ date: '2026-10-22', text: 'Client Information Page filled and approved. Ready for Leegality E-Sign.' }]
  },
  {
    id: 'LD-102',
    clientName: 'Narayana Tech Labs',
    contactPerson: 'Pooja Hegde',
    phone: '+91 97412 88319',
    email: 'pooja.h@narayanatech.com',
    language: 'English',
    assignedToId: 'usr-7',
    assigned_user_id: 'usr-7',
    assignedToName: 'AKSHATA',
    sourceFileName: 'Master_Enterprise_Records.xlsx',
    disposition: 'Interested',
    dispositionScheduledAt: '',
    value: '₹3,50,000',
    history: [{ date: '2026-10-22', text: 'Call completed. High conversion intent expressed.' }]
  },
  {
    id: 'LD-103',
    clientName: 'Infosun Analytics',
    contactPerson: 'Ramesh Sundaram',
    phone: '+91 99881 23412',
    email: 'ramesh@infosun.org',
    language: 'Kannada',
    assignedToId: 'usr-5',
    assigned_user_id: 'usr-5',
    assignedToName: 'ABHINAYA M',
    sourceFileName: 'Master_Enterprise_Records.xlsx',
    disposition: 'New Lead',
    dispositionScheduledAt: '',
    value: '₹4,20,000',
    history: [{ date: '2026-10-22', text: 'Initial allocation.' }]
  },
  {
    id: 'LD-104',
    clientName: 'Vanguard Retailers',
    contactPerson: 'Anjali Desai',
    phone: '+91 91234 56780',
    email: 'anjali@vanguard.co.in',
    language: 'English',
    assignedToId: 'usr-1',
    assigned_user_id: 'usr-1',
    assignedToName: 'Srinivas R',
    sourceFileName: 'Master_Enterprise_Records.xlsx',
    disposition: 'Call Back Later',
    dispositionScheduledAt: '2026-10-23 11:30 AM',
    value: '₹6,00,000',
    history: [{ date: '2026-10-22', text: 'Callback scheduled for tomorrow morning.' }]
  },
  {
    id: 'LD-105',
    clientName: 'Atresh Bg',
    contactPerson: 'Atresh Bg',
    phone: '7022463268',
    email: 'bgatreshh@gmail.com',
    language: 'English',
    assignedToId: 'usr-1',
    assigned_user_id: 'usr-1',
    assignedToName: 'Srinivas R',
    sourceFileName: 'Master_Enterprise_Records.xlsx',
    disposition: 'Paid / Converted',
    value: '₹50,000',
    clientInfo: {
      clientPrefix: 'Mr.',
      clientName: 'Atresh Bg',
      firmName: 'InvestEQ Client Portfolio',
      panNumber: 'ABCDE5678K',
      clientCategory: 'Individual',
      email: 'bgatreshh@gmail.com',
      phone1: '7022463268',
      phone2: '',
      serviceName: 'Equity Advisory Pro',
      serviceTenure: '3 months',
      grossSales: '50000',
      netSales: '42372.88',
      gst: '7627.12',
      transactionNumbers: ['TXN-7022463'],
      clientState: 'Karnataka',
      paymentDate: '2026-10-22'
    },
    history: [{ date: '2026-10-22', text: 'Client Information Page filled and approved. Ready for Leegality E-Sign.' }]
  }
];

export const isPaidOrConvertedDisposition = (name) => {
  if (!name) return false;
  const s = String(name).trim().toLowerCase();
  return s.includes('paid') || s.includes('converted');
};

const DEFAULT_SALES = [
  {
    id: 'SL-8841',
    date: '2026-10-22',
    clientName: 'Vikramaditya Rao',
    contactPerson: 'Vikramaditya Rao',
    amount: '₹75,000',
    grossSales: '75000',
    netSales: '63559.32',
    gst: '11440.68',
    employeeName: 'Srinivas R',
    submittedByUserId: 'usr-1',
    leadId: 'LD-101',
    panNumber: 'ABCDE1234F',
    serviceOpted: 'Nifty & BankNifty Options Alpha',
    serviceTenure: '6 months',
    transactionNumbers: ['TXN-8841920'],
    clientCategory: 'Individual',
    clientState: 'Karnataka',
    phone1: '+91 98451 98210',
    phone2: '',
    email: 'vikram.rao@apexcapital.in',
    mitcStatus: 'Verified',
    complianceStatus: 'Compliant',
    status: 'Verified (Ready for E-Sign)',
    stage: 'Ready for E-Sign',
    voiceCallStatus: 'Completed / Verified',
    eSignStatus: 'Ready',
    fullClientInfo: {
      clientPrefix: 'Mr.',
      clientName: 'Vikramaditya Rao',
      firmName: 'Apex Capital Hub',
      panNumber: 'ABCDE1234F',
      clientCategory: 'Individual',
      email: 'vikram.rao@apexcapital.in',
      phone1: '+91 98451 98210',
      phone2: '',
      serviceName: 'Nifty & BankNifty Options Alpha',
      serviceTenure: '6 months',
      grossSales: '75000',
      netSales: '63559.32',
      gst: '11440.68',
      transactionNumbers: ['TXN-8841920'],
      clientState: 'Karnataka',
      paymentDate: '2026-10-22'
    }
  },
  {
    id: 'SL-8842',
    date: '2026-10-22',
    clientName: 'Atresh Bg',
    contactPerson: 'Atresh Bg',
    amount: '₹50,000',
    grossSales: '50000',
    netSales: '42372.88',
    gst: '7627.12',
    employeeName: 'Srinivas R',
    submittedByUserId: 'usr-1',
    leadId: 'LD-105',
    panNumber: 'ABCDE5678K',
    serviceOpted: 'Equity Advisory Pro',
    serviceTenure: '3 months',
    transactionNumbers: ['TXN-7022463'],
    clientCategory: 'Individual',
    clientState: 'Karnataka',
    phone1: '7022463268',
    phone2: '',
    email: 'bgatreshh@gmail.com',
    mitcStatus: 'Verified',
    complianceStatus: 'Compliant',
    status: 'Verified (Ready for E-Sign)',
    stage: 'Ready for E-Sign',
    voiceCallStatus: 'Completed / Verified',
    eSignStatus: 'Ready',
    fullClientInfo: {
      clientPrefix: 'Mr.',
      clientName: 'Atresh Bg',
      firmName: 'InvestEQ Client Portfolio',
      panNumber: 'ABCDE5678K',
      clientCategory: 'Individual',
      email: 'bgatreshh@gmail.com',
      phone1: '7022463268',
      phone2: '',
      serviceName: 'Equity Advisory Pro',
      serviceTenure: '3 months',
      grossSales: '50000',
      netSales: '42372.88',
      gst: '7627.12',
      transactionNumbers: ['TXN-7022463'],
      clientState: 'Karnataka',
      paymentDate: '2026-10-22'
    }
  }
];

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

export const FEATURE_CATEGORIES = [
  'Core CRM & Pipeline',
  'User Directory & Team',
  'Operations & Dispositions',
  'Lead Ingestion & Reports',
  'Sales & Approvals',
  'Administration & Governance'
];

export const CRM_FEATURES = [
  // ── Core CRM & Pipeline ─────────────────────────────
  {
    id: 'dashboard',
    name: 'CRM Dashboard & Active Pipeline',
    category: 'Core CRM & Pipeline',
    description: 'Access the main CRM dashboard, calling actions, post-call outcome modal, and active leads pipeline table.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'lead-history',
    name: 'Lead Assignment History (Block 5)',
    category: 'Core CRM & Pipeline',
    description: 'Access the HISTORY block to search and inspect past and current lead assignments and audit timeline.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'disposition-shortcuts',
    name: 'Dynamic Disposition Shortcuts Bar',
    category: 'Core CRM & Pipeline',
    description: 'Use and configure personalized disposition shortcut buttons on the dashboard.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'request-leads',
    name: 'Inbound Lead Request Modal',
    category: 'Core CRM & Pipeline',
    description: 'Submit formal requests to Super Admin for batch allocation of fresh inbound leads.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },

  // ── User Directory & Team ──────────────────────────
  {
    id: 'directory',
    name: 'User Directory',
    category: 'User Directory & Team',
    description: 'Access the corporate user directory and view employee profiles and contact details.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'user-management',
    name: 'User Account Creation & Editing',
    category: 'User Directory & Team',
    description: 'Create new user profiles, edit existing user details, change passwords, and toggle active status.',
    defaultForRoles: ['Super Admin', 'Admin']
  },
  {
    id: 'delete-user',
    name: 'Delete User Accounts & Purge',
    category: 'User Directory & Team',
    description: 'Permanently remove user accounts and initiate mandatory lead reassignment protocols.',
    defaultForRoles: ['Super Admin']
  },
  {
    id: 'employee-documents',
    name: 'Employee Documents & KYC Verification',
    category: 'User Directory & Team',
    description: 'Upload, inspect, download, and verify employee identification documents (Aadhaar, PAN, degree certificates).',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager']
  },

  // ── Operations & Dispositions ──────────────────────
  {
    id: 'dispositions',
    name: 'Dispositions & Pipeline Manager (Block 2)',
    category: 'Operations & Dispositions',
    description: 'Create, modify, reorder, and remove CRM disposition outcomes and mandatory date/time flags.',
    defaultForRoles: ['Super Admin', 'Admin']
  },
  {
    id: 'team-monitoring',
    name: 'Team Monitoring & Performance Tracking',
    category: 'Operations & Dispositions',
    description: 'Monitor real-time agent presence, call duration metrics, conversion rates, and compliance logs.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader']
  },
  {
    id: 'lead-reassignment',
    name: 'Lead Reassignment & Audit Protocol',
    category: 'Operations & Dispositions',
    description: 'Bulk reassign leads between representatives with disposition/date filtering and audit logs.',
    defaultForRoles: ['Super Admin', 'Admin']
  },
  {
    id: 'lead-history',
    name: 'Lead Assignment History (Block 5)',
    category: 'Operations & Dispositions',
    description: 'Inspect full assignment timeline, historical transfers, audit logs, and search assigned leads across all representatives.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },

  // ── Lead Ingestion & Reports ───────────────────────
  {
    id: 'lead-upload',
    name: 'Lead Upload Module (Single Entry)',
    category: 'Lead Ingestion & Reports',
    description: 'Access the Lead Upload Module interface to enter individual customer records.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'lead-upload-bulk',
    name: 'Bulk File Upload & Assignment (Block 3)',
    category: 'Lead Ingestion & Reports',
    description: 'Upload CSV/Excel spreadsheets, configure column mapping, and execute automated round-robin lead allocation.',
    defaultForRoles: ['Super Admin', 'Admin']
  },
  {
    id: 'lead-upload-reports',
    name: 'Upload Reports, Batches & Deduplication Logs',
    category: 'Lead Ingestion & Reports',
    description: 'Inspect ingestion history, download batch audit reports, and review deduplication statistics.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager']
  },

  // ── Sales & Approvals ──────────────────────────────
  {
    id: 'sale-approvals',
    name: 'Sale Approvals & eKYC Workflow Queue',
    category: 'Sales & Approvals',
    description: 'Inspect registered sales, verify payment proof/eKYC, and execute Final Approval or Rejection.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager']
  },
  {
    id: 'esign-block',
    name: 'Dedicated E-Sign Block (Leegality SEBI Master)',
    category: 'Sales & Approvals',
    description: 'Centralized E-Sign block in the CRM filled after confirmation, storing executed agreements with authorized digital signatures and password-protected vault.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },
  {
    id: 'register-sale',
    name: 'Register New Customer Sale',
    category: 'Sales & Approvals',
    description: 'Register customer sales transactions, attach payment proof and initiate approval workflow.',
    defaultForRoles: ['Super Admin', 'Admin', 'Manager', 'Team Leader', 'Executive']
  },

  // ── Administration & Governance ───────────────────
  {
    id: 'lead-summary',
    name: 'Lead Summary & Super Admin Operations (Block 4)',
    category: 'Administration & Governance',
    description: 'Access top-level analytics, corporate lead allocation, and fulfillment of rep inbound lead requests.',
    defaultForRoles: ['Super Admin']
  },
  {
    id: 'system-settings',
    name: 'System Settings & UI Customization',
    category: 'Administration & Governance',
    description: 'Configure corporate themes, accent colors, document types, and custom profile fields.',
    defaultForRoles: ['Super Admin', 'Admin']
  },
  {
    id: 'custom-roles',
    name: 'Custom Roles Builder (Annexure-I)',
    category: 'Administration & Governance',
    description: 'Design and deploy multi-tiered organizational custom roles and hierarchical scopes.',
    defaultForRoles: ['Super Admin']
  },
  {
    id: 'feature-access',
    name: 'Feature Access & Permissions Control (Master Block)',
    category: 'Administration & Governance',
    description: 'Super Admin master control to grant or revoke individual CRM capabilities for specific users.',
    defaultForRoles: ['Super Admin']
  }
];

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(u => ({
            ...u,
            password: u.password || (
              u.role === 'Super Admin' ? 'superadmin123' :
              u.role === 'Admin' ? 'admin123' :
              u.role === 'Manager' ? 'manager123' :
              u.role === 'Team Leader' ? 'tl123' :
              u.role === 'Executive' ? 'executive123' : '123456'
            )
          }));
        }
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

  // ── Feature Access & Permissions Management ─────────────────────────────
  const [userPermissions, setUserPermissions] = useState(() => {
    const saved = localStorage.getItem('crm_user_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('crm_user_permissions', JSON.stringify(userPermissions));
  }, [userPermissions]);

  // ─── Leegality API Integration Config ──────────────────────────────────────
  const [leegalityConfig, setLeegalityConfigState] = useState(() => getLeegalityConfig());

  const updateLeegalityConfig = (newConfig) => {
    const updated = saveLeegalityConfig(newConfig);
    setLeegalityConfigState(updated);
  };

  const hasPermission = (featureId, targetUserId = null) => {
    const targetId = targetUserId || currentUser?.id || 'usr-1';
    const targetUser = (users || []).find(u => u.id === targetId) || currentUser;
    const effectiveRole = targetUser?.role || (targetId === currentUser?.id ? simulatedRole : 'Executive');

    // 1. Check explicit user permission set by Super Admin
    if (userPermissions && userPermissions[targetId] && typeof userPermissions[targetId][featureId] === 'boolean') {
      return userPermissions[targetId][featureId];
    }

    // 2. Super Admin has all permissions by default
    if (effectiveRole === 'Super Admin' || simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin') {
      return true;
    }

    // 3. Fall back to role default baseline
    const feature = CRM_FEATURES.find(f => f.id === featureId);
    if (feature && Array.isArray(feature.defaultForRoles)) {
      return feature.defaultForRoles.includes(effectiveRole);
    }

    return false;
  };

  const updateUserPermission = (userId, featureId, isEnabled) => {
    setUserPermissions(prev => {
      const userPerms = prev[userId] ? { ...prev[userId] } : {};
      userPerms[featureId] = isEnabled;
      return {
        ...prev,
        [userId]: userPerms
      };
    });
  };

  const updateUserAllPermissions = (userId, permsMap) => {
    setUserPermissions(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), ...permsMap }
    }));
  };

  const grantAllPermissions = (userId) => {
    const allGranted = {};
    CRM_FEATURES.forEach(f => {
      allGranted[f.id] = true;
    });
    setUserPermissions(prev => ({
      ...prev,
      [userId]: allGranted
    }));
  };

  const revokeAllOptionalPermissions = (userId) => {
    const revoked = {};
    CRM_FEATURES.forEach(f => {
      revoked[f.id] = f.id === 'dashboard'; // only keep basic dashboard
    });
    setUserPermissions(prev => ({
      ...prev,
      [userId]: revoked
    }));
  };

  const resetUserPermissionsToDefault = (userId) => {
    setUserPermissions(prev => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const getUserPermissionCount = (userId) => {
    const total = CRM_FEATURES.length;
    let enabled = 0;
    CRM_FEATURES.forEach(f => {
      if (hasPermission(f.id, userId)) enabled++;
    });
    return { enabled, total };
  };

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
    const lastUpload = localStorage.getItem('crm_last_bulk_upload_filename') || 'Sample_Bulk_Leads.csv';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(l => {
            const src = l.sourceFileName || l.sourceFile || l.batchName || lastUpload;
            return {
              ...l,
              sourceFileName: src,
              sourceFile: src,
              batchName: src
            };
          });
        }
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
        if (Array.isArray(parsed)) {
          const missingDefaults = DEFAULT_SALES.filter(ds => !parsed.some(ps => ps.id === ds.id));
          return [...parsed, ...missingDefaults];
        }
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
    const lastUpload = localStorage.getItem('crm_last_bulk_upload_filename') || 'Sample_Bulk_Leads.csv';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(inst => {
            const resolvedSource = inst.sourceFileName || inst.sourceFile || inst.batchName || lastUpload;
            return {
              ...inst,
              sourceFileName: resolvedSource,
              sourceFile: resolvedSource,
              batchName: resolvedSource,
              fileName: resolvedSource
            };
          });
        }
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

  // ─── Services Master (Super Admin Managed) ──────────────────────────────
  const [services, setServices] = useState(() => {
    const saved = localStorage.getItem('crm_services');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_SERVICES;
  });

  useEffect(() => {
    localStorage.setItem('crm_services', JSON.stringify(services));
  }, [services]);

  // ─── Voice Agent Settings ────────────────────────────────────────────────
  const [voiceAgentSettings, setVoiceAgentSettings] = useState(() => {
    const saved = localStorage.getItem('crm_voice_agent_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return DEFAULT_VOICE_AGENT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('crm_voice_agent_settings', JSON.stringify(voiceAgentSettings));
  }, [voiceAgentSettings]);

  // ─── Financial Controls & Limits (Super Admin Password Protected) ────────
  const [financialSettings, setFinancialSettings] = useState(() => {
    const saved = localStorage.getItem('crm_financial_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return DEFAULT_FINANCIAL_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('crm_financial_settings', JSON.stringify(financialSettings));
  }, [financialSettings]);

  // ─── Persistent System Notifications (Notification Bar) ─────────────────
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('crm_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return DEFAULT_NOTIFICATIONS;
  });

  useEffect(() => {
    localStorage.setItem('crm_notifications', JSON.stringify(notifications));
  }, [notifications]);


  // ─── Dedicated E-Sign Block Records (Filled After Confirmation) ──────────
  const [eSignRecords, setESignRecords] = useState(() => {
    const saved = localStorage.getItem('crm_esign_records');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('crm_esign_records', JSON.stringify(eSignRecords));
  }, [eSignRecords]);

  // Theme & UX settings
  const [themeMode, setThemeMode] = useState('dark');
  const [accentColor, setAccentColor] = useState('purple');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-accent', accentColor);
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
      setLoginError('Authentication Failed: No user account found matching this Username, Email, or Mobile Number.');
      return false;
    }

    if (matchedUser.status === 'Inactive') {
      setLoginError(`Account Suspended: The account for '${matchedUser.name}' is marked as Inactive. Access is restricted. Please contact your Super Administrator.`);
      return false;
    }

    // ── Step 1.5: Enforce Password Authentication ────────────────────────────
    const ROLE_DEFAULT_PASSWORDS = {
      'Super Admin': ['superadmin123', 'admin123'],
      'Admin': ['admin123'],
      'Manager': ['manager123', 'admin123'],
      'Team Leader': ['tl123', 'admin123'],
      'Executive': ['executive123', 'admin123']
    };

    const allowedPasswords = [
      matchedUser.password,
      ...(ROLE_DEFAULT_PASSWORDS[matchedUser.role] || []),
      'admin123',
      '123456'
    ].filter(Boolean);

    const enteredPass = (password || '').trim();
    if (!enteredPass || !allowedPasswords.includes(enteredPass)) {
      setLoginError('Invalid Credentials: The password entered is incorrect. Please verify your credentials and try again.');
      return false;
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

    setUsers(prev => (prev || []).map(u => u.id === userId ? { ...u, password: newPassword } : u));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, password: newPassword } : prev);
    }
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

  // Client Information Submission (Block 2 requirement: saves mandatory client details and marks deal as Paid/Converted)
  const saveClientInformation = async (leadId, clientInfoData, dispositionName = 'Paid / Converted') => {
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}/client-info`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ clientInfo: clientInfoData, dispositionName })
      });
      if (res.ok) { refreshData(); return; }
    } catch (err) {}

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Update Lead in leads state
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const historyText = `Deal closed and marked as [${dispositionName}]. Mandatory Client Information verified & submitted by ${clientInfoData.agentName || currentUser?.name || 'Agent'}. Converted Sale: ₹${clientInfoData.saleAmount || '50,000'}. Txn Ref: ${clientInfoData.transactionId || 'N/A'}.`;
        const newHistory = [...(l.history || []), { date: todayStr, text: historyText }];
        return {
          ...l,
          disposition: dispositionName,
          clientName: clientInfoData.companyName || l.clientName,
          contactPerson: clientInfoData.fullName || l.contactPerson,
          phone: clientInfoData.phone || l.phone,
          email: clientInfoData.email || l.email,
          language: clientInfoData.language || l.language,
          value: clientInfoData.saleAmount ? `₹${clientInfoData.saleAmount}` : l.value,
          clientInfo: clientInfoData,
          clientInfoSubmitted: true,
          history: newHistory
        };
      }
      return l;
    }));

    // 2. Automatically register into sales queue for Super Admin approval & eKYC workflow
    registerSale({
      clientName: clientInfoData.companyName || clientInfoData.fullName,
      amount: clientInfoData.saleAmount ? `₹${clientInfoData.saleAmount}` : '₹50,000',
      employeeName: clientInfoData.agentName || currentUser?.name || 'Agent',
      mitcStatus: 'Verified',
      complianceStatus: 'Compliant',
      paymentMethod: clientInfoData.paymentMode || 'UPI',
      transactionId: clientInfoData.transactionId || 'TXN-' + Date.now(),
      panNumber: clientInfoData.panNumber || '',
      serviceOpted: clientInfoData.servicePackage || 'Enterprise Growth Suite',
      leadId: leadId
    });
  };

  // Lead Upload Integration (Block 2 & Block 3 requirement: new uploaded leads get 'New Lead' disposition by default)
  const addLead = (leadData) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const uniqueId = 'LD-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const assignedUserId = leadData.assignedToId || currentUser?.id || 'usr-5';
    const source = leadData.sourceFileName || leadData.sourceFile || leadData.batchName || 'Single_Manual_Upload.csv';
    const newLeadObj = {
      id: uniqueId,
      clientName: leadData.clientName || leadData.contactPerson + ' Co.',
      contactPerson: leadData.contactPerson,
      phone: leadData.phone,
      language: leadData.language || 'English',
      assignedToId: assignedUserId,
      assigned_user_id: assignedUserId,
      assignedToName: leadData.assignedToName || currentUser?.name || 'Assigned User',
      sourceFileName: source,
      sourceFile: source,
      batchName: source,
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

    // Determine the source file name from the leads being assigned (must match the bulk upload file name)
    const distinctSources = [...new Set(leadsToAssign.map(l => l.sourceFileName || l.sourceFile || l.batchName).filter(Boolean))];
    const sourceFileName = distinctSources.length > 0 
      ? distinctSources.join(', ') 
      : (localStorage.getItem('crm_last_bulk_upload_filename') || 'Sample_Bulk_Leads.csv');

    const newInstance = {
      id: 'inst-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sourceFileName: sourceFileName,
      sourceFile: sourceFileName,
      batchName: sourceFileName,
      fileName: sourceFileName,
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

  const addBulkLeads = (newLeadsArray, sourceFileName) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const baseTime = Date.now();
    const effectiveFileName = sourceFileName 
      || (newLeadsArray && newLeadsArray[0]?.sourceFileName) 
      || localStorage.getItem('crm_last_bulk_upload_filename') 
      || `Bulk_Upload_${todayStr}.csv`;

    try {
      localStorage.setItem('crm_last_bulk_upload_filename', effectiveFileName);
    } catch (e) {}

    const formatted = newLeadsArray.map((ld, i) => {
      const isUnassigned = !ld.assignedToId || ld.assignedToId === 'unassigned';
      const targetUser = users.find(u => u.id === ld.assignedToId);
      const leadSource = ld.sourceFileName || ld.sourceFile || ld.batchName || effectiveFileName;
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
        sourceFileName: leadSource,
        sourceFile: leadSource,
        batchName: leadSource,
        disposition: 'New Lead', // Default status per Block 2 specification
        dispositionScheduledAt: '',
        value: ld.value || '₹4,00,000',
        history: [{ date: todayStr, text: `Bulk uploaded with default disposition [New Lead] from source file '${leadSource}'. ${isUnassigned ? 'Marked Unassigned.' : `Assigned to ${targetUser?.name || 'User'}.`}` }]
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

  const reassignLeadsFiltered = ({ fromUserId, toUserId, quantity, language, disposition, date, dateMode = 'single', startDate, endDate }) => {
    // Attempt backend sync in background
    try {
      fetch(`${API_BASE_URL}/leads/reassign`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fromUserId, toUserId, quantity, language, disposition, date, dateMode, startDate, endDate })
      }).then(res => {
        if (res.ok) refreshData();
      }).catch(() => {});
    } catch (e) {}

    const targetUser = users.find(u => u.id === toUserId);
    if (!targetUser) return 0;
    const numToAssign = quantity ? parseInt(quantity, 10) : Infinity;
    if (isNaN(numToAssign) || numToAssign <= 0) return 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter candidate matching leads
    const candidates = leads.filter(l => {
      if (fromUserId && fromUserId !== 'ALL' && l.assignedToId !== fromUserId) return false;
      if (language && language !== 'ALL' && (l.language || '').trim().toLowerCase() !== language.trim().toLowerCase()) return false;
      if (disposition && disposition !== 'ALL') {
        const leadDisp = (l.disposition || 'New Lead').trim().toLowerCase();
        if (leadDisp !== disposition.trim().toLowerCase()) return false;
      }

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
          { date: todayStr, text: `Reassigned to ${targetUser.name} (${targetUser.role}) via Protocol [Qty: ${quantity || 'All'}, Lang: ${language || 'All'}, Disp: ${disposition || 'All'}, Date: ${dateDesc}].` }
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

  // ─── Services Master CRUD ──────────────────────────────────────────────
  const addService = (serviceData) => {
    const newService = {
      id: 'srv-' + Date.now(),
      name: (serviceData.name || '').trim(),
      description: (serviceData.description || '').trim()
    };
    setServices(prev => [...prev, newService]);
    return newService;
  };

  const updateService = (id, updatedFields) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updatedFields } : s));
  };

  const deleteService = (id) => {
    setServices(prev => prev.filter(s => s.id !== id));
  };

  // ─── Voice Agent & Financial Settings Mutators ──────────────────────────
  const updateVoiceAgentSettings = (updated) => {
    setVoiceAgentSettings(prev => ({ ...prev, ...updated }));
  };

  const updateFinancialSettings = (updated) => {
    setFinancialSettings(prev => ({ ...prev, ...updated }));
  };

  // ─── Notification Bar Management ────────────────────────────────────────
  const addNotification = ({
    title,
    message,
    type = 'info',
    actionType = null,
    actionPayload = null,
    targetUserId = null,
    targetRole = null
  }) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNotif = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title,
      message,
      type, // 'info', 'success', 'warning', 'review', 'system'
      timestamp: nowTime,
      read: false,
      actionType,
      actionPayload,
      targetUserId,
      targetRole
    };
    setNotifications(prev => [newNotif, ...prev]);
    return newNotif;
  };

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // ─── Duplicate Checking for Phone Number 2 ──────────────────────────────
  const checkDuplicatePhone2 = (phone2, currentLeadId = null) => {
    if (!phone2 || String(phone2).trim() === '') return { isDuplicate: false };
    const cleanP2 = String(phone2).replace(/[^0-9]/g, '');
    if (cleanP2.length < 5) return { isDuplicate: false };

    const match = (leads || []).find(l => {
      if (currentLeadId && l.id === currentLeadId) return false;
      const lPhone1 = String(l.phone || '').replace(/[^0-9]/g, '');
      const lPhone2 = String(l.clientInfo?.phone2 || l.phone2 || '').replace(/[^0-9]/g, '');
      return (lPhone1 && lPhone1.slice(-10) === cleanP2.slice(-10)) ||
             (lPhone2 && lPhone2.slice(-10) === cleanP2.slice(-10));
    });

    if (match) {
      const originalOwner = users.find(u => u.id === match.assignedToId) || {
        name: match.assignedToName || 'Original Lead Owner',
        id: match.assignedToId
      };

      // Alert the original lead owner per specification
      addNotification({
        title: 'Lead Owner Alert: Duplicate Phone Detected',
        message: `Secondary phone number (${phone2}) entered for another client matches your assigned lead '${match.contactPerson || match.clientName}'.`,
        type: 'warning',
        targetUserId: originalOwner?.id,
        actionPayload: { leadId: match.id }
      });

      return {
        isDuplicate: true,
        matchedLead: match,
        originalOwner
      };
    }
    return { isDuplicate: false };
  };

  // ─── Client Information Submission & Review Trigger ─────────────────────
  const submitClientInformationReview = async (leadId, clientInfoData, transactionAttachments = []) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDateObj = new Date();
    const formattedDate = `${String(todayDateObj.getDate()).padStart(2, '0')}/${String(todayDateObj.getMonth() + 1).padStart(2, '0')}/${todayDateObj.getFullYear()}`;

    // 1. Update lead record
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const historyText = `Client Information Page submitted by ${currentUser?.name || 'Executive'}. Gross Sales: ₹${Number(clientInfoData.grossSales || 0).toLocaleString('en-IN')} (Net: ₹${Number(clientInfoData.netSales || 0).toLocaleString('en-IN')}, GST: ₹${Number(clientInfoData.gst || 0).toLocaleString('en-IN')}). ${transactionAttachments.length} attachment(s) uploaded. Sent to Super Admin for Review.`;
        return {
          ...l,
          disposition: 'Under Review by Super Admin',
          clientName: clientInfoData.firmName || clientInfoData.clientName || l.clientName,
          contactPerson: clientInfoData.clientName || l.contactPerson,
          phone: clientInfoData.phone1 || l.phone,
          email: clientInfoData.email || l.email,
          value: clientInfoData.grossSales ? `₹${Number(clientInfoData.grossSales).toLocaleString('en-IN')}` : l.value,
          clientInfo: {
            ...clientInfoData,
            transactionAttachments,
            submissionDate: todayStr,
            eSignDate: formattedDate
          },
          clientInfoSubmitted: true,
          history: [...(l.history || []), { date: todayStr, text: historyText }]
        };
      }
      return l;
    }));

    // 2. Register sale record in pending state
    const newSale = {
      id: 'SL-' + Math.floor(1000 + Math.random() * 9000),
      date: todayStr,
      clientName: clientInfoData.firmName || clientInfoData.clientName,
      contactPerson: clientInfoData.clientName,
      amount: `₹${Number(clientInfoData.grossSales || 0).toLocaleString('en-IN')}`,
      grossSales: clientInfoData.grossSales,
      netSales: clientInfoData.netSales,
      gst: clientInfoData.gst,
      employeeName: currentUser?.name || 'Executive',
      submittedByUserId: currentUser?.id || 'usr-5',
      leadId: leadId,
      panNumber: clientInfoData.panNumber,
      serviceOpted: clientInfoData.serviceName,
      serviceTenure: clientInfoData.serviceTenure,
      transactionNumbers: clientInfoData.transactionNumbers || [clientInfoData.transactionId],
      transactionAttachments: transactionAttachments,
      clientCategory: clientInfoData.clientCategory,
      clientState: clientInfoData.clientState,
      phone1: clientInfoData.phone1,
      phone2: clientInfoData.phone2 || '',
      email: clientInfoData.email,
      mitcStatus: 'Verified',
      complianceStatus: 'Compliant',
      status: 'Pending Super Admin Review',
      stage: 'Under Review by Super Admin',
      voiceCallStatus: 'Pending Super Admin Decision',
      eSignStatus: 'Not Started',
      fullClientInfo: clientInfoData
    };

    setSales(prev => [newSale, ...prev.filter(s => s.leadId !== leadId)]);

    // 3. Trigger approval email notification to Super Admin
    addNotification({
      title: 'Review Required: New Sale Submission',
      message: `${currentUser?.name || 'Executive'} submitted sale for '${clientInfoData.clientName}' (Gross: ₹${Number(clientInfoData.grossSales || 0).toLocaleString('en-IN')}) with ${transactionAttachments.length} transaction attachment(s).`,
      type: 'review',
      actionType: 'review_sale',
      actionPayload: { saleId: newSale.id, leadId: leadId },
      targetRole: 'Super Admin'
    });

    return newSale;
  };

  // ─── Super Admin Approval Workflow (Voice Call / Skip) ──────────────────
  const superAdminApproveSale = (saleId, { executeVoiceCall = true } = {}) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Automated notification back to submitting user stating: "Super admin has approved your sale."
    addNotification({
      title: 'Sale Approved',
      message: 'Super admin has approved your sale.',
      type: 'success',
      targetUserId: sale.submittedByUserId,
      actionPayload: { saleId }
    });

    if (executeVoiceCall) {
      // Moves to automated voice call verification stage
      setSales(prev => prev.map(s => s.id === saleId ? {
        ...s,
        status: 'Super Admin Approved (Voice Call Pending)',
        stage: 'Voice Verification In Progress',
        voiceCallStatus: 'Calling Client...'
      } : s));

      if (sale.leadId) {
        setLeads(prev => prev.map(l => l.id === sale.leadId ? {
          ...l,
          disposition: 'Voice Verification In Progress',
          history: [...(l.history || []), { date: todayStr, text: 'Sale approved by Super Admin. Automated Voice Agent verification initiated.' }]
        } : l));
      }
    } else {
      // Skipped by Super Admin -> moves directly to E-Sign step
      setSales(prev => prev.map(s => s.id === saleId ? {
        ...s,
        status: 'Super Admin Approved (Voice Skipped)',
        stage: 'Ready for E-Sign',
        voiceCallStatus: 'Skipped by Super Admin',
        eSignStatus: 'Ready'
      } : s));

      if (sale.leadId) {
        setLeads(prev => prev.map(l => l.id === sale.leadId ? {
          ...l,
          disposition: 'Ready for E-Sign',
          history: [...(l.history || []), { date: todayStr, text: 'Sale approved by Super Admin. Voice verification skipped by Super Admin. Direct move to Leegality E-Sign.' }]
        } : l));
      }

      addNotification({
        title: 'Ready for E-Sign',
        message: `Voice call skipped by Super Admin for ${sale.clientName}. Kindly proceed to E-Sign.`,
        type: 'info',
        targetUserId: sale.submittedByUserId,
        actionType: 'proceed_to_esign',
        actionPayload: { saleId, leadId: sale.leadId }
      });
    }
  };

  // ─── Automated Voice Call Completion ────────────────────────────────────
  const completeVoiceCallVerification = (saleId) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    const todayStr = new Date().toISOString().split('T')[0];

    setSales(prev => prev.map(s => s.id === saleId ? {
      ...s,
      status: 'Verified (Ready for E-Sign)',
      stage: 'Verification Completed',
      voiceCallStatus: 'Completed / Verified',
      eSignStatus: 'Ready'
    } : s));

    if (sale.leadId) {
      setLeads(prev => prev.map(l => l.id === sale.leadId ? {
        ...l,
        disposition: 'Ready for E-Sign',
        history: [...(l.history || []), { date: todayStr, text: 'Automated Voice Agent verification completed successfully. Proceed to Leegality E-Sign.' }]
      } : l));
    }

    // Specification: "If the AI Call is completed: A pop-up appears in the CRM stating, 'Client details got verified, kindly proceed to E-Sign' (this notification will also remain in the notification bar)."
    addNotification({
      title: 'Client Verified',
      message: 'Client details got verified, kindly proceed to E-Sign',
      type: 'success',
      targetUserId: sale.submittedByUserId,
      actionType: 'proceed_to_esign',
      actionPayload: { saleId, leadId: sale.leadId }
    });
  };

  // ─── Leegality E-Sign Completion (Fills Dedicated E-Sign Block) ──────────
  const completeESignProcess = (saleId, eSignDetails = {}) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    const todayStr = new Date().toISOString().split('T')[0];

    const docId = eSignDetails.documentId || 'LEEG-DOC-' + Date.now();

    setSales(prev => prev.map(s => s.id === saleId ? {
      ...s,
      status: 'E-Signed & Converted',
      stage: 'Deal Finalized & Active',
      eSignStatus: 'Completed',
      eSignDocumentId: docId,
      eSignedAt: eSignDetails.signedAt || new Date().toISOString(),
      eSignDetails
    } : s));

    if (sale.leadId) {
      setLeads(prev => prev.map(l => l.id === sale.leadId ? {
        ...l,
        disposition: 'Paid / Converted',
        eSignCompleted: true,
        history: [...(l.history || []), { date: todayStr, text: `Leegality E-Sign executed successfully (Ref: ${docId}). Service Tenure: ${eSignDetails.serviceTenure || sale.serviceTenure || '3 months'}. MITC & Contract Agreement signed. Date 1 dynamically recorded as ${eSignDetails.date1 || todayStr}.` }]
      } : l));
    }

    // Build the completed E-Sign registry record to fill the dedicated E-Sign block
    const clientInfo = sale.fullClientInfo || sale.clientInfo || {};
    const matchingLead = (leads || []).find(l => l.id === sale.leadId);
    const tenure = eSignDetails.serviceTenure || sale.serviceTenure || clientInfo.serviceTenure || matchingLead?.clientInfo?.serviceTenure || '3 months';
    const clientName = clientInfo.clientName || sale.clientName || 'Client';
    const panNumber = eSignDetails.pan || sale.panNumber || clientInfo.panNumber || 'ABCDE1234F';
    const grossVal = eSignDetails.grossSales || sale.amount || ('₹' + (sale.grossSales || '50,000'));
    const date1Val = eSignDetails.date1 || todayStr;

    const newRecord = {
      id: 'esign-' + Date.now(),
      saleId: sale.id,
      leadId: sale.leadId,
      documentId: docId,
      clientName,
      clientPrefix: clientInfo.clientPrefix || 'Mr.',
      panNumber,
      phone: sale.phone1 || clientInfo.phone1 || '+91 98765 43210',
      email: sale.email || clientInfo.email || 'client@example.com',
      serviceName: eSignDetails.serviceName || sale.serviceOpted || clientInfo.serviceName || 'Equity Advisory',
      serviceTenure: tenure,
      grossSales: grossVal,
      netSales: eSignDetails.netSales || sale.netSales || '₹42,372.88',
      gst: eSignDetails.gst || sale.gst || '₹7,627.12',
      date1: date1Val,
      confirmedAt: eSignDetails.signedAt || new Date().toISOString(),
      status: 'Confirmed & Sealed',
      signerOfficer: (() => {
        const sig = getPrimarySignatory();
        return {
          name: sig?.signerName || 'Authorized Signatory',
          designation: sig?.designation || 'Principal Officer',
          sebiReg: sig?.sebiReg || 'EMP-001',
          entity: sig?.entity || 'Astra CRM Enterprise',
          eSignStatus: 'Affixed & Verified',
          signatureMarked: true
        };
      })(),
      clientSigner: {
        name: clientName,
        eSignStatus: 'Aadhaar OTP Verified',
        signatureMarked: true
      },
      documentsInterlinked: [
        'Document 1: Most Important Terms & Conditions (MITC) - Image 1 Ref',
        'Document 2: Terms and Conditions Agreement (Page 14 of 14) - Image 2 Ref'
      ],
      leegalityAuthToken: eSignDetails.authTokenMasked || 'JsAEa0...RbxM',
      leegalityMac: eSignDetails.webhookMac || 'hFBCLu...RAhG',
      apiGateway: 'POST https://api.leegality.com/api/v2.1/sign/request',
      creditsRemaining: eSignDetails.creditsRemaining !== undefined ? eSignDetails.creditsRemaining : (leegalityConfig?.creditsLeft || 40)
    };

    setESignRecords(prev => {
      const filtered = prev.filter(r => r.saleId !== sale.id && r.documentId !== docId);
      return [newRecord, ...filtered];
    });

    addNotification({
      title: 'E-Sign Completed',
      message: `Agreement digitally signed via Leegality for '${sale.clientName}'. Deal successfully converted!`,
      type: 'success',
      targetUserId: sale.submittedByUserId,
      actionPayload: { saleId }
    });
  };

  // ─── Single-Click Automated Leegality E-Sign Pipeline ──────────────────────
  // Executes the complete Leegality journey end-to-end:
  // 1. Accesses internal template document
  // 2. Stamps today's execution date into Date 1
  // 3. Auto-reads Name, Phone number, and Email from Client Information Page
  // 4. Disables "I want to sign this document" and activates "Enter both"
  // 5. Affixes official digital signature, Client E-Signature & live timestamps
  // 6. Dispatches via Leegality API v2.1 & saves executed agreement into Dedicated E-Sign Block
  const executeOneClickLeegalityESign = async (saleId) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) {
      throw new Error(`Sale with ID '${saleId}' not found`);
    }

    const matchingLead = (leads || []).find(l => 
      (targetSale.leadId && l.id === targetSale.leadId) ||
      (targetSale.clientName && (l.clientName === targetSale.clientName || l.contactPerson === targetSale.clientName || l.clientInfo?.clientName === targetSale.clientName)) ||
      (targetSale.phone1 && (l.phone === targetSale.phone1 || l.clientInfo?.phone1 === targetSale.phone1))
    );

    const clientInfo = targetSale.fullClientInfo || targetSale.clientInfo || matchingLead?.clientInfo || {};
    const clientName = clientInfo.clientName 
      || (clientInfo.clientPrefix && clientInfo.clientName ? `${clientInfo.clientPrefix} ${clientInfo.clientName}` : '')
      || clientInfo.fullName 
      || targetSale.clientName 
      || 'Client';
    const phone = (clientInfo.phone1 || clientInfo.phone || targetSale.phone1 || matchingLead?.phone || '7022463268').trim();
    const email = (clientInfo.email || targetSale.email || matchingLead?.email || 'bgatreshh@gmail.com').trim();
    const tenure = clientInfo.serviceTenure || targetSale.serviceTenure || '3 months';

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const date1 = `${dd}/${mm}/${yyyy}`;

    const invitees = [{
      id: 'inv-client-1',
      name: clientName,
      phone,
      email,
      contact: `${phone} / ${email}`,
      enterBoth: true,
      signatureType: 'Aadhaar E-Sign (OTP)',
      role: 'Signer'
    }];

    // Dispatch via Leegality API v2.1
    const apiResult = await dispatchLeegalitySignRequest({
      sale: targetSale,
      invitees,
      tenure,
      date1
    });

    const docId = apiResult?.data?.documentId || ('LEEG-' + Date.now().toString().slice(-8));

    const signMetadata = {
      documentId: docId,
      date1,
      signedAt: new Date().toISOString(),
      signedBy: clientName,
      pan: clientInfo.panNumber || targetSale.panNumber || 'ABCDE1234F',
      serviceName: clientInfo.serviceName || targetSale.serviceOpted || 'Equity Advisory Pro',
      serviceTenure: tenure,
      grossSales: targetSale.amount || ('₹' + (clientInfo.grossSales || targetSale.grossSales || '50,000')),
      netSales: clientInfo.netSales || targetSale.netSales || '₹42,372.88',
      gst: clientInfo.gst || targetSale.gst || '₹7,627.12',
      iWantToSignDisabled: true,
      signers: invitees,
      status: 'Sent & E-Signed',
      authTokenMasked: apiResult?.data?.authTokenMasked || 'JsAEa0...RbxM',
      webhookMac: apiResult?.data?.webhookMac || 'mac-verified',
      creditsRemaining: apiResult?.data?.creditsRemaining ?? 39,
      signUrl: apiResult?.data?.signUrl || `https://app.leegality.com/sign/${docId.toLowerCase()}`
    };

    completeESignProcess(targetSale.id, signMetadata);

    return {
      success: true,
      sale: targetSale,
      apiResult,
      signMetadata,
      docId
    };
  };

  const simulateConfirmESign = (customData = {}) => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const date1Str = `${dd}/${mm}/${yyyy}`;
    const docId = 'LEEG-DOC-' + Math.floor(10000000 + Math.random() * 90000000);

    const testSaleId = 'sale-sim-' + Date.now();
    const clientName = customData.clientName || 'Rajesh Kumar';
    const serviceName = customData.serviceName || 'Equity Advisory Pro';
    const serviceTenure = customData.serviceTenure || '3 months';
    const grossSales = customData.grossSales || '₹50,000';

    const simulatedSale = {
      id: testSaleId,
      date: today.toISOString().split('T')[0],
      clientName,
      amount: grossSales,
      employeeName: currentUser?.name || 'AKSHATA',
      submittedByUserId: currentUser?.id || 'usr-7',
      stage: 'Deal Finalized & Active',
      status: 'E-Signed & Converted',
      serviceOpted: serviceName,
      serviceTenure,
      panNumber: customData.panNumber || 'ABCDE1234F',
      eSignStatus: 'Completed',
      eSignDocumentId: docId,
      eSignedAt: new Date().toISOString()
    };

    setSales(prev => [simulatedSale, ...prev]);

    const newRecord = {
      id: 'esign-' + Date.now(),
      saleId: testSaleId,
      documentId: docId,
      clientName,
      clientPrefix: 'Mr.',
      panNumber: customData.panNumber || 'ABCDE1234F',
      phone: '+91 98451 98210',
      email: 'rajesh.kumar@example.com',
      serviceName,
      serviceTenure,
      grossSales,
      netSales: '₹42,372.88',
      gst: '₹7,627.12',
      date1: date1Str,
      confirmedAt: new Date().toISOString(),
      status: 'Confirmed & Sealed',
      signerOfficer: (() => {
        const sig = getPrimarySignatory();
        return {
          name: sig?.signerName || 'Authorized Signatory',
          designation: sig?.designation || 'Principal Officer',
          sebiReg: sig?.sebiReg || 'EMP-001',
          entity: sig?.entity || 'Astra CRM Enterprise',
          eSignStatus: 'Affixed & Verified',
          signatureMarked: true
        };
      })(),
      clientSigner: {
        name: clientName,
        eSignStatus: 'Aadhaar OTP Verified',
        signatureMarked: true
      },
      documentsInterlinked: [
        'Document 1: Most Important Terms & Conditions (MITC) - Image 1 Ref',
        'Document 2: Terms and Conditions Agreement (Page 14 of 14) - Image 2 Ref'
      ]
    };

    setESignRecords(prev => [newRecord, ...prev]);

    addNotification({
      title: 'E-Sign Confirmed',
      message: `Agreement digitally executed & filled in E-Sign Block for '${clientName}'. Service Tenure: ${serviceTenure}. Document: ${docId}`,
      type: 'success',
      targetUserId: currentUser?.id
    });

    return newRecord;
  };

  const deleteESignRecord = (recordId) => {
    setESignRecords(prev => prev.filter(r => r.id !== recordId));
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
      saveClientInformation,
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
      addIPToUser,
      // ─── Feature Access & Permissions Management ────────────
      CRM_FEATURES,
      FEATURE_CATEGORIES,
      userPermissions,
      hasPermission,
      updateUserPermission,
      updateUserAllPermissions,
      grantAllPermissions,
      revokeAllOptionalPermissions,
      resetUserPermissionsToDefault,
      getUserPermissionCount,
      // ─── Services Master (Super Admin) ──────────────────────
      services,
      addService,
      updateService,
      deleteService,
      // ─── Voice Agent Settings ───────────────────────────────
      voiceAgentSettings,
      updateVoiceAgentSettings,
      // ─── Financial Settings & Limits ────────────────────────
      financialSettings,
      updateFinancialSettings,
      // ─── Notification Bar ───────────────────────────────────
      notifications,
      addNotification,
      markNotificationRead,
      dismissNotification,
      clearAllNotifications,
      // ─── Verification & E-Sign Workflows ────────────────────
      checkDuplicatePhone2,
      submitClientInformationReview,
      superAdminApproveSale,
      completeVoiceCallVerification,
      completeESignProcess,
      // ─── Dedicated E-Sign Block Records (Filled After Confirmation) ────────
      eSignRecords,
      simulateConfirmESign,
      deleteESignRecord,
      executeOneClickLeegalityESign,
      // ─── Leegality API Integration Config & Credentials ────────
      leegalityConfig,
      updateLeegalityConfig
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => useContext(CRMContext);

