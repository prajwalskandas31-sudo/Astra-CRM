import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { FileSpreadsheet, Search, X, Download, Play } from 'lucide-react';
import { loadPayslipEmployees, loadPayslip, downloadPayslipPdf } from '../services/accountsService';

const pad = (n) => String(n).padStart(2, '0');
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
// Same default as default_pay_date() in backend/payslip.py: the 1st of the following month
const defaultPayDate = (month) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The payslip is shown as a printed page (white paper) in both themes, as it will look in the PDF
const P = { ink: '#222222', muted: '#6B6B6B', line: '#D5D5E0', green: '#4CC76A', greenBg: '#EAF8EE', rowBg: '#F7F7F9', tint: '#F3F2FB' };

const SUMMARY = [
  ['Employee Name', p => p.employee.name], ['Employee ID', p => p.employee.employeeId], ['Pay Period', p => p.monthName],
  ['Pay Date', p => p.payDateText], ['UAN Number', p => p.employee.uanNumber], ['Account Number', p => p.employee.bankAccountNumber],
  ['IFSC Code', p => p.employee.ifscCode], ['Date of Joining', p => p.employee.dateOfJoining],
  ['Date of Birth', p => p.employee.dateOfBirth], ['PAN Number', p => p.employee.panNumber],
  ['Aadhaar Number', p => p.employee.aadhaarMasked]
];

const Row = ({ label, value, strong }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '130px 12px 1fr', fontSize: '0.84rem', lineHeight: 1.9 }}>
    <span style={{ color: P.muted }}>{label}</span>
    <span style={{ color: P.muted }}>:</span>
    <span style={{ color: P.ink, fontWeight: strong ? 700 : 400, wordBreak: 'break-word' }}>{value || '—'}</span>
  </div>
);

const Items = ({ title, items, totalLabel, total }) => (
  <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#333', padding: '14px 16px 8px', borderBottom: `1px dashed ${P.line}`, margin: '0 0 6px' }}>
      <span>{title}</span><span>AMOUNT</span>
    </div>
    <div style={{ flex: 1 }}>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 16px', fontSize: '0.82rem', color: i.reference ? P.muted : P.ink }}>
          <span>{i.label}{i.reference ? <span style={{ fontSize: '0.7rem' }}> (for reference)</span> : null}</span>
          <span style={{ fontWeight: i.reference ? 400 : 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{i.text || money(i.amount)}</span>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', marginTop: '6px', background: P.rowBg, fontWeight: 700, fontSize: '0.84rem', color: '#333' }}>
      <span>{totalLabel}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</span>
    </div>
  </div>
);

const Payslip = ({ p, logo }) => (
  <div style={{ background: '#fff', color: P.ink, borderRadius: '10px', padding: 'clamp(16px, 4vw, 36px)', maxWidth: '860px', margin: '0 auto', boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
    {/* Header */}
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: `1px solid ${P.line}` }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: '1 1 320px', minWidth: 0 }}>
        {logo ? <img src={logo} alt="" style={{ maxWidth: '110px', maxHeight: '42px', objectFit: 'contain', marginTop: '4px' }} /> : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.25 }}>{p.company.title || 'Company Name'}</div>
          {p.company.address && <div style={{ fontSize: '0.8rem', color: P.muted, marginTop: '4px' }}>{p.company.address}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
        <div style={{ fontSize: '0.8rem', color: P.muted }}>Payslip For the Month</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{p.monthName}</div>
      </div>
    </div>

    {/* Employee Summary + Total Net Pay */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '18px', justifyContent: 'space-between' }}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: P.muted, letterSpacing: '0.03em', marginBottom: '4px' }}>EMPLOYEE SUMMARY</div>
        {SUMMARY.map(([label, get]) => <Row key={label} label={label} value={get(p)} />)}
      </div>
      <div style={{ flex: '0 1 280px', alignSelf: 'flex-start', border: `1px solid ${P.line}`, borderRadius: '10px', overflow: 'hidden', minWidth: '230px' }}>
        <div style={{ background: P.greenBg, padding: '16px 20px' }}>
          <div style={{ borderLeft: `3px solid ${P.green}`, paddingLeft: '10px' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1.2 }}>{money(p.netPay)}</div>
            <div style={{ fontSize: '0.82rem', color: '#5F7F68' }}>Total Net Pay</div>
          </div>
        </div>
        <div style={{ padding: '10px 20px 14px', borderTop: `1px dashed ${P.line}` }}>
          <Row label="Paid Days" value={p.attendance.paidDays} />
          <Row label="LOP Days" value={p.attendance.lopDays} />
        </div>
      </div>
    </div>

    {/* Pay Type */}
    <div style={{ marginTop: '18px', background: P.tint, border: `1px solid ${P.line}`, borderRadius: '8px', padding: '2px 12px' }}>
      <Row label="Pay Type" value={p.employee.payType} strong />
    </div>

    {/* Earnings | Deductions */}
    <div style={{ marginTop: '18px', border: `1px solid ${P.line}`, borderRadius: '10px', overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
      <Items title="EARNINGS" items={p.earnings} totalLabel="Gross Earnings" total={p.grossEarnings} />
      <Items title="DEDUCTIONS" items={p.deductions} totalLabel="Total Deductions" total={p.totalDeductions} />
    </div>

    {/* Total Net Payable */}
    <div style={{ marginTop: '18px', border: `1px solid ${P.line}`, borderRadius: '10px', overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 220px', padding: '12px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>TOTAL NET PAYABLE</div>
        <div style={{ fontSize: '0.8rem', color: P.muted }}>Gross Earnings - Total Deductions</div>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: '160px', background: P.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', fontWeight: 700, fontSize: '1rem' }}>
        {money(p.netPay)}
      </div>
    </div>

    <div style={{ textAlign: 'right', fontSize: '0.82rem', marginTop: '14px', paddingBottom: '14px', borderBottom: `1px solid ${P.line}` }}>
      <span style={{ color: P.muted }}>Amount In Words</span> : {p.amountInWords}
    </div>
    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: P.muted, marginTop: '16px' }}>-- This is a system-generated document. --</div>
  </div>
);

/**
 * Pay Slip Block (Reports): search or pick any employee across all branches, pick a month (and Pay Date),
 * Generate shows the payslip built by backend/payslip.py from the User Directory and the Salary Block;
 * Download PDF saves the same payslip as a PDF.
 */
export const PayslipBlock = () => {
  const { companyProfile } = useCRM();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [month, setMonth] = useState(lastMonth);
  const [payDate, setPayDate] = useState(() => defaultPayDate(lastMonth()));
  const [payslip, setPayslip] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadPayslipEmployees()
      .then(body => setEmployees(body.employees || []))
      .catch(err => setListError(err.message || 'Could not load the employees.'));
  }, []);

  const q = search.trim().toLowerCase();
  const matches = useMemo(() => employees.filter(e => !q
    || e.name.toLowerCase().includes(q) || (e.employeeId || '').toLowerCase().includes(q)), [employees, q]);

  // A search that finds exactly one employee picks them
  useEffect(() => {
    if (q && matches.length === 1 && matches[0].userId !== userId) setUserId(matches[0].userId);
  }, [q, matches, userId]);

  // The shown payslip belongs to the chosen employee / month / Pay Date; any change clears it
  useEffect(() => { setPayslip(null); setError(''); }, [userId, month, payDate]);

  const changeMonth = (value) => {
    if (!value) return;
    setMonth(value);
    setPayDate(defaultPayDate(value));
  };

  const chosen = employees.find(e => e.userId === userId);

  const generate = async () => {
    if (!userId) { setError('Pick an employee first.'); return; }
    setLoading(true);
    setError('');
    try {
      setPayslip(await loadPayslip(userId, month, payDate));
    } catch (err) {
      setPayslip(null);
      setError(err.message || 'Could not generate the payslip.');
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!payslip) return;
    setDownloading(true);
    try {
      const code = (payslip.employee.employeeId || payslip.employee.name).replace(/[^A-Za-z0-9_-]+/g, '_');
      await downloadPayslipPdf(userId, month, payDate, `Payslip_${code}_${MONTHS[Number(month.slice(5, 7)) - 1]}_${month.slice(0, 4)}.pdf`);
    } catch (err) {
      showToast(err.message || 'Could not download the PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const control = { height: '36px', boxSizing: 'border-box', fontSize: '0.83rem' };
  const label = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--text-secondary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="directory-card" style={{ overflow: 'hidden' }}>
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="var(--accent)" /> Pay Slip
            </h3>
            <p>
              Pick an employee and a month, then Generate. Details come from the User Directory and the figures from the
              Salary Block for that month; the header uses the Brand Name, Company Name, address and logo from the Company Profile.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', margin: '0 20px 16px', alignItems: 'end' }}>
          <label style={label}>
            Search Employee Name / Code
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Yasmin or UNITEB19"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...control, width: '100%', paddingLeft: '32px', paddingRight: search ? '30px' : '12px' }}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', lineHeight: 1, zIndex: 1 }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </label>
          <label style={label}>
            Employee ({matches.length} of {employees.length}, all branches)
            <select className="form-control" value={userId} onChange={e => setUserId(e.target.value)} style={{ ...control, width: '100%' }}>
              <option value="">Select an employee</option>
              {chosen && !matches.includes(chosen) && (
                <option value={chosen.userId}>{chosen.name}{chosen.employeeId ? ` (${chosen.employeeId})` : ''}</option>
              )}
              {matches.map(e => (
                <option key={e.userId} value={e.userId}>
                  {e.name}{e.employeeId ? ` (${e.employeeId})` : ''}{e.branch ? ` · ${e.branch}` : ''}{e.payType ? '' : ' · no Pay Type'}{e.status !== 'Active' ? ` · ${e.status}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Month
            <input type="month" className="form-control" value={month} onChange={e => changeMonth(e.target.value)} style={{ ...control, width: '100%' }} />
          </label>
          <label style={label}>
            Pay Date
            <input type="date" className="form-control" value={payDate} onChange={e => e.target.value && setPayDate(e.target.value)} style={{ ...control, width: '100%' }} />
          </label>
          <button className="btn-primary" onClick={generate} disabled={loading || !userId} style={{ ...control, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Play size={14} /> {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {listError && <div style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{listError}</div>}
        {error && <div role="alert" style={{ margin: '0 20px 12px', fontSize: '0.82rem', color: 'var(--status-danger)' }}>{error}</div>}
        {chosen && !chosen.payType && !error && (
          <div style={{ margin: '0 20px 12px', fontSize: '0.8rem', color: 'var(--status-warning)' }}>
            {chosen.name} has no Pay Type yet. Set it on the Add User page so the Salary Block can work out their pay.
          </div>
        )}

        {payslip ? (
          <div style={{ padding: '0 20px 24px' }}>
            <Payslip p={payslip} logo={companyProfile?.companyLogo || ''} />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '18px' }}>
              <button className="btn-primary" onClick={download} disabled={downloading} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}>
                <Download size={16} /> {downloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        ) : !error && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            {loading ? 'Generating the payslip...' : 'Pick an employee and a month, then click Generate.'}
          </div>
        )}
      </div>
    </div>
  );
};
