import React, { useCallback, useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { downloadLeegalityFile } from '../services/leegalityService';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Smartphone,
  Mail,
  RefreshCw,
  Download,
  FileText,
  Clock,
  AlertTriangle,
  PenTool
} from 'lucide-react';

const POLL_INTERVAL_MS = 20000;

const tileStyle = {
  padding: '12px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)'
};
const tileLabelStyle = { fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 };
const tileValueStyle = { fontSize: '0.86rem', color: '#ffffff', fontWeight: 700, marginTop: '4px' };
const smallBtnStyle = {
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
};

const describeInvitation = (inv) => {
  if (!inv) return { text: 'Waiting for Leegality status…', color: '#94a3b8' };
  if (inv.signed) return { text: `Signed on Leegality${inv.signDate ? ` at ${inv.signDate}` : ''}${inv.usedSignatureType ? ` (${inv.usedSignatureType})` : ''}`, color: '#34d399' };
  if (inv.rejected) return { text: `Rejected by client${inv.signRejectionMessage ? `: ${inv.signRejectionMessage}` : ''}`, color: '#f87171' };
  if (inv.expired) return { text: `Invitation expired${inv.failureReason ? ` (${inv.failureReason})` : ''}`, color: '#f87171' };
  if (inv.active) return { text: `Awaiting client signature${inv.expiryDate ? ` · link valid until ${inv.expiryDate}` : ''}`, color: '#facc15' };
  return { text: 'Invitation created, not yet active', color: '#94a3b8' };
};

export const LiveLeegalityDispatchModal = ({
  isOpen,
  onClose,
  sale,
  dispatchResult
}) => {
  const { refreshESignStatus } = useCRM();
  const { showToast } = useToast();

  const [copiedLink, setCopiedLink] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloading, setDownloading] = useState('');

  const record = dispatchResult || {};
  const documentId = record.documentId || sale?.eSignDocumentId;
  const isCompleted = liveStatus?.documentStatus === 'COMPLETED';
  const isUnknownToLeegality = /document not found/i.test(statusError);

  const refresh = useCallback(async (silent = false) => {
    if (!sale || !documentId) return;
    setIsRefreshing(true);
    try {
      const details = await refreshESignStatus(sale.id, documentId);
      setLiveStatus(details);
      setStatusError('');
    } catch (err) {
      setStatusError(err.message);
      if (!silent) showToast(`Leegality status check failed: ${err.message}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [sale, documentId, refreshESignStatus, showToast]);

  useEffect(() => {
    setLiveStatus(null);
    setStatusError('');
  }, [documentId]);

  // Poll Leegality while the modal is open until the document is completed
  useEffect(() => {
    if (!isOpen || !documentId || isCompleted || isUnknownToLeegality) return undefined;
    refresh(true);
    const timer = setInterval(() => refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentId, isCompleted, isUnknownToLeegality]);

  if (!isOpen || !sale || !dispatchResult) return null;

  const sentInvitee = (record.invitees && record.invitees[0]) || {};
  const liveInvitation = (liveStatus?.invitations || []).find(i => i.inviteeType !== 'APPROVER') || liveStatus?.invitations?.[0];
  const signUrl = liveInvitation?.signUrl || sentInvitee.signUrl || '';
  const invitationState = describeInvitation(liveInvitation);
  const leegalityMessages = (record.messages || []).map(m => m.message).filter(Boolean);
  // Only requests created through the backend carry dispatchedAt; older simulated records do not
  const wasDispatchedByBackend = !!record.dispatchedAt;
  const delivery = record.deliveryConfig?.invitees?.[0];
  const documentStatus = liveStatus?.documentStatus || (wasDispatchedByBackend ? record.documentStatus : null);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText?.(signUrl);
    setCopiedLink(true);
    showToast('Leegality signing URL copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownload = async (kind) => {
    setDownloading(kind);
    try {
      await downloadLeegalityFile(documentId, kind);
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
    } finally {
      setDownloading('');
    }
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                Leegality e-KYC & E-Sign
              </h3>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 600 }}>
                Workflow ID: {record.profileId || 'LzfDhWc'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Every value below was returned by Leegality.
            </p>
          </div>

          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Leegality response */}
          {wasDispatchedByBackend ? (
            <div style={{ padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={22} color="#34d399" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#34d399' }}>
                  Leegality created the signing request
                </div>
                <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: '2px' }}>
                  Leegality response: {leegalityMessages.length ? leegalityMessages.join(' | ') : 'status 1 (success), no message'}
                </div>
              </div>
            </div>
          ) : isUnknownToLeegality ? (
            <div style={{ padding: '14px 18px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                <strong>Leegality has no document with ID {documentId}.</strong> This record was produced by the old simulated flow and was never sent to Leegality.
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.8rem', color: '#cbd5e1' }}>
              Checking document {documentId} with Leegality…
            </div>
          )}

          {/* Request details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Document ID</div>
              <code style={{ ...tileValueStyle, display: 'block', fontSize: '0.8rem', color: '#38bdf8', wordBreak: 'break-all' }}>{documentId}</code>
            </div>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Date 1 (execution date)</div>
              <div style={tileValueStyle}>{record.date1 || '—'}</div>
            </div>
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Checkbox 1 (Service Tenure)</div>
              <div style={tileValueStyle}>{record.tenureOption || '—'} {record.serviceTenure && <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>({record.serviceTenure})</span>}</div>
            </div>
            {record.walletAfterDispatch && !record.walletAfterDispatch.error && (
              <div style={tileStyle}>
                <div style={tileLabelStyle}>Leegality Credits</div>
                <div style={tileValueStyle}>
                  {record.walletAfterDispatch.unused} unused <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>({record.walletAfterDispatch.reserved} reserved)</span>
                </div>
              </div>
            )}
            <div style={tileStyle}>
              <div style={tileLabelStyle}>Document Status</div>
              <div style={{ ...tileValueStyle, color: isCompleted ? '#34d399' : '#facc15' }}>{documentStatus || '—'}</div>
            </div>
          </div>

          {/* Signature placements */}
          {(record.signatureStamps || []).length > 0 && (
            <div style={{ ...tileStyle, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ ...tileLabelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PenTool size={13} /> Digital Signature Storage Block → agreement placements
              </div>
              {record.signatureStamps.map(st => (
                <div key={st.field} style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                  {st.field}: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{st.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Client & invitation status */}
          <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Client Signer · Live Leegality Status
              </div>
              <button type="button" onClick={() => refresh(false)} disabled={isRefreshing} style={smallBtnStyle}>
                <RefreshCw size={13} style={isRefreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
                {isRefreshing ? 'Checking…' : 'Refresh Status'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Client Name</div>
                <div style={{ fontSize: '0.94rem', fontWeight: 700 }}>{liveInvitation?.name || sentInvitee.name || record.clientName || sale.clientName}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={15} color="#94a3b8" />
                <div style={{ fontSize: '0.82rem' }}>{liveInvitation?.phone || sentInvitee.phone || '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={15} color="#94a3b8" />
                <div style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{liveInvitation?.email || sentInvitee.email || '—'}</div>
              </div>
            </div>

            {/* Delivery settings Leegality applied to this document (read back after sending) */}
            {delivery && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ color: delivery.emailNotification ? '#34d399' : '#f87171' }}>
                    <Mail size={13} style={{ verticalAlign: '-2px' }} /> Email by Leegality: {delivery.emailNotification ? 'ON' : 'OFF'}
                  </span>
                  <span style={{ color: delivery.smsNotification ? '#34d399' : '#f87171' }}>
                    <Smartphone size={13} style={{ verticalAlign: '-2px' }} /> SMS by Leegality: {delivery.smsNotification ? 'ON' : 'OFF'}
                  </span>
                  <span style={{ color: '#94a3b8' }}>
                    Signature types: {delivery.allowedSignatures.join(', ') || '—'}
                  </span>
                </div>
                {['email', 'phone'].filter(k => record.sentContact?.[k] && !delivery[k]).map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#fca5a5' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    Leegality dropped the client's {k === 'phone' ? `mobile number (${record.sentContact.phone}), so no SMS will be sent` : `email (${record.sentContact.email}), so no email will be sent`}. Set the workflow signer to accept both email and phone ("Enter both").
                  </div>
                ))}
                {!delivery.emailNotification && !delivery.smsNotification && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#fca5a5' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    Workflow LzfDhWc has email and SMS notifications turned off, so the client was not notified. Share the signing link below manually, or enable notifications for the signer in the Leegality workflow.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.82rem', fontWeight: 600, color: invitationState.color }}>
              {isCompleted ? <CheckCircle2 size={15} /> : <Clock size={15} />}
              {isUnknownToLeegality ? 'No Leegality invitation exists for this record' : invitationState.text}
            </div>

            {statusError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.78rem', color: '#fca5a5' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {statusError}
              </div>
            )}
          </div>

          {/* Signing link */}
          {signUrl && (
            <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Client Signing URL</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={handleCopyLink} style={{ ...smallBtnStyle, color: copiedLink ? '#34d399' : '#f8fafc' }}>
                    {copiedLink ? <Check size={13} /> : <Copy size={13} />} {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                  <button type="button" onClick={() => window.open(signUrl, '_blank', 'noopener,noreferrer')} style={smallBtnStyle}>
                    <ExternalLink size={13} /> Open
                  </button>
                </div>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#020617', border: '1px solid #1e293b', fontSize: '0.8rem', fontFamily: 'monospace', color: '#38bdf8', wordBreak: 'break-all' }}>
                {signUrl}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            {isCompleted ? 'Signed copy is available from Leegality.' : `Status re-checked with Leegality every ${POLL_INTERVAL_MS / 1000}s while open. The deal finalizes automatically once Leegality reports COMPLETED.`}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isCompleted && (
              <>
                <button type="button" className="btn-secondary" onClick={() => handleDownload('audit-trail')} disabled={!!downloading} style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> {downloading === 'audit-trail' ? 'Downloading…' : 'Audit Trail'}
                </button>
                <button type="button" onClick={() => handleDownload('signed-pdf')} disabled={!!downloading} style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={14} /> {downloading === 'signed-pdf' ? 'Downloading…' : 'Signed Agreement'}
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
