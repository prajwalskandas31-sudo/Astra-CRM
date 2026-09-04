import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { CheckCircle, XCircle, Clock, FileCheck, ShieldCheck, ArrowRight, PlusCircle } from 'lucide-react';

export const SaleApprovalWorkflow = () => {
  const { sales, simulatedRole, registerSale, approveSale, rejectSale, users } = useCRM();
  const { showToast } = useToast();

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [newSale, setNewSale] = useState({
    clientName: '',
    amount: '',
    employeeName: 'AKSHATA',
    mitcStatus: 'Verified',
    complianceStatus: 'Compliant'
  });

  const handleSubmitSale = (e) => {
    e.preventDefault();
    if (!newSale.clientName || !newSale.amount) {
      showToast('Please fill in Client Name and Sale Amount.', 'warning');
      return;
    }
    registerSale(newSale);
    showToast(`Sale submitted! Notification sent to Super Admin for approval.`, 'success');
    setIsSubmitOpen(false);
    setNewSale({ clientName: '', amount: '', employeeName: 'AKSHATA', mitcStatus: 'Verified', complianceStatus: 'Compliant' });
  };

  const handleApprove = (id, name) => {
    approveSale(id);
    showToast(`Sale for '${name}' approved and moved to eKYC workflow stage.`, 'success');
  };

  const handleReject = (id, name) => {
    rejectSale(id, 'Super Admin declined sale details.');
    showToast(`Sale for '${name}' rejected.`, 'info');
  };

  const pendingSales = sales.filter(s => s.status.includes('Pending'));
  const processedSales = sales.filter(s => !s.status.includes('Pending'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h4>Pending Approvals</h4>
            <div className="value" style={{ color: 'var(--status-warning)' }}>{pendingSales.length}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', borderColor: 'var(--status-warning-border)' }}>
            <Clock size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Moved to eKYC Stage</h4>
            <div className="value" style={{ color: 'var(--status-success)' }}>{sales.filter(s => s.status.includes('eKYC')).length}</div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h4>Total Registered Sales</h4>
            <div className="value">{sales.length}</div>
          </div>
          <div className="metric-icon">
            <FileCheck size={18} />
          </div>
        </div>
      </div>

      <div className="directory-card">
        <div className="directory-toolbar">
          <div className="directory-title-area">
            <h3>Sale Approval & eKYC Workflow Queue</h3>
            <p>Employee sales require Super Admin approval to finalize and transition to the eKYC stage.</p>
          </div>

          <button className="btn-primary" onClick={() => setIsSubmitOpen(true)}>
            <PlusCircle size={15} /> Register New Employee Sale
          </button>
        </div>

        {/* Pending Approvals Table */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.86rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={15} /> Pending Super Admin Approval Queue ({pendingSales.length})
          </h4>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client Name</th>
                <th>Sale Amount</th>
                <th>Submitted By</th>
                <th>MITC Status</th>
                <th>Compliance</th>
                <th>Workflow State</th>
                <th>Super Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingSales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No pending sales awaiting Super Admin approval.
                  </td>
                </tr>
              ) : (
                pendingSales.map(s => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td style={{ fontWeight: 600 }}>{s.clientName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.amount}</td>
                    <td>{s.employeeName}</td>
                    <td>
                      <div className="status-indicator">
                        <span className="status-dot active" />
                        <span>{s.mitcStatus}</span>
                      </div>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className="status-dot active" />
                        <span>{s.complianceStatus}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning-border)' }}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {simulatedRole === 'Super Admin' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-primary"
                            style={{ padding: '3px 8px', fontSize: '0.76rem' }}
                            onClick={() => handleApprove(s.id, s.clientName)}
                          >
                            <CheckCircle size={12} /> Approve & Send to eKYC
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '3px 8px', fontSize: '0.76rem' }}
                            onClick={() => handleReject(s.id, s.clientName)}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Awaiting Super Admin
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Processed / eKYC Pipeline Table */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-table-head)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={15} /> Processed & eKYC Pipeline ({processedSales.length})
          </h4>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client Name</th>
                <th>Amount</th>
                <th>Submitted By</th>
                <th>Final Stage</th>
                <th>Approval Decision</th>
              </tr>
            </thead>
            <tbody>
              {processedSales.map(s => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td style={{ fontWeight: 600 }}>{s.clientName}</td>
                  <td>{s.amount}</td>
                  <td>{s.employeeName}</td>
                  <td>
                    <span className="badge badge-disposition">
                      <ArrowRight size={11} /> {s.stage || 'eKYC Approved'}
                    </span>
                  </td>
                  <td>
                    <div className="status-indicator">
                      <span className="status-dot active" />
                      <span>Approved by Super Admin</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Sale Modal */}
      {isSubmitOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Register New Employee Sale</h3>
              <button className="modal-close-btn" onClick={() => setIsSubmitOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitSale}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Client / Lead Name *</label>
                  <input
                    type="text"
                    value={newSale.clientName}
                    onChange={(e) => setNewSale({ ...newSale, clientName: e.target.value })}
                    placeholder="e.g. Apex Tech Solutions"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Sale Amount *</label>
                  <input
                    type="text"
                    value={newSale.amount}
                    onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })}
                    placeholder="e.g. ₹5,00,000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Submitting Employee</label>
                  <select
                    value={newSale.employeeName}
                    onChange={(e) => setNewSale({ ...newSale, employeeName: e.target.value })}
                  >
                    {users.filter(u => u.role === 'Executive').map(u => (
                      <option key={u.id} value={u.name}>{u.name} ({u.employeeId})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsSubmitOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
