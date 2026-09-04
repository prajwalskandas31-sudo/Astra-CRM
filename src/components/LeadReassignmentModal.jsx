import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { X, ArrowRight, ShieldAlert, History, UserCheck } from 'lucide-react';

export const LeadReassignmentModal = ({ isOpen, onClose, userToDelete = null, onReassignComplete }) => {
  const { users, leads, reassignLeads, deleteUser } = useCRM();

  const [targetUserId, setTargetUserId] = useState('');

  if (!isOpen || !userToDelete) return null;

  // Active leads held by user to delete
  const userLeads = leads.filter(l => l.assignedToId === userToDelete.id);

  // Eligible active target users to receive reassigned leads
  const eligibleTargetUsers = users.filter(u => u.id !== userToDelete.id && u.status === 'Active');

  const handleExecuteReassignment = (e) => {
    e.preventDefault();
    if (!targetUserId) {
      alert('Please select an active user to receive the reassigned leads.');
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId);

    // Reassign leads & execute deletion
    reassignLeads(userToDelete.id, targetUserId);
    deleteUser(userToDelete.id, targetUserId);

    alert(`Successfully reassigned ${userLeads.length} lead(s) to ${targetUser?.name}. User account '${userToDelete.name}' has been deleted.`);
    
    if (onReassignComplete) onReassignComplete();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
            <ShieldAlert size={20} /> Pre-Deletion Lead Reassignment Required
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleExecuteReassignment}>
          <div className="modal-body">
            <div className="alert-box alert-warning">
              <ShieldAlert size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Mandatory Account Rule:</strong> Before user <strong>{userToDelete.name}</strong> can be deleted, all <strong>{userLeads.length} active lead(s)</strong> assigned to them must be reassigned to another active user.
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Active Leads to be Reassigned:</h4>
              <div style={{ background: 'var(--bg-table-head)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                {userLeads.map(lead => (
                  <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{lead.clientName}</span> ({lead.contactPerson})
                    </div>
                    <span className="badge badge-active">{lead.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>Select Target Active User to Receive Leads *</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
                style={{ padding: '12px' }}
              >
                <option value="">-- Choose Active Target User --</option>
                {eligibleTargetUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) - {u.email || u.mobile}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>
                <History size={15} /> Lead History Rule:
              </div>
              The full audit timeline and interaction history of these leads will automatically be transferred and made visible to the new lead owner.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel Deletion
            </button>
            <button type="submit" className="btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Reassign Leads & Delete Account <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
