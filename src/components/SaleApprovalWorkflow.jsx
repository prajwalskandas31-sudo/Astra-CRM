import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileCheck, 
  ShieldCheck, 
  ArrowRight, 
  PlusCircle, 
  Mail, 
  PhoneCall, 
  FileSignature, 
  Paperclip,
  FastForward,
  Bot,
  Sparkles
} from 'lucide-react';
import { SuperAdminEmailReviewModal } from './SuperAdminEmailReviewModal';
import { VoiceAgentCallModal } from './VoiceAgentCallModal';
import { LeegalityESignModal } from './LeegalityESignModal';
import { LiveLeegalityDispatchModal } from './LiveLeegalityDispatchModal';

export const SaleApprovalWorkflow = () => {
  const { 
    sales, 
    simulatedRole, 
    registerSale, 
    rejectSale, 
    users, 
    hasPermission,
    voiceAgentSettings,
    triggerEKycAndESign
  } = useCRM();
  const { showToast } = useToast();

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedReviewSale, setSelectedReviewSale] = useState(null);
  const [selectedVoiceSale, setSelectedVoiceSale] = useState(null);
  const [selectedESignSale, setSelectedESignSale] = useState(null);
  const [isAutoRunMode, setIsAutoRunMode] = useState(false);
  const [liveDispatchData, setLiveDispatchData] = useState(null); // { sale, result }
  const [isDispatchingDirect, setIsDispatchingDirect] = useState(false);

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

  const handleReject = (id, name) => {
    rejectSale(id, 'Super Admin declined sale details.');
    showToast(`Sale for '${name}' rejected.`, 'info');
  };

  const handleDirectTriggerEKycAndESign = async (targetSale) => {
    setIsDispatchingDirect(true);
    showToast(`Dispatching live Leegality e-KYC & E-Sign package for '${targetSale.clientName}' (Workflow LzfDhWc)...`, 'info');
    try {
      const res = await triggerEKycAndESign(targetSale.id);
      setIsDispatchingDirect(false);
      setLiveDispatchData({ sale: targetSale, result: res.apiResult });
      showToast(`Leegality API Gateway: Invitations dispatched successfully! (Doc ID: ${res.apiResult.data.documentId})`, 'success');
    } catch (err) {
      setIsDispatchingDirect(false);
      showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
    }
  };

  const pendingSales = sales.filter(s => 
    s.status.includes('Pending') || 
    s.status.includes('Voice Call Pending') ||
    s.status.includes('Dispatched') ||
    s.stage?.includes('Awaiting Client E-Sign')
  );
  const processedSales = sales.filter(s => !pendingSales.some(p => p.id === s.id));

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
            <h4>E-Signed & Finalized</h4>
            <div className="value" style={{ color: 'var(--status-success)' }}>
              {sales.filter(s => s.status.includes('E-Signed') || s.eSignStatus === 'Completed').length}
            </div>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', borderColor: 'var(--status-success-border)' }}>
            <FileSignature size={18} />
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
            <h3>Sale Approval & Automated Verification Queue</h3>
            <p>Super Admin reviews submissions, manages Voice Agent verification, and monitors Leegality digital E-Sign.</p>
          </div>

          <button className="btn-primary" onClick={() => setIsSubmitOpen(true)}>
            <PlusCircle size={15} /> Register New Employee Sale
          </button>
        </div>

        {/* Pending Approvals Table */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '0.86rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <Clock size={15} /> Pending Super Admin Approval Queue ({pendingSales.length})
          </h4>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Voice Agent: <strong>{voiceAgentSettings?.enabled ? 'Enabled' : 'Disabled'}</strong>
          </span>
        </div>

        <div className="table-responsive">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client Name</th>
                <th>Sale Amount</th>
                <th>Submitted By</th>
                <th>Attachments</th>
                <th>Workflow Stage</th>
                <th>Super Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingSales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No pending sales awaiting Super Admin approval.
                  </td>
                </tr>
              ) : (
                pendingSales.map(s => {
                  const attachmentsCount = (s.transactionAttachments || s.fullClientInfo?.transactionAttachments || []).length;
                  const isVoicePending = s.status.includes('Voice Call Pending');

                  return (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td style={{ fontWeight: 600 }}>{s.clientName}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.amount}</td>
                      <td>{s.employeeName}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: attachmentsCount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          <Paperclip size={12} /> {attachmentsCount} File{attachmentsCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ 
                          background: isVoicePending ? 'rgba(59, 130, 246, 0.15)' : 'var(--status-warning-bg)', 
                          color: isVoicePending ? '#60a5fa' : 'var(--status-warning)', 
                          border: `1px solid ${isVoicePending ? 'rgba(59, 130, 246, 0.3)' : 'var(--status-warning-border)'}` 
                        }}>
                          {s.stage || s.status}
                        </span>
                      </td>
                      <td>
                        {hasPermission('sale-approvals') ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Direct provision to trigger e-KYC & E-Sign process */}
                            <button
                              className="btn-primary"
                              style={{
                                padding: '3px 10px',
                                fontSize: '0.74rem',
                                gap: '5px',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                border: 'none',
                                color: '#ffffff'
                              }}
                              onClick={() => handleDirectTriggerEKycAndESign(s)}
                              disabled={isDispatchingDirect}
                              title="Directly trigger real Leegality e-KYC & E-Sign dispatch (Workflow LzfDhWc)"
                            >
                              <Sparkles size={12} /> Trigger e-KYC & E-Sign
                            </button>

                            {/* Open Review Email Modal */}
                            <button
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.74rem', gap: '4px' }}
                              onClick={() => setSelectedReviewSale(s)}
                              title="Inspect Approval Email and decide Voice Call / Skip options"
                            >
                              <Mail size={12} /> Review Email
                            </button>

                            {isVoicePending ? (
                              <button
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', gap: '4px', borderColor: '#10b981', color: '#10b981' }}
                                onClick={() => setSelectedVoiceSale(s)}
                              >
                                <PhoneCall size={12} /> Launch Voice Call
                              </button>
                            ) : null}

                            <button
                              className="btn-danger"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleReject(s.id, s.clientName)}
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            Awaiting Approval Action
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Processed / Finalized Pipeline Table */}
        <div style={{ padding: '12px 20px', background: 'var(--bg-table-head)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={15} /> Verified & E-Sign Finalized Pipeline ({processedSales.length})
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
                <th>Current Stage</th>
                <th>E-Sign Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {processedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No finalized sales yet.
                  </td>
                </tr>
              ) : (
                processedSales.map(s => {
                  const isReadyForESign = s.stage?.includes('Ready for E-Sign') || s.status?.includes('Ready for E-Sign');
                  const isESigned = s.status?.includes('E-Signed') || s.eSignStatus === 'Completed';

                  return (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td style={{ fontWeight: 600 }}>{s.clientName}</td>
                      <td>{s.amount}</td>
                      <td>{s.employeeName}</td>
                      <td>
                        <span className="badge badge-disposition">
                          <ArrowRight size={11} /> {s.stage || 'Approved'}
                        </span>
                      </td>
                      <td>
                        {isESigned ? (
                          <div className="status-indicator">
                            <span className="status-dot active" />
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Leegality E-Signed</span>
                          </div>
                        ) : isReadyForESign ? (
                          <span className="badge" style={{ background: '#3b82f615', color: '#60a5fa', border: '1px solid #3b82f630' }}>
                            Awaiting E-Sign
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.status}</span>
                        )}
                      </td>
                      <td>
                        {isReadyForESign ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn-primary"
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                background: '#10b981',
                                gap: '5px',
                                fontWeight: 700,
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                              }}
                              onClick={() => {
                                setSelectedESignSale(s);
                                setIsAutoRunMode(true);
                              }}
                              title="Single-click execution: Auto-read Client Info, Date stamp, Affix E-signs & timestamps, and Dispatch via Leegality API"
                            >
                              <Sparkles size={12} /> ⚡ 1-Click E-Sign
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => {
                                setSelectedESignSale(s);
                                setIsAutoRunMode(false);
                              }}
                              title="Manual Step-by-Step Leegality Inspector"
                            >
                              Manual
                            </button>
                          </div>
                        ) : isESigned ? (
                          <button
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.74rem', gap: '4px' }}
                            onClick={() => setSelectedESignSale(s)}
                          >
                            <ShieldCheck size={12} color="#10b981" /> View Agreement
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Approved</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
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

      {/* Super Admin Email Review Modal */}
      <SuperAdminEmailReviewModal
        isOpen={!!selectedReviewSale}
        sale={selectedReviewSale}
        onClose={() => setSelectedReviewSale(null)}
        onExecuteVoiceCall={(sale) => setSelectedVoiceSale(sale)}
        onSkipVoiceCall={(sale) => handleDirectTriggerEKycAndESign(sale)}
        onTriggerEKycAndESign={(sale) => handleDirectTriggerEKycAndESign(sale)}
      />

      {/* Automated Voice Agent Verification Modal */}
      <VoiceAgentCallModal
        isOpen={!!selectedVoiceSale}
        sale={selectedVoiceSale}
        onClose={() => setSelectedVoiceSale(null)}
        onProceedToESign={(sale) => handleDirectTriggerEKycAndESign(sale)}
      />

      {/* Real Leegality e-KYC & E-Sign Live Dispatch Modal (Replaces simulation) */}
      <LiveLeegalityDispatchModal
        isOpen={!!liveDispatchData}
        sale={liveDispatchData?.sale}
        dispatchResult={liveDispatchData?.result}
        onClose={() => setLiveDispatchData(null)}
        onFinalized={() => setLiveDispatchData(null)}
      />

      {/* Leegality Agreement Inspector Modal for Completed Deals */}
      <LeegalityESignModal
        isOpen={!!selectedESignSale}
        sale={selectedESignSale}
        autoRun={isAutoRunMode}
        onClose={() => {
          setSelectedESignSale(null);
          setIsAutoRunMode(false);
        }}
      />
    </div>
  );
};
