import React from 'react';
import { useCRM } from '../context/CRMContext';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Check, 
  ArrowRight, 
  PhoneCall, 
  FileSignature, 
  Mail,
  ShieldCheck,
  X
} from 'lucide-react';

export const NotificationBar = ({
  isOpen,
  onClose,
  onOpenReviewModal = null,
  onOpenESignModal = null
}) => {
  const { 
    notifications = [], 
    markNotificationRead, 
    dismissNotification, 
    clearAllNotifications,
    sales,
    currentUser,
    simulatedRole
  } = useCRM();

  if (!isOpen) return null;

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  // Filter notifications for this user (or global/super admin if applicable)
  const userNotifications = notifications.filter(n => {
    if (n.targetUserId && n.targetUserId !== currentUser?.id && !isSuperAdmin) {
      return false;
    }
    if (n.targetRole === 'Super Admin' && !isSuperAdmin) {
      return false;
    }
    return true;
  });

  const unreadCount = userNotifications.filter(n => !n.read).length;

  const handleAction = (n) => {
    markNotificationRead(n.id);
    if (n.actionType === 'review_sale' && onOpenReviewModal) {
      const targetSale = sales.find(s => s.id === n.actionPayload?.saleId);
      if (targetSale) {
        onOpenReviewModal(targetSale);
        onClose();
      }
    } else if (n.actionType === 'proceed_to_esign' && onOpenESignModal) {
      const targetSale = sales.find(s => s.id === n.actionPayload?.saleId || s.leadId === n.actionPayload?.leadId);
      if (targetSale) {
        onOpenESignModal(targetSale);
        onClose();
      }
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: '60px',
        right: '20px',
        width: '380px',
        maxHeight: '520px',
        backgroundColor: 'var(--bg-modal)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.75), 0 0 25px rgba(99, 102, 241, 0.15)',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--bg-table-head)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} color="var(--accent-primary)" />
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            System Notifications
          </h4>
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: '#f43f5e',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '9999px'
            }}>
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {userNotifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}
              title="Clear all notifications"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {userNotifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Bell size={24} style={{ opacity: 0.3, margin: '0 auto 8px auto', display: 'block' }} />
            No active notifications in your tray.
          </div>
        ) : (
          userNotifications.map(n => {
            const isUnread = !n.read;
            const isSuccess = n.type === 'success';
            const isWarning = n.type === 'warning';
            const isReview = n.type === 'review';

            return (
              <div 
                key={n.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isUnread ? 'var(--bg-surface)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isUnread ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSuccess ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : isWarning ? (
                      <AlertCircle size={14} color="#f59e0b" />
                    ) : isReview ? (
                      <Mail size={14} color="#6366f1" />
                    ) : (
                      <ShieldCheck size={14} color="#3b82f6" />
                    )}
                    <strong style={{ fontSize: '0.82rem', color: isSuccess ? '#10b981' : isWarning ? '#f59e0b' : 'var(--text-primary)' }}>
                      {n.title}
                    </strong>
                  </div>

                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{n.timestamp}</span>
                </div>

                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {n.message}
                </p>

                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  {n.actionType === 'review_sale' && (
                    <button
                      onClick={() => handleAction(n)}
                      className="btn-primary"
                      style={{ fontSize: '0.72rem', padding: '3px 8px', gap: '4px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Mail size={11} /> Open Review Email
                    </button>
                  )}

                  {n.actionType === 'proceed_to_esign' && (
                    <button
                      onClick={() => handleAction(n)}
                      className="btn-primary"
                      style={{ fontSize: '0.72rem', padding: '3px 8px', gap: '4px', display: 'inline-flex', alignItems: 'center', background: '#10b981' }}
                    >
                      <FileSignature size={11} /> Proceed to E-Sign
                    </button>
                  )}

                  {!n.actionType && <span />}

                  <button
                    onClick={() => dismissNotification(n.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', padding: '2px 4px' }}
                    title="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
