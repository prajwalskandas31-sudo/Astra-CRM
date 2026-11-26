import * as XLSX from 'xlsx';
import { reportSheet, tableSheet, writeReport } from '../lib/reportExcel';

// Global settings for a month. Keys must match SETTING_FIELDS in backend/salary.py.
export const SETTING_FIELDS = [
  { key: 'workingDays', label: 'Total Working Days', group: 'Attendance', whole: true },
  { key: 'paidLeaves', label: 'Paid Leaves allowed', group: 'Attendance', whole: true },
  { key: 'absentDeduction', label: 'Deduction per Absent Day (₹)', group: 'Attendance' },
  { key: 'halfDayDeduction', label: 'Deduction per Half Day (₹)', group: 'Attendance' },
  { key: 'professionalTax', label: 'Professional Tax Value (₹)', group: 'Professional Tax' },
  { key: 'professionalTaxLimit', label: 'Professional Tax Limit Amount (₹)', group: 'Professional Tax' },
  { key: 'insuranceDeduction', label: 'Insurance Deduction (₹)', group: 'Insurance & PF' },
  { key: 'pf', label: 'PF (₹)', group: 'Insurance & PF' }
];

export const ENTRY_AMOUNTS = [
  { key: 'incentive', label: 'Incentive' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'deduction', label: 'Deduction' },
  { key: 'advance', label: 'Advance' }
];

const n = (v) => {
  const x = Number(String(v ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Same steps as payroll() in backend/salary.py, so the table updates while typing; the server
 * repeats it on every load. Order: base + Incentive − Absent − Half Day + Expenses − Deduction − Advance,
 * then Professional Tax (only when above the limit), then Insurance and PF, never below ₹0.
 */
export const calculate = (base, counts, settings, entry) => {
  const s = Object.fromEntries(SETTING_FIELDS.map(f => [f.key, n(settings?.[f.key])]));
  const { present = 0, halfDay = 0, leave = 0, absent = 0 } = counts || {};
  const paidLeaves = Math.floor(s.paidLeaves);
  const working = Math.floor(s.workingDays);
  const extraLeave = Math.max(0, leave - paidLeaves);
  const attendance = {
    workingDays: working, worked: present + halfDay, present, halfDay, leave,
    paidLeave: Math.min(leave, paidLeaves), extraLeave, absent, absentCharged: absent + extraLeave,
    notMarked: Math.max(0, working - (present + halfDay + leave + absent))
  };
  const c = { base: r2(n(base)), incentive: n(entry?.incentive) };
  c.absentDeduction = r2(attendance.absentCharged * s.absentDeduction);
  c.halfDayDeduction = r2(halfDay * s.halfDayDeduction);
  c.expenses = n(entry?.expenses);
  c.deduction = n(entry?.deduction);
  c.advance = n(entry?.advance);
  let amount = c.base + c.incentive - c.absentDeduction - c.halfDayDeduction + c.expenses - c.deduction - c.advance;
  c.beforeProfessionalTax = r2(amount);
  const applicable = s.professionalTax > 0 && amount > s.professionalTaxLimit;
  c.professionalTaxStatus = applicable ? 'Applicable' : 'Not Applicable';
  c.professionalTax = applicable ? s.professionalTax : 0;
  c.insurance = entry?.insurance ? s.insuranceDeduction : 0;
  c.pf = entry?.pf ? s.pf : 0;
  amount -= c.professionalTax + c.insurance + c.pf;
  c.finalSalary = r2(Math.max(amount, 0));
  return { attendance, calc: c };
};

// ---------------------------------------------------------------- Excel export

const money = (x) => (x === null || x === undefined || x === '' ? '' : r2(Number(x)));

const payTypeFields = (payType, r) => {
  if (payType === 'Commission') return [['Commission %', r.commissionPercent ?? ''], ['Status', r.status || '']];
  const out = [['Target', money(r.targetValue)], ['Fixed Salary', money(r.fixedSalary)]];
  if (payType === 'Salary plus Incentives') out.push(['Incentive %', r.incentivePercent ?? ''], ['Target Incentive', money(r.incentive)]);
  out.push(['Status', r.status || ''], ['Short of Target', r.status === 'Not Eligible for Salary' || r.status === 'Target Not Reached' ? money(r.difference) : '']);
  return out;
};

// Every field for one employee, in calculation order: [label, value]
const employeeFields = (payType, r, settings) => {
  const { attendance: a, calc: c } = r.view;
  return [
    ['Employee', r.name], ['Employee ID', r.employeeId || ''], ['Role', r.role || ''], ['Branch', r.branch || ''],
    ['Pay Type', payType], ['Net Sales', money(r.netSales)],
    ...payTypeFields(payType, r),
    ['Total Salary (calculated)', money(c.base)],
    ['Total Working Days', a.workingDays], ['Worked Days', a.worked], ['Present', a.present], ['Half Days', a.halfDay],
    ['Leaves taken', a.leave], ['Paid Leaves used', a.paidLeave], ['Leaves beyond allowance (charged as Absent)', a.extraLeave],
    ['Absent', a.absent], ['Not marked', a.notMarked],
    ['Incentive', money(c.incentive)],
    [`Absent Deduction (${a.absentCharged} × ₹${n(settings.absentDeduction)})`, money(-c.absentDeduction)],
    [`Half-Day Deduction (${a.halfDay} × ₹${n(settings.halfDayDeduction)})`, money(-c.halfDayDeduction)],
    ['Expenses', money(c.expenses)], ['Deduction', money(-c.deduction)], ['Advance', money(-c.advance)],
    ['Total before Professional Tax', money(c.beforeProfessionalTax)],
    ['Professional Tax', c.professionalTaxStatus], ['Professional Tax deducted', money(-c.professionalTax)],
    ['Insurance', r.entry?.insurance ? 'On' : 'Off'], ['Insurance deducted', money(-c.insurance)],
    ['PF', r.entry?.pf ? 'On' : 'Off'], ['PF deducted', money(-c.pf)],
    ['Final Total Salary', money(c.finalSalary)]
  ];
};

const settingsRows = (settings) => SETTING_FIELDS.map(f => [f.label, n(settings?.[f.key])]);

const fileStem = (payType, month) => `Salary_${payType.replace(/\s+/g, '_')}_${month}`;

/** One sheet with every employee of the pay type (a row each), plus a Settings sheet. */
export const exportConsolidated = (payType, month, rows, settings) => {
  const wb = XLSX.utils.book_new();
  const header = rows.length ? employeeFields(payType, rows[0], settings).map(([label]) => label.replace(/ \(.*× ₹.*\)$/, '')) : ['Employee'];
  const body = rows.map(r => employeeFields(payType, r, settings).map(([, v]) => v));
  const total = header.map((h, i) => (i === 0 ? `Total (${rows.length})` : h === 'Final Total Salary' || h === 'Net Sales'
    ? r2(body.reduce((s, row) => s + (Number(row[i]) || 0), 0)) : ''));
  const sheet = tableSheet({ title: `Salary Block - ${payType}`, subtitle: month, header, rows: body, total,
    cols: header.map(h => Math.min(Math.max(h.length + 2, 12), 28)) });
  XLSX.utils.book_append_sheet(wb, sheet, payType.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, tableSheet({ title: 'Salary Settings', subtitle: month, header: ['Setting', `Value for ${month}`],
    rows: settingsRows(settings), cols: [44, 18] }), 'Settings');
  writeReport(wb, `${fileStem(payType, month)}_All.xlsx`);
};

/** One workbook, one sheet per employee with every field, the calculation and their transactions. */
export const exportIndividual = (payType, month, rows, settings) => {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  rows.forEach(r => {
    const fields = employeeFields(payType, r, settings);
    const b = reportSheet().title(`${r.name} - ${payType}`).subtitle(month)
      .header(['Field', 'Value']).rows(fields.slice(0, -1)).total(fields[fields.length - 1]);
    b.blank().section('Closed client transactions').header(['Payment Date', 'Client', 'Sale', 'Credited as', 'Net Sales credited']);
    (r.transactions || []).forEach(t => b.body([t.paymentDate, t.clientName || '', t.saleId, t.role, money(t.credited)]));
    if (!(r.transactions || []).length) b.note('None in this month');
    b.blank().section('Settings applied').header(['Setting', `Value for ${month}`]).rows(settingsRows(settings));
    const sheet = b.build({ cols: [44, 24, 16, 14, 20] });
    const base = (`${r.name}${r.employeeId ? ` ${r.employeeId}` : ''}`).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Employee';
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i += 1) name = `${base.slice(0, 26)} ${i}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, sheet, name);
  });
  writeReport(wb, `${fileStem(payType, month)}_Individual.xlsx`);
};
