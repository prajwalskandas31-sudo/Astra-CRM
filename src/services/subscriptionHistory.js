// Subscription history for an existing (Old) client on the Client Information Page.
//
// A client's services come from two places:
//   - the Paid block (paidClients): a New Client sale once e-KYC & E-Sign is done, with real start/end dates
//   - sales: Old Client payments (no Paid record; their expiry is stored on the sale as serviceEndDate),
//     and sales still on their way through review
// A record belongs to the client when it shares the lead, a phone number or a valid PAN.

import { computeServiceEndDate, isTenureOver, todayKey, PAID_STATUS_EXPIRED } from './serviceTenure';

export const SUB_ACTIVE = 'Active';
export const SUB_EXPIRED = 'Expired';
export const SUB_PENDING = 'Pending';

const OLD_CLIENT = 'Old Client';
const OLD_CLIENT_APPROVED = 'Old Client - Approved';
const CONVERTED = 'E-Signed & Converted';
// Sales that never became a service
const DEAD_SALE_STATUSES = ['Rejected by Super Admin', 'Rejected', 'Rejected in Telegram Review', 'Old Client - Declined'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD as "10 Feb 2027"; anything else is returned as given. */
export const formatDay = (key) => {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (key || '—');
};

const phoneKey = (p) => {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
};

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const panKey = (pan) => {
  const p = String(pan || '').trim().toUpperCase();
  return PAN_RE.test(p) ? p : '';
};

const dateKey = (v) => {
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

const statusFromEnd = (end, today) => (end && today >= end ? SUB_EXPIRED : SUB_ACTIVE);

/**
 * Every service the client has had, newest first within: Active, then Pending, then Expired.
 * openSaleStatuses: the lead's sales in these statuses are left out, since submitting this page replaces them.
 */
export const buildSubscriptionHistory = ({
  lead, panNumber = '', phones = [], paidClients = [], sales = [], openSaleStatuses = [], today = todayKey()
}) => {
  if (!lead) return [];
  const leadId = lead.id;
  const phoneSet = new Set([lead.phone, lead.clientInfo?.phone1, lead.clientInfo?.phone2, ...phones].map(phoneKey).filter(Boolean));
  const panSet = new Set([panNumber, lead.clientInfo?.panNumber].map(panKey).filter(Boolean));

  const belongs = (rec, recPhones, recPan) =>
    (leadId && rec.leadId === leadId)
    || recPhones.some(p => phoneSet.has(phoneKey(p)))
    || (!!panKey(recPan) && panSet.has(panKey(recPan)));

  const entries = [];
  const paidSaleIds = new Set();

  for (const p of paidClients || []) {
    if (!p || !belongs(p, [p.phone], p.panNumber)) continue;
    if (p.saleId) paidSaleIds.add(p.saleId);
    const expired = p.status === PAID_STATUS_EXPIRED || isTenureOver(p, today);
    entries.push({
      id: p.id,
      source: 'paid',
      clientType: 'New Client',
      serviceName: p.serviceName || 'Unspecified Service',
      serviceTenure: p.serviceTenure || '',
      startDate: p.serviceStartDate || '',
      endDate: p.serviceEndDate || '',
      status: expired ? SUB_EXPIRED : SUB_ACTIVE,
      amount: p.grossSales || '',
      saleId: p.saleId || null
    });
  }

  for (const s of sales || []) {
    if (!s || paidSaleIds.has(s.id) || DEAD_SALE_STATUSES.includes(s.status)) continue;
    if (s.leadId === leadId && openSaleStatuses.includes(s.status)) continue;
    const info = s.fullClientInfo || {};
    if (!belongs(s, [s.phone1, s.phone2, info.phone1, info.phone2], s.panNumber || info.panNumber)) continue;

    const oldClient = s.clientType === OLD_CLIENT;
    const done = oldClient ? s.status === OLD_CLIENT_APPROVED : s.status === CONVERTED;
    const tenure = s.serviceTenure || info.serviceTenure || '';
    const startDate = dateKey(info.paymentDate) || dateKey(s.date);
    const endDate = s.serviceEndDate || info.serviceEndDate || (done ? computeServiceEndDate(startDate, tenure) : '') || '';
    entries.push({
      id: s.id,
      source: 'sale',
      clientType: oldClient ? OLD_CLIENT : 'New Client',
      serviceName: s.serviceOpted || info.serviceName || 'Unspecified Service',
      serviceTenure: tenure,
      startDate,
      endDate,
      status: done ? statusFromEnd(endDate, today) : SUB_PENDING,
      pendingStage: done ? '' : (s.stage || s.status || ''),
      expiryInherited: !!(s.expiryInherited || info.expiryInherited),
      amount: s.grossSales || '',
      saleId: s.id
    });
  }

  const rank = { [SUB_ACTIVE]: 0, [SUB_PENDING]: 1, [SUB_EXPIRED]: 2 };
  return entries.sort((a, b) =>
    rank[a.status] - rank[b.status]
    || (b.endDate || '').localeCompare(a.endDate || '')
    || (b.startDate || '').localeCompare(a.startDate || ''));
};

/** Active subscriptions a new payment can join: one per expiry date, the latest first. */
export const activeSubscriptions = (history) => {
  const active = history.filter(e => e.status === SUB_ACTIVE && e.endDate);
  // A payment that joined a subscription shares its expiry date; name the subscription it joined
  const ordered = [...active.filter(e => !e.expiryInherited), ...active.filter(e => e.expiryInherited)];
  const seen = new Set();
  return ordered
    .filter(e => (seen.has(e.endDate) ? false : seen.add(e.endDate)))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
};
