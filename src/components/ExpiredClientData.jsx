import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useCRM } from '../context/CRMContext';
import { CalendarClock, Download, Search } from 'lucide-react';
import { parseSignDate, daysBetween, todayKey, toDateKey } from '../services/serviceTenure';

// The e-Sign tenure counted here: one year from the day the client e-signed
export const ESIGN_TENURE_DAYS = 365;

const WINDOWS = [
  { value: '30', label: 'Within 30 days (incl. completed)' },
  { value: '60', label: 'Within 60 days (incl. completed)' },
  { value: '90', label: 'Within 90 days (incl. completed)' },
  { value: 'expired', label: 'Completed 365 days only' },
  { value: 'all', label: 'All e-signed clients' }
];

const keyOf = (pan, phone) => {
  const p = String(pan || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (p) return `pan:${p}`;
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return digits ? `phone:${digits}` : '';
};

const addDays = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
};

const formatDay = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * One row per client (PAN, or mobile without a PAN) from their latest e-Sign: days elapsed since that
 * e-Sign and days remaining to complete 365 days, counted from today.
 */
export const buildExpiryRows = ({ eSignRecords = [], paidClients = [], sales = [] }, today = todayKey()) => {
  const byClient = new Map();
  const consider = (rec) => {
    const day = parseSignDate(rec.signedAt);
    const key = keyOf(rec.panNumber, rec.phone) || (rec.saleId ? `sale:${rec.saleId}` : '');
    if (!day || !key) return;
    const prev = byClient.get(key);
    if (!prev || day > prev.eSignDate) byClient.set(key, { ...rec, key, eSignDate: day });
  };
  eSignRecords.forEach(r => consider({
    saleId: r.saleId, clientName: [r.clientPrefix, r.clientName].filter(Boolean).join(' '), panNumber: r.panNumber,
    phone: r.phone, email: r.email, serviceName: r.serviceName, serviceTenure: r.serviceTenure, signedAt: r.confirmedAt,
    documentId: r.documentId
  }));
  paidClients.filter(p => !p.extendedService).forEach(p => consider({
    saleId: p.saleId, clientName: [p.clientPrefix, p.clientName].filter(Boolean).join(' '), panNumber: p.panNumber,
    phone: p.phone, email: p.email, serviceName: p.serviceName, serviceTenure: p.serviceTenure,
    signedAt: p.eSignedAt || p.serviceStartDate, documentId: p.documentId
  }));
  sales.filter(s => s.eSignStatus === 'Completed' && s.eSignedAt).forEach(s => {
    const info = s.fullClientInfo || s.clientInfo || {};
    consider({
      saleId: s.id, clientName: [info.clientPrefix, info.clientName || s.clientName].filter(Boolean).join(' '),
      panNumber: info.panNumber || s.panNumber, phone: info.phone1 || s.phone1, email: info.email || s.email,
      serviceName: info.serviceName || s.serviceOpted, serviceTenure: info.serviceTenure || s.serviceTenure,
      signedAt: s.eSignedAt, documentId: s.eSignDocumentId
    });
  });

  return [...byClient.values()].map(r => {
    const elapsed = Math.max(0, daysBetween(r.eSignDate, today));
    const remaining = ESIGN_TENURE_DAYS - elapsed;
    return { ...r, elapsed, remaining, completesOn: addDays(r.eSignDate, ESIGN_TENURE_DAYS) };
  }).sort((a, b) => a.remaining - b.remaining || a.clientName.localeCompare(b.clientName));
};

const statusOf = (r) => {
  if (r.remaining <= 0) return { label: 'Completed 365 days', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (r.remaining <= 30) return { label: 'Expiring soon', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
};

/** E-Sign Block → Expired Client Data. */
export const ExpiredClientData = () => {
  const { eSignRecords = [], paidClients = [], sales = [] } = useCRM();
  const [windowDays, setWindowDays] = useState('30');
  const [query, setQuery] = useState('');

  const all = useMemo(() => buildExpiryRows({ eSignRecords, paidClients, sales }), [eSignRecords, paidClients, sales]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter(r => windowDays === 'all' || (windowDays === 'expired' ? r.remaining <= 0 : r.remaining <= Number(windowDays)))
      .filter(r => !q || [r.clientName, r.panNumber, r.phone, r.email, r.serviceName].some(v => String(v || '').toLowerCase().includes(q)));
  }, [all, windowDays, query]);

  const counts = useMemo(() => ({
    completed: all.filter(r => r.remaining <= 0).length,
    soon: all.filter(r => r.remaining > 0 && r.remaining <= 30).length
  }), [all]);

  const exportExcel = () => {
    const aoa = [['Client', 'PAN', 'Phone', 'Email', 'Service', 'Tenure', 'e-Sign Date', 'Days Since e-Sign',
      'Days Remaining to 365', '365 Days Complete On', 'Status']];
    rows.forEach(r => aoa.push([r.clientName, r.panNumber || '', r.phone || '', r.email || '', r.serviceName || '', r.serviceTenure || '',
      r.eSignDate, r.elapsed, Math.max(0, r.remaining), r.completesOn, statusOf(r).label]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Expired Client Data');
    XLSX.writeFile(wb, `Expired Client Data ${todayKey()}.xlsx`);
  };

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarClock size={18} color="#f59e0b" /> Expired Client Data
          </h3>
          <p>
            Clients whose e-Sign tenure ({ESIGN_TENURE_DAYS} days from their latest e-Sign) is ending, counted from today:
            {' '}<strong style={{ color: '#ef4444' }}>{counts.completed}</strong> completed 365 days,
            {' '}<strong style={{ color: '#f59e0b' }}>{counts.soon}</strong> within 30 days.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search client, PAN, phone…"
              style={{ paddingLeft: '30px', minWidth: '220px' }} />
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <select value={windowDays} onChange={e => setWindowDays(e.target.value)} aria-label="Show clients">
            {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={exportExcel} disabled={!rows.length}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>PAN</th>
              <th>Phone</th>
              <th>Service</th>
              <th>e-Sign Date</th>
              <th>Days Since e-Sign</th>
              <th>Days Remaining (to 365)</th>
              <th>365 Days Complete On</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  {all.length ? 'No client in this window.' : 'No e-signed clients yet.'}
                </td>
              </tr>
            ) : rows.map(r => {
              const st = statusOf(r);
              return (
                <tr key={r.key}>
                  <td style={{ fontWeight: 600 }}>{r.clientName || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{r.panNumber || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{r.phone || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{r.serviceName || '—'}{r.serviceTenure ? ` (${r.serviceTenure})` : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDay(r.eSignDate)}</td>
                  <td style={{ fontWeight: 600 }}>{r.elapsed}</td>
                  <td style={{ fontWeight: 700, color: st.color }}>
                    {r.remaining > 0 ? r.remaining : `0 (${-r.remaining} over)`}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDay(r.completesOn)}</td>
                  <td>
                    <span style={{ color: st.color, background: st.bg, padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpiredClientData;
