import React from 'react';
import { Wallet, Plus, Trash2 } from 'lucide-react';

// "Mode of Payment" block of the Client Information Page (New and Old Client): up to 10 rows,
// each a payment mode the user types or picks (UPI, NEFT, Cash...) and the amount paid through it.
export const MAX_PAYMENT_MODES = 10;
export const PAYMENT_MODE_SUGGESTIONS = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cash', 'Cheque', 'Debit Card', 'Credit Card', 'Net Banking', 'Payment Gateway'];

export const emptyPaymentMode = () => ({ mode: '', amount: '' });
export const emptyPaymentModes = () => [emptyPaymentMode()];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const paymentModesTotal = (rows) => round2((rows || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0));

// Credit Card and Payment Gateway payments lose a 2% charge, so only 98% of them counts as Gross Sales
export const CARD_FEE_RATE = 0.02;
export const isCardFeeMode = (mode) => /credits*card|payments*gateway/i.test(mode || '');

export const cardFeeTotal = (rows) => round2((rows || []).reduce(
  (sum, r) => sum + (isCardFeeMode(r.mode) ? (parseFloat(r.amount) || 0) * CARD_FEE_RATE : 0), 0));

// Gross Sales (A) = everything paid, less the 2% charge on Credit Card / Payment Gateway amounts
export const grossFromPaymentModes = (rows) => round2(paymentModesTotal(rows) - cardFeeTotal(rows));

// Field errors keyed by row ("mode_0", "amount_0") plus "total"; empty object when valid
export const validatePaymentModes = (rows, grossSales) => {
  const errors = {};
  const list = rows || [];
  if (!list.length) errors.total = 'Add at least 1 mode of payment';
  if (list.length > MAX_PAYMENT_MODES) errors.total = `Up to ${MAX_PAYMENT_MODES} modes of payment`;
  const seen = new Set();
  list.forEach((r, i) => {
    const name = (r.mode || '').trim();
    if (!name) errors[`mode_${i}`] = 'Enter the payment mode';
    else if (seen.has(name.toLowerCase())) errors[`mode_${i}`] = `"${name}" is listed twice`;
    seen.add(name.toLowerCase());
    if (!(parseFloat(r.amount) > 0)) errors[`amount_${i}`] = 'Enter an amount above 0';
  });
  // Gross Sales is filled from these rows; a stale value (e.g. an older saved sale) must be refreshed
  const gross = round2(parseFloat(grossSales) || 0);
  const expected = grossFromPaymentModes(list);
  if (!errors.total && expected > 0 && Math.abs(gross - expected) > 0.01) {
    errors.total = `Gross Sales ₹${gross.toLocaleString('en-IN')} does not match the Mode of Payment (₹${expected.toLocaleString('en-IN')})`;
  }
  return errors;
};

// What gets saved on the sale
export const paymentModesPayload = (rows) => (rows || [])
  .map(r => ({ mode: (r.mode || '').trim(), amount: round2(parseFloat(r.amount) || 0) }))
  .filter(r => r.mode);

// Saved rows back into form rows (a sale sent back for changes keeps its payment modes)
export const paymentModesFromSaved = (saved) => (Array.isArray(saved) && saved.length
  ? saved.slice(0, MAX_PAYMENT_MODES).map(r => ({ mode: r?.mode || '', amount: r?.amount != null ? String(r.amount) : '' }))
  : emptyPaymentModes());

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PaymentModesSection = ({ rows, onChange, errors = {} }) => {
  const total = paymentModesTotal(rows);
  const fee = cardFeeTotal(rows);
  const gross = grossFromPaymentModes(rows);

  const update = (idx, patch) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const add = () => { if (rows.length < MAX_PAYMENT_MODES) onChange([...rows, emptyPaymentMode()]); };
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wallet size={14} /> Mode of Payment <span style={{ color: '#ef4444' }}>*</span>
        </label>
        {rows.length < MAX_PAYMENT_MODES && (
          <button type="button" onClick={add} style={{
            background: 'rgba(99, 102, 241, 0.12)', border: '1px solid var(--accent-border)', color: 'var(--accent)',
            borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <Plus size={13} /> Add Payment Mode ({rows.length}/{MAX_PAYMENT_MODES})
          </button>
        )}
      </div>

      <datalist id="payment-mode-suggestions">
        {PAYMENT_MODE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
      </datalist>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((r, idx) => {
          const modeErr = errors[`mode_${idx}`];
          const amountErr = errors[`amount_${idx}`];
          return (
            <div key={idx}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(110px, 160px) 34px', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}.</span>
                <input type="text" list="payment-mode-suggestions" value={r.mode} maxLength={60}
                  onChange={(e) => update(idx, { mode: e.target.value })}
                  aria-label={`Payment mode ${idx + 1}`}
                  placeholder="Mode (e.g. UPI, NEFT, Cash or type your own)"
                  className={modeErr ? 'client-form-input-error' : ''}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', borderColor: modeErr ? '#ef4444' : undefined }} />
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>₹</span>
                  <input type="number" min="0" step="0.01" value={r.amount}
                    onChange={(e) => update(idx, { amount: e.target.value })}
                    aria-label={`Amount for payment mode ${idx + 1}`}
                    placeholder="Amount"
                    className={amountErr ? 'client-form-input-error' : ''}
                    style={{ width: '100%', padding: '7px 10px 7px 22px', fontSize: '0.82rem', borderColor: amountErr ? '#ef4444' : undefined }} />
                </div>
                <button type="button" onClick={() => remove(idx)} disabled={rows.length <= 1}
                  aria-label={`Delete payment mode ${idx + 1}`}
                  title={rows.length <= 1 ? 'At least 1 mode of payment is needed' : 'Delete'}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444',
                    borderRadius: 'var(--radius-sm)', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: rows.length <= 1 ? 'not-allowed' : 'pointer', opacity: rows.length <= 1 ? 0.4 : 1
                  }}>
                  <Trash2 size={13} />
                </button>
              </div>
              {(modeErr || amountErr) && (
                <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '3px', paddingLeft: '36px' }}>{modeErr || amountErr}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '8px', padding: '8px 10px',
        fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99, 102, 241, 0.05)'
      }}>
        <span>Total paid: <strong>{inr(total)}</strong></span>
        {fee > 0 && <span>Card / Gateway charge (2%): <strong style={{ color: '#ef4444' }}>− {inr(fee)}</strong></span>}
        <span>Gross Sales (A): <strong style={{ color: '#10b981' }}>{inr(gross)}</strong></span>
      </div>
      {errors.total && <span style={{ color: '#ef4444', fontSize: '0.74rem', display: 'block', marginTop: '4px' }}>{errors.total}</span>}
    </div>
  );
};

export default PaymentModesSection;
