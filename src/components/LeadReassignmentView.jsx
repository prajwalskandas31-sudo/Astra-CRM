import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { Layers, ArrowRight } from 'lucide-react';

export const LeadReassignmentView = () => {
  const { users, leads, reassignLeads, simulatedRole } = useCRM();
  const { showToast } = useToast();

  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');

  const handleManualReassignment = (e) => {
    e.preventDefault();
    if (!fromUser || !toUser) {
      showToast('Please select both Source User and Target User.', 'warning');
      return;
    }
    if (fromUser === toUser) {
      showToast('Source and Target user cannot be the same person.', 'warning');
      return;
    }

    reassignLeads(fromUser, toUser);
    const target = users.find(u => u.id === toUser);
    showToast(`Leads successfully reassigned to ${target?.name}.`, 'success');
    setFromUser('');
    setToUser('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Reassignment Panel */}
      <div className="directory-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-primary)" /> Lead Reassignment Protocol
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Super Admin and Admin can reassign leads from inactive or reassigned staff to active team members.
        </p>

        {simulatedRole === 'Super Admin' || simulatedRole === 'Admin' ? (
          <form onSubmit={handleManualReassignment} className="form-grid">
            <div className="form-group">
              <label>Reassign From (Source User) *</label>
              <select value={fromUser} onChange={(e) => setFromUser(e.target.value)} required>
                <option value="">-- Choose Source User --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.status}) - {u.role}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Reassign To (Target User) *</label>
              <select value={toUser} onChange={(e) => setToUser(e.target.value)} required>
                <option value="">-- Choose Active Target User --</option>
                {users.filter(u => u.status === 'Active').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
                Execute Lead Reassignment <ArrowRight size={15} />
              </button>
            </div>
          </form>
        ) : (
          <div className="alert-box alert-warning">
            Lead reassignment protocol is restricted to Super Admin and Admin roles.
          </div>
        )}
      </div>

      {/* Active Leads Table */}
      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Active Lead Directory & History Logs</h3>
            <p>Immutable audit trail maintained across reassignment transfers.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Lead ID</th>
                <th>Client Name</th>
                <th>Contact Person</th>
                <th>Phone Number</th>
                <th>Owner</th>
                <th>Value</th>
                <th>Audit Log Trail</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{l.id}</td>
                  <td style={{ fontWeight: 600 }}>{l.clientName}</td>
                  <td>{l.contactPerson}</td>
                  <td>{l.phone}</td>
                  <td><span className="badge badge-role">{l.assignedToName}</span></td>
                  <td style={{ fontWeight: 700 }}>{l.value}</td>
                  <td>
                    <div style={{ fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {l.history.map((h, i) => (
                        <div key={i} style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>[{h.date}]</span> {h.text}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
