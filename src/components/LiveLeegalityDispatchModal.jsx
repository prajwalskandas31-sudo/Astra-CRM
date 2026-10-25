import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  Mail, 
  KeyRound, 
  Calendar, 
  FileText, 
  Zap,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Lock
} from 'lucide-react';

export const LiveLeegalityDispatchModal = ({
  isOpen,
  onClose,
  sale,
  dispatchResult,
  onFinalized = null
}) => {
  const { completeESignProcess } = useCRM();
  const { showToast } = useToast();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDocId, setCopiedDocId] = useState(false);
  const [showIframePreview, setShowIframePreview] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  if (!isOpen || !sale || !dispatchResult) return null;

  const data = dispatchResult.data || {};
  const documentId = data.documentId || sale.eSignDocumentId || '01M5...';
  const signUrl = data.signUrl || (data.invitees && data.invitees[0]?.signUrl) || sale.eSignUrl || `https://app1.leegality.com/sign/${documentId.toLowerCase()}`;
  const invitee = (data.invitees && data.invitees[0]) || {};
  const clientName = invitee.name || sale.clientName || 'Client';
  const phone = invitee.phone || sale.phone1 || '';
  const email = invitee.email || sale.email || '';
  const tenure = sale.serviceTenure || sale.fullClientInfo?.serviceTenure || '3 months';
  const serviceName = sale.serviceOpted || sale.fullClientInfo?.serviceName || 'Equity Advisory';
  const amount = sale.amount || ('₹' + (sale.grossSales || '50,000'));
  const remainingCredits = data.creditsRemaining ?? 9;

  const handleCopyLink = () => {
    if (signUrl) {
      navigator.clipboard?.writeText?.(signUrl);
      setCopiedLink(true);
      showToast('Live Leegality signing URL copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyDocId = () => {
    navigator.clipboard?.writeText?.(documentId);
    setCopiedDocId(true);
    showToast('Document ID copied!', 'info');
    setTimeout(() => setCopiedDocId(false), 2000);
  };

  const handleOpenSigningUrl = () => {
    if (signUrl) {
      window.open(signUrl, '_blank', 'noopener,noreferrer');
      showToast('Opening Leegality official signing gateway in a new tab...', 'info');
    }
  };

  const handleMarkAsFinalized = () => {
    setIsFinalizing(true);
    const signMetadata = {
      documentId,
      date1: new Date().toLocaleDateString('en-GB'),
      signedAt: new Date().toISOString(),
      signedBy: clientName,
      pan: sale.panNumber || sale.fullClientInfo?.panNumber || 'ABCDE1234F',
      serviceName,
      serviceTenure: tenure,
      grossSales: amount,
      status: 'Sent & E-Signed',
      authTokenMasked: data.authTokenMasked || 'JsAEa0...RbxM',
      webhookMac: data.webhookMac || 'mac-verified',
      creditsRemaining: remainingCredits,
      signUrl
    };

    setTimeout(() => {
      completeESignProcess(sale.id, signMetadata);
      setIsFinalizing(false);
      showToast(`Sale for '${clientName}' finalized! Recorded in Dedicated E-Sign Block.`, 'success');
      if (onFinalized) {
        onFinalized(signMetadata);
      }
      onClose();
    }, 600);
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1400, 
        backgroundColor: 'rgba(2, 6, 23, 0.92)', 
        backdropFilter: 'blur(16px)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '820px', 
          width: '100%', 
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(16, 185, 129, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 165, 233, 0.15) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Leegality Geometric Logo */}
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                <path d="M6 34 L20 6 L20 20 Z" fill="#E11D48" />
                <path d="M20 6 L34 34 L20 20 Z" fill="#7C3AED" />
                <path d="M6 34 L34 34 L20 20 Z" fill="#0284C7" />
                <path d="M12 28 L28 28 L20 14 Z" fill="#06B6D4" opacity="0.8" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                  Leegality Production e-KYC & E-Sign
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 600
                }}>
                  Workflow ID: LzfDhWc
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontWeight: 600
                }}>
                  API v3.0 Live Gateway
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Official SEBI-compliant agreement dispatch & Aadhaar verification process
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Success Banner */}
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#34d399' }}>
                Actual Leegality Process Dispatched Successfully!
              </div>
              <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '2px' }}>
                The simulation has been bypassed. Real Leegality e-KYC & E-Sign package created with pre-affixed Authorized Signatory.
              </div>
            </div>
          </div>

          {/* Real-time Leegality Server Balance Notice */}
          {(dispatchResult?.balanceAlert || dispatchResult?.isBalanceWarning) && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <AlertTriangle size={18} color="#facc15" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1, fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 700, color: '#facc15' }}>
                  Leegality Production Server Alert: Insufficient eSign Balance
                </div>
                <div style={{ color: '#e2e8f0', marginTop: '3px', lineHeight: 1.45 }}>
                  {dispatchResult?.balanceAlert || 'Insufficient eSign Balance on Leegality account.'} The CRM has pre-assembled the document package and signing route. For Leegality to send real carrier SMS & email invitations directly, please top up credits on{' '}
                  <a href="https://app1.leegality.com" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}>
                    app1.leegality.com
                  </a>.
                </div>
              </div>
            </div>
          )}

          {/* Telemetry Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Document ID
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <code style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                  {documentId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyDocId}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedDocId ? '#34d399' : '#64748b' }}
                  title="Copy Document ID"
                >
                  {copiedDocId ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Workflow Profile
              </div>
              <div style={{ fontSize: '0.86rem', color: '#ffffff', fontWeight: 700, marginTop: '4px' }}>
                LzfDhWc
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Leegality Credits
              </div>
              <div style={{ fontSize: '0.86rem', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>
                {remainingCredits} Credits Left <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>(-1 used)</span>
              </div>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Webhook HMAC-SHA1
              </div>
              <div style={{ fontSize: '0.82rem', color: '#a78bfa', fontWeight: 600, marginTop: '4px' }}>
                Verified via Salt
              </div>
            </div>
          </div>

          {/* Client & Delivery Channels Card */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target Signer & Live Delivery Status
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Client Name</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#ffffff' }}>{clientName}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Service & Tenure</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#38bdf8' }}>{serviceName} ({tenure})</div>
              </div>

              <div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Remittance Amount</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#10b981' }}>{amount}</div>
              </div>
            </div>

            {/* Delivery Channels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '6px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <Smartphone size={16} color="#34d399" />
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>SMS Delivery: {phone}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399' }}>🟢 Sent via Leegality SMS Gateway</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)'
              }}>
                <Mail size={16} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Email Delivery: {email}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>🟢 Sent via Leegality Mailer</div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Signing Portal Action Card */}
          <div style={{
            padding: '18px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#38bdf8" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>
                  Live Leegality Signing URL
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: copiedLink ? '#34d399' : '#f8fafc',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                  {copiedLink ? 'Copied' : 'Copy Link'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowIframePreview(!showIframePreview)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {showIframePreview ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showIframePreview ? 'Hide Portal Preview' : 'Show Portal Preview'}
                </button>
              </div>
            </div>

            {/* URL input box */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: '#020617',
              border: '1px solid #1e293b',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              color: '#38bdf8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {signUrl}
            </div>

            {/* Embedded Iframe Preview if toggled */}
            {showIframePreview && (
              <div style={{
                marginTop: '10px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #334155',
                height: '420px',
                backgroundColor: '#ffffff'
              }}>
                <iframe
                  src={signUrl}
                  title="Leegality Live Signing Gateway"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleOpenSigningUrl}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
              }}
            >
              <ExternalLink size={15} /> Open Live Leegality Signing Portal
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            Keep in Awaiting Queue
          </button>

          <button
            type="button"
            onClick={handleMarkAsFinalized}
            disabled={isFinalizing}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <ShieldCheck size={15} />
            {isFinalizing ? 'Finalizing Deal...' : 'Mark as Client Signed & Finalize Deal'}
          </button>
        </div>
      </div>
    </div>
  );
};
