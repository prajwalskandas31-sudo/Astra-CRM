import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, MessageSquare } from 'lucide-react';

/**
 * In-app replacement for the browser's confirm() / prompt() pop-ups, styled like the rest of the CRM.
 *
 *   if (!(await confirmAsync('Delete this branch?', { danger: true }))) return;
 *   const note = await promptAsync('Follow-up note (optional):');   // null when cancelled
 *
 * <ConfirmDialogHost /> is mounted once in App.jsx; the helpers work from any component or plain function.
 * Options: title, confirmLabel, cancelLabel, danger (red button), requireText (the user must type this
 * exact text before the confirm button unlocks, for actions that wipe a lot of data).
 */
let openDialog = null;

const ask = (kind, message, options) => {
  if (!openDialog) {
    // Host not mounted (should not happen): fall back to the browser dialog rather than silently proceeding
    // eslint-disable-next-line no-alert
    return Promise.resolve(kind === 'prompt' ? window.prompt(message, options.defaultValue || '') : window.confirm(message));
  }
  return new Promise(resolve => openDialog({ kind, message, ...options, resolve }));
};

export const confirmAsync = (message, options = {}) => ask('confirm', message, options);
export const promptAsync = (message, options = {}) => ask('prompt', message, options);

export const ConfirmDialogHost = () => {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const queue = useRef([]);
  const confirmRef = useRef(null);
  const inputRef = useRef(null);
  const restoreFocus = useRef(null);

  const current = useRef(null);

  const show = useCallback((next) => {
    current.current = next;
    if (next) {
      restoreFocus.current = document.activeElement;
      setValue(next.defaultValue || '');
    }
    setDialog(next);
  }, []);

  useEffect(() => {
    openDialog = (d) => {
      if (current.current) queue.current.push(d);
      else show(d);
    };
    return () => { openDialog = null; };
  }, [show]);

  useEffect(() => {
    if (!dialog) return;
    const t = setTimeout(() => (dialog.kind === 'prompt' || dialog.requireText ? inputRef.current : confirmRef.current)?.focus(), 0);
    return () => clearTimeout(t);
  }, [dialog]);

  const close = (result) => {
    dialog.resolve(result);
    const next = queue.current.shift();
    if (next) { show(next); return; }
    show(null);
    try { restoreFocus.current?.focus?.(); } catch { /* element gone */ }
  };

  if (!dialog) return null;

  const isPrompt = dialog.kind === 'prompt';
  const locked = !!dialog.requireText && value.trim() !== dialog.requireText;
  const accept = () => { if (!locked) close(isPrompt ? value : true); };
  const cancel = () => close(isPrompt ? null : false);
  const Icon = isPrompt ? MessageSquare : dialog.danger ? AlertTriangle : HelpCircle;
  const tone = dialog.danger ? '#f43f5e' : 'var(--accent-primary)';
  const title = dialog.title || (isPrompt ? 'Add a note' : dialog.danger ? 'Please confirm' : 'Are you sure?');

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); return; }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); accept(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...e.currentTarget.querySelectorAll('button:not([disabled]), input, textarea')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="modal-overlay confirm-dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }} onKeyDown={onKeyDown}>
      <div className="modal-content confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div className="confirm-dialog-body">
          <span className="confirm-dialog-icon" style={{ color: tone, backgroundColor: dialog.danger ? 'rgba(244, 63, 94, 0.12)' : 'var(--accent-soft)' }}>
            <Icon size={20} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 id="confirm-dialog-title">{title}</h3>
            <p id="confirm-dialog-message">{dialog.message}</p>
            {(isPrompt || dialog.requireText) && (
              <>
                {dialog.requireText && (
                  <label className="confirm-dialog-hint" htmlFor="confirm-dialog-input">
                    Type <strong>{dialog.requireText}</strong> to continue.
                  </label>
                )}
                <input
                  id="confirm-dialog-input"
                  ref={inputRef}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={dialog.placeholder || ''}
                  maxLength={500}
                  autoComplete="off"
                  className="confirm-dialog-input"
                />
              </>
            )}
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-secondary" onClick={cancel}>{dialog.cancelLabel || 'Cancel'}</button>
          <button
            type="button"
            ref={confirmRef}
            className={dialog.danger ? 'btn-danger confirm-dialog-danger' : 'btn-primary'}
            onClick={accept}
            disabled={locked}
          >
            {dialog.confirmLabel || (isPrompt ? 'Save' : 'Continue')}
          </button>
        </div>
      </div>
    </div>
  );
};
