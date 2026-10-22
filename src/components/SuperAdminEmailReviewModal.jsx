import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  Mail, 
  CheckCircle2, 
  PhoneCall, 
  FastForward, 
  Paperclip, 
  FileText, 
  FileImage, 
  CreditCard, 
  Building2, 
  User, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Bot
} from 'lucide-react';

export const SuperAdminEmailReviewModal = ({
  isOpen,
  onClose,
  sale = null,
  onExecuteVoiceCall = null,
  onSkipVoiceCall = null
}) => {
  const { 
    currentUser, 
    simulatedRole, 
    voiceAgentSettings, 
    superAdminApproveSale 
  } = useCRM();
  const { showToast } = useToast();

  const [activePreviewDoc, setActivePreviewDoc] = useState(null);

  if (!isOpen || !sale) return null;

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';
  const voiceAgentEnabled = voiceAgentSettings?.enabled ?? true;
  const clientInfo = sale.fullClientInfo || sale.clientInfo || {};
  const attachments = sale.transactionAttachments || clientInfo.transactionAttachments || [];

  const handleApproveWithVoiceCall = () => {
    superAdminApproveSale(sale.id, { executeVoiceCall: true });
    showToast('Super admin has approved the sale. Automated Voice Agent verification initiated!', 'success');
    if (onExecuteVoiceCall) {
      onExecuteVoiceCall(sale);
    }
    onClose();
  };

  const handleApproveSkipVoiceCall = () => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin has authority to skip or cancel voice agent call.', 'error');
      return;
    }
    superAdminApproveSale(sale.id, { executeVoiceCall: false });
    showToast('Super admin has approved the sale. Voice call skipped — proceeding directly to E-Sign.', 'info');
    if (onSkipVoiceCall) {
      onSkipVoiceCall(sale);
    }
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1300, 
        backgroundColor: 'rgba(3, 5, 10, 0.92)', 
        backdropFilter: 'blur(12px)',
        padding: '20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '860px', 
          width: '100%', 
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--accent-border)',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.9), 0 0 35px rgba(99, 102, 241, 0.2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Email Header Bar */}
        <div 
          className="modal-header" 
          style={{ 
            padding: '16px 24px', 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(59, 130, 246, 0.1) 100%)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Mail size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Super Admin Approval Email
                </h3>
                <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '0.72rem' }}>
                  Sale Review Notification
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                System-generated dispatch to Super Admin Inbox ({currentUser?.email || 'superadmin@company.com'})
              </p>
            </div>
          </div>

          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Email Metadata Envelope */}
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-table-head)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted)', width: '60px' }}>From:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>sCRM Notification Engine &lt;notifications@astracrm.com&gt;</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted)', width: '60px' }}>To:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Super Admin &lt;{currentUser?.email || 'superadmin@company.com'}&gt;</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: 'var(--text-muted)', width: '60px' }}>Subject:</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Action Required: New Sale Approval Request for {sale.clientName} (Gross: {sale.amount || '₹' + sale.grossSales})
            </span>
          </div>
        </div>

        {/* Scrollable Email Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Submission Overview Card */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--accent)" />
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>1. Client & Entity Profile</h4>
              </div>
              <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.72rem' }}>
                Category: {clientInfo.clientCategory || sale.clientCategory || 'Individual'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Client Full Name</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clientInfo.clientPrefix || ''} {sale.contactPerson || sale.clientName}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>PAN Number</span>
                <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>{sale.panNumber || clientInfo.panNumber || 'N/A'}</strong>
              </div>

              {clientInfo.clientCategory === 'Non-Individual' && (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Firm / Company Name</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{clientInfo.firmName || 'N/A'}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>GSTIN Number</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{clientInfo.gstin || 'N/A'}</strong>
                  </div>
                </>
              )}

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Email ID</span>
                <strong style={{ color: 'var(--text-primary)' }}>{sale.email || clientInfo.email || 'N/A'}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Phone Number 1 (Lead Phone)</span>
                <strong style={{ color: 'var(--text-primary)' }}>{sale.phone1 || clientInfo.phone1 || 'N/A'}</strong>
              </div>

              {clientInfo.phone2 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Phone Number 2</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{clientInfo.phone2}</strong>
                </div>
              )}

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Client State</span>
                <strong style={{ color: 'var(--text-primary)' }}>{sale.clientState || clientInfo.clientState || 'N/A'}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Submitted By Rep</span>
                <strong style={{ color: 'var(--text-primary)' }}>{sale.employeeName}</strong>
              </div>
            </div>
          </div>

          {/* Deal Financials Card */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <CreditCard size={16} color="#10b981" />
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>2. Deal Financials & Service Package</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Service Subscribed</span>
                <strong style={{ color: 'var(--text-primary)' }}>{sale.serviceOpted || clientInfo.serviceName || 'Equity Advisory'}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Service Tenure</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{sale.serviceTenure || clientInfo.serviceTenure || '3 months'}</strong>
                  <span style={{ fontSize: '0.68rem', background: '#0284c720', color: '#38bdf8', border: '1px solid #0284c740', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                    MITC Synced
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Gross Sales (A)</span>
                <strong style={{ color: 'var(--accent)', fontSize: '1rem' }}>{sale.amount || '₹' + (sale.grossSales || '0')}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Net Sales (B = A ÷ C)</span>
                <strong style={{ color: '#818cf8', fontSize: '0.95rem' }}>₹{Number(sale.netSales || clientInfo.netSales || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>GST (A - B)</span>
                <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>₹{Number(sale.gst || clientInfo.gst || 0).toLocaleString('en-IN')}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Payment Date</span>
                <strong style={{ color: 'var(--text-primary)' }}>{clientInfo.paymentDate || sale.date}</strong>
              </div>
            </div>

            {/* Transaction Numbers */}
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Transaction / UTR Reference Numbers:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(sale.transactionNumbers || clientInfo.transactionNumbers || ['TXN-MOCK']).map((txn, i) => (
                  <span 
                    key={i} 
                    style={{ 
                      padding: '3px 8px', 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-sm)', 
                      fontSize: '0.76rem', 
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}
                  >
                    #{i + 1}: {txn}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Transaction Attachments View */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={16} color="var(--accent)" />
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                  3. Uploaded Transaction Proofs ({attachments.length} Files Attached)
                </h4>
              </div>
            </div>

            {attachments.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                No attachments uploaded for this transaction.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {attachments.map((att, i) => (
                  <div
                    key={att.id || i}
                    onClick={() => setActivePreviewDoc(att)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.78rem'
                    }}
                    title="Click to preview file"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {att.type?.includes('pdf') ? (
                        <FileText size={16} color="#ef4444" />
                      ) : (
                        <FileImage size={16} color="#3b82f6" />
                      )}
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {att.name}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{att.size || 'Attachment'}</span>
                      </div>
                    </div>
                    <ExternalLink size={12} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Agent Setting Advisory Banner */}
          <div style={{
            padding: '12px 16px',
            background: voiceAgentEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${voiceAgentEnabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bot size={20} color={voiceAgentEnabled ? '#10b981' : '#f59e0b'} />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                  Voice Agent Setting: {voiceAgentEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {voiceAgentEnabled 
                    ? 'Super Admin has enabled the voice agent setting. You can choose to Execute automated voice verification or Skip directly to E-Sign.'
                    : 'Voice agent setting is currently disabled in System Settings. Approval moves straight to E-Sign.'}
                </span>
              </div>
            </div>

            <span className="badge" style={{ backgroundColor: voiceAgentEnabled ? '#10b98120' : '#f59e0b20', color: voiceAgentEnabled ? '#10b981' : '#f59e0b' }}>
              {voiceAgentEnabled ? 'Voice Ready' : 'Direct E-Sign'}
            </span>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div 
          className="modal-footer" 
          style={{ 
            padding: '16px 24px', 
            borderTop: '1px solid var(--border-default)', 
            background: 'var(--bg-table-head)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Super Admin Authority: <strong style={{ color: '#10b981' }}>Full Operational Sign-Off</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            >
              Close
            </button>

            {voiceAgentEnabled ? (
              <>
                {/* Option 2: Skip Voice Call (Proceed directly to E-Sign) */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleApproveSkipVoiceCall}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    color: '#60a5fa'
                  }}
                  title="Only Super Admin has authority to skip voice agent call"
                >
                  <FastForward size={14} /> Skip Voice Call (Proceed to E-Sign)
                </button>

                {/* Option 1: Execute Automated Voice Call */}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApproveWithVoiceCall}
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <PhoneCall size={14} /> Approve & Execute Voice Call
                </button>
              </>
            ) : (
              /* Direct Approve when Voice Agent is Disabled */
              <button
                type="button"
                className="btn-primary"
                onClick={handleApproveSkipVoiceCall}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={14} /> Approve Sale & Move to E-Sign
              </button>
            )}
          </div>
        </div>

        {/* Attachment Lightbox Preview Modal */}
        {activePreviewDoc && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                <FileText size={18} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activePreviewDoc.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({activePreviewDoc.size})</span>
              </div>
              <button 
                onClick={() => setActivePreviewDoc(null)}
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {activePreviewDoc.dataUrl?.startsWith('data:image') ? (
                <img 
                  src={activePreviewDoc.dataUrl} 
                  alt={activePreviewDoc.name} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} 
                />
              ) : (
                <iframe 
                  src={activePreviewDoc.dataUrl} 
                  title={activePreviewDoc.name} 
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#fff' }} 
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
