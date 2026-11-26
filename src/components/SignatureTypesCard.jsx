import React, { useEffect, useState } from 'react';
import { Fingerprint, PenLine, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSignatureTypes, saveSignatureTypes } from '../services/leegalityService';
import { useToast } from './ToastNotification';

const TYPES = [
  { key: 'aadhaar', label: 'Aadhaar', hint: 'Aadhaar eSign (OTP); adds the Aadhaar e-KYC certificate to the Welcome Kit', Icon: Fingerprint },
  { key: 'virtualSign', label: 'Virtual Sign', hint: 'Client types or draws a signature', Icon: PenLine }
];
const COMBOS = ['aadhaar', 'virtualSign', 'both'];

const comboOf = ({ aadhaar, virtualSign }) =>
  aadhaar && virtualSign ? 'both' : aadhaar ? 'aadhaar' : virtualSign ? 'virtualSign' : null;

export const Switch = ({ on, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    style={{
      width: '40px', height: '22px', borderRadius: '11px', border: 'none', padding: '2px', flexShrink: 0,
      backgroundColor: on ? '#0284c7' : 'rgba(148, 163, 184, 0.35)',
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s ease', position: 'relative'
    }}
  >
    <span style={{
      display: 'block', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff',
      transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.15s ease'
    }} />
  </button>
);

/**
 * E-Sign Block > Client Signature Types: turn Aadhaar / Virtual Sign on or off for the client.
 * Leegality's API cannot set signature types per document, so each combination is sent through
 * its own Leegality workflow, and the backend cancels any document whose types do not match.
 */
export const SignatureTypesCard = () => {
  const { showToast } = useToast();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSignatureTypes()
      .then(cfg => { setSaved(cfg); setDraft(cfg); })
      .catch(err => setError(err.message));
  }, []);

  if (error && !draft) {
    return (
      <div style={cardStyle}>
        <Header />
        <div style={{ color: '#f87171', fontSize: '0.8rem', display: 'flex', gap: '6px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> Could not load the signature settings: {error}
        </div>
      </div>
    );
  }
  if (!draft) return <div style={cardStyle}><Header /><div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>Loading…</div></div>;

  const combo = comboOf(draft);
  const labels = draft.comboLabels || {};
  const activeWorkflow = combo ? (draft.workflows[combo] || '').trim() : '';
  const dirty = JSON.stringify([draft.aadhaar, draft.virtualSign, draft.workflows]) !==
    JSON.stringify([saved.aadhaar, saved.virtualSign, saved.workflows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = await saveSignatureTypes(draft);
      setSaved(cfg);
      setDraft(cfg);
      showToast(`Saved. New agreements go through Leegality workflow ${cfg.activeWorkflow} (${labels[cfg.activeCombo]}).`, 'success');
    } catch (err) {
      showToast(`Not saved: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <Header />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {TYPES.map(({ key, label, hint, Icon }) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px',
            border: `1px solid ${draft[key] ? 'rgba(2, 132, 199, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
            backgroundColor: draft[key] ? 'rgba(2, 132, 199, 0.1)' : 'rgba(255, 255, 255, 0.02)'
          }}>
            <Switch on={!!draft[key]} label={label} disabled={saving} onChange={v => setDraft({ ...draft, [key]: v })} />
            <Icon size={18} color={draft[key] ? '#38bdf8' : '#64748b'} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #ffffff)' }}>
                {label} <span style={{ fontWeight: 600, fontSize: '0.72rem', color: draft[key] ? '#34d399' : '#94a3b8' }}>{draft[key] ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '8px' }}>
        Leegality workflow for each combination
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {COMBOS.map(c => (
          <label key={c} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem', color: c === combo ? '#38bdf8' : 'var(--text-muted, #94a3b8)', fontWeight: c === combo ? 700 : 500 }}>
            {labels[c] || c}{c === combo ? ' (in use)' : ''}
            <input
              type="text"
              value={draft.workflows[c] || ''}
              placeholder="Workflow ID, e.g. KKliSJp"
              disabled={saving}
              onChange={e => setDraft({ ...draft, workflows: { ...draft.workflows, [c]: e.target.value } })}
              style={{
                padding: '7px 10px', fontSize: '0.8rem', borderRadius: '6px', fontFamily: 'monospace',
                backgroundColor: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-primary, #ffffff)',
                border: `1px solid ${c === combo ? 'rgba(2, 132, 199, 0.6)' : 'var(--border-subtle, rgba(255, 255, 255, 0.12))'}`
              }}
            />
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.76rem', display: 'flex', alignItems: 'flex-start', gap: '6px', color: !combo || !activeWorkflow ? '#f87171' : '#94a3b8', maxWidth: '720px' }}>
          {!combo ? (
            <><AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> Turn on at least one signature type.</>
          ) : !activeWorkflow ? (
            <><AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> Enter the workflow ID for "{labels[combo]}". In Leegality, copy workflow {saved.workflows.virtualSign || 'KKliSJp'}, set its Signature Type to {labels[combo]}, and paste the new workflow's profileId here.</>
          ) : (
            <><CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} /> New agreements go through workflow <code>{activeWorkflow}</code>. If Leegality applies different signature types, the CRM cancels the document and shows the error.</>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || !combo || !activeWorkflow}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, opacity: saving || !dirty || !combo || !activeWorkflow ? 0.55 : 1 }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Signature Types'}
        </button>
      </div>
    </div>
  );
};

const cardStyle = {
  backgroundColor: 'var(--bg-card, #1e293b)',
  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
  borderRadius: '10px',
  padding: '20px 24px',
  marginBottom: '24px'
};

const Header = () => (
  <div style={{ marginBottom: '14px' }}>
    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary, #ffffff)' }}>
      Client Signature Types (Leegality)
    </h3>
    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
      Choose how clients may sign. Applies to every agreement sent after saving; agreements already sent keep their types.
    </span>
  </div>
);

export default SignatureTypesCard;
