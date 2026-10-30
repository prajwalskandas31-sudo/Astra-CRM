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
import { LiveLeegalityDispatchModal } from './LiveLeegalityDispatchModal';
import { isRealLeegalityDispatch, getEKycLight } from '../services/leegalityService';

const LIGHTS = ['red', 'yellow', 'green'];

// Red: not sent (click sends e-KYC & E-Sign). Yellow: sent, waiting on the client. Green: completed and moved to Paid.
const EKycTrafficLight = ({ sale, canTrigger, isDispatching, onTrigger, onViewStatus }) => {
  const light = getEKycLight(sale);
  const isRejectedSale = sale.stage === 'Rejected' || !!sale.status?.includes('Rejected by Super Admin');

  let title;
  let label;
  let onClick = null;
  if (light === 'green') {
    title = 'e-KYC completed';
    label = 'Client signed · moved to Paid';
    onClick = onViewStatus;
  } else if (light === 'yellow') {
    title = 'Awaiting client';
    label = 'Request sent · client yet to complete e-KYC';
    onClick = onViewStatus;
  } else if (isRejectedSale) {
    title = 'Not triggered';
    label = 'Sale rejected by Super Admin';
  } else {
    title = sale.eSignStatus === 'Rejected by Client' ? 'Client declined'
      : sale.eSignStatus === 'Invitation Expired' ? 'Invitation expired'
      : 'e-KYC not triggered';
    label = canTrigger
      ? (sale.eSignStatus === 'Rejected by Client' || sale.eSignStatus === 'Invitation Expired' ? 'Click to re-send e-KYC & E-Sign' : 'Click to send e-KYC & E-Sign')
      : 'Awaiting Super Admin';
    if (canTrigger) onClick = onTrigger;
  }

  const content = (
    <>
      <span className="ekyc-light-housing" aria-hidden="true">
        {LIGHTS.map(l => <span key={l} className={`ekyc-lamp ${l}${l === light ? ' lit' : ''}`} />)}
      </span>
      <span className="ekyc-light-text">
        <span className="ekyc-light-title">{title}</span>
        <span className="ekyc-light-label">{label}</span>
      </span>
    </>
  );

  return onClick ? (
    <button
      type="button"
      className={`ekyc-light ${light}`}
      onClick={onClick}
      disabled={light === 'red' && isDispatching}
      title={light === 'red' ? 'Create the real Leegality signing request (Workflow LzfDhWc)' : 'Live status from Leegality'}
    >
      {content}
    </button>
  ) : (
    <span className={`ekyc-light ${light}`}>{content}</span>
  );
};

export const SaleApprovalWorkflow = () => {
  const { 
    sales, 
    simulatedRole,
    rejectSale,
    hasPermission,
    voiceAgentSettings,
    triggerEKycAndESign
  } = useCRM();
  const { showToast } = useToast();

  const [selectedReviewSale, setSelectedReviewSale] = useState(null);
  const [selectedVoiceSale, setSelectedVoiceSale] = useState(null);
  const [liveDispatchData, setLiveDispatchData] = useState(null); // { sale, result }
  const [isDispatchingDirect, setIsDispatchingDirect] = useState(false);

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
      showToast(`Leegality created document ${res.apiResult.documentId} for '${targetSale.clientName}'.`, 'success');
    } catch (err) {
      setIsDispatchingDirect(false);
      showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
    }
  };

  // Sales already sent to Leegality move down to the pipeline, where the traffic light tracks them
  const pendingSales = sales.filter(s =>
    s.status.includes('Pending') ||
    s.status.includes('Voice Call Pending')
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
              {sales.filter(s => getEKycLight(s) === 'green').length}
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
                            {/* Direct provision to trigger e-KYC & E-Sign process (or check status once dispatched) */}
                            {isRealLeegalityDispatch(s) ? (
                              <button
                                className="btn-secondary"
                                style={{ padding: '3px 10px', fontSize: '0.74rem', gap: '5px', fontWeight: 700, borderColor: '#0ea5e9', color: '#38bdf8' }}
                                onClick={() => setLiveDispatchData({ sale: s, result: s.eSignDetails?.documentId ? s.eSignDetails : { documentId: s.eSignDocumentId } })}
                                title="Live signing status from Leegality"
                              >
                                <ShieldCheck size={12} /> Leegality Status
                              </button>
                            ) : (
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
                            )}

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
                <th>e-KYC & E-Sign</th>
              </tr>
            </thead>
            <tbody>
              {processedSales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No finalized sales yet.
                  </td>
                </tr>
              ) : (
                processedSales.map(s => {
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
                        <EKycTrafficLight
                          sale={s}
                          canTrigger={hasPermission('sale-approvals')}
                          isDispatching={isDispatchingDirect}
                          onTrigger={() => handleDirectTriggerEKycAndESign(s)}
                          onViewStatus={() => setLiveDispatchData({ sale: s, result: s.eSignDetails?.documentId ? s.eSignDetails : { documentId: s.eSignDocumentId } })}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Leegality e-KYC & E-Sign status modal (live data via CRM backend) */}
      <LiveLeegalityDispatchModal
        isOpen={!!liveDispatchData}
        sale={liveDispatchData?.sale}
        dispatchResult={liveDispatchData?.result}
        onClose={() => setLiveDispatchData(null)}
      />

    </div>
  );
};
