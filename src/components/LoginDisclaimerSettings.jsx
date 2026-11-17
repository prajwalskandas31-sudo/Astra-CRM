import React, { useEffect, useState } from 'react';
import { ShieldAlert, Eye, Save, RotateCcw, Lock } from 'lucide-react';
import { useCRM, DEFAULT_LOGIN_DISCLAIMER, LOGIN_DISCLAIMER_LIMITS, LOGIN_DISCLAIMER_BUTTON } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { LoginDisclaimerModal } from './LoginDisclaimerModal';

const draftOf = (d) => ({
  enabled: d?.enabled !== false,
  title: d?.title ?? DEFAULT_LOGIN_DISCLAIMER.title,
  message: d?.message ?? DEFAULT_LOGIN_DISCLAIMER.message
});

/** System Settings card: the Super Admin sets the pop-up every user must accept after signing in. */
export const LoginDisclaimerSettings = () => {
  const { loginDisclaimer, updateLoginDisclaimer, currentUser, companyProfile } = useCRM();
  const { showToast } = useToast();
  const canEdit = currentUser?.role === 'Super Admin';  // the server accepts changes from a Super Admin only

  const [draft, setDraft] = useState(() => draftOf(loginDisclaimer));
  const [showPreview, setShowPreview] = useState(false);
  const saved = draftOf(loginDisclaimer);
  const dirty = draft.enabled !== saved.enabled || draft.title !== saved.title || draft.message !== saved.message;

  // The saved settings can arrive from the server after this card opens: follow them unless mid-edit
  useEffect(() => {
    if (!dirty) setDraft(draftOf(loginDisclaimer));
  }, [loginDisclaimer?.enabled, loginDisclaimer?.title, loginDisclaimer?.message]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    const title = draft.title.trim();
    const message = draft.message.trim();
    if (!message) {
      showToast('Enter the disclaimer message users must accept.', 'error');
      return;
    }
    if (title.length > LOGIN_DISCLAIMER_LIMITS.title || message.length > LOGIN_DISCLAIMER_LIMITS.message) {
      showToast('The disclaimer title or message is too long.', 'error');
      return;
    }
    updateLoginDisclaimer({ enabled: draft.enabled, title, message });
    setDraft({ enabled: draft.enabled, title, message });
    showToast(
      draft.enabled
        ? 'Login Disclaimer saved. Every user must accept it at their next sign-in (signed-in users see it again if the text changed).'
        : 'Login Disclaimer saved and turned off. Users will not see it when signing in.',
      'success'
    );
  };

  const counter = (value, limit) => (
    <span style={{ fontSize: '0.72rem', color: value.length > limit ? '#ef4444' : 'var(--text-muted)', fontWeight: 400 }}>
      {value.length} / {limit}
    </span>
  );

  return (
    <div className="directory-card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--accent-primary)" /> Login Disclaimer Pop-up
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '760px' }}>
            Shown to every user immediately after they sign in. The CRM stays locked until they click
            "{LOGIN_DISCLAIMER_BUTTON}" (or they can sign out). It is asked again at every sign-in, and right away if you change the text.
          </p>
        </div>
        <span className="badge" style={{
          backgroundColor: saved.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
          color: saved.enabled ? '#10b981' : 'var(--text-muted)',
          border: `1px solid ${saved.enabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`
        }}>
          {saved.enabled ? 'Active' : 'Off'}
        </span>
      </div>

      {!canEdit && (
        <div className="alert-box alert-warning" style={{ margin: '12px 0' }}>
          <Lock size={14} /> Only a Super Admin can change the Login Disclaimer.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: canEdit ? 'pointer' : 'default', width: 'fit-content' }}>
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          <span>Show this disclaimer to every user after they sign in</span>
        </label>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pop-up Title</span> {counter(draft.title, LOGIN_DISCLAIMER_LIMITS.title)}
          </label>
          <input
            type="text"
            value={draft.title}
            disabled={!canEdit}
            maxLength={LOGIN_DISCLAIMER_LIMITS.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="e.g. Terms & Conditions of Use"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Disclaimer Message * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(plain text; line breaks are kept)</span></span>
            {counter(draft.message, LOGIN_DISCLAIMER_LIMITS.message)}
          </label>
          <textarea
            value={draft.message}
            disabled={!canEdit}
            maxLength={LOGIN_DISCLAIMER_LIMITS.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            rows={12}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
            placeholder="Write the terms and conditions every user must accept..."
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowPreview(true)} disabled={!draft.message.trim()}>
            <Eye size={15} /> Preview Pop-up
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDraft({ ...draft, title: DEFAULT_LOGIN_DISCLAIMER.title, message: DEFAULT_LOGIN_DISCLAIMER.message })}
                title="Put the built-in sample text back into the form (not saved until you click Save)"
              >
                <RotateCcw size={15} /> Use Sample Text
              </button>
              {dirty && (
                <button type="button" className="btn-secondary" onClick={() => setDraft(saved)}>
                  Discard Changes
                </button>
              )}
              <button type="button" className="btn-primary" onClick={handleSave} disabled={!dirty} style={{ marginLeft: 'auto', opacity: dirty ? 1 : 0.6 }}>
                <Save size={15} /> Save Disclaimer
              </button>
            </>
          )}
        </div>
      </div>

      {showPreview && (
        <LoginDisclaimerModal
          preview
          title={draft.title.trim()}
          message={draft.message.trim()}
          companyName={companyProfile?.companyName}
          userName={currentUser?.name}
          onClosePreview={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default LoginDisclaimerSettings;
