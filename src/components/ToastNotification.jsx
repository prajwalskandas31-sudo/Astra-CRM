import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const MAX_TOASTS = 5;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Errors stay until dismissed so failures can't go unnoticed; warnings (mostly form hints) linger longer than info.
  const addToast = useCallback((message, type = 'success', duration) => {
    const id = Date.now() + Math.random();
    const sticky = duration === undefined ? type === 'error' : duration === 0;
    setToasts((prev) => {
      const withoutDuplicate = prev.filter((t) => !(t.message === message && t.type === type));
      return [...withoutDuplicate, { id, message, type, sticky }].slice(-MAX_TOASTS);
    });

    if (!sticky) {
      setTimeout(() => {
        removeToast(id);
      }, duration ?? (type === 'warning' ? 8000 : 5000));
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast: addToast, addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.type}${toast.sticky ? ' toast-sticky' : ''}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <div className="toast-icon">
              {toast.type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
              {toast.type === 'warning' && <AlertTriangle size={18} color="#f59e0b" />}
              {toast.type === 'error' && <XCircle size={18} color="#ef4444" />}
              {toast.type === 'info' && <Info size={18} color="var(--accent-primary)" />}
            </div>
            <div className="toast-message">{toast.message}</div>
            <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification" title="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    const noop = (msg) => console.log(msg);
    return { showToast: noop, addToast: noop };
  }
  return ctx;
};
