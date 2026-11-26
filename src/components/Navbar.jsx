import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { Bell, User, LogOut } from 'lucide-react';
import { NotificationBar } from './NotificationBar';
import { useToast } from './ToastNotification';

// Broadcast_group messages (from Telegram, via the backend) pop up once per browser when they arrive.
// Older ones (e.g. sent while this user was signed out) only wait in the tray.
const SEEN_BROADCASTS_KEY = 'crm_seen_broadcasts';
const POPUP_MAX_AGE_MS = 10 * 60 * 1000;

const loadSeenBroadcasts = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_BROADCASTS_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export const Navbar = ({ currentTabTitle, onOpenReviewModal = null, onOpenESignModal = null }) => {
  const { currentUser, simulatedRole, handleLogout, notifications = [] } = useCRM();
  const [showNotificationBar, setShowNotificationBar] = useState(false);
  const { showToast } = useToast();
  const seenBroadcasts = useRef(null);

  useEffect(() => {
    if (!seenBroadcasts.current) seenBroadcasts.current = loadSeenBroadcasts();
    const seen = seenBroadcasts.current;
    const fresh = notifications.filter(n => n?.type === 'broadcast' && !seen.has(n.id));
    if (!fresh.length) return;
    fresh.slice().reverse().forEach(n => {  // oldest first, so the newest ends up on top
      seen.add(n.id);
      const age = Date.now() - Date.parse(n.createdAt || 0);
      if (age < POPUP_MAX_AGE_MS) showToast(`📢 ${n.title} — ${n.message}`, 'info', 15000);
    });
    try {
      // Keep only ids that still exist, so the list never grows without bound
      const live = new Set(notifications.map(n => n?.id));
      localStorage.setItem(SEEN_BROADCASTS_KEY, JSON.stringify([...seen].filter(id => live.has(id))));
    } catch { /* storage blocked: worst case a pop-up shows again */ }
  }, [notifications, showToast]);

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

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

  return (
    <header className="top-header" style={{ position: 'relative' }}>
      <div className="header-title-section">
        {/* Keyed so the title's reveal animation replays on every tab change. */}
        <h2 key={currentTabTitle}>{currentTabTitle}</h2>
      </div>

      <div className="header-controls">
        {/* Persistent Notifications Tray Button */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-secondary" 
            onClick={() => setShowNotificationBar(!showNotificationBar)}
            style={{ 
              padding: '8px', 
              borderRadius: '9999px', 
              width: '36px', 
              height: '36px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: showNotificationBar ? 'var(--accent-soft)' : undefined,
              borderColor: showNotificationBar ? 'var(--accent)' : undefined
            }} 
            title="Notifications"
            aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          >
            <Bell size={16} color={unreadCount > 0 ? 'var(--accent)' : 'currentColor'} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                backgroundColor: '#f43f5e',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                minWidth: '16px',
                height: '16px',
                padding: '0 4px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Slide-out Notification Bar Panel */}
          <NotificationBar
            isOpen={showNotificationBar}
            onClose={() => setShowNotificationBar(false)}
            onOpenReviewModal={onOpenReviewModal}
            onOpenESignModal={onOpenESignModal}
          />
        </div>

        {/* Logged in User Profile Badge */}
        <div className="header-user-badge" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          background: 'rgba(16, 18, 26, 0.85)', 
          padding: '4px 14px 4px 6px', 
          borderRadius: '9999px', 
          border: '1px solid rgba(255, 255, 255, 0.09)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)'
        }}>
          <div className="avatar-circle">
            <User size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
              {currentUser?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.71rem', color: 'var(--accent)', fontWeight: 500 }}>
              {currentUser?.role}
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="btn-text-danger"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={14} /> <span className="header-signout-label">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
