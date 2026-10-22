import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  PhoneCall, 
  PhoneOff, 
  Bot, 
  User, 
  CheckCircle2, 
  FastForward, 
  Volume2, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  AlertCircle,
  FileSignature
} from 'lucide-react';

export const VoiceAgentCallModal = ({
  isOpen,
  onClose,
  sale = null,
  onProceedToESign = null
}) => {
  const { 
    currentUser, 
    simulatedRole, 
    completeVoiceCallVerification 
  } = useCRM();
  const { showToast } = useToast();

  const isSuperAdmin = simulatedRole === 'Super Admin' || currentUser?.role === 'Super Admin';

  const [currentStep, setCurrentStep] = useState(0); // 0: Calling, 1..4: Questions, 5: Completed
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  const clientInfo = sale?.fullClientInfo || sale?.clientInfo || {};
  const clientName = clientInfo.clientName || sale?.clientName || 'Client';
  const phone = sale?.phone1 || clientInfo.phone1 || '+91 98765 43210';
  const serviceName = sale?.serviceOpted || clientInfo.serviceName || 'Equity Advisory';
  const tenure = sale?.serviceTenure || clientInfo.serviceTenure || '3 months';
  const grossAmount = sale?.amount || ('₹' + (sale?.grossSales || '50,000'));
  const txnId = (sale?.transactionNumbers && sale.transactionNumbers[0]) || clientInfo.transactionNumbers?.[0] || 'TXN-982182';

  const questions = [
    {
      agent: `Hello, this is Astra CRM's automated compliance verification agent. Am I speaking directly with Mr./Ms. ${clientName}?`,
      client: `Yes, this is ${clientName} speaking.`
    },
    {
      agent: `Thank you. Do you confirm subscribing to ${serviceName} under Research Analyst SEBI regulations for a tenure of ${tenure}?`,
      client: `Yes, I have opted for ${serviceName} for ${tenure}.`
    },
    {
      agent: `Did you complete the gross fee remittance of ${grossAmount} via transaction reference ${txnId}?`,
      client: `Yes, the fee was transferred directly from my verified bank account.`
    },
    {
      agent: `Do you acknowledge the Market Risk Disclosures and agree to complete the digital E-Sign via Leegality?`,
      client: `Yes, I acknowledge the disclosures and agree to proceed with Leegality E-Sign.`
    }
  ];

  // Timer for active call duration
  useEffect(() => {
    let timer;
    if (isOpen && currentStep > 0 && currentStep <= questions.length) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, currentStep]);

  // Automated step progression simulator
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCallDuration(0);
      setShowCompletionPopup(false);
      return;
    }

    if (currentStep === 0) {
      // Connect call in 1.8 seconds
      const t1 = setTimeout(() => {
        setCurrentStep(1);
      }, 1800);
      return () => clearTimeout(t1);
    }

    if (currentStep >= 1 && currentStep <= questions.length) {
      // Advance to next question automatically every 4 seconds
      const t2 = setTimeout(() => {
        if (currentStep === questions.length) {
          handleCallFinished();
        } else {
          setCurrentStep(prev => prev + 1);
        }
      }, 4000);
      return () => clearTimeout(t2);
    }
  }, [isOpen, currentStep]);

  if (!isOpen || !sale) return null;

  const handleCallFinished = () => {
    setCurrentStep(questions.length + 1);
    if (sale?.id) {
      completeVoiceCallVerification(sale.id);
    }
    setShowCompletionPopup(true);
    showToast('Client details got verified, kindly proceed to E-Sign', 'success');
  };

  const handleSuperAdminSkip = () => {
    if (!isSuperAdmin) {
      showToast('Only the Super Admin has the authority to skip or cancel the voice agent call.', 'error');
      return;
    }
    showToast('Super Admin skipped voice verification. Moving to E-Sign step.', 'info');
    if (sale?.id) {
      completeVoiceCallVerification(sale.id);
    }
    if (onProceedToESign) {
      onProceedToESign(sale);
    }
    onClose();
  };

  const handlePopupProceed = () => {
    setShowCompletionPopup(false);
    if (onProceedToESign) {
      onProceedToESign(sale);
    }
    onClose();
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1350, 
        backgroundColor: 'rgba(2, 4, 10, 0.94)', 
        backdropFilter: 'blur(16px)',
        padding: '20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '680px', 
          width: '100%', 
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.95), 0 0 50px rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Call Banner Header */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(99, 102, 241, 0.12) 100%)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: currentStep > 0 && currentStep <= questions.length
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
              animation: currentStep > 0 && currentStep <= questions.length ? 'pulse 2s infinite' : 'none'
            }}>
              <PhoneCall size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Automated Voice Agent Verification
                </h3>
                <span className="badge" style={{ backgroundColor: '#10b98125', color: '#10b981', border: '1px solid #10b98150', fontSize: '0.72rem' }}>
                  {currentStep === 0 ? 'Connecting...' : currentStep > questions.length ? 'Call Completed' : `Live Call • ${formatTime(callDuration)}`}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Target Client: <strong>{clientName}</strong> ({phone})
              </p>
            </div>
          </div>

          {/* Super Admin Skip Button */}
          {isSuperAdmin && currentStep <= questions.length && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSuperAdminSkip}
              style={{
                fontSize: '0.76rem',
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: 'rgba(59, 130, 246, 0.4)',
                color: '#60a5fa'
              }}
              title="Super Admin authority to skip voice agent call"
            >
              <FastForward size={13} /> Skip Voice Call
            </button>
          )}
        </div>

        {/* Audio Waveform Graphic */}
        <div style={{
          padding: '20px 24px',
          background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.08) 0%, rgba(9, 10, 15, 0.95) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Animated Waveform Bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}>
            {[18, 32, 45, 28, 55, 38, 22, 48, 60, 35, 20, 42, 50, 30, 16].map((h, i) => (
              <span
                key={i}
                style={{
                  width: '4px',
                  height: currentStep > 0 && currentStep <= questions.length ? `${h}px` : '6px',
                  backgroundColor: currentStep > 0 && currentStep <= questions.length ? '#10b981' : 'var(--text-muted)',
                  borderRadius: '2px',
                  transition: 'height 0.25s ease-in-out',
                  opacity: currentStep > 0 && currentStep <= questions.length ? 0.9 : 0.3
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bot size={14} color="#10b981" /> Astra AI Voice Model (Neural Text-to-Speech)
            </span>
            <span>•</span>
            <span>Bitrate: 128 kbps (Encrypted VoIP)</span>
          </div>
        </div>

        {/* Interactive Dialogue Transcript */}
        <div style={{ padding: '20px 24px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {currentStep === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '10px' }}>Dialing client at {phone}...</div>
              <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                Ringing... Awaiting client answer
              </span>
            </div>
          ) : (
            questions.slice(0, currentStep).map((q, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* AI Agent Speech */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Bot size={15} />
                  </div>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    borderTopLeftRadius: '2px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    maxWidth: '85%'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                      Astra AI Voice Bot (Question {idx + 1}/{questions.length})
                    </span>
                    {q.agent}
                  </div>
                </div>

                {/* Client Response */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '12px',
                    borderTopRightRadius: '2px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    maxWidth: '85%'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                      Client ({clientName})
                    </span>
                    {q.client}
                  </div>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <User size={15} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Call Footer Bar */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-table-head)',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Step: {Math.min(currentStep, questions.length)} of {questions.length} questions completed
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {currentStep > questions.length ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handlePopupProceed}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileSignature size={15} /> Proceed to E-Sign
              </button>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Verifying responses automatically...
              </span>
            )}
          </div>
        </div>

        {/* ─── MANDATORY SPEC POPUP: "Client details got verified, kindly proceed to E-Sign" ─── */}
        {showCompletionPopup && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div 
              style={{
                maxWidth: '460px',
                width: '100%',
                background: 'var(--bg-modal)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 'var(--radius-lg)',
                padding: '26px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 40px rgba(16, 185, 129, 0.3)',
                textAlign: 'center'
              }}
            >
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.35)'
              }}>
                <CheckCircle2 size={32} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Verification Successful
              </h3>

              {/* Exact spec prompt string */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                margin: '14px 0 20px 0',
                fontSize: '0.94rem',
                fontWeight: 600,
                color: '#10b981'
              }}>
                "Client details got verified, kindly proceed to E-Sign"
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                All compliance questions were verified. This notification has also been saved to your top notification bar.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCompletionPopup(false);
                    onClose();
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Dismiss
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handlePopupProceed}
                  style={{
                    padding: '8px 24px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileSignature size={15} /> Proceed to E-Sign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
