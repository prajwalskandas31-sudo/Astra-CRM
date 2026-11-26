import React from 'react';
import { Fingerprint, PenLine, Lock } from 'lucide-react';
import { Switch } from './SignatureTypesCard';

export const SALE_SIGNATURE_TYPES = [
  { key: 'aadhaar', label: 'Aadhaar', hint: 'Aadhaar eSign (OTP); adds the Aadhaar e-KYC certificate to the Welcome Kit', Icon: Fingerprint },
  { key: 'virtualSign', label: 'Virtual Sign', hint: 'Client types or draws a signature', Icon: PenLine }
];

/**
 * Sale Approval queue: how this one client signs the Leegality agreement.
 * Exactly one type is on at a time: switching one on turns the other off, and switching the
 * active one off moves to the other, so a client never gets both (or neither).
 * Locked once the agreement is sent, because a sent document keeps its signature types.
 */
export const SaleSignatureTypeToggle = ({ value, onChange, disabled, locked }) => {
  const pick = (key, on) => onChange(on ? key : SALE_SIGNATURE_TYPES.find(t => t.key !== key).key);

  return (
    <div
      role="radiogroup"
      aria-label="Client signature type (Leegality)"
      title={locked ? 'Agreement already sent with this signature type. Delete the e-sign link to change it.' : 'Only one signature type per client'}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px', opacity: locked ? 0.75 : 1 }}
    >
      {SALE_SIGNATURE_TYPES.map(({ key, label, hint, Icon }) => {
        const on = value === key;
        return (
          <div key={key} title={hint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Switch on={on} label={label} disabled={disabled || locked} onChange={v => pick(key, v)} />
            <Icon size={14} color={on ? '#38bdf8' : '#64748b'} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.76rem', fontWeight: on ? 700 : 500, color: on ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {label} <span style={{ fontSize: '0.66rem', fontWeight: 600, color: on ? '#34d399' : '#94a3b8' }}>{on ? 'ON' : 'OFF'}</span>
            </span>
            {locked && on && <Lock size={11} color="#94a3b8" />}
          </div>
        );
      })}
    </div>
  );
};

export default SaleSignatureTypeToggle;
