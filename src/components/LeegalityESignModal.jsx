import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Send, 
  ShieldCheck, 
  Download, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  Smartphone,
  Mail,
  KeyRound,
  FileCheck2,
  Check,
  AlertCircle
} from 'lucide-react';

export const LeegalityESignModal = ({
  isOpen,
  onClose,
  sale = null,
  onComplete = null
}) => {
  const { currentUser, leads, completeESignProcess } = useCRM();
  const { showToast } = useToast();

  // Stepper: 1: Create, 2: Invite, 3: Finalize
  const [activeStep, setActiveStep] = useState(1);
  const [activeTab, setActiveTab] = useState('Templates'); // 'Upload' | 'Templates'

  // Document preview switcher: 'mitc' | 'contract' | 'both'
  const [activeDocTab, setActiveDocTab] = useState('mitc');

  // Dynamic Date 1: "This field dynamically records the exact date the process is being performed"
  const getDynamicDateFormatted = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [date1, setDate1] = useState(getDynamicDateFormatted());
  const [date1Iso, setDate1Iso] = useState(new Date().toISOString().split('T')[0]);

  // Checkbox 1 Options (from template) - dynamically pre-checked & bound to tenure
  const [checkboxOptions, setCheckboxOptions] = useState({
    option1: true,
    option2: true,
    option3: true
  });

  const [allowFirstInviteeToFill, setAllowFirstInviteeToFill] = useState(false);

  // Step 2 & 3 state
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [documentId, setDocumentId] = useState('');

  // Extract client & sale info with robust fallback to leads array
  const clientInfo = sale?.fullClientInfo || sale?.clientInfo || {};
  const matchingLead = (leads || []).find(l => l.id === sale?.leadId);
  const clientName = clientInfo.clientName || sale?.clientName || 'Client';
  const panNumber = sale?.panNumber || clientInfo.panNumber || 'ABCDE1234F';
  const phone = sale?.phone1 || clientInfo.phone1 || '+91 98765 43210';
  const email = sale?.email || clientInfo.email || 'client@example.com';
  const serviceName = sale?.serviceOpted || clientInfo.serviceName || 'Equity Advisory';
  
  // Exact Service Tenure auto-pulled from Client Information Page
  const tenure = sale?.serviceTenure 
    || clientInfo.serviceTenure 
    || matchingLead?.clientInfo?.serviceTenure 
    || '3 months';

  const grossSales = sale?.amount || ('₹' + (sale?.grossSales || '50,000'));
  const rawGrossNum = parseFloat(String(sale?.grossSales || (sale?.amount ? String(sale.amount).replace(/[^0-9.]/g, '') : '50000'))) || 50000;
  const netSales = sale?.netSales || clientInfo.netSales || (rawGrossNum / 1.18).toFixed(2);
  const gst = sale?.gst || clientInfo.gst || (rawGrossNum - parseFloat(netSales)).toFixed(2);
  const paymentDate = clientInfo.paymentDate || sale?.date || date1;

  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      const dynamicDate = getDynamicDateFormatted();
      setDate1(dynamicDate);
      setDate1Iso(new Date().toISOString().split('T')[0]);
      setInviteSent(false);
      setIsCompleted(false);
      setOtpInput('');
      setDocumentId('LEEG-' + Date.now().toString().slice(-8));
      setActiveDocTab('mitc');
      setCheckboxOptions({
        option1: true,
        option2: true,
        option3: true
      });
    }
  }, [isOpen]);

  if (!isOpen || !sale) return null;

  const handleDateIsoChange = (e) => {
    const val = e.target.value;
    setDate1Iso(val);
    if (val) {
      const parts = val.split('-');
      if (parts.length === 3) {
        setDate1(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
    }
  };

  // Step 1: Create Document
  const handleCreateDocument = () => {
    if (!checkboxOptions.option1 || !checkboxOptions.option2 || !checkboxOptions.option3) {
      showToast('Please check all template agreement options to proceed.', 'warning');
      return;
    }

    setActiveStep(2);
    setIsSendingInvite(true);
    setTimeout(() => {
      setIsSendingInvite(false);
      setInviteSent(true);
      showToast('Document created! Leegality invitation link sent via SMS & Email with auto-filled Service Tenure (' + tenure + ').', 'success');
    }, 1200);
  };

  // Step 2: Proceed to Finalize (OTP Signing)
  const handleProceedToOtp = () => {
    setActiveStep(3);
  };

  // Step 3: Complete Aadhaar OTP E-Sign
  const handleFinalizeSigning = (e) => {
    e.preventDefault();
    if (otpInput.trim() !== '123456' && otpInput.trim().length < 4) {
      showToast('Please enter the 6-digit Aadhaar OTP (Default: 123456)', 'warning');
      return;
    }

    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setIsCompleted(true);

      const signMetadata = {
        documentId,
        date1: date1,
        signedAt: new Date().toISOString(),
        signedBy: clientName,
        pan: panNumber,
        serviceName,
        serviceTenure: tenure,
        grossSales,
        netSales,
        gst
      };

      completeESignProcess(sale.id, signMetadata);
      showToast(`Leegality E-Sign finalized for '${clientName}'! Service Tenure: ${tenure}. Document ID: ${documentId}`, 'success');

      if (onComplete) {
        onComplete(signMetadata);
      }
    }, 1500);
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1400, 
        backgroundColor: 'rgba(0, 0, 0, 0.94)', 
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
          maxWidth: '1240px', 
          width: '100%', 
          height: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          borderRadius: '10px',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9), 0 0 40px rgba(14, 116, 144, 0.25)',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {/* ─── LEEGALITY TOP NAVIGATION BAR (Pixel-Perfect from Screenshot) ─── */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Leegality Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 800,
              fontSize: '1.4rem',
              color: '#0284c7',
              letterSpacing: '-0.5px'
            }}>
              <span style={{ fontSize: '1.7rem', color: '#0369a1', lineHeight: 0.9 }}>❖</span>
              <span>leegality</span>
            </div>
            <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, marginLeft: '6px' }}>
              API v2.1
            </span>
          </div>

          {/* Stepper (1 Create -> 2 Invite -> 3 Finalize) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {/* Step 1: Create */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '4px',
              backgroundColor: activeStep === 1 ? '#0284c7' : 'transparent',
              color: activeStep === 1 ? '#ffffff' : (activeStep > 1 ? '#0284c7' : '#94a3b8'),
              fontWeight: 600,
              fontSize: '0.84rem'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 1 ? '#ffffff' : (activeStep > 1 ? '#0284c7' : '#cbd5e1'),
                color: activeStep === 1 ? '#0284c7' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                1
              </div>
              <span>Create</span>
            </div>

            {/* Step 2: Invite */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '4px',
              backgroundColor: activeStep === 2 ? '#0284c7' : 'transparent',
              color: activeStep === 2 ? '#ffffff' : (activeStep > 2 ? '#0284c7' : '#94a3b8'),
              fontWeight: 600,
              fontSize: '0.84rem'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 2 ? '#ffffff' : (activeStep > 2 ? '#0284c7' : '#cbd5e1'),
                color: activeStep === 2 ? '#0284c7' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                2
              </div>
              <span>Invite</span>
            </div>

            {/* Step 3: Finalize */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '4px',
              backgroundColor: activeStep === 3 ? '#0284c7' : 'transparent',
              color: activeStep === 3 ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.84rem'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 3 ? '#ffffff' : '#cbd5e1',
                color: activeStep === 3 ? '#0284c7' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                3
              </div>
              <span>Finalize</span>
            </div>
          </div>

          {/* Right Action Icons & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Top Right Tabs: Upload | Templates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
              <span 
                onClick={() => setActiveTab('Upload')}
                style={{ 
                  color: activeTab === 'Upload' ? '#0284c7' : '#64748b', 
                  cursor: 'pointer',
                  paddingBottom: '4px',
                  borderBottom: activeTab === 'Upload' ? '2px solid #0284c7' : 'none'
                }}
              >
                Upload
              </span>
              <span 
                onClick={() => setActiveTab('Templates')}
                style={{ 
                  color: activeTab === 'Templates' ? '#0284c7' : '#64748b', 
                  fontWeight: 600,
                  cursor: 'pointer',
                  paddingBottom: '4px',
                  borderBottom: activeTab === 'Templates' ? '2px solid #0284c7' : 'none'
                }}
              >
                Templates
              </span>
            </div>

            <button 
              onClick={onClose} 
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close Leegality Window"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── MAIN WORKSPACE (SPLIT: DOCUMENT PREVIEW VS FORM FIELDS) ─── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
          {/* LEFT COLUMN: DOCUMENT PREVIEW WITH MITC & CONTRACT TOGGLES */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#f1f5f9'
          }}>
            {/* Document Navigation & Auto-Fill Status Bar */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              background: '#e2e8f0',
              padding: '4px 6px',
              borderRadius: '8px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveDocTab('mitc')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.76rem',
                    fontWeight: activeDocTab === 'mitc' ? 700 : 500,
                    backgroundColor: activeDocTab === 'mitc' ? '#ffffff' : 'transparent',
                    color: activeDocTab === 'mitc' ? '#0284c7' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: activeDocTab === 'mitc' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <FileText size={13} /> Most Important Terms (MITC)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDocTab('contract')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.76rem',
                    fontWeight: activeDocTab === 'contract' ? 700 : 500,
                    backgroundColor: activeDocTab === 'contract' ? '#ffffff' : 'transparent',
                    color: activeDocTab === 'contract' ? '#0284c7' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: activeDocTab === 'contract' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <FileText size={13} /> Contract Agreement (T&C)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDocTab('both')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.76rem',
                    fontWeight: activeDocTab === 'both' ? 700 : 500,
                    backgroundColor: activeDocTab === 'both' ? '#ffffff' : 'transparent',
                    color: activeDocTab === 'both' ? '#0284c7' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: activeDocTab === 'both' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <FileCheck2 size={13} /> View Both
                </button>
              </div>

              {/* Service Tenure Auto-Fill Pill */}
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0369a1',
                backgroundColor: '#e0f2fe',
                border: '1px solid #7dd3fc',
                padding: '3px 8px',
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={11} /> Service Tenure: <strong>{tenure}</strong>
              </div>
            </div>

            {/* Virtual A4 Paper Document Preview Container */}
            <div style={{
              width: '100%',
              maxWidth: '680px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* DOCUMENT 1: MOST IMPORTANT TERMS & CONDITIONS (MITC)           */}
              {/* ───────────────────────────────────────────────────────────── */}
              {(activeDocTab === 'mitc' || activeDocTab === 'both') && (
                <div style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  padding: '36px 34px',
                  borderRadius: '4px',
                  color: '#334155',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  border: '1px solid #e2e8f0',
                  position: 'relative'
                }}>
                  {/* Watermark / Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    SEBI COMPLIANT MITC
                  </div>

                  {/* MITC Header */}
                  <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '2px solid #0284c7', paddingBottom: '12px' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px 0', color: '#0f172a', letterSpacing: '-0.2px' }}>
                      MOST IMPORTANT TERMS & CONDITIONS (MITC)
                    </h2>
                    <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0369a1', margin: '0 0 4px 0' }}>
                      SEBI (Research Analyst) Regulations, 2014 Mandatory Disclosure Document
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#64748b', margin: 0 }}>
                      Research Analyst: <strong>Harshal Parmar</strong> • SEBI Registration No: <strong>INH000002099</strong>
                    </p>
                  </div>

                  {/* Preamble Notice */}
                  <p style={{ fontSize: '0.74rem', color: '#475569', textAlign: 'justify', marginBottom: '14px' }}>
                    This document summarizes the <strong>Most Important Terms and Conditions (MITC)</strong> governing the research services provided by the Research Analyst. The Client acknowledges having selected the service parameters during the intake process:
                  </p>

                  {/* Highlighted Schedule Table with Exact Service Tenure */}
                  <div style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                    fontSize: '0.76rem'
                  }}>
                    <div style={{
                      fontWeight: 700,
                      color: '#0f172a',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: '6px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>Key Commercial & Service Parameters</span>
                      <span style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 600 }}>
                        Auto-Synced with Client Information Page
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                      <div>• <strong>Client Name:</strong> {clientInfo.clientPrefix || 'Mr.'} {clientName}</div>
                      <div>• <strong>PAN Number:</strong> {panNumber}</div>
                      <div>• <strong>Registered Mobile:</strong> {phone}</div>
                      <div>• <strong>Registered Email:</strong> {email}</div>
                      <div>• <strong>Subscribed Service:</strong> {serviceName}</div>

                      {/* SERVICE TENURE - HIGH VISIBILITY ROW */}
                      <div style={{
                        gridColumn: '1 / -1',
                        backgroundColor: '#e0f2fe',
                        border: '1px solid #7dd3fc',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '2px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#0369a1' }}>• Service Tenure (Duration):</strong>
                          <span style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            padding: '1px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.8rem'
                          }}>
                            {tenure}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={11} /> Auto-Pulled from Client Info Page
                        </span>
                      </div>

                      <div>• <strong>Gross Advisory Fee:</strong> {grossSales}</div>
                      <div>• <strong>Net Fee / GST:</strong> ₹{Number(netSales).toLocaleString('en-IN')} + GST ₹{Number(gst).toLocaleString('en-IN')}</div>
                      <div>• <strong>Date of Execution:</strong> {date1}</div>
                      <div>• <strong>Date of Payment:</strong> {paymentDate}</div>
                    </div>
                  </div>

                  {/* Standard MITC Regulatory Points */}
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.78rem' }}>Essential Terms & Disclosures:</strong>
                    <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0', color: '#475569', fontSize: '0.74rem', lineHeight: 1.5 }}>
                      <li>
                        <strong>Tenure Duration & Validity:</strong> The research recommendations and analyst advisory services are strictly engaged for the duration of <strong>{tenure}</strong> starting on <strong>{date1}</strong>. The service shall automatically terminate at the conclusion of the <strong>{tenure}</strong> period without automatic rollover unless renewed by written mutual agreement.
                      </li>
                      <li>
                        <strong>Nature of Advisory Services:</strong> The Research Analyst provides research reports and opinions on a non-discretionary, advisory basis only under SEBI (Research Analyst) Regulations, 2014. The RA does not execute trades, manage funds, or offer guaranteed returns.
                      </li>
                      <li>
                        <strong>Market Risk Disclosure:</strong> Investment in the securities market is subject to market risks. The Client has evaluated their financial risk profile prior to engaging this <strong>{tenure}</strong> service.
                      </li>
                      <li>
                        <strong>Grievance Redressal / SCORES:</strong> In case of unresolved queries, the Client may register a complaint on the SEBI SCORES portal at <code>https://scores.sebi.gov.in</code> or SMART ODR portal at <code>https://smartodr.in</code>.
                      </li>
                    </ol>
                  </div>

                  {/* Client Declaration */}
                  <div style={{
                    backgroundColor: '#f1f5f9',
                    borderLeft: '3px solid #0284c7',
                    padding: '8px 12px',
                    fontSize: '0.72rem',
                    color: '#334155',
                    marginBottom: '16px'
                  }}>
                    <strong>Client Acknowledgment:</strong> "I confirm that I have reviewed, understood, and agreed to these Most Important Terms & Conditions (MITC), specifically acknowledging the service tenure of <strong>{tenure}</strong> for <strong>{serviceName}</strong>."
                  </div>

                  {/* Digital Signature Footer */}
                  <div style={{
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    fontSize: '0.72rem'
                  }}>
                    <div>
                      <div style={{ color: '#64748b' }}>Authorized Signer (Research Analyst):</div>
                      <strong style={{ color: '#0f172a' }}>Harshal Parmar (SEBI INH000002099)</strong>
                      <div style={{ color: '#10b981', fontWeight: 600 }}>✓ Certified Digital Signer</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#64748b' }}>Client Signature (Second Invitee):</div>
                      <strong style={{ color: '#0f172a' }}>{clientName}</strong>
                      {isCompleted ? (
                        <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                          <CheckCircle2 size={13} /> Aadhaar E-Signed ({date1})
                        </div>
                      ) : (
                        <div style={{ color: '#f59e0b', fontWeight: 600 }}>Awaiting Signature</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* DOCUMENT 2: TERMS AND CONDITIONS AGREEMENT (CONTRACT)          */}
              {/* ───────────────────────────────────────────────────────────── */}
              {(activeDocTab === 'contract' || activeDocTab === 'both') && (
                <div style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  padding: '36px 34px',
                  borderRadius: '4px',
                  color: '#334155',
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  border: '1px solid #e2e8f0'
                }}>
                  {/* Document Header */}
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a', letterSpacing: '-0.2px' }}>
                      TERMS AND CONDITIONS AGREEMENT
                    </h2>
                    <p style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', margin: 0 }}>
                      **The client is requested to read the terms and conditions of the research services offered including rights and obligations.**
                    </p>
                  </div>

                  {/* Dynamic Date Agreement Preamble */}
                  <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    This Terms and Conditions Agreement (hereinafter referred to as <strong>"Agreement"</strong>) is made on{' '}
                    <span style={{
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      border: '1px solid #7dd3fc'
                    }}>
                      {date1}
                    </span>{' '}
                    and entered into
                  </div>

                  {/* By and Between */}
                  <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    <strong>By and between:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>
                      <strong>Harshal Parmar</strong> (hereinafter referred to as <strong>"Research Analyst / RA"</strong>), having its registered office at Shop No. 5, Pramukh Darshan Complex, Chharwada Road, Vapi, Valsad, Gujarat - 396191 and duly registered under SEBI (Research Analyst) Regulations, 2014 under Registration Number <strong>INH000002099</strong> (which expression shall, unless repugnant to the context or meaning thereof, be deemed to mean and include its successors and assigns) of the <strong>ONE PART</strong>.
                    </p>
                  </div>

                  {/* AND Client Details */}
                  <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    <strong>AND</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Client or User (<strong>"You"</strong>, <strong>"Your"</strong>, or <strong>"Client"</strong>):
                    </p>
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      margin: '6px 0',
                      fontSize: '0.75rem',
                      lineHeight: 1.4
                    }}>
                      <div>• <strong>Name:</strong> {clientInfo.clientPrefix || ''} {clientName}</div>
                      <div>• <strong>PAN:</strong> {panNumber} | <strong>Email:</strong> {email}</div>
                      <div>• <strong>Phone:</strong> {phone} | <strong>State:</strong> {clientInfo.clientState || 'Maharashtra'}</div>
                      <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>• <strong>Service:</strong> {serviceName}</span>
                        <span style={{
                          backgroundColor: '#e0f2fe',
                          color: '#0284c7',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontWeight: 700,
                          border: '1px solid #bae6fd'
                        }}>
                          Service Tenure: {tenure}
                        </span>
                        <span>• <strong>Fee Consideration:</strong> {grossSales}</span>
                      </div>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>
                      • The individual or entity subscribing to or availing research services.<br />
                      • Must meet the eligibility requirements set forth herein and under Indian law of the <strong>SECOND PART</strong>.
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#64748b' }}>
                      The Research Analyst and the Client are hereinafter collectively referred to as "Parties" and individually as "Party".
                    </p>
                  </div>

                  {/* Recitals / WHEREAS */}
                  <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    <strong>WHEREAS</strong>
                    <ol style={{ paddingLeft: '18px', margin: '4px 0 0 0', color: '#475569' }}>
                      <li>The Research Analyst is authorized to provide research analyst services in accordance with SEBI (Research Analyst) Regulations, 2014.</li>
                      <li>The Client has expressed an interest in availing the aforementioned services.</li>
                      <li>These Terms & Conditions ("T&C") Agreement govern the Client's, from time to time, use or subscription of our research services ("Services"), including any Digital Platforms, or communications.</li>
                    </ol>
                  </div>

                  {/* Clause 3: Scope of Services & Exact Service Tenure */}
                  <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
                    <strong>3. SCOPE OF SERVICES & SERVICE TENURE</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>
                      (a) The Research Analyst shall provide research recommendations and analyst reports under the <strong>{serviceName}</strong> package to the Client for the explicit duration of <strong>{tenure}</strong> (<strong>"Service Tenure"</strong>) selected during the Client Information intake process.<br />
                      (b) The tenure starts effective on the date of execution (<strong>{date1}</strong>) and remains valid strictly for the agreed <strong>{tenure}</strong> period.<br />
                      (c) All research alerts and advisory publications will be disseminated strictly in accordance with SEBI (Research Analyst) Regulations, 2014.
                    </p>
                  </div>

                  {/* Digital E-Sign Stamp / Status */}
                  <div style={{
                    marginTop: 'auto',
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    fontSize: '0.72rem'
                  }}>
                    <div>
                      <div style={{ color: '#64748b' }}>First Invitee (Research Analyst):</div>
                      <strong style={{ color: '#0f172a' }}>Harshal Parmar (SEBI INH000002099)</strong>
                      <div style={{ color: '#10b981', fontWeight: 600 }}>✓ Certified Digital Signer</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#64748b' }}>Second Invitee (Client):</div>
                      <strong style={{ color: '#0f172a' }}>{clientName}</strong>
                      {isCompleted ? (
                        <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                          <CheckCircle2 size={13} /> Aadhaar E-Signed ({date1})
                        </div>
                      ) : (
                        <div style={{ color: '#f59e0b', fontWeight: 600 }}>Awaiting Signature</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: TEMPLATE FORM FIELDS (Pixel-Perfect from Screenshot) */}
          <div style={{
            width: '380px',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ flex: 1, padding: '22px 20px', overflowY: 'auto' }}>
              {activeStep === 1 && (
                <>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>
                    Template Form Fields
                  </h3>

                  {/* ─── FIELD: Date 1 (Matching Screenshot) ─── */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Date 1
                    </label>

                    {/* Input with calendar icon matching screenshot */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={date1}
                        onChange={(e) => setDate1(e.target.value)}
                        placeholder="dd/mm/yyyy"
                        style={{
                          width: '100%',
                          padding: '8px 36px 8px 12px',
                          fontSize: '0.84rem',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          border: '1px solid #0284c7',
                          borderRadius: '4px',
                          boxShadow: '0 0 0 2px rgba(2, 132, 199, 0.15)',
                          fontWeight: 500
                        }}
                      />
                      {/* Hidden native date picker to allow picking */}
                      <input
                        type="date"
                        value={date1Iso}
                        onChange={handleDateIsoChange}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          opacity: 0,
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer'
                        }}
                      />
                      <Calendar 
                        size={16} 
                        color="#0284c7" 
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
                      />
                    </div>

                    <span style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                      ⚡ Dynamically records the exact execution date: <strong>{date1}</strong>
                    </span>
                  </div>

                  {/* ─── SERVICE TENURE AUTO-FILL INDICATOR FIELD ─── */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>Service Tenure (Auto-Filled)</span>
                      <span style={{ fontSize: '0.68rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        ✓ Client Info Synced
                      </span>
                    </label>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '0.84rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ClockIcon />
                        <strong style={{ color: '#0f172a' }}>{tenure}</strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>
                        Auto-Filled
                      </span>
                    </div>

                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Pulled from Client Information Page & injected into MITC and contract.
                    </span>
                  </div>

                  {/* ─── FIELD: Checkbox 1 (Circled in Cyan in Screenshot) ─── */}
                  <div style={{
                    marginBottom: '22px',
                    border: '1.5px dashed #0284c7',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: 'rgba(2, 132, 199, 0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Checkbox 1
                      </label>
                      <span style={{
                        fontSize: '0.68rem',
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontWeight: 700
                      }}>
                        Tenure Bound
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Option 1: Bound to Exact Service Tenure (Circled in Screenshot) */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#1e293b',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        backgroundColor: checkboxOptions.option1 ? '#f0fdf4' : '#ffffff',
                        border: checkboxOptions.option1 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        borderRadius: '4px'
                      }}>
                        <input
                          type="checkbox"
                          checked={checkboxOptions.option1}
                          onChange={(e) => setCheckboxOptions({ ...checkboxOptions, option1: e.target.checked })}
                          style={{ accentColor: '#0284c7', width: '15px', height: '15px', marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            Option 1: Service Tenure: <strong style={{ color: '#0284c7' }}>{tenure}</strong>
                          </div>
                          <span style={{ fontSize: '0.69rem', color: '#16a34a', display: 'block', marginTop: '1px' }}>
                            ✓ Exact Service Tenure selected on Client Information Page
                          </span>
                        </div>
                      </label>

                      {/* Option 2: Service Name & Fee */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#1e293b',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        backgroundColor: checkboxOptions.option2 ? '#f8fafc' : '#ffffff',
                        border: checkboxOptions.option2 ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                        borderRadius: '4px'
                      }}>
                        <input
                          type="checkbox"
                          checked={checkboxOptions.option2}
                          onChange={(e) => setCheckboxOptions({ ...checkboxOptions, option2: e.target.checked })}
                          style={{ accentColor: '#0284c7', width: '15px', height: '15px', marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            Option 2: Service Plan ({serviceName})
                          </div>
                          <span style={{ fontSize: '0.69rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                            Fee: {grossSales} • RA Scope Confirmed
                          </span>
                        </div>
                      </label>

                      {/* Option 3: MITC & Regulatory Compliance */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#1e293b',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        backgroundColor: checkboxOptions.option3 ? '#f8fafc' : '#ffffff',
                        border: checkboxOptions.option3 ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                        borderRadius: '4px'
                      }}>
                        <input
                          type="checkbox"
                          checked={checkboxOptions.option3}
                          onChange={(e) => setCheckboxOptions({ ...checkboxOptions, option3: e.target.checked })}
                          style={{ accentColor: '#0284c7', width: '15px', height: '15px', marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            Option 3: MITC & Leegality E-Sign Consent
                          </div>
                          <span style={{ fontSize: '0.69rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                            SEBI (Research Analyst) Regulations, 2014 Terms
                          </span>
                        </div>
                      </label>
                    </div>

                    <div style={{
                      fontSize: '0.68rem',
                      color: '#0284c7',
                      marginTop: '8px',
                      padding: '4px 8px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '4px',
                      lineHeight: 1.3
                    }}>
                      ⚡ <strong>Auto-Fill Active:</strong> Checkbox 1 Option 1 is bound to <strong>"{tenure}"</strong> chosen on Client Information Page.
                    </div>
                  </div>

                  {/* Invitee Metadata Box */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    color: '#64748b',
                    lineHeight: 1.4
                  }}>
                    <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Invitee Target:</strong>
                    <div>• Name: {clientName}</div>
                    <div>• Mobile: {phone}</div>
                    <div>• Email: {email}</div>
                    <div>• Service: {serviceName}</div>
                    <div>• Service Tenure: <strong style={{ color: '#0284c7' }}>{tenure}</strong></div>
                  </div>
                </>
              )}

              {/* STEP 2: INVITE SCREEN */}
              {activeStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>
                    Leegality API Dispatch
                  </h3>

                  <div style={{
                    padding: '14px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '0.78rem',
                    color: '#166534'
                  }}>
                    <strong>Document Created!</strong> Reference: <code>{documentId}</code>
                    <br /><br />
                    An encrypted digital e-sign package containing the <strong>MITC</strong> and <strong>Contract Agreement</strong> for <strong>{tenure}</strong> tenure has been dispatched via Leegality API to:
                    <div style={{ marginTop: '6px', fontWeight: 600 }}>
                      📱 SMS: {phone}<br />
                      ✉️ Email: {email}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '16px' }}>
                    The client can either click their SMS/Email link or you can proceed to the Finalize step to simulate Aadhaar OTP authentication directly.
                  </div>

                  <button
                    type="button"
                    onClick={handleProceedToOtp}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    Proceed to Client Finalize Step <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* STEP 3: FINALIZE / AADHAAR OTP E-SIGN */}
              {activeStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>
                    Finalize Digital E-Sign
                  </h3>

                  {!isCompleted ? (
                    <form onSubmit={handleFinalizeSigning}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '0.76rem',
                        color: '#475569'
                      }}>
                        <strong>Aadhaar e-Sign Service (ESP)</strong>
                        <p style={{ margin: '4px 0 0 0' }}>
                          A 6-digit one-time password has been sent to client mobile linked with UIDAI for executing the <strong>{tenure}</strong> agreement.
                        </p>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Enter Aadhaar OTP (Demo: 123456) *
                        </label>
                        <input
                          type="text"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '1rem',
                            letterSpacing: '4px',
                            textAlign: 'center',
                            border: '1px solid #0284c7',
                            borderRadius: '4px'
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isVerifyingOtp}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {isVerifyingOtp ? 'Verifying OTP & Affixing Signature...' : 'Confirm & Affix Digital Signature'}
                      </button>
                    </form>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px auto'
                      }}>
                        <CheckCircle2 size={26} />
                      </div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#166534', fontWeight: 700 }}>
                        Agreement E-Signed!
                      </h4>
                      <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 16px 0' }}>
                        MITC and Contract document sealed with Leegality cryptographic audit certificate for <strong>{tenure}</strong> tenure.
                      </p>

                      <button
                        type="button"
                        onClick={onClose}
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        Return to CRM Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── BOTTOM CONTROLS (Pixel-Perfect from Screenshot) ─── */}
            <div style={{
              padding: '14px 18px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* "Allow first invitee to fill" Toggle (Matching Screenshot) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="allowFirstInvitee"
                  checked={allowFirstInviteeToFill}
                  onChange={(e) => setAllowFirstInviteeToFill(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <label htmlFor="allowFirstInvitee" style={{ fontSize: '0.76rem', color: '#64748b', cursor: 'pointer' }}>
                  Allow first invitee to fill
                </label>
              </div>

              {/* Action Buttons: Back & Create Document */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep > 1) setActiveStep(prev => prev - 1);
                    else onClose();
                  }}
                  style={{
                    padding: '7px 16px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>

                {activeStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleCreateDocument}
                    style={{
                      padding: '7px 18px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                    }}
                  >
                    Create Document
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '7px 18px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini Clock Icon helper component
const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);
