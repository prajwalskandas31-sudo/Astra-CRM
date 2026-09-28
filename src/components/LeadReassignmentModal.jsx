import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { X, ArrowRight, ShieldAlert, History, AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';

export const LeadReassignmentModal = ({ isOpen, onClose, userToDelete = null, onReassignComplete }) => {
  const { users, leads, deleteUser } = useCRM();

  const [targetUserId, setTargetUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setTargetUserId('');
    setIsSubmitting(false);
    setErrorMsg('');
  }, [isOpen, userToDelete]);

  if (!isOpen || !userToDelete) return null;

  // Active leads held by user to delete (matches by id, assigned_user_id, email, or name)
  const userLeads = (leads || []).filter(l => {
    if (!l || l.isUnassigned || l.assignedToId === 'unassigned' || l.assignedToName === 'Unassigned') return false;
    return (
      l.assignedToId === userToDelete.id ||
      l.assigned_user_id === userToDelete.id ||
      (userToDelete.email && l.assignedToEmail && l.assignedToEmail.toLowerCase() === userToDelete.email.toLowerCase()) ||
      (userToDelete.name && l.assignedToName && l.assignedToName.trim().toLowerCase() === userToDelete.name.trim().toLowerCase())
    );
  });

  const hasLeads = userLeads.length > 0;

  // Eligible active target users to receive reassigned leads (excluding the user being deleted)
  const eligibleTargetUsers = (users || []).filter(u => u.id !== userToDelete.id && u.status === 'Active');

  const handleExecute = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (hasLeads && !targetUserId) {
      setErrorMsg('Please select an active user to receive the reassigned leads.');
      return;
    }

    setIsSubmitting(true);
    const targetUser = eligibleTargetUsers.find(u => u.id === targetUserId);

    try {
      const res = await deleteUser(userToDelete.id, hasLeads ? targetUserId : null);
      if (res && res.success) {
        if (onReassignComplete) {
          onReassignComplete({
            hasLeads,
            reassignedCount: userLeads.length,
            targetUserName: targetUser?.name || 'Selected User',
            deletedUserName: userToDelete.name
          });
        }
        onClose();
      } else {
        setErrorMsg(res?.error || 'Failed to delete user.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during user deletion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLeads ? '#f87171' : 'var(--text-primary)' }}>
            {hasLeads ? <ShieldAlert size={20} color="#f87171" /> : <Trash2 size={20} color="#f87171" />}
            {hasLeads ? 'Pre-Deletion Lead Reassignment Required' : 'Confirm Account Deletion'}
          </h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleExecute}>
          <div className="modal-body">
            {errorMsg && (
              <div className="alert-box alert-danger" style={{ marginBottom: '16px' }}>
                <AlertTriangle size={18} />
                <div>{errorMsg}</div>
              </div>
            )}

            {hasLeads ? (
              <>
                <div className="alert-box alert-warning">
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Super Admin Mandate:</strong> User <strong>{userToDelete.name}</strong> currently holds <strong>{userLeads.length} active lead(s)</strong>. Before this account can be deleted, their leads must be reassigned to another active user based on your choice.
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600 }}>Active Leads to be Reassigned:</h4>
                    <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 600 }}>
                      {userLeads.length} Total Leads
                    </span>
                  </div>

                  <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-table-head)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                    {userLeads.map(lead => (
                      <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{lead.clientName || lead.contactPerson || 'Client Lead'}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({lead.contactPerson || lead.phone || lead.id})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {lead.language && (
                            <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                              {lead.language}
                            </span>
                          )}
                          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                            {lead.disposition || 'Active'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    Select Target Active User to Receive All {userLeads.length} Leads *
                  </label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    required
                    style={{ padding: '11px 14px', fontSize: '0.88rem', width: '100%', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="">-- Choose Target Active User --</option>
                    {eligibleTargetUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) — {u.email || u.mobile}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: '16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>
                    <History size={15} /> Lead History & Audit Rule:
                  </div>
                  The complete audit timeline, notes, and interaction history for all {userLeads.length} leads will automatically be preserved and transferred to the chosen user.
                </div>
              </>
            ) : (
              <div>
                <div className="alert-box alert-warning" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    Are you sure you want to permanently delete user <strong>{userToDelete.name}</strong> ({userToDelete.role})?
                  </div>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  This user currently has <strong>0 leads</strong> assigned. Once deleted, their profile and credentials will be removed from the system.
                </p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              disabled={isSubmitting || (hasLeads && !targetUserId)}
            >
              {isSubmitting ? (
                'Processing...'
              ) : hasLeads ? (
                <>Reassign Leads & Delete Account <ArrowRight size={16} /></>
              ) : (
                <>Confirm Delete Account <Trash2 size={16} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
