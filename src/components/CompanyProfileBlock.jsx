import React, { useEffect, useState } from 'react';
import { useCRM, DEFAULT_COMPANY_PROFILE } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Building2, Save, RotateCcw } from 'lucide-react';

const FIELDS = [
  { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'e.g. Astra Research Pvt. Ltd.', autoComplete: 'organization' },
  { key: 'sebiRegistrationNumber', label: 'SEBI Registration Number', type: 'text', placeholder: 'e.g. INH000000000' },
  { key: 'contact', label: 'Contact', type: 'tel', placeholder: 'e.g. +91 98765 43210', autoComplete: 'tel' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'e.g. support@company.com', autoComplete: 'email' },
  { key: 'website', label: 'Website', type: 'text', placeholder: 'e.g. www.company.com', autoComplete: 'url' }
];

const pick = (profile) => Object.fromEntries(FIELDS.map(f => [f.key, profile?.[f.key] ?? DEFAULT_COMPANY_PROFILE[f.key]]));

export const CompanyProfileBlock = () => {
  const { companyProfile, updateCompanyProfile, currentUser } = useCRM();
  const { showToast } = useToast();
  // The server only accepts changes from a Super Admin; everyone else sees the profile read-only
  const canEdit = currentUser?.role === 'Super Admin';

  const saved = pick(companyProfile);
  const [draft, setDraft] = useState(saved);
  const dirty = FIELDS.some(f => draft[f.key] !== saved[f.key]);

  // Show changes saved elsewhere unless this user is in the middle of editing
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) setDraft(saved);
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = Object.fromEntries(FIELDS.map(f => [f.key, (draft[f.key] || '').trim()]));
    cleaned.sebiRegistrationNumber = cleaned.sebiRegistrationNumber.toUpperCase();
    if (!cleaned.companyName) {
      showToast('Company Name is required.', 'error');
      return;
    }
    updateCompanyProfile(cleaned);
    setDraft(cleaned);
    showToast('Company Profile saved.', 'success');
  };

  return (
    <div className="directory-card" style={{ overflow: 'hidden' }}>
      <div className="directory-toolbar">
        <div className="directory-title-area">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--accent)" /> Company Profile
          </h3>
          <p>
            {canEdit
              ? 'The company details used across the CRM. Changes are shared with every user.'
              : 'The company details used across the CRM. Only a Super Admin can change them.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        <div className="form-grid">
          {FIELDS.map(f => (
            <div className="form-group" key={f.key}>
              <label htmlFor={`company-${f.key}`}>
                {f.label}{f.key === 'companyName' && canEdit ? ' *' : ''}
              </label>
              <input
                id={`company-${f.key}`}
                type={f.type}
                value={draft[f.key]}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={canEdit ? f.placeholder : '—'}
                autoComplete={f.autoComplete}
                readOnly={!canEdit}
                required={f.key === 'companyName'}
                style={f.key === 'sebiRegistrationNumber' ? { textTransform: 'uppercase', fontFamily: 'monospace' } : undefined}
              />
            </div>
          ))}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDraft(saved)}
              disabled={!dirty}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} /> Discard
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!dirty}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={14} /> Save Profile
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
