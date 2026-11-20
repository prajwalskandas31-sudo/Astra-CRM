/**
 * RA Monthly Compliance Tracker: the sheets of the client's workbook (RA_Monthly_Compliance_Tracker_Unite.xlsx)
 * as data. Every sheet lists its columns (what the user types, drop-downs, and the automatic "grey" cells)
 * and the rule that gives each row its Status: Compliant, Non-compliant or Pending (blank = empty row).
 * The server (backend/ra_compliance.py) only stores the typed values, per month per sheet.
 *
 * Column types:
 *   text, longtext, number, date (YYYY-MM-DD), yn (Yes/No), ynna (Yes/No/NA), select (options),
 *   reco (picks a Reco Register call), auto (worked out: value(row, ctx)), label (fixed text of a fixed row)
 * Sheet kinds:
 *   list    rows the user adds
 *   fixed   a set list of items (fixedRows); Policies lets the last items be renamed
 *   client  one row per Client Register client (row id = the client row's id)
 *   weekly  SCORES / ODR: five weekly checks plus a complaint log
 */

export const COMPLIANT = 'Compliant';
export const NON_COMPLIANT = 'Non-compliant';
export const PENDING = 'Pending';
export const NA = 'NA';

const PLATFORMS = ['Instagram', 'Facebook', 'YouTube', 'Telegram', 'WhatsApp', 'X (Twitter)', 'LinkedIn', 'Other'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const allBlank = (row, keys) => keys.every(k => blank(row[k]));
const anyIs = (row, keys, v) => keys.some(k => row[k] === v);
const anyBlank = (row, keys) => keys.some(k => blank(row[k]));

export const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const fmtDate = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}` : (v || '');
};
export const monthLabel = (month) => {
  const m = String(month || '').match(/^(\d{4})-(\d{2})$/);
  return m ? `${FULL_MONTHS[Number(m[2]) - 1]} ${m[1]}` : month;
};
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const shiftMonth = (month, by) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** "01-Oct to 07-Oct" ... "29-Oct to 31-Oct" for weeks 1-5 of the month. */
export const weekPeriod = (month, week) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const from = (week - 1) * 7 + 1;
  if (from > last) return '';
  const to = week === 5 ? last : Math.min(from + 6, last);
  const mon = MONTHS[m - 1];
  return `${String(from).padStart(2, '0')}-${mon} to ${String(to).padStart(2, '0')}-${mon}`;
};

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ─── Status rules (the workbook's formulas) ────────────────────────────────────

const yesNoStatus = (v) => (v === 'Yes' ? COMPLIANT : v === 'No' ? NON_COMPLIANT : PENDING);

const portalWeekStatus = (r) => (r.checked === 'NA' ? NA : yesNoStatus(r.checked));
const complaintLogStatus = (r) => (allBlank(r, ['date', 'complainant', 'ref', 'nature']) ? '' : yesNoStatus(r.resolved));

const weeklyColumns = (portal) => [
  { key: 'period', label: 'Week period (from - to)', type: 'text', width: 150, placeholder: (r, ctx, fixed) => weekPeriod(ctx.month, fixed?.week || 1), fallback: true },
  { key: 'dateChecked', label: `Date ${portal} checked`, type: 'date' },
  { key: 'checked', label: 'Portal checked? (Yes/No/NA)', type: 'ynna' },
  { key: 'checkedBy', label: 'Checked by', type: 'text', placeholder: 'e.g. Compliance Officer' },
  { key: 'newComplaints', label: 'New complaints received (number)', type: 'number' },
  { key: 'resolved', label: 'Complaints resolved / ATR filed (number)', type: 'number' },
  { key: 'pending', label: 'Pending (auto)', type: 'auto', value: r => (blank(r.newComplaints) ? '' : Number(r.newComplaints) - (Number(r.resolved) || 0)) },
  { key: 'remarks', label: 'Remarks', type: 'text', width: 180 }
];

const complaintLogColumns = (portal) => [
  { key: 'date', label: 'Date received', type: 'date' },
  { key: 'complainant', label: 'Complainant / client name', type: 'text', width: 170 },
  { key: 'ref', label: 'Complaint ref. no.', type: 'text', placeholder: `${portal}/2026/0001` },
  { key: 'nature', label: 'Nature of complaint', type: 'text', width: 200 },
  { key: 'action', label: 'Action taken / ATR date', type: 'text', width: 170 },
  { key: 'resolved', label: 'Resolved? (Yes/No)', type: 'yn' },
  { key: 'dateResolved', label: 'Date resolved', type: 'date' },
  { key: 'remarks', label: 'Remarks', type: 'text', width: 180 }
];

const WEEKS = [1, 2, 3, 4, 5].map(w => ({ id: `w${w}`, week: w, label: `Week ${w}` }));

const portalSheet = (key, no, short, title, portal, intro) => ({
  key, no, short, title, kind: 'weekly', intro,
  sections: [
    {
      key: 'weeks', title: `${portal} portal - weekly check`, kind: 'fixed', fixedRows: WEEKS,
      labelColumn: { key: 'label', label: 'Week' },
      columns: weeklyColumns(portal), status: portalWeekStatus
    },
    {
      key: 'log', title: `${portal} complaint log - every complaint received this month (resolved or not)`, kind: 'list',
      columns: complaintLogColumns(portal), status: complaintLogStatus,
      example: { date: '2026-10-04', complainant: 'Sample Client', ref: `${portal}/2026/0001`, nature: 'Delay in report delivery', action: 'Replied 06-Oct', resolved: 'Yes', dateResolved: '2026-10-06' }
    }
  ]
});

// ─── Fixed lists from the workbook ────────────────────────────────────────────

const WEBSITE_ITEMS = [
  ['Home page', 'Research Analyst details - Name', 'Name of the Research Analyst / entity is shown on the home page.'],
  ['Home page', 'Research Analyst details - Registered office address', 'Registered office address is shown on the home page.'],
  ['Home page', 'SEBI Registration Number', 'SEBI registration number is shown on the home page.'],
  ['Home page', 'BSE Enlistment Number', 'BSE enlistment number is shown on the home page.'],
  ['Home page', 'Mandatory standard warning', 'Minimum font size 10: "Investment in securities market are subject to market risks. Read all the related documents carefully before investing."'],
  ['Home page', 'Mandatory SEBI disclaimer', 'Minimum font size 10: "Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors."'],
  ['Footer tab / link', 'Investor Charter (Annexure A)', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'Investor Complaints (Annexure B)', 'Tab/link present and complaint data is uploaded.'],
  ['Footer tab / link', 'Grievance Redressal Process', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'Disclaimers', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'Disclosures', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'Escalation Matrix', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'Contact Us - Principal / Compliance Officer details', 'Name, telephone number and email ID of the Principal / Compliance Officer are shown.'],
  ['Footer tab / link', 'Contact Us - Grievance Officer details', 'Name, telephone number and email ID of the Grievance Officer are shown.'],
  ['Footer tab / link', 'Audit Report', 'Tab/link present and the latest Annual Compliance Audit Report is uploaded.'],
  ['Footer tab / link', 'SEBI Office Details', 'SEBI head office and local office details are shown.'],
  ['Footer tab / link', 'Code of Conduct', 'Tab/link present and the document is uploaded.'],
  ['Footer tab / link', 'PMLA Policy', 'Tab/link present and the document is uploaded.']
].map(([where, item, check], i) => ({ id: `web${i + 1}`, where, label: item, check }));

const COMMS_ITEMS = ['SMS', 'Call (recordings / call log)', 'Email', 'WhatsApp / other messaging apps', 'Other (meetings, letters, etc.)']
  .map((label, i) => ({ id: `comm${i + 1}`, label }));

const POLICY_ITEMS = [
  'Code of Conduct', 'PMLA / Anti-Money Laundering Policy', 'Grievance Redressal Process', 'Escalation Matrix',
  'Terms and conditions of research services (MITC)', 'Investor Charter', 'Conflict of interest / disclosure policy',
  'Record keeping / retention policy', 'Internal compliance manual / procedures'
].map((label, i) => ({ id: `pol${i + 1}`, label }))
  .concat([10, 11, 12].map(n => ({ id: `pol${n}`, label: 'Other (specify)', renamable: true })));

const COMPLAINT_DATA_ITEMS = [
  'Monthly complaint data (Annexure B) updated on the website',
  'Complaint register maintained and up to date',
  'Complaint data matches SCORES records (SCORES tab)',
  'Complaint data matches ODR records (ODR tab)',
  'Pending complaints followed up within the timeline'
].map((label, i) => ({ id: `cd${i + 1}`, label }));

export const CLIENT_DOCUMENTS = [
  ['doc1', '1. Terms and Conditions of research services'],
  ['doc2', '2. Disclosures to be given to clients'],
  ['doc3', '3. Disclaimers to be given to clients'],
  ['doc4', '4. Investor Charter to be provided to clients'],
  ['doc5', '5. Research Reports and Recommendations to be given'],
  ['doc6', '6. Grievance Redressal Process to be provided'],
  ['doc7', '7. Annual Compliance Audit Reports to be given']
];
const DOC_KEYS = CLIENT_DOCUMENTS.map(([k]) => k);

// ─── Cross-sheet lookups ──────────────────────────────────────────────────────

/** ctx: {month, rowsOf(sheet, section='rows'), clients, clientById, recoById, recoNo} */
export const buildContext = (month, rowsOf) => {
  const clients = rowsOf('clientRegister');
  const recos = rowsOf('recoRegister');
  const reports = rowsOf('researchReports');
  const byId = (list) => Object.fromEntries(list.map(r => [r.id, r]));
  const mitc = byId(rowsOf('mitc'));
  const invoices = byId(rowsOf('invoices'));
  const docs = byId(rowsOf('clientDocuments'));
  return {
    month,
    rowsOf,
    clients,
    clientById: byId(clients),
    clientNo: Object.fromEntries(clients.map((c, i) => [c.id, i + 1])),
    recos,
    recoById: byId(recos),
    recoNo: Object.fromEntries(recos.map((r, i) => [r.id, i + 1])),
    reportOnFile: (recoId) => reports.some(r => r.recoId === recoId && r.maintained === 'Yes'),
    mitcSigned: (clientId) => mitc[clientId]?.signed || 'Not updated',
    invoiceIssued: (clientId) => invoices[clientId]?.issued || 'Not updated',
    docsSent: (clientId) => `${DOC_KEYS.filter(k => docs[clientId]?.[k] === 'Yes').length} of 7`
  };
};

const clientAuto = [
  { key: 'srNo', label: 'Sr. No (auto)', type: 'auto', width: 70, value: (r, ctx) => ctx.clientNo[r.id] ?? '' },
  { key: 'clientName', label: 'Client name (auto)', type: 'auto', width: 170, value: (r, ctx) => ctx.clientById[r.id]?.name || '' }
];

// ─── The sheets ──────────────────────────────────────────────────────────────

export const SHEETS = [
  {
    key: 'socialBio', no: '1A', short: 'Social Media and Bio', title: 'Social media accounts - bio check', kind: 'list',
    intro: 'Every social media account of the Research Analyst: the bio must show the company name, SEBI registration number, the term "Research Analyst" and the website link.',
    carry: ['platform', 'handle', 'url'],
    sections: [{
      key: 'rows', kind: 'list',
      columns: [
        { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS },
        { key: 'handle', label: 'Account name / handle', type: 'text', placeholder: '@sample_research' },
        { key: 'url', label: 'Profile link (URL)', type: 'text', width: 200, placeholder: 'https://instagram.com/...' },
        { key: 'companyName', label: 'Company name in bio? (Yes/No)', type: 'yn' },
        { key: 'sebiReg', label: 'SEBI Registration No. in bio? (Yes/No)', type: 'yn' },
        { key: 'raTerm', label: "Term 'Research Analyst' in bio? (Yes/No)", type: 'yn' },
        { key: 'website', label: 'Website link in bio? (Yes/No)', type: 'yn' },
        { key: 'remarks', label: 'Remarks / action taken', type: 'text', width: 200 }
      ],
      example: { platform: 'Instagram', handle: '@sample_research', url: 'https://instagram.com/sample_research', companyName: 'Yes', sebiReg: 'Yes', raTerm: 'Yes', website: 'No', remarks: 'Website link to be added to bio' },
      status: (r) => {
        const checks = ['companyName', 'sebiReg', 'raTerm', 'website'];
        if (allBlank(r, ['platform', 'handle', 'url', ...checks])) return '';
        if (anyIs(r, checks, 'No')) return NON_COMPLIANT;
        return checks.every(k => r[k] === 'Yes') ? COMPLIANT : PENDING;
      }
    }]
  },
  {
    key: 'socialPosts', no: '1B', short: 'Social Media Posts', title: 'Social media posts - post-level check (every post)', kind: 'list',
    intro: 'Every post made this month. A post with a buy / sell recommendation must carry the public disclosures.',
    sections: [{
      key: 'rows', kind: 'list',
      columns: [
        { key: 'date', label: 'Date of post', type: 'date' },
        { key: 'platform', label: 'Platform', type: 'select', options: PLATFORMS },
        { key: 'post', label: 'Post link / short description', type: 'text', width: 230 },
        { key: 'companyName', label: 'Company name on post? (Yes/No)', type: 'yn' },
        { key: 'sebiReg', label: 'SEBI Reg. No. on post? (Yes/No)', type: 'yn' },
        { key: 'raTerm', label: "Term 'Research Analyst' on post? (Yes/No)", type: 'yn' },
        { key: 'recoGiven', label: 'Buy / Sell recommendation given? (Yes/No)', type: 'yn' },
        { key: 'disclosures', label: 'If yes, public disclosures given? (Yes/No/NA)', type: 'ynna' },
        { key: 'evidence', label: 'Screenshot / evidence ref.', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 180 }
      ],
      example: { date: '2026-10-05', platform: 'Telegram', post: 'Post: BUY ABC Ltd above 250, target 280', companyName: 'Yes', sebiReg: 'Yes', raTerm: 'Yes', recoGiven: 'Yes', disclosures: 'No', evidence: 'SS_05Oct_01.png', remarks: 'Disclosure line missing' },
      status: (r) => {
        if (allBlank(r, ['date', 'platform', 'post'])) return '';
        const reco = r.recoGiven === 'Yes';
        if (anyIs(r, ['companyName', 'sebiReg', 'raTerm'], 'No') || (reco && !blank(r.disclosures) && r.disclosures !== 'Yes')) return NON_COMPLIANT;
        if (anyBlank(r, ['companyName', 'sebiReg', 'raTerm', 'recoGiven']) || (reco && blank(r.disclosures))) return PENDING;
        return COMPLIANT;
      }
    }]
  },
  {
    key: 'recoRegister', no: '2', short: 'Reco Register', title: 'Records of research recommendations made during the year', kind: 'list',
    intro: 'One line per research recommendation / call. "Research report on file" turns Yes once the Research Reports tab has a maintained report for that call.',
    sections: [{
      key: 'rows', kind: 'list', numbered: true,
      columns: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'nature', label: 'Nature of Recommendation provided', type: 'text', placeholder: 'Positional call' },
        { key: 'security', label: 'Products / Securities in which recommendation is provided', type: 'text', width: 190, placeholder: 'ABC Ltd (NSE: ABC)' },
        { key: 'strike', label: 'Strike Price / Trigger Price', type: 'text' },
        { key: 'period', label: 'Period for Buy / Sell / Hold', type: 'text', placeholder: '2 months' },
        { key: 'callPut', label: 'Call / Put / Hold', type: 'select', options: ['Call', 'Put', 'Hold'] },
        { key: 'buyRate', label: 'Buy Rate', type: 'text', width: 90 },
        { key: 'sellRate', label: 'Sell Rate', type: 'text', width: 90 },
        { key: 'rationale', label: 'Whether Rationale for Research Recommendation is maintained (Yes/No)', type: 'yn' },
        { key: 'reportOnFile', label: 'Research report on file? (auto from Research Reports)', type: 'auto', value: (r, ctx) => (ctx.reportOnFile(r.id) ? 'Yes' : 'No') }
      ],
      example: { date: '2026-10-05', nature: 'Positional call', security: 'ABC Ltd (NSE: ABC)', strike: '250 (trigger)', period: '2 months', callPut: 'Call', buyRate: '250', rationale: 'Yes', reportOnFile: 'Yes' },
      status: (r, ctx) => {
        if (allBlank(r, ['date', 'nature', 'security', 'strike', 'period', 'callPut', 'buyRate', 'sellRate', 'rationale'])) return '';
        if (r.rationale === 'No' || !ctx.reportOnFile(r.id)) return NON_COMPLIANT;
        return blank(r.rationale) ? PENDING : COMPLIANT;
      }
    }]
  },
  {
    key: 'researchReports', no: '3', short: 'Research Reports', title: 'Research reports - one line per recommendation / call', kind: 'list',
    intro: 'Pick the call from the Reco Register; its date and security fill in by themselves.',
    sections: [{
      key: 'rows', kind: 'list',
      columns: [
        { key: 'recoId', label: 'Recommendation (from Reco Register)', type: 'reco', width: 210 },
        { key: 'recoDate', label: 'Date of recommendation (auto)', type: 'auto', value: (r, ctx) => (r.recoId ? (ctx.recoById[r.recoId] ? fmtDate(ctx.recoById[r.recoId].date) : 'Not in register') : '') },
        { key: 'recoSecurity', label: 'Security (auto)', type: 'auto', width: 160, value: (r, ctx) => ctx.recoById[r.recoId]?.security || '' },
        { key: 'maintained', label: 'Research report maintained? (Yes/No)', type: 'yn' },
        { key: 'reportRef', label: 'Report ref. no. / file name / link', type: 'text', placeholder: 'RR/2026-27/001' },
        { key: 'sent', label: 'Report sent to client? (Yes/No)', type: 'yn' },
        { key: 'dateSent', label: 'Date sent', type: 'date' },
        { key: 'mode', label: 'Mode of sending', type: 'select', options: ['Email', 'WhatsApp', 'SMS', 'Telegram', 'Physical', 'Other'] },
        { key: 'disclaimer', label: 'Proper disclaimer given? (Yes/No)', type: 'yn' },
        { key: 'disclosure', label: 'Proper disclosure given? (Yes/No)', type: 'yn' },
        { key: 'signed', label: 'Report signed? (Yes/No)', type: 'yn' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      example: { recoId: '#1 - 05-Oct-2026 - ABC Ltd (NSE: ABC)', recoDate: '05-Oct-2026', recoSecurity: 'ABC Ltd (NSE: ABC)', maintained: 'Yes', reportRef: 'RR/2026-27/001', sent: 'Yes', dateSent: '2026-10-05', mode: 'Email', disclaimer: 'Yes', disclosure: 'Yes', signed: 'No', remarks: 'Signature pending' },
      status: (r, ctx) => {
        if (blank(r.recoId)) return '';
        const checks = ['maintained', 'sent', 'disclaimer', 'disclosure', 'signed'];
        if (!ctx.recoById[r.recoId] || anyIs(r, checks, 'No')) return NON_COMPLIANT;
        return anyBlank(r, checks) ? PENDING : COMPLIANT;
      }
    }]
  },
  {
    key: 'clientRegister', no: '4', short: 'Client Register', title: 'Register of clients', kind: 'list', noStatus: true,
    intro: 'Add clients only here: MITC, KYC, Invoices and Client Documents pick them up automatically. "Add CRM clients" brings in this month\'s e-signed clients from the Paid block.',
    sections: [{
      key: 'rows', kind: 'list', numbered: true,
      columns: [
        { key: 'joinDate', label: 'Date of Joining', type: 'date', hint: 'Date the client accepted the terms and conditions.' },
        { key: 'name', label: 'Name of the Client', type: 'text', width: 170, hint: 'Full name as per PAN.' },
        { key: 'products', label: 'Details of products / securities', type: 'text', width: 170, placeholder: 'Equity cash & derivatives' },
        { key: 'natureOfService', label: 'Nature of Service', type: 'select', options: ['Research report', 'Research recommendation service', 'Both'] },
        { key: 'renewalDate', label: 'Date of Joining for Renewed Clients (blank = NA)', type: 'date' },
        { key: 'renewedName', label: 'Name of Renewed Clients', type: 'text', placeholder: 'NA' },
        { key: 'pan', label: 'PAN of Clients', type: 'text', width: 120, upper: true, placeholder: 'ABCDE1234F', check: v => (blank(v) || PAN_RE.test(v) ? '' : 'PAN should look like ABCDE1234F') },
        { key: 'kyc', label: 'Whether KYC is done (Yes/No)', type: 'yn' },
        { key: 'natureOfAdvice', label: 'Nature of Advice provided', type: 'text', width: 160, placeholder: 'Positional calls' },
        { key: 'tenure', label: 'Tenure of Service', type: 'text', width: 200, placeholder: '3 months (03/10/2026 to 02/01/2027)' },
        { key: 'recoDetails', label: 'Details of Recommendation made', type: 'text', width: 200, placeholder: 'As per Recommendation Register, Ref. No. 1' },
        { key: 'feeDate', label: 'Date of Fees charged', type: 'date' },
        { key: 'fees', label: 'Fees Charged (Rs)', type: 'number' },
        { key: 'mitcSigned', label: 'MITC signed? (auto from MITC)', type: 'auto', value: (r, ctx) => ctx.mitcSigned(r.id) },
        { key: 'docsSent', label: 'Documents sent (auto from Client Documents)', type: 'auto', value: (r, ctx) => ctx.docsSent(r.id) },
        { key: 'invoiceIssued', label: 'Invoice issued? (auto from Invoices)', type: 'auto', value: (r, ctx) => ctx.invoiceIssued(r.id) }
      ],
      example: { joinDate: '2026-10-03', name: 'Rahul Sharma (SAMPLE)', products: 'Equity cash & derivatives', natureOfService: 'Research recommendation service', renewedName: 'NA', pan: 'ABCDE1234F', kyc: 'Yes', natureOfAdvice: 'Positional calls', tenure: '3 months (03/10/2026 to 02/01/2027)', recoDetails: 'As per Recommendation Register, Ref. No. 1', feeDate: '2026-10-03', fees: 5900, mitcSigned: 'Yes', docsSent: '7 of 7', invoiceIssued: 'Yes' }
    }]
  },
  {
    key: 'mitc', no: '5', short: 'MITC', title: 'MITC (Most Important Terms and Conditions) - every client', kind: 'client',
    intro: 'One line for every client in the Client Register.',
    sections: [{
      key: 'rows', kind: 'client',
      columns: [
        ...clientAuto,
        { key: 'joinDate', label: 'Date of joining (auto)', type: 'auto', value: (r, ctx) => fmtDate(ctx.clientById[r.id]?.joinDate) },
        { key: 'sent', label: 'MITC sent to client? (Yes/No)', type: 'yn' },
        { key: 'dateSent', label: 'Date sent', type: 'date' },
        { key: 'mode', label: 'Mode of sending', type: 'select', options: ['Email', 'WhatsApp', 'Physical', 'e-Sign', 'Other'] },
        { key: 'signed', label: 'MITC signed / accepted by client? (Yes/No)', type: 'yn' },
        { key: 'dateSigned', label: 'Date signed', type: 'date' },
        { key: 'ref', label: 'Signed copy ref. / file name', type: 'text', placeholder: 'MITC_RahulSharma.pdf' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r) => (anyIs(r, ['sent', 'signed'], 'No') ? NON_COMPLIANT : anyBlank(r, ['sent', 'signed']) ? PENDING : COMPLIANT)
    }]
  },
  {
    key: 'kyc', no: '6', short: 'KYC', title: 'KYC - every client', kind: 'client',
    intro: 'One line for every client in the Client Register. "Matches Client Register" flags a KYC answer that differs from the register.',
    sections: [{
      key: 'rows', kind: 'client',
      columns: [
        ...clientAuto,
        { key: 'pan', label: 'PAN (auto)', type: 'auto', value: (r, ctx) => ctx.clientById[r.id]?.pan || '' },
        { key: 'registerKyc', label: 'KYC status in Client Register (auto)', type: 'auto', value: (r, ctx) => ctx.clientById[r.id]?.kyc || '' },
        { key: 'done', label: 'KYC done? (Yes/No)', type: 'yn' },
        { key: 'date', label: 'Date KYC completed', type: 'date' },
        { key: 'through', label: 'KYC done through', type: 'select', options: ['SEBI-registered KRA', 'Own process', 'Other'] },
        { key: 'docs', label: 'KYC documents on file? (Yes/No)', type: 'yn' },
        { key: 'matches', label: 'Matches Client Register? (auto)', type: 'auto', value: (r, ctx) => (blank(r.done) ? '' : r.done === ctx.clientById[r.id]?.kyc ? 'Yes' : 'No - update register') },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r) => (anyIs(r, ['done', 'docs'], 'No') ? NON_COMPLIANT : anyBlank(r, ['done', 'docs']) ? PENDING : COMPLIANT)
    }]
  },
  portalSheet('scores', '7A', 'SCORES', 'SCORES portal - weekly check and complaints', 'SCORES',
    'Check the SEBI SCORES portal every week and log every complaint received this month.'),
  portalSheet('odr', '7B', 'ODR', 'ODR (Online Dispute Resolution) portal - weekly check and complaints', 'ODR',
    'Check the ODR portal every week and log every complaint received this month.'),
  {
    key: 'website', no: '8', short: 'Website', title: 'Website - mandatory display checklist', kind: 'fixed',
    intro: 'Everything SEBI requires on the website. Verify each item this month.',
    sections: [{
      key: 'rows', kind: 'fixed', fixedRows: WEBSITE_ITEMS,
      labelColumn: { key: 'label', label: 'Item' },
      infoColumns: [{ key: 'where', label: 'Where on website', width: 110 }, { key: 'check', label: 'What to check', width: 260 }],
      columns: [
        { key: 'displayed', label: 'Displayed on website? (Yes/No)', type: 'yn' },
        { key: 'link', label: 'Page / document link', type: 'text', width: 190 },
        { key: 'upToDate', label: 'Latest / up to date? (Yes/No/NA)', type: 'ynna' },
        { key: 'verifiedOn', label: 'Last verified on', type: 'date' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r) => (r.displayed === 'No' ? NON_COMPLIANT : blank(r.displayed) ? PENDING : r.upToDate === 'No' ? NON_COMPLIANT : COMPLIANT)
    }]
  },
  {
    key: 'upiBank', no: '9', short: 'UPI and Bank', title: 'Bank accounts and UPI - every account used to collect fees', kind: 'list',
    intro: 'Every bank account used to collect fees must have UPI. "Add from Company Profile" brings in the company\'s bank accounts.',
    carry: ['bankName', 'holder', 'last4', 'type', 'upiId'],
    sections: [{
      key: 'rows', kind: 'list',
      columns: [
        { key: 'bankName', label: 'Bank name', type: 'text', width: 150 },
        { key: 'holder', label: 'Account holder name', type: 'text', width: 170 },
        { key: 'last4', label: 'Account no. (last 4 digits only)', type: 'text', width: 90, maxLength: 4, check: v => (blank(v) || /^\d{4}$/.test(v) ? '' : 'Only the last 4 digits') },
        { key: 'type', label: 'Account type', type: 'select', options: ['Current', 'Savings', 'Other'] },
        { key: 'upiId', label: 'UPI ID', type: 'text', width: 170, placeholder: 'abcresearch@bank' },
        { key: 'upiEnabled', label: 'UPI taken / enabled? (Yes/No)', type: 'yn' },
        { key: 'verifiedOn', label: 'Date verified', type: 'date' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      example: { bankName: 'Sample Bank', holder: 'ABC Research Services', last4: '1234', type: 'Current', upiId: 'abcresearch@samplebank', upiEnabled: 'Yes', verifiedOn: '2026-10-01' },
      status: (r) => {
        if (allBlank(r, ['bankName', 'holder', 'last4', 'type', 'upiId'])) return '';
        if (r.upiEnabled === 'No') return NON_COMPLIANT;
        return r.upiEnabled === 'Yes' && !blank(r.upiId) ? COMPLIANT : PENDING;
      }
    }]
  },
  {
    key: 'clientComms', no: '10', short: 'Client Comms', title: 'Communication with clients - records maintained?', kind: 'fixed',
    intro: 'For every way you talk to clients, keep records that can be retrieved.',
    sections: [{
      key: 'rows', kind: 'fixed', fixedRows: COMMS_ITEMS,
      labelColumn: { key: 'label', label: 'Mode of communication' },
      columns: [
        { key: 'held', label: 'Communication held this month? (Yes/No)', type: 'yn' },
        { key: 'records', label: 'Records maintained and retrievable? (Yes/No)', type: 'yn' },
        { key: 'location', label: 'Where records are kept (folder / system / device)', type: 'text', width: 200 },
        { key: 'sample', label: 'Sample record checked (ref. / date)', type: 'text', width: 170 },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r) => (blank(r.held) ? PENDING : r.held === 'No' ? NA : yesNoStatus(r.records))
    }]
  },
  {
    key: 'advertisements', no: '11', short: 'Advertisements', title: 'Advertisements - approval letter for every advertisement', kind: 'list',
    intro: 'Every advertisement needs an approval letter; record its reference and where the letter is kept.',
    sections: [{
      key: 'rows', kind: 'list',
      columns: [
        { key: 'date', label: 'Date of advertisement', type: 'date' },
        { key: 'description', label: 'Advertisement description', type: 'text', width: 220 },
        { key: 'medium', label: 'Medium / platform', type: 'text', width: 120 },
        { key: 'approved', label: 'Approval letter obtained? (Yes/No)', type: 'yn' },
        { key: 'approvalRef', label: 'Approval letter ref. no. and date', type: 'text', width: 180, placeholder: 'ADV/2026/001 dt 07-Oct-2026' },
        { key: 'attached', label: 'Approval letter attached / on file? (Yes/No)', type: 'yn' },
        { key: 'letterLink', label: 'Approval letter link / file name', type: 'text', width: 190 },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      example: { date: '2026-10-08', description: 'Instagram reel promoting monthly research subscription', medium: 'Instagram', approved: 'Yes', approvalRef: 'ADV/2026/001 dt 07-Oct-2026', attached: 'Yes', letterLink: 'ADV_2026_001.pdf' },
      status: (r) => {
        if (allBlank(r, ['date', 'description', 'medium'])) return '';
        if (anyIs(r, ['approved', 'attached'], 'No')) return NON_COMPLIANT;
        return anyBlank(r, ['approved', 'attached']) ? PENDING : COMPLIANT;
      }
    }]
  },
  {
    key: 'policies', no: '12', short: 'Policies', title: 'Policies maintained in the office', kind: 'fixed',
    intro: 'Suggested list; rename the "Other (specify)" lines for any further policy you keep.',
    carry: ['label', 'form', 'version', 'location'],
    sections: [{
      key: 'rows', kind: 'fixed', fixedRows: POLICY_ITEMS,
      labelColumn: { key: 'label', label: 'Policy / document' },
      columns: [
        { key: 'maintained', label: 'Maintained in office? (Yes/No)', type: 'yn' },
        { key: 'form', label: 'Form (Hard copy / Soft copy / Both)', type: 'select', options: ['Hard copy', 'Soft copy', 'Both'] },
        { key: 'version', label: 'Version / date last reviewed', type: 'text' },
        { key: 'location', label: 'Location / reference', type: 'text', width: 170 },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r, ctx, fixed) => {
        if (fixed?.renamable && blank(r.label) && blank(r.maintained)) return '';
        return yesNoStatus(r.maintained);
      }
    }]
  },
  {
    key: 'complaintData', no: '13', short: 'Complaint Data', title: 'Complaint data - updated?', kind: 'fixed',
    intro: 'Investor complaint data (Annexure B) for the month.',
    sections: [{
      key: 'rows', kind: 'fixed', fixedRows: COMPLAINT_DATA_ITEMS,
      labelColumn: { key: 'label', label: 'Item' },
      columns: [
        { key: 'done', label: 'Done / updated? (Yes/No)', type: 'yn' },
        { key: 'date', label: 'Date updated', type: 'date' },
        { key: 'ref', label: 'Reference / link', type: 'text', width: 190 },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r) => yesNoStatus(r.done)
    }]
  },
  {
    key: 'invoices', no: '14', short: 'Invoices', title: 'Invoices - every client', kind: 'client',
    intro: 'One line for every client in the Client Register; the fee comes from the register and is checked against the invoice amount.',
    sections: [{
      key: 'rows', kind: 'client',
      columns: [
        ...clientAuto,
        { key: 'registerFees', label: 'Fees per Client Register (Rs) (auto)', type: 'auto', value: (r, ctx) => ctx.clientById[r.id]?.fees ?? '' },
        { key: 'issued', label: 'Invoice issued? (Yes/No)', type: 'yn' },
        { key: 'invoiceNo', label: 'Invoice no.', type: 'text', placeholder: 'INV/2026-27/001' },
        { key: 'invoiceDate', label: 'Invoice date', type: 'date' },
        { key: 'amount', label: 'Invoice amount (Rs)', type: 'number' },
        { key: 'sentToClient', label: 'Invoice sent to client? (Yes/No)', type: 'yn' },
        { key: 'viaBank', label: 'Fee received via bank / UPI? (Yes/No)', type: 'yn' },
        { key: 'matches', label: 'Amount matches register? (auto)', type: 'auto', value: (r, ctx) => invoiceMatches(r, ctx) },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 }
      ],
      status: (r, ctx) => {
        if (anyIs(r, ['issued', 'sentToClient', 'viaBank'], 'No') || invoiceMatches(r, ctx) === 'No') return NON_COMPLIANT;
        return anyBlank(r, ['issued', 'sentToClient', 'viaBank']) ? PENDING : COMPLIANT;
      }
    }]
  },
  {
    key: 'clientDocuments', no: '15', short: 'Client Documents', title: 'Documents sent to every client', kind: 'client',
    intro: 'The seven documents every client must receive.',
    sections: [{
      key: 'rows', kind: 'client',
      columns: [
        ...clientAuto,
        ...CLIENT_DOCUMENTS.map(([key, label]) => ({ key, label, type: 'yn' })),
        { key: 'proof', label: 'Date(s), mode and proof of sending', type: 'text', width: 190, placeholder: '03-Oct-2026 by email' },
        { key: 'remarks', label: 'Remarks', type: 'text', width: 170 },
        { key: 'sentCount', label: 'Documents sent (auto)', type: 'auto', value: r => `${DOC_KEYS.filter(k => r[k] === 'Yes').length} of 7` }
      ],
      status: (r) => (anyIs(r, DOC_KEYS, 'No') ? NON_COMPLIANT : DOC_KEYS.every(k => r[k] === 'Yes') ? COMPLIANT : PENDING)
    }]
  }
];

function invoiceMatches(r, ctx) {
  if (blank(r.amount)) return '';
  const fee = Number(ctx.clientById[r.id]?.fees) || 0;
  return Math.round((Number(r.amount) - fee) * 100) === 0 ? 'Yes' : 'No';
}

export const SHEET_BY_KEY = Object.fromEntries(SHEETS.map(s => [s.key, s]));

/** The sub-blocks in the order they are shown: the Dashboard, then the 17 input sheets. */
export const SUB_BLOCKS = [{ key: 'dashboard', short: 'Dashboard' }, ...SHEETS];

export const DETAIL_FIELDS = [
  { key: 'raName', label: 'Name of Research Analyst / Company', profile: 'companyName' },
  { key: 'sebiReg', label: 'SEBI Registration No.', profile: 'sebiRegistrationNumber' },
  { key: 'bseEnlistment', label: 'BSE Enlistment No.' },
  { key: 'checkedBy', label: 'Checked by' },
  { key: 'reviewDate', label: 'Date of review', type: 'date' }
];

/** Rows shown for a section, in order: list rows as typed; fixed / client rows merged with what was typed. */
export const displayRows = (section, stored, ctx) => {
  const saved = Array.isArray(stored) ? stored : [];
  if (section.kind === 'list') return saved.map(r => ({ row: r }));
  const byId = Object.fromEntries(saved.map(r => [r.id, r]));
  if (section.kind === 'client') return ctx.clients.map(c => ({ row: byId[c.id] || { id: c.id } }));
  return section.fixedRows.map(f => {
    const row = byId[f.id] || { id: f.id };
    return { row: f.renamable ? row : { ...row, label: f.label }, fixed: f };
  });
};

export const rowStatus = (section, row, ctx, fixed) => (section.status ? section.status(row, ctx, fixed) : '');

/** The Dashboard's summary lines (as in the workbook): one per sheet section that has statuses. */
export const SUMMARY_LINES = [
  ['socialBio', 'rows', 'Social media - bio of each account'],
  ['socialPosts', 'rows', 'Social media - every post'],
  ['recoRegister', 'rows', 'Register of recommendations'],
  ['researchReports', 'rows', 'Research reports (maintained, sent, disclaimer, signed)'],
  ['mitc', 'rows', 'MITC - sent and signed by every client'],
  ['kyc', 'rows', 'KYC - every client'],
  ['scores', 'weeks', 'SCORES portal - weekly checks'],
  ['scores', 'log', 'SCORES portal - complaints'],
  ['odr', 'weeks', 'ODR portal - weekly checks'],
  ['odr', 'log', 'ODR portal - complaints'],
  ['website', 'rows', 'Website - mandatory display'],
  ['upiBank', 'rows', 'UPI - every bank account'],
  ['clientComms', 'rows', 'Communication with clients'],
  ['advertisements', 'rows', 'Advertisements and approval letters'],
  ['policies', 'rows', 'Policies maintained in office'],
  ['complaintData', 'rows', 'Complaint data updated'],
  ['invoices', 'rows', 'Invoices - every client'],
  ['clientDocuments', 'rows', 'Documents sent to every client']
];

export const overallStatus = (c) => (c.items === 0 ? 'No data' : c.nc > 0 ? 'Action needed' : c.pending > 0 ? 'In progress' : 'Compliant');

/** {sheet, section, area, items, ok, nc, pending, pct, overall} per summary line, plus the total. */
export const summarize = (ctx) => {
  const lines = SUMMARY_LINES.map(([sheet, sectionKey, area]) => {
    const def = SHEET_BY_KEY[sheet];
    const section = def.sections.find(s => s.key === sectionKey);
    const counts = { ok: 0, nc: 0, pending: 0 };
    displayRows(section, ctx.rowsOf(sheet, sectionKey), ctx).forEach(({ row, fixed }) => {
      const st = rowStatus(section, row, ctx, fixed);
      if (st === COMPLIANT) counts.ok += 1;
      else if (st === NON_COMPLIANT) counts.nc += 1;
      else if (st === PENDING) counts.pending += 1;
    });
    const items = counts.ok + counts.nc + counts.pending;
    const line = { sheet, section: sectionKey, area, tab: `${def.no}. ${def.short}`, items, ...counts };
    return { ...line, pct: items ? counts.ok / items : null, overall: overallStatus(line) };
  });
  const total = lines.reduce((t, l) => ({ items: t.items + l.items, ok: t.ok + l.ok, nc: t.nc + l.nc, pending: t.pending + l.pending }),
    { items: 0, ok: 0, nc: 0, pending: 0 });
  return { lines, total: { ...total, pct: total.items ? total.ok / total.items : null, overall: overallStatus(total) } };
};

/** What a cell shows (auto cells worked out, dates as 05-Oct-2026, a call as "1 - 05-Oct-2026 ABC Ltd"). */
export const cellText = (col, row, ctx, fixed) => {
  if (col.type === 'auto') return col.value(row, ctx);
  if (col.type === 'label') return row[col.key] ?? fixed?.[col.key] ?? '';
  if (col.type === 'date') return fmtDate(row[col.key]);
  if (col.type === 'reco') return recoLabel(row[col.key], ctx);
  // A column whose placeholder is the sensible default (the week's dates) prints that default when left empty
  if (col.fallback && blank(row[col.key]) && typeof col.placeholder === 'function') return col.placeholder(row, ctx, fixed);
  return row[col.key] ?? '';
};

export const recoLabel = (id, ctx) => {
  if (blank(id)) return '';
  const r = ctx.recoById[id];
  if (!r) return 'Not in register';
  return [`#${ctx.recoNo[id]}`, fmtDate(r.date), r.security].filter(Boolean).join(' - ');
};

/** Rows to keep when copying a sheet from an earlier month (identity fields only, so checks are redone). */
export const carryRows = (sheet, rows) => {
  const def = SHEET_BY_KEY[sheet];
  if (!def?.carry) return [];
  return (rows || []).map(r => {
    const out = { id: def.kind === 'fixed' ? r.id : newId() };
    def.carry.forEach(k => { if (!blank(r[k])) out[k] = r[k]; });
    return out;
  }).filter(r => Object.keys(r).length > 1);
};
