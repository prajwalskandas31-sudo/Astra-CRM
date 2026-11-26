/**
 * RA Periodic Report: the 11 sub-blocks' fields, how the CRM's values and the typed values combine,
 * and the Excel workbook (one sheet per sub-block, laid out as RA_Periodic_Report_31-03-2026.xlsx).
 * Server side: backend/ra_periodic_report.py (auto values, saving per half).
 */
import { styleSheet } from '../lib/reportExcel';

export const YES_NO = ['Yes', 'No'];
const ADDRESS_FIELDS = [['line1', 'Address Line 1'], ['line2', 'Address Line 2'], ['state', 'State'], ['city', 'City'],
  ['district', 'District'], ['pincode', 'Pincode'], ['country', 'Country']];

// ---------------- 1. General Details ----------------
// kind: field (one value) | address (7 lines under a heading) | group (sub-fields under one Sr. No.) | ref (points to a sheet)
// type: text (default) | yesno | select | date | number | textarea; `from` = Yes/No or a count taken from a list sub-block
export const GENERAL = [
  { sr: 1, kind: 'field', key: 'registeredName', label: 'Registered Name of RA (as per SEBI registration certificate)' },
  { sr: 2, kind: 'field', key: 'tradeName', label: 'Trade Name as RA (As per GST certificate) / Brand Name as RA' },
  { sr: 3, kind: 'field', key: 'pan', label: 'Permanent Account Number (PAN)', upper: true },
  { sr: 4, kind: 'field', key: 'sebiRegNo', label: 'SEBI Registration Number', upper: true },
  { sr: 5, kind: 'field', key: 'raasbEnlistment', label: 'Enlistment Number of Research Analyst Administration and Supervisory Body (RAASB)' },
  { sr: 6, kind: 'field', key: 'logo', label: 'Logo (if any) Yes/No', type: 'yesno' },
  { sr: 7, kind: 'field', key: 'incorporationDate', label: 'Date of Birth for individual RA / Date of Incorporation for Non Individual RA', type: 'date' },
  { sr: 8, kind: 'field', key: 'legalStructure', label: 'Legal Structure (Individual / Partnership / LLP / Body Corporate)', type: 'select', options: ['Individual', 'Partnership', 'LLP', 'Body Corporate'] },
  { sr: 9, kind: 'field', key: 'raCategory', label: 'Category of registered RA (Research Entity/Independent Research Analyst/Individual Research Analyst)', type: 'select', options: ['Research Entity', 'Independent Research Analyst', 'Individual Research Analyst'] },
  { sr: 10, kind: 'field', key: 'otherActivities', label: 'Whether Non- individual RA is involved in activities other than research services? (Yes/No)', type: 'yesno' },
  { sr: 11, kind: 'field', key: 'partTime', label: 'Whether registered RA registered as Part time?  (Applicable to individual and partnership  firm RAs only)', type: 'yesno' },
  { sr: 12, kind: 'field', key: 'registeredIA', label: 'Are you registered as Investment Adviser? (Applicable to individual and partnership  firm RAs only)', type: 'yesno' },
  { sr: 13, kind: 'field', key: 'institutionalOnly', label: 'Whether RA is providing services only to the Institutional Clients or QIBs? (Yes / No)', type: 'yesno' },
  { sr: 14, kind: 'address', key: 'reg', label: 'Registered Office Address' },
  { sr: 15, kind: 'address', key: 'corr', label: 'Correspondence Address' },
  { sr: 16, kind: 'address', key: 'ppb', label: 'Address of Principal place of business' },
  { sr: 17, kind: 'field', key: 'branchCount', label: 'Number of branches', type: 'number', from: { table: 'branches', count: true } },
  { sr: 18, kind: 'field', key: 'branchesListed', label: 'Addresses of branches (provide details of all branches)', type: 'yesno', from: { table: 'branches' } },
  { sr: 19, kind: 'field', key: 'websiteListed', label: 'Official Website Address', type: 'yesno', from: { table: 'websites' } },
  { sr: 20, kind: 'field', key: 'socialListed', label: 'Details of Social Media handles as an IA (provide details for all such platforms)', type: 'yesno', from: { table: 'social' } },
  { sr: 21, kind: 'field', key: 'bankListed', label: 'Details of bank account/s for receiving advisory fees (provide details of all such bank accounts)', type: 'yesno', from: { table: 'banks' } },
  { sr: 22, kind: 'group', label: 'Details of Contact Person', fields: [
    { key: 'contactName', label: 'Name' }, { key: 'contactDob', label: 'Date of Birth', type: 'date' },
    { key: 'contactMobile', label: 'Mobile' }, { key: 'contactEmail', label: 'Email id' }] },
  { sr: 23, kind: 'group', label: 'Details of Dedicated Officer (DO) for complaint redressal(DO - who handle issues relating to compliance and redressal of investor grievances)', fields: [
    { key: 'doName', label: 'Name' }, { key: 'doDesignation', label: 'Designation' },
    { key: 'doMobile', label: 'Mobile' }, { key: 'doEmail', label: 'Email id' }] },
  { sr: 24, kind: 'group', label: 'Details of Compliance Officer', fields: [
    { key: 'coType', label: 'Type of compliance officer' }, { key: 'coName', label: 'Name' },
    { key: 'coDob', label: 'Date of Birth', type: 'date' }, { key: 'coMobile', label: 'Mobile' },
    { key: 'coEmail', label: 'Email id' }, { key: 'coQualification', label: 'Qualification of CO' }] },
  { sr: 25, kind: 'group', label: 'Details of Principal Officer (PO)', fields: [
    { key: 'poName', label: 'Name' }, { key: 'poDob', label: 'Date of Birth', type: 'date' },
    { key: 'poPan', label: 'PAN', upper: true }, { key: 'poMobile', label: 'Mobile' }, { key: 'poEmail', label: 'Email id' },
    { key: 'poDesignation', label: 'Designation of PO (managing director / designated director / managing partner / Executive Chairman / Business head / Unit head / CEO)' }] },
  { sr: 26, kind: 'group', label: 'Details of Managing Director / Managing Partner', fields: [
    { key: 'mdExists', label: 'Do you have Managing Director / Managing Partner?', type: 'yesno' }, { key: 'mdName', label: 'Name' },
    { key: 'mdPan', label: 'PAN', upper: true }, { key: 'mdDob', label: 'Date of Birth', type: 'date' },
    { key: 'mdDin', label: 'DIN (Mandatory for Body corporate and LLP)' }, { key: 'mdMobile', label: 'Mobile' }, { key: 'mdEmail', label: 'Email id' }] },
  { sr: 27, kind: 'ref', sheet: 'directors', label: 'Details of Other Directors / Partners (List of all Directors / Partners)' },
  { sr: 28, kind: 'ref', sheet: 'shareholding', label: 'Shareholding Pattern (provide details of shareholders having a holding of 10% or more)' },
  { sr: 29, kind: 'field', key: 'raCount', type: 'number', label: 'Total number of Persons employed as Research Analyst (RA) (please refer to the definition of research analyst as provided under Regulation 2(1)(u) of SEBI (Research Analysts) Regulations, 2014)' },
  { sr: 30, kind: 'field', key: 'parsCount', type: 'number', label: 'Total number of Persons Associated with Research service (PARS) (does not include individual RA or principal officer of non-individual RA)' },
  { sr: 31, kind: 'ref', sheet: 'nism', label: 'NISM / CFP / Other certification details (provide details of all such persons)' },
  { sr: 32, kind: 'group', label: 'Details of last inspection', fields: [
    { key: 'inspBy', label: 'Inspection carried out by (SEBI / RAASB)' }, { key: 'inspDate', label: 'Date of last inspection', type: 'date' },
    { key: 'inspPeriod', label: 'Period of Inspection' }, { key: 'inspRemarks', label: 'Any adverse remarks of inspection' },
    { key: 'inspRemedial', label: 'Remedial steps taken to address adverse remarks' }] },
  { sr: 33, kind: 'group', label: 'Details of Advertisements issued', fields: [
    { key: 'adsIssued', label: 'Number of Advertisements issued during the half year period', type: 'number' },
    { key: 'adsApproved', label: 'Number of Advertisements approved by RAASB during the half year period', type: 'number' }] },
  { sr: 34, kind: 'group', label: 'Publishing of Complaints and Investor Charter', fields: [
    { key: 'complaintsPublished', type: 'yesno', label: 'Whether complaints data is updated by RA on their  respective websites and mobile applications (if any) by 7th of the succeeding month for each month of the half year period (Yes/No)?' },
    { key: 'charterDisclosed', type: 'yesno', label: 'Whether Investor Charter is disclosed by RA on their respective websites and mobile applications (if any), making them available at prominent places in the office, provide a copy of Investor Charter as a part of client on-boarding process, through e-mails/ letters etc?' }] },
  { sr: 35, kind: 'field', key: 'researchReports', type: 'number', label: 'Number of Research Reports  published during the reporting period (includes Buy/Sell/Hold recommendation)' },
  { sr: 36, kind: 'field', key: 'publicAppearances', type: 'number', label: 'Aggregate number of public appearances made by the RA/ its Director/analyst during the period' },
  { sr: 37, kind: 'field', key: 'others', type: 'textarea', label: 'Others (Incase RA wish to provide any information other than above mentioned)' },
  { sr: 38, kind: 'field', key: 'employees', type: 'number', label: 'Total number of Employees as on last date of the reporting period' },
  { sr: 39, kind: 'field', key: 'upiApplied', type: 'yesno', label: 'Whether RA has applied for @valid UPI handle?' },
  { sr: 40, kind: 'field', key: 'upiRemarks', type: 'textarea', label: 'Remarks for not applying for a valid UPI handle.' }
];

/** Every single-value field of General Details, flattened. */
export const GENERAL_FIELDS = GENERAL.flatMap(item => {
  if (item.kind === 'field') return [item];
  if (item.kind === 'group') return item.fields;
  if (item.kind === 'address') return ADDRESS_FIELDS.map(([k, label]) => ({ key: `${item.key}.${k}`, label }));
  return [];
});

// ---------------- 2. Complaints ----------------
export const COMPLAINT_ROWS = [
  { sr: 1, key: 'q1', label: 'Number of complaints pending at the end of previous half yearly period (a)' },
  { sr: 2, key: 'q2', label: 'Number of complaints received during the period (b)' },
  { sr: 3, key: 'q3', label: 'Total number of complaints resolved during the period (c)' },
  { sr: 4, key: 'q4', label: 'Total number of complaints pending at the end of the period (a+b-c) = (d)', calc: true },
  { sr: 5, label: 'Ageing details of complaints pending at the end of the period', subs: [
    { key: 'q5a', label: 'Total number of complaints pending for up to 21 days (a)' },
    { key: 'q5b', label: 'Number of complaints pending from 22-90 Days (b)' },
    { key: 'q5c', label: 'Number of complaints pending for more than 90 Days (c)' },
    { key: 'q5d', label: 'Total number of complaints pending (a+b+c)=d', calc: true }] },
  { sr: 6, key: 'q6', decimal: true, label: 'Average Complaint resolution time (Average complaint Resolution time is the sum total of time taken to resolve each complaint in days, in the concerned half year period divided by total number of complaints resolved in the said half year period.)' },
  { sr: 7, label: 'Break-up of type of complaints received during the period', subs: [
    { key: 'q7a', label: 'Grievances related to recommendations' },
    { key: 'q7b', label: 'Issues related to fees charged' },
    { key: 'q7c', label: 'Inadequacy/ issues related to services' },
    { key: 'q7d', label: 'Promise of assured returns' },
    { key: 'q7e', label: 'Other (please specify)' },
    { key: 'q7f', label: 'Other (please specify)', text: true }] },
  { sr: 8, key: 'q8', label: 'Number of unique clients who have filed complaint during the period Eg. Client A has filed 2 complaints Client B has filed 3 complaints Client C has filed 1 complaints Then total no. of unique client who have filed complaint during the period shall be 3 and no. of complaints shall be considered as' }
];
export const COMPLAINT_SOURCES = [['scores', 'Complaints received through SCORES'], ['other', 'Complaints from other Sources']];

// ---------------- 3. Clients And Fees (same rows as the Audit Report's Client and Fee Details) ----------------
export const FEE_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const FEE_ROWS = [
  { sr: 1, key: 'r1', kind: 'columns', label: 'Number of clients at the end of the previous half yearly period (i)' },
  { sr: 2, key: 'r2', kind: 'columns', label: 'Number of client acquired signed during the period (ii)' },
  { sr: 3, key: 'r3', kind: 'columns', label: 'Number of client subscription  or agreements expired/terminated during the period (iii)' },
  { sr: 4, key: 'r4', kind: 'columns', calc: true, label: 'Number of clients at the end of the period (iv = i + ii - iii)' },
  { sr: 5, key: 'r5', kind: 'single', label: 'Maximum number of active client on any day during the period' },
  { sr: 6, key: 'r6', kind: 'text', label: 'Details of Deposit maintained with RAASB based on maximum no. of clients' },
  { sr: 7, key: 'r7', kind: 'text', label: 'Amount of Deposit maintained with RAASB' },
  { sr: 8, key: 'r8', kind: 'columns', money: true, label: 'Details of Fees collected (in Rs)' }
];

// ---------------- 4-11. List sub-blocks ----------------
export const TABLES = {
  branches: { sheet: 'Branch Address', title: 'Addresses of branches (provide details of all branches)', columns: ADDRESS_FIELDS.map(([key, label]) => ({ key, label })) },
  websites: { sheet: 'Website Details', title: 'Website Details', columns: [{ key: 'url', label: 'List of website of RA (mention link of website)', wide: true }] },
  social: { sheet: 'Details Of Social Media', title: 'Social Media Type (e.g. Facebook, Twitter, Linkedin, etc.)', columns: [
    { key: 'platform', label: 'Name of Social Media handles.(e.g. Facebook, Twitter, Linkedin, etc.)', list: ['Facebook', 'Instagram', 'X (Twitter)', 'LinkedIn', 'YouTube', 'Telegram', 'WhatsApp'] },
    { key: 'link', label: 'Details of social media handles. ( Provide link of the social media handle )', wide: true }] },
  banks: { sheet: 'Bank Details', title: 'Details of Bank Accounts', columns: [
    { key: 'holderName', label: 'Name as per Bank Account' }, { key: 'accountNo', label: 'Account No' },
    { key: 'accountType', label: 'Type of account', list: ['CURRENT', 'SAVINGS'] }, { key: 'ifsc', label: 'IFSC Code', upper: true },
    { key: 'bankName', label: 'Bank Name' }, { key: 'branch', label: 'Bank Branch Name' }] },
  directors: { sheet: 'List of Directors & Partners', title: 'Details of Other Directors/Partners', columns: [
    { key: 'name', label: 'Name' }, { key: 'residentialStatus', label: 'Residential status of director / partner', options: ['Indian', 'Foreign'] },
    { key: 'pan', label: 'PAN (Mandatory for Indian director / partner)', upper: true },
    { key: 'foreignId', label: 'Any one foreign Identification proof number (Mandatory for foreign director / partner)' },
    { key: 'dob', label: 'Date of Birth', type: 'date' }, { key: 'din', label: 'DIN' }] },
  shareholding: { sheet: 'Shareholding Details', title: 'Shareholding Pattern (provide details of shareholders having a holding of 10% or more) in case of Body corporate Or Profit sharing ratio in case of partnership Or Capital contribution in case of LLP', columns: [
    { key: 'name', label: 'Name of shareholder' }, { key: 'shares', label: 'Number of shares', type: 'number' },
    { key: 'percent', label: '% of shareholding', type: 'number' }] },
  nism: { sheet: 'NISM Certification Details', title: 'Details of NISM Certification', columns: [
    { key: 'personType', label: 'Please specify the person is Individual RA / PARS / PO /CO/RA/Partner of a RA', list: ['Individual RA', 'PARS', 'Principle Officer', 'Compliance Officer', 'Research Analyst', 'Partner'] },
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email ID' }, { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'pan', label: 'PAN', upper: true }, { key: 'certType', label: 'Type of Certification', list: ['NISM XV', 'NISM XV-B', 'NISM III A', 'CFP', 'Other'] },
    { key: 'xvFrom', label: 'NISM XV / XV-B: From Date', type: 'date' }, { key: 'xvTo', label: 'NISM XV / XV-B: To Date', type: 'date' },
    { key: 'iiiaFrom', label: 'NISM III A: From Date', type: 'date' }, { key: 'iiiaTo', label: 'NISM III A: To Date', type: 'date' }] },
  upi: { sheet: 'UPI Handle', title: 'UPI Details', columns: [{ key: 'upiId', label: 'UPI ID', wide: true }] }
};
export const TABLE_IDS = Object.keys(TABLES);

export const SUB_BLOCKS = [
  ['general', 'General Details'], ['complaints', 'Complaints'], ['clientsFees', 'Clients And Fees'],
  ['branches', 'Branch Address'], ['websites', 'Website Details'], ['social', 'Details Of Social Media'],
  ['banks', 'Bank Details'], ['directors', 'List of Directors & Partners'], ['shareholding', 'Shareholding Details'],
  ['nism', 'NISM Certification Details'], ['upi', 'UPI Handle']
];

// ---------------- Values: the CRM's, overridden by what was typed ----------------
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const hasRow = (row) => Object.values(row || {}).some(v => String(v ?? '').trim() !== '');

const sameName = (a, b) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' ');
/** Adds a row, or fills the blanks of the row already there for the same person. */
const addPerson = (rows, row) => {
  if (!String(row.name || '').trim()) return rows;
  const i = rows.findIndex(r => sameName(r.name, row.name));
  if (i < 0) return [...rows, row];
  const merged = { ...rows[i] };
  Object.entries(row).forEach(([k, v]) => { if (String(merged[k] ?? '').trim() === '' && String(v ?? '').trim() !== '') merged[k] = v; });
  return rows.map((r, j) => (j === i ? merged : r));
};

/**
 * The CRM's rows for a list sub-block: the server's (Company Profile, Branch Profiles, User Directory NISM details,
 * RA Compliance Tracker social media), plus what General Details holds (typed or the CRM's), worked out here so
 * a change typed in General Details shows straight away.
 */
export const crmRows = (data, draft, id) => {
  const server = data.auto[id] || [];
  const g = (key) => generalValue(data, draft, { key }).trim();
  const indian = (pan) => (pan ? 'Indian' : '');
  const md = g('mdExists') !== 'No' && g('mdName')
    ? { name: g('mdName'), residentialStatus: indian(g('mdPan')), pan: g('mdPan'), foreignId: '', dob: g('mdDob'), din: g('mdDin') } : null;
  const poIsDirector = /director|partner|chairman/i.test(g('poDesignation'));
  const po = g('poName') ? { name: g('poName'), residentialStatus: indian(g('poPan')), pan: g('poPan'), foreignId: '', dob: g('poDob'), din: '' } : null;
  if (id === 'banks') {
    const holder = g('registeredName');
    return holder ? server.map(r => ({ ...r, holderName: holder })) : server;
  }
  if (id === 'directors') {
    let rows = server;
    if (md) rows = addPerson(rows, md);
    if (po && poIsDirector) rows = addPerson(rows, po);
    return rows;
  }
  if (id === 'shareholding') {
    if (server.length) return server;
    if (g('legalStructure') === 'Individual' && g('registeredName')) return [{ name: g('registeredName'), shares: '', percent: '100' }];
    return tableRows(data, draft, 'directors').filter(d => String(d.name || '').trim()).map(d => ({ name: d.name, shares: '', percent: '' }));
  }
  if (id === 'nism') {
    let rows = [];
    if (po) rows = addPerson(rows, { personType: 'Principle Officer', name: po.name, email: g('poEmail'), dob: po.dob, pan: po.pan });
    if (g('coName')) rows = addPerson(rows, { personType: 'Compliance Officer', name: g('coName'), email: g('coEmail'), dob: g('coDob'), pan: '' });
    // then everyone with NISM Exam Details in the User Directory; the MD's details fill their row's blanks
    rows = server.filter(r => String(r.name || '').trim()).reduce(addPerson, rows);
    if (md) {
      const partner = /Partnership|LLP/.test(g('legalStructure')) ? 'Partner' : '';
      rows = rows.map(r => (sameName(r.name, md.name) ? addPerson([r], { name: r.name, personType: partner, email: g('mdEmail'), dob: md.dob, pan: md.pan })[0] : r));
    }
    return rows;
  }
  return server;
};

/** The rows a list sub-block shows: what was typed, else the CRM's rows. */
export const tableRows = (data, draft, id) => (Array.isArray(draft[id]) ? draft[id] : crmRows(data, draft, id));

/** General Details value before typing: from a list sub-block, else the CRM's. */
export const generalAuto = (data, draft, field) => {
  if (field.from) {
    const rows = tableRows(data, draft, field.from.table).filter(hasRow);
    return field.from.count ? String(rows.length) : (rows.length ? 'Yes' : 'No');
  }
  return String(data.auto.general?.[field.key] ?? '');
};
export const generalValue = (data, draft, field) =>
  (field.key in (draft.general || {}) ? String(draft.general[field.key]) : generalAuto(data, draft, field));

export const complaintCells = (draft) => {
  const v = (k, s) => num(draft.complaints?.[`${k}.${s}`]);
  const out = {};
  COMPLAINT_SOURCES.forEach(([s]) => {
    COMPLAINT_ROWS.flatMap(r => r.subs || [r]).forEach(r => { if (!r.text) out[`${r.key}.${s}`] = v(r.key, s); });
    out[`q4.${s}`] = v('q1', s) + v('q2', s) - v('q3', s);
    out[`q5d.${s}`] = v('q5a', s) + v('q5b', s) + v('q5c', s);
  });
  Object.keys(out).filter(k => k.endsWith('.scores')).forEach(k => {
    const key = k.slice(0, -7);
    out[`${key}.total`] = r2(out[`${key}.scores`] + out[`${key}.other`]);
  });
  return out;
};

export const feeAuto = (data, k) => data.auto.clientsFees?.[k] ?? (k === 'r6' || k === 'r7' ? '' : 0);
export const feeValue = (data, draft, k) => (k in (draft.clientsFees || {}) ? draft.clientsFees[k] : feeAuto(data, k));
export const feeCells = (data, draft) => {
  const out = {};
  FEE_ROWS.forEach(r => {
    if (r.kind !== 'columns') { out[r.key] = feeValue(data, draft, r.key); return; }
    FEE_COLUMNS.forEach(c => {
      out[`${r.key}.${c}`] = r.calc ? num(out[`r1.${c}`]) + num(out[`r2.${c}`]) - num(out[`r3.${c}`]) : num(feeValue(data, draft, `${r.key}.${c}`));
    });
    out[`${r.key}.total`] = r2(FEE_COLUMNS.reduce((s, c) => s + out[`${r.key}.${c}`], 0));
  });
  return out;
};

// ---------------- Excel (house style from ../lib/reportExcel) ----------------
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 'YYYY-MM-DD' -> a real Excel date (DD-MM-YYYY); other text as is. */
const dateCell = (v) => {
  const m = ISO.exec(String(v || ''));
  if (!m) return v || '';
  const serial = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000;
  return { t: 'n', v: serial, z: 'dd-mm-yyyy' };
};
const numberCell = (v) => (String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : (v ?? ''));
const typed = (field, v) => (field.type === 'date' ? dateCell(v) : field.type === 'number' ? numberCell(v) : (v ?? ''));
const merge = (r1, c1, r2_, c2) => ({ s: { r: r1, c: c1 }, e: { r: r2_, c: c2 } });
export const dmyDash = (iso) => { const m = ISO.exec(iso || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const halfName = (data) => `the half year ended ${new Date(`${data.to}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`; // "March 31, 2026"

/** Row 1 the sheet name, row 2 its description band, then `headerRows` heading rows, the rows, an optional total. */
const sheetOf = (XLSX, aoa, merges, widths, headerRows = 1, totalLast = false) => {
  const s = XLSX.utils.aoa_to_sheet(aoa);
  s['!merges'] = merges;
  s['!cols'] = widths.map(wch => ({ wch }));
  const roles = aoa.map((_, r) => (r === 0 ? 'title' : r === 1 ? 'subtitle' : r < 2 + headerRows ? 'header'
    : totalLast && r === aoa.length - 1 ? 'total' : 'body'));
  return styleSheet(s, roles);
};

const generalSheet = (XLSX, data, draft) => {
  const aoa = [['General Details'],
    [`General details of Research Analyst (RA) for ${halfName(data)}  Note: (All fields are mandatory in case if any field not not Applicable, You can mention NA)`, '', '', dateCell(data.to)],
    ['Sr. No.', 'Particulars', '', 'Details', '']];
  const merges = [merge(0, 0, 0, 4), merge(1, 0, 1, 2), merge(2, 1, 2, 2), merge(2, 3, 2, 4)];
  const value = (f) => typed(f, generalValue(data, draft, f));
  GENERAL.forEach(item => {
    const r = aoa.length;
    if (item.kind === 'field' || item.kind === 'ref') {
      const v = item.kind === 'ref' ? `Refer sheet: ${TABLES[item.sheet].sheet}` : value(item);
      aoa.push([String(item.sr), item.label, '', v, '']);
      merges.push(merge(r, 1, r, 2), merge(r, 3, r, 4));
    } else if (item.kind === 'address') {
      aoa.push([String(item.sr), item.label, '', '', '']);
      merges.push(merge(r, 1, r, 2), merge(r, 3, r, 4));
      ADDRESS_FIELDS.forEach(([k, label]) => {
        const rr = aoa.length;
        aoa.push(['', label, '', value({ key: `${item.key}.${k}` }), '']);
        merges.push(merge(rr, 1, rr, 2), merge(rr, 3, rr, 4));
      });
      merges.push(merge(r, 0, r + ADDRESS_FIELDS.length, 0));
    } else {
      item.fields.forEach((f, i) => {
        aoa.push([i ? '' : String(item.sr), i ? '' : item.label, f.label, value(f), '']);
        merges.push(merge(r + i, 3, r + i, 4));
      });
      if (item.fields.length > 1) merges.push(merge(r, 0, r + item.fields.length - 1, 0), merge(r, 1, r + item.fields.length - 1, 1));
    }
  });
  return sheetOf(XLSX, aoa, merges, [8, 60, 50, 40, 12]);
};

const complaintsSheet = (XLSX, data, draft) => {
  const cells = complaintCells(draft);
  const aoa = [['Complaints'], [`Details of the complaints aganist Research Analyst (RA) for the Half Year ended on ${dmyDash(data.to)}`],
    ['Sr No.', 'Particulars', '', ...COMPLAINT_SOURCES.map(([, t]) => t), 'Total (Through SCORES + Other Sources)']];
  const merges = [merge(0, 0, 0, 5), merge(1, 0, 1, 5), merge(2, 1, 2, 2)];
  const values = (k) => [cells[`${k}.scores`], cells[`${k}.other`], cells[`${k}.total`]];
  COMPLAINT_ROWS.forEach(row => {
    const r = aoa.length;
    if (!row.subs) {
      aoa.push([String(row.sr), row.label, '', ...values(row.key)]);
      merges.push(merge(r, 1, r, 2));
      return;
    }
    row.subs.forEach((sub, i) => {
      const lead = i ? ['', ''] : [String(row.sr), row.label];
      if (sub.text) {
        aoa.push([...lead, sub.label, draft.complaints?.[sub.key] || '', '', '']);
        merges.push(merge(r + i, 3, r + i, 5));
      } else aoa.push([...lead, sub.label, ...values(sub.key)]);
    });
    merges.push(merge(r, 0, r + row.subs.length - 1, 0), merge(r, 1, r + row.subs.length - 1, 1));
  });
  return sheetOf(XLSX, aoa, merges, [8, 50, 50, 22, 22, 26]);
};

const feesSheet = (XLSX, data, draft) => {
  const cells = feeCells(data, draft);
  const aoa = [['Clients And Fees'], [`Details of Clients, Assets under Advice (AUA) and Fees for the half year ended on ${dmyDash(data.to)}`],
    ['Sr No.', 'Particulars', 'Details of Individual clients', '', '', 'Details of Non-Individual clients', '', '', 'Total (A+B+C+D+E+F)'],
    ['', '', 'Resident (A)', 'Non-Resident (B)', 'FPI(C)', 'Resident (D)', 'Non-Resident (E)', 'FPI (F)', '']];
  const merges = [merge(0, 0, 0, 8), merge(1, 0, 1, 8), merge(2, 0, 3, 0), merge(2, 1, 3, 1), merge(2, 2, 2, 4), merge(2, 5, 2, 7), merge(2, 8, 3, 8)];
  FEE_ROWS.forEach(row => {
    if (row.kind === 'columns') {
      aoa.push([String(row.sr), row.label, ...FEE_COLUMNS.map(c => cells[`${row.key}.${c}`]), cells[`${row.key}.total`]]);
    } else {
      aoa.push([String(row.sr), row.label, '', '', '', '', '', '', row.kind === 'single' ? num(cells[row.key]) : numberCell(cells[row.key])]);
      merges.push(merge(aoa.length - 1, 2, aoa.length - 1, 7));
    }
  });
  return sheetOf(XLSX, aoa, merges, [8, 60, 14, 16, 10, 14, 16, 10, 20], 2);
};

const tableSheet = (XLSX, data, draft, id) => {
  const t = TABLES[id];
  const rows = tableRows(data, draft, id).filter(hasRow);
  const width = t.columns.length + 1;
  const merges = [merge(0, 0, 0, width - 1), merge(1, 0, 1, width - 1)];
  const aoa = [[t.sheet], [t.title]];
  if (id === 'nism') {
    aoa.push(['SR', ...t.columns.slice(0, 6).map(c => c.label), 'Validity of Certificate NISM XV / NISM XV-B', '', 'Validity of Certificate NISM - III A', '']);
    aoa.push(['', '', '', '', '', '', '', 'From Date', 'To Date', 'From Date', 'To Date']);
    for (let c = 0; c <= 6; c += 1) merges.push(merge(2, c, 3, c));
    merges.push(merge(2, 7, 2, 8), merge(2, 9, 2, 10));
  } else {
    aoa.push(['SR', ...t.columns.map(c => c.label)]);
  }
  rows.forEach((row, i) => aoa.push([String(i + 1), ...t.columns.map(c => typed(c, row[c.key]))]));
  const total = id === 'shareholding' && rows.length > 0;
  if (total) {
    aoa.push(['Total', '', '', r2(rows.reduce((s, row) => s + num(row.percent), 0))]);
    merges.push(merge(aoa.length - 1, 0, aoa.length - 1, 2));
  }
  return sheetOf(XLSX, aoa, merges, [6, ...t.columns.map(c => (c.wide ? 70 : c.type === 'date' ? 14 : 28))], id === 'nism' ? 2 : 1, total);
};

/** The workbook for the given sub-blocks (all 11 by default), sheets in the order of the reference file. */
export const buildWorkbook = (XLSX, data, draft, ids = SUB_BLOCKS.map(([id]) => id)) => {
  const wb = XLSX.utils.book_new();
  SUB_BLOCKS.filter(([id]) => ids.includes(id)).forEach(([id, name]) => {
    const sheet = id === 'general' ? generalSheet(XLSX, data, draft)
      : id === 'complaints' ? complaintsSheet(XLSX, data, draft)
        : id === 'clientsFees' ? feesSheet(XLSX, data, draft)
          : tableSheet(XLSX, data, draft, id);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  });
  return wb;
};

export const fileName = (data, ids) => {
  const one = ids.length === 1 ? ` - ${SUB_BLOCKS.find(([id]) => id === ids[0])[1].replace(/&/g, 'and')}` : '';
  return `RA_Periodic_Report_${dmyDash(data.to)}${one}.xlsx`;
};
