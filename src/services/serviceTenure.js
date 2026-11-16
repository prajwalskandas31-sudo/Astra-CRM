// Service tenure tracking for the Paid block.
// A client's service starts on the day they complete e-KYC & E-Sign and runs for the
// Service Tenure chosen on the Client Information page.

export const PAID_STATUS_ACTIVE = 'Active';
export const PAID_STATUS_EXPIRED = 'Service Expired';

// "Demo" has no length on the Client Information page, so it runs for a fixed trial period
export const DEMO_TENURE_DAYS = 7;

// Within this many days of the end date a record is flagged as expiring soon
export const EXPIRING_SOON_DAYS = 7;

const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD (toISOString would shift the day for IST evenings)
export const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toDateKey(new Date());

const fromDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Leegality returns sign dates as ISO strings or as DD-MM-YYYY / DD/MM/YYYY (optionally with a time).
 * Returns a YYYY-MM-DD key, or null when the value is not a date.
 */
export const parseSignDate = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d) ? null : toDateKey(d);
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return s;
  const d = new Date(s);
  return isNaN(d) ? null : toDateKey(d);
};

/** Last day the service is still running is the day before this; null when the tenure has no known length. */
export const computeServiceEndDate = (startKey, tenure) => {
  if (!startKey || !tenure) return null;
  const start = fromDateKey(startKey);
  const t = String(tenure).trim().toLowerCase();

  if (t === 'demo') {
    start.setDate(start.getDate() + DEMO_TENURE_DAYS);
    return toDateKey(start);
  }

  const months = t.match(/^(\d+)\s*months?$/);
  const years = t.match(/^(\d+)\s*years?$/);
  const addMonths = months ? Number(months[1]) : years ? Number(years[1]) * 12 : null;
  if (!addMonths) return null;

  // Clamp to the month's last day so 31 Jan + 1 month ends on 28/29 Feb, not 3 Mar
  const target = new Date(start.getFullYear(), start.getMonth() + addMonths, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return toDateKey(target);
};

export const daysBetween = (fromKey, toKey) =>
  Math.round((fromDateKey(toKey) - fromDateKey(fromKey)) / 86400000);

export const isTenureOver = (record, today = todayKey()) =>
  !!record?.serviceEndDate && today >= record.serviceEndDate;

/**
 * The record disabled in the Telegram Control Block: every ticked segment cleared (remembered as
 * segmentsBeforeExpiry), so trade calls stop. Mirrors disable() in backend/service_expiry.py.
 */
export const disableTelegram = (record, today = todayKey()) => {
  const segments = Array.isArray(record.segments) ? record.segments : [];
  return {
    ...record,
    segments: [],
    segmentsBeforeExpiry: [...new Set([...(record.segmentsBeforeExpiry || []), ...segments])],
    telegramDisabledAt: record.telegramDisabledAt || new Date().toISOString(),
    expiredAt: record.expiredAt || today
  };
};

/**
 * Tenure progress for display: days used / total / left and a 0-100 percentage.
 */
export const getTenureProgress = (record, today = todayKey()) => {
  if (!record?.serviceStartDate || !record?.serviceEndDate) return null;
  const total = Math.max(1, daysBetween(record.serviceStartDate, record.serviceEndDate));
  const used = Math.min(total, Math.max(0, daysBetween(record.serviceStartDate, today)));
  const left = Math.max(0, daysBetween(today, record.serviceEndDate));
  return { total, used, left, percent: Math.round((used / total) * 100) };
};

// Trading segments a client can be enabled for in the Telegram Control Block; stored on the paid client as `segments`
export const TRADING_SEGMENTS = [
  'NSE DERIVATIVES',
  'MCX DERIVATIVES',
  'BSE DERIVATIVES',
  'NSE BSE Equity'
];

// Which segment boxes start ticked for each service chosen on the Client Information page
const SERVICE_SEGMENTS = {
  'stock cash': ['NSE BSE Equity'],
  'stock future': ['NSE DERIVATIVES'],
  'stock options': ['NSE DERIVATIVES'],
  'index futures': ['NSE DERIVATIVES'],
  'index options': ['NSE DERIVATIVES'],
  'nse derivatives': ['NSE DERIVATIVES'],
  'bullions': ['MCX DERIVATIVES'],
  'base metals': ['MCX DERIVATIVES'],
  'energy': ['MCX DERIVATIVES'],
  'mcx derivatives': ['MCX DERIVATIVES'],
  'bse derivatives': ['BSE DERIVATIVES'],
  'hni options - nse & bse': ['NSE DERIVATIVES', 'BSE DERIVATIVES']
};

/** Default segments for a service name; unknown or custom services start with nothing ticked. */
export const defaultSegmentsForService = (serviceName) =>
  [...(SERVICE_SEGMENTS[String(serviceName || '').trim().replace(/\s+/g, ' ').toLowerCase()] || [])];

/**
 * The Paid block record stored when a client completes e-KYC & E-Sign.
 * Service name and tenure come from the Client Information page.
 */
export const buildPaidClient = ({ sale, clientInfo = {}, lead, eSignRecord, signedAt }) => {
  const serviceStartDate = parseSignDate(signedAt) || todayKey();
  const serviceTenure = eSignRecord?.serviceTenure || clientInfo.serviceTenure || sale?.serviceTenure || lead?.clientInfo?.serviceTenure || '';
  const serviceEndDate = computeServiceEndDate(serviceStartDate, serviceTenure);
  const alreadyOver = !!serviceEndDate && todayKey() >= serviceEndDate;
  const serviceName = clientInfo.serviceName || sale?.serviceOpted || eSignRecord?.serviceName || 'Unspecified Service';
  return {
    id: 'paid-' + (sale?.id || Date.now()),
    saleId: sale?.id,
    leadId: lead?.id || sale?.leadId || null,
    documentId: eSignRecord?.documentId || '',
    clientPrefix: clientInfo.clientPrefix || '',
    clientName: eSignRecord?.clientName || clientInfo.clientName || sale?.clientName || '',
    firmName: clientInfo.firmName || '',
    phone: eSignRecord?.phone || clientInfo.phone1 || sale?.phone1 || lead?.phone || '',
    email: eSignRecord?.email || clientInfo.email || sale?.email || '',
    panNumber: eSignRecord?.panNumber || clientInfo.panNumber || sale?.panNumber || '',
    clientState: clientInfo.clientState || '',
    serviceName,
    serviceTenure: serviceTenure || 'Unspecified Tenure',
    segments: defaultSegmentsForService(serviceName),
    grossSales: eSignRecord?.grossSales || clientInfo.grossSales || sale?.amount || '',
    paymentDate: clientInfo.paymentDate || '',
    submittedByUserId: sale?.submittedByUserId || null,
    submittedBy: sale?.employeeName || '',
    eSignedAt: signedAt || '',
    serviceStartDate,
    serviceEndDate,
    status: alreadyOver ? PAID_STATUS_EXPIRED : PAID_STATUS_ACTIVE,
    expiredAt: alreadyOver ? serviceEndDate : null,
    createdAt: new Date().toISOString()
  };
};
