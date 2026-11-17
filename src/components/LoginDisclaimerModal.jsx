import React, { useEffect, useRef } from 'react';
import { ShieldAlert, LogOut, CheckCircle2, Loader2 } from 'lucide-react';
import { LOGIN_DISCLAIMER_BUTTON } from '../context/CRMContext';

/**
 * Mandatory pop-up shown right after sign-in. App.jsx renders it instead of the CRM, so nothing else
 * can be used until the user accepts it (or signs out). It cannot be closed with Escape or by clicking
 * outside. `preview` shows the same pop-up from System Settings, closable, without accepting anything.
 */
export const LoginDisclaimerModal = ({
  title,
  message,
  companyName,
  userName,
  ready = true,
  onAccept,
  onSignOut,
  preview = false,
  onClosePreview
}) => {
  const acceptRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (ready) acceptRef.current?.focus();
  }, [ready]);

  // Keep keyboard focus inside the pop-up; Escape only closes the Settings preview
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (preview) onClosePreview?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), [tabindex="0"]') || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1000, backgroundColor: preview ? undefined : 'var(--bg-app, #090a0f)' }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        className="modal-content"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="login-disclaimer-title"
        aria-describedby="login-disclaimer-message"
        style={{ maxWidth: '640px' }}
      >
        <div className="modal-header" style={{ justifyContent: 'flex-start', gap: '12px' }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)'
          }}>
            <ShieldAlert size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 id="login-disclaimer-title" style={{ margin: 0, overflowWrap: 'anywhere' }}>
              {title || 'Terms & Conditions'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {preview
                ? 'Preview: this is what every user sees right after signing in.'
                : `${companyName ? `${companyName} · ` : ''}Please read before continuing${userName ? `, ${userName}` : ''}.`}
            </p>
          </div>
        </div>

        <div
          id="login-disclaimer-message"
          className="modal-body"
          tabIndex={0}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontSize: '0.88rem',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            maxHeight: '55vh'
          }}
        >
          {ready ? message : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="animate-spin" /> Loading the latest terms and conditions...
            </span>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {preview ? (
            <button type="button" className="btn-secondary" onClick={onClosePreview}>
              Close Preview
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={onSignOut} title="Sign out without accepting">
              <LogOut size={15} /> Sign Out
            </button>
          )}
          <button
            ref={acceptRef}
            type="button"
            className="btn-primary"
            disabled={!ready}
            onClick={preview ? onClosePreview : onAccept}
            style={{ opacity: ready ? 1 : 0.6, cursor: ready ? 'pointer' : 'not-allowed' }}
          >
            <CheckCircle2 size={16} /> {LOGIN_DISCLAIMER_BUTTON}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginDisclaimerModal;
