import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  ArrowLeft,
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
  AlertCircle,
  Copy,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Sliders,
  Info,
  Code,
  FileSignature,
  Eye,
  UserCheck,
  Shield
} from 'lucide-react';
import { HarshalParmarESign } from './HarshalParmarESign';

// ─── AUTHENTIC LEEGALITY LOGO (Geometric Multi-Color Facets) ────────────────
const LeegalityLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <path d="M6 34 L20 6 L20 20 Z" fill="#E11D48" />
      <path d="M20 6 L34 34 L20 20 Z" fill="#7C3AED" />
      <path d="M6 34 L34 34 L20 20 Z" fill="#0284C7" />
      <path d="M12 28 L28 28 L20 14 Z" fill="#06B6D4" opacity="0.8" />
    </svg>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
      <span style={{
        fontSize: '1.4rem',
        fontWeight: 800,
        color: '#0f172a',
        letterSpacing: '-0.5px',
        fontFamily: "'Inter', sans-serif"
      }}>
        leegality
      </span>
    </div>
  </div>
);

// ─── EXACT LEEGALITY TOGGLE SWITCH COMPONENT ─────────────────────────────────
const LeegalityToggle = ({ checked, onChange, disabled = false, id }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    id={id}
    disabled={disabled}
    onClick={() => !disabled && onChange && onChange(!checked)}
    style={{
      position: 'relative',
      width: '38px',
      height: '22px',
      borderRadius: '12px',
      backgroundColor: checked ? '#2b5c7d' : (disabled ? '#e2e8f0' : '#cbd5e1'),
      border: disabled ? '1px solid #cbd5e1' : 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.2s ease',
      padding: 0,
      outline: 'none',
      opacity: disabled ? 0.75 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0
    }}
  >
    <span
      style={{
        display: 'block',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: disabled && !checked ? '#94a3b8' : '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        transition: 'transform 0.2s ease, background-color 0.2s ease'
      }}
    />
  </button>
);

// ─── SEBI MITC & CONTRACT DOCUMENT PREVIEW ──────────────────────────────────
const LeegalityDocumentPreview = ({
  activeDocTab,
  setActiveDocTab,
  tenure,
  clientInfo,
  clientName,
  panNumber,
  phone,
  email,
  serviceName,
  grossSales,
  netSales,
  gst,
  date1,
  paymentDate,
  isSignAffixed,
  activeStep,
  isCompleted,
  documentId
}) => {
  return (
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
        {/* ── DOCUMENT 1: MITC ── */}
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

            <p style={{ fontSize: '0.74rem', color: '#475569', textAlign: 'justify', marginBottom: '14px' }}>
              This document summarizes the <strong>Most Important Terms and Conditions (MITC)</strong> governing the research services provided by the Research Analyst. The Client acknowledges having selected the service parameters during the intake process:
            </p>

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

            <div style={{ marginBottom: '14px' }}>
              <strong style={{ color: '#0f172a', fontSize: '0.78rem' }}>Essential Terms & Disclosures:</strong>
              <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0', color: '#475569', fontSize: '0.74rem', lineHeight: 1.5 }}>
                <li>
                  <strong>Tenure Duration & Validity:</strong> The research recommendations and analyst advisory services are strictly engaged for the duration of <strong>{tenure}</strong> starting on <strong>{date1}</strong>.
                </li>
                <li>
                  <strong>Nature of Advisory Services:</strong> The Research Analyst provides research reports and opinions on a non-discretionary, advisory basis only under SEBI (Research Analyst) Regulations, 2014.
                </li>
                <li>
                  <strong>Market Risk Disclosure:</strong> Investment in the securities market is subject to market risks. The Client has evaluated their financial risk profile prior to engaging this <strong>{tenure}</strong> service.
                </li>
              </ol>
            </div>

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

            {/* Signature Block (Harshal Parmar in cyan marked box) */}
            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  For Harshal Parmar
                </div>
                <div>
                  <HarshalParmarESign
                    date={date1}
                    isConfirmed={isSignAffixed || activeStep > 1 || isCompleted}
                    showCyanBorder={true}
                    documentId={documentId}
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5, marginTop: '4px' }}>
                  <div>Signature:</div>
                  <div>Name: Mr Harshal Parmar</div>
                  <div>Designation: Principal Officer</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                  For and on behalf of the Client
                </div>
                <div style={{ minHeight: '34px', display: 'flex', alignItems: 'center', margin: '4px 0 6px 0' }}>
                  {isCompleted ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '4px',
                      fontSize: '0.74rem',
                      color: '#166534',
                      fontWeight: 700
                    }}>
                      <CheckCircle2 size={13} color="#16a34a" /> Aadhaar E-Signed by {clientName} ({date1})
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', padding: '2px 0' }}>
                      [Client signature affixed via Aadhaar OTP in Step 3]
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5 }}>
                  <div>Signature: {isCompleted ? <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Verified</span> : ''}</div>
                  <div>Name: {clientName}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENT 2: CONTRACT AGREEMENT ── */}
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
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: '#0f172a', letterSpacing: '-0.2px' }}>
                TERMS AND CONDITIONS AGREEMENT
              </h2>
              <p style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', margin: 0 }}>
                **The client is requested to read the terms and conditions of the research services offered including rights and obligations.**
              </p>
            </div>

            <div style={{ marginBottom: '14px', textAlign: 'justify' }}>
              This Terms and Conditions Agreement is made on{' '}
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
              and entered into by and between <strong>Harshal Parmar</strong> (SEBI INH000002099) of the <strong>ONE PART</strong> and <strong>{clientName}</strong> (PAN: {panNumber}) of the <strong>SECOND PART</strong> for the explicit tenure of <strong>{tenure}</strong>.
            </div>

            {/* Signature Block Page 14 */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                For Harshal Parmar
              </div>
              <div>
                <HarshalParmarESign
                  date={date1}
                  isConfirmed={isSignAffixed || activeStep > 1 || isCompleted}
                  showCyanBorder={true}
                  documentId={documentId}
                />
              </div>
              <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5, marginTop: '4px' }}>
                <div>Signature:</div>
                <div>Name: Mr Harshal Parmar</div>
                <div>Designation: Principal Officer</div>
              </div>
            </div>

            <div style={{
              marginTop: '36px',
              paddingTop: '12px',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.74rem',
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Page 14 of 14</span>
              <span style={{ fontSize: '0.68rem', color: '#0284c7' }}>SEBI INH000002099 Certified</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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

  // Dynamic Date 1
  const getDynamicDateFormatted = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [date1, setDate1] = useState(getDynamicDateFormatted());
  const [date1Iso, setDate1Iso] = useState(new Date().toISOString().split('T')[0]);

  // Checkbox 1 Options (bound to tenure)
  const [checkboxOptions, setCheckboxOptions] = useState({
    option1: true,
    option2: true,
    option3: true
  });

  const [allowFirstInviteeToFill, setAllowFirstInviteeToFill] = useState(false);
  const [isSignAffixed, setIsSignAffixed] = useState(true);

  // ─── STEP 2 (INVITE) STATE MATCHING LEEGALITY SCREENSHOT ──────────────────
  const [requestFixedOrder, setRequestFixedOrder] = useState(false);
  // User Requirement: "in leegality (ekyc portal of which we are using api) this must be disabled"
  const [iWantToSign, setIWantToSign] = useState(false); // MUST BE DISABLED
  const [invitees, setInvitees] = useState([]);
  const [signatureDropdownOpenId, setSignatureDropdownOpenId] = useState(null);
  const [selectedInviteeForOptions, setSelectedInviteeForOptions] = useState(null);
  const [showJourneyOptionsModal, setShowJourneyOptionsModal] = useState(false);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [previewLegacyInvestEQ, setPreviewLegacyInvestEQ] = useState(false);

  // Step 3 state
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [documentId, setDocumentId] = useState('');

  // Extract client & sale info
  const clientInfo = sale?.fullClientInfo || sale?.clientInfo || {};
  const matchingLead = (leads || []).find(l => l.id === sale?.leadId);
  const clientName = clientInfo.clientName || sale?.clientName || 'Client';
  const panNumber = sale?.panNumber || clientInfo.panNumber || 'ABCDE1234F';
  const phone = sale?.phone1 || clientInfo.phone1 || '+91 98765 43210';
  const email = sale?.email || clientInfo.email || 'client@example.com';
  const serviceName = sale?.serviceOpted || clientInfo.serviceName || 'Equity Advisory';
  
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
      setRequestFixedOrder(false);
      setIWantToSign(false); // MUST BE DISABLED
      setPreviewLegacyInvestEQ(false);
      setInvitees([
        {
          id: 'inv-client-1',
          name: clientName,
          phone: phone,
          email: email,
          contact: phone || email,
          enterBoth: true, // User Requirement: once disabled, "enter both" must be selected
          signatureType: 'Aadhaar E-Sign (OTP)',
          role: 'Signer'
        }
      ]);
    }
  }, [isOpen, sale]);

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

  // Step 1: Create Document -> Moves to Step 2 (Invite)
  const handleCreateDocument = () => {
    if (!checkboxOptions.option1 || !checkboxOptions.option2 || !checkboxOptions.option3) {
      showToast('Please check all template agreement options to proceed.', 'warning');
      return;
    }
    setActiveStep(2);
    showToast('Document initialized! Review invitees in Leegality Step 2: Invite.', 'info');
  };

  // Step 2 Invitee Handlers
  const handleAddInvitee = () => {
    const newId = 'inv-' + Date.now();
    setInvitees(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        phone: '',
        email: '',
        contact: '',
        enterBoth: true, // "once disabled, 'enter both' must be selected"
        signatureType: 'Aadhaar E-Sign (OTP)',
        role: 'Signer'
      }
    ]);
    showToast('New Invitee added (Enter both selected for Phone & Email).', 'info');
  };

  const handleUpdateInvitee = (id, field, value) => {
    setInvitees(prev => prev.map(inv => {
      if (inv.id !== id) return inv;
      const updated = { ...inv, [field]: value };
      if (field === 'phone' || field === 'email' || field === 'enterBoth') {
        const p = field === 'phone' ? value : (inv.phone || '');
        const e = field === 'email' ? value : (inv.email || '');
        const isBoth = field === 'enterBoth' ? value : updated.enterBoth;
        updated.contact = isBoth ? [p, e].filter(Boolean).join(' / ') : (p || e || inv.contact);
      }
      return updated;
    }));
  };

  const handleDuplicateInvitee = (id) => {
    const target = invitees.find(inv => inv.id === id);
    if (!target) return;
    const dup = {
      ...target,
      id: 'inv-' + Date.now(),
      name: `${target.name} (Copy)`
    };
    setInvitees(prev => [...prev, dup]);
    showToast('Invitee duplicated.', 'info');
  };

  const handleMoveInvitee = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= invitees.length) return;
    setInvitees(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIndex];
      copy[newIndex] = temp;
      return copy;
    });
  };

  const handleDeleteInvitee = (id) => {
    if (invitees.length <= 1) {
      showToast('At least one invitee must remain for signing.', 'warning');
      return;
    }
    setInvitees(prev => prev.filter(inv => inv.id !== id));
    showToast('Invitee removed.', 'info');
  };

  // Step 2 -> Step 3 (Proceed to Finalize OTP)
  const handleProceedToOtp = () => {
    const primary = invitees[0];
    if (!primary || !primary.name?.trim()) {
      showToast('Please provide a valid invitee name.', 'warning');
      return;
    }

    const phoneVal = (primary.phone || (primary.contact && !primary.contact.includes('@') ? primary.contact : '')).trim();
    const emailVal = (primary.email || (primary.contact && primary.contact.includes('@') ? primary.contact : '')).trim();

    if (primary.enterBoth) {
      if (!phoneVal || !emailVal) {
        showToast('"Enter both" is selected: Please provide both Phone number and Email for two-factor Aadhaar verification.', 'warning');
        return;
      }
    } else {
      if (!phoneVal && !emailVal && !primary.contact?.trim()) {
        showToast('Please provide valid invitee phone or email.', 'warning');
        return;
      }
    }

    const displayContact = primary.enterBoth 
      ? `${phoneVal} & ${emailVal}` 
      : (primary.contact || phoneVal || emailVal);

    setActiveStep(3);
    setIsSendingInvite(true);
    setTimeout(() => {
      setIsSendingInvite(false);
      setInviteSent(true);
      showToast(`Leegality E-Sign package dispatched to ${primary.name} (${displayContact}).`, 'success');
    }, 1000);
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
        signedBy: invitees[0]?.name || clientName,
        pan: panNumber,
        serviceName,
        serviceTenure: tenure,
        grossSales,
        netSales,
        gst,
        iWantToSignDisabled: true, // Persist compliance flag
        signers: invitees
      };

      completeESignProcess(sale.id, signMetadata);
      showToast(`Leegality E-Sign finalized for '${clientName}'! Service Tenure: ${tenure}. Document ID: ${documentId}`, 'success');

      if (onComplete) {
        onComplete(signMetadata);
      }
    }, 1500);
  };

  const cardActionBtnStyle = {
    padding: '6px 10px',
    border: 'none',
    borderRight: '1px solid #e2e8f0',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9), 0 0 40px rgba(43, 92, 125, 0.3)',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif"
        }}
      >
        {/* ─── TOP NAVIGATION BAR (Pixel-Perfect from Screenshot) ─── */}
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
            <LeegalityLogo />
            <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, marginLeft: '6px' }}>
              API v2.1
            </span>
          </div>

          {/* Stepper (1 Create -> 2 Invite -> 3 Finalize) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Step 1: Create */}
            <div 
              onClick={() => setActiveStep(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: activeStep === 1 ? '6px 16px' : '4px 8px',
                borderRadius: '4px',
                backgroundColor: activeStep === 1 ? '#2b5c7d' : 'transparent',
                color: activeStep === 1 ? '#ffffff' : (activeStep > 1 ? '#2b5c7d' : '#94a3b8'),
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 1 ? '#ffffff' : (activeStep > 1 ? '#2b5c7d' : '#e2e8f0'),
                color: activeStep === 1 ? '#2b5c7d' : (activeStep > 1 ? '#ffffff' : '#64748b'),
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

            {/* Step 2: Invite (Exact Leegality dark slate blue pill #2b5c7d from screenshot) */}
            <div 
              onClick={() => setActiveStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: activeStep === 2 ? '6px 16px' : '4px 8px',
                borderRadius: '4px',
                backgroundColor: activeStep === 2 ? '#2b5c7d' : 'transparent',
                color: activeStep === 2 ? '#ffffff' : (activeStep > 2 ? '#2b5c7d' : '#94a3b8'),
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 2 ? '#ffffff' : (activeStep > 2 ? '#2b5c7d' : '#e2e8f0'),
                color: activeStep === 2 ? '#2b5c7d' : (activeStep > 2 ? '#ffffff' : '#64748b'),
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
            <div 
              onClick={() => setActiveStep(3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: activeStep === 3 ? '6px 16px' : '4px 8px',
                borderRadius: '4px',
                backgroundColor: activeStep === 3 ? '#2b5c7d' : 'transparent',
                color: activeStep === 3 ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: activeStep === 3 ? '#ffffff' : '#e2e8f0',
                color: activeStep === 3 ? '#2b5c7d' : '#64748b',
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
            {activeStep === 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                <span 
                  onClick={() => setActiveTab('Upload')}
                  style={{ 
                    color: activeTab === 'Upload' ? '#2b5c7d' : '#64748b', 
                    cursor: 'pointer',
                    paddingBottom: '4px',
                    borderBottom: activeTab === 'Upload' ? '2px solid #2b5c7d' : 'none'
                  }}
                >
                  Upload
                </span>
                <span 
                  onClick={() => setActiveTab('Templates')}
                  style={{ 
                    color: activeTab === 'Templates' ? '#2b5c7d' : '#64748b', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    paddingBottom: '4px',
                    borderBottom: activeTab === 'Templates' ? '2px solid #2b5c7d' : 'none'
                  }}
                >
                  Templates
                </span>
              </div>
            )}

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

        {/* ─── STEP 1: CREATE VIEW (SPLIT: PREVIEW VS FORM FIELDS) ─── */}
        {activeStep === 1 && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
            <LeegalityDocumentPreview
              activeDocTab={activeDocTab}
              setActiveDocTab={setActiveDocTab}
              tenure={tenure}
              clientInfo={clientInfo}
              clientName={clientName}
              panNumber={panNumber}
              phone={phone}
              email={email}
              serviceName={serviceName}
              grossSales={grossSales}
              netSales={netSales}
              gst={gst}
              date1={date1}
              paymentDate={paymentDate}
              isSignAffixed={isSignAffixed}
              activeStep={activeStep}
              isCompleted={isCompleted}
              documentId={documentId}
            />

            {/* RIGHT COLUMN: TEMPLATE FORM FIELDS */}
            <div style={{
              width: '380px',
              backgroundColor: '#ffffff',
              borderLeft: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ flex: 1, padding: '22px 20px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>
                  Template Form Fields
                </h3>

                {/* Date 1 Field */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Date 1
                  </label>
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
                        fontWeight: 500
                      }}
                    />
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
                    ⚡ Dynamically records execution date: <strong>{date1}</strong>
                  </span>
                </div>

                {/* Service Tenure Auto-Fill */}
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
                </div>

                {/* Checkbox 1 (Bound to Tenure) */}
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
                    <span style={{ fontSize: '0.68rem', backgroundColor: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                      Tenure Bound
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  <div>• Service Tenure: <strong style={{ color: '#0284c7' }}>{tenure}</strong></div>
                </div>
              </div>

              {/* Bottom Controls */}
              <div style={{
                padding: '14px 18px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="allowFirstInvitee"
                    checked={allowFirstInviteeToFill}
                    onChange={(e) => setAllowFirstInviteeToFill(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2b5c7d', cursor: 'pointer' }}
                  />
                  <label htmlFor="allowFirstInvitee" style={{ fontSize: '0.76rem', color: '#64748b', cursor: 'pointer' }}>
                    Allow first invitee to fill
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={onClose}
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
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDocument}
                    style={{
                      padding: '7px 18px',
                      backgroundColor: '#2b5c7d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(43, 92, 125, 0.35)'
                    }}
                  >
                    Create Document <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2: DEDICATED FULL-WIDTH INVITE SCREEN (EXACT FROM SCREENSHOT) ─── */}
        {activeStep === 2 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            overflowY: 'auto'
          }}>
            {/* Centered Content Container */}
            <div style={{
              width: '100%',
              maxWidth: '820px',
              margin: '0 auto',
              padding: '36px 32px 20px 32px',
              flex: 1
            }}>
              {/* ─── TWO SWITCHES AT TOP (MATCHING SCREENSHOT) ─── */}
              <div style={{ marginBottom: '26px' }}>
                {/* Switch 1: Request invitees to sign in fixed order */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <LeegalityToggle
                    id="toggle-fixed-order"
                    checked={requestFixedOrder}
                    onChange={(checked) => setRequestFixedOrder(checked)}
                  />
                  <label 
                    htmlFor="toggle-fixed-order" 
                    style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Request invitees to sign in fixed order
                  </label>
                </div>

                {/* Switch 2: I want to sign this document (CIRCLED IN CYAN - MUST BE DISABLED) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <LeegalityToggle
                    id="toggle-self-sign"
                    checked={previewLegacyInvestEQ}
                    disabled={true} // Strictly disabled per requirement
                    onChange={() => {}}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label 
                        htmlFor="toggle-self-sign" 
                        style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600, cursor: 'not-allowed' }}
                      >
                        I want to sign this document
                      </label>
                      <span style={{
                        fontSize: '0.7rem',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Lock size={11} /> Must be disabled (API Policy)
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.45 }}>
                      In Leegality (eKYC API portal), this toggle <strong>must be disabled</strong>. Disabling this removes <code>InvestEQ (8494953754)</code> from signers so only the client signs, since Harshal Parmar's digital signature is already pre-affixed on the documents.
                    </p>

                    {/* Interactive Comparison Preview Button */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Preview Modes:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewLegacyInvestEQ(false);
                          setInvitees([
                            {
                              id: 'inv-client-1',
                              name: clientName,
                              phone: phone,
                              email: email,
                              contact: phone,
                              enterBoth: true, // "once disabled, 'enter both' must be selected"
                              signatureType: 'Aadhaar E-Sign (OTP)',
                              role: 'Signer'
                            }
                          ]);
                          showToast('Switched to API Mode: InvestEQ disabled, Enter Both selected for Client.', 'success');
                        }}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          border: !previewLegacyInvestEQ ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          backgroundColor: !previewLegacyInvestEQ ? '#e0f2fe' : '#ffffff',
                          color: !previewLegacyInvestEQ ? '#0284c7' : '#64748b',
                          fontWeight: !previewLegacyInvestEQ ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ API Mode: Client (Enter Both Active)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewLegacyInvestEQ(true);
                          setInvitees([
                            {
                              id: 'inv-investeq',
                              name: 'InvestEQ',
                              contact: '8494953754',
                              phone: '8494953754',
                              email: '',
                              enterBoth: false,
                              signatureType: 'Aadhaar E-Sign (OTP)',
                              role: 'Signer'
                            }
                          ]);
                          showToast('Showing screenshot state: self-sign enabled adds InvestEQ.', 'warning');
                        }}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          borderRadius: '4px',
                          border: previewLegacyInvestEQ ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          backgroundColor: previewLegacyInvestEQ ? '#fee2e2' : '#ffffff',
                          color: previewLegacyInvestEQ ? '#dc2626' : '#64748b',
                          fontWeight: previewLegacyInvestEQ ? 700 : 500,
                          cursor: 'pointer'
                        }}
                        title="Simulate what happened in the screenshot when self-sign was turned ON"
                      >
                        Screenshot Mode: InvestEQ (Self-Sign ON)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── SECTION TITLE: Invitees (Signers & Reviewers) ─── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0
                }}>
                  Invitees (Signers & Reviewers)
                </h3>

                <button
                  type="button"
                  onClick={() => setShowPayloadModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Code size={13} /> View Leegality API JSON Payload
                </button>
              </div>

              {/* ─── INVITEE CARDS (MATCHING SCREENSHOT) ─── */}
              {invitees.map((inv, idx) => (
                <div
                  key={inv.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                    padding: '18px 22px',
                    marginBottom: '18px',
                    position: 'relative'
                  }}
                >
                  {/* Top Right Card Action Icons Group (Duplicate, Up, Down, Delete) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                    <div style={{
                      display: 'inline-flex',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      backgroundColor: '#f8fafc',
                      overflow: 'hidden'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleDuplicateInvitee(inv.id)}
                        title="Duplicate Invitee"
                        style={cardActionBtnStyle}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveInvitee(idx, -1)}
                        disabled={idx === 0}
                        title="Move Up"
                        style={{ ...cardActionBtnStyle, opacity: idx === 0 ? 0.35 : 1 }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveInvitee(idx, 1)}
                        disabled={idx === invitees.length - 1}
                        title="Move Down"
                        style={{ ...cardActionBtnStyle, opacity: idx === invitees.length - 1 ? 0.35 : 1 }}
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvitee(inv.id)}
                        title="Delete Invitee"
                        style={{ ...cardActionBtnStyle, borderRight: 'none', color: '#ef4444' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Form Inputs (Name, Phone number, Email) — Supports "Enter both" vs single field */}
                  {inv.enterBoth ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={inv.name}
                            onChange={(e) => handleUpdateInvitee(inv.id, 'name', e.target.value)}
                            placeholder="Full Name"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              fontSize: '0.86rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: '#0f172a',
                              fontWeight: 500
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Phone number
                          </label>
                          <input
                            type="text"
                            value={inv.phone || (inv.contact && !inv.contact.includes('@') ? inv.contact : '')}
                            onChange={(e) => handleUpdateInvitee(inv.id, 'phone', e.target.value)}
                            placeholder="e.g. 9845198210"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              fontSize: '0.86rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: '#0f172a',
                              fontWeight: 500
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Email
                          </label>
                          <input
                            type="email"
                            value={inv.email || (inv.contact && inv.contact.includes('@') ? inv.contact : '')}
                            onChange={(e) => handleUpdateInvitee(inv.id, 'email', e.target.value)}
                            placeholder="e.g. client@example.com"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              fontSize: '0.86rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: '#0f172a',
                              fontWeight: 500
                            }}
                          />
                        </div>
                      </div>

                      {/* "Enter either" link when Enter both is selected */}
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateInvitee(inv.id, 'enterBoth', false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0284c7',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Enter either
                        </button>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> "Enter both" selected: SMS & Email verification active
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={inv.name}
                            onChange={(e) => handleUpdateInvitee(inv.id, 'name', e.target.value)}
                            placeholder="Name"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              fontSize: '0.86rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: '#0f172a',
                              fontWeight: 500
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Email / Phone number
                          </label>
                          <input
                            type="text"
                            value={inv.contact || inv.phone || inv.email}
                            onChange={(e) => handleUpdateInvitee(inv.id, 'contact', e.target.value)}
                            placeholder="Email or Phone number"
                            style={{
                              width: '100%',
                              padding: '9px 12px',
                              fontSize: '0.86rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: '#0f172a',
                              fontWeight: 500
                            }}
                          />

                          {/* EXACT "Enter both" link as circled in user screenshot */}
                          <div style={{ marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateInvitee(inv.id, 'enterBoth', true);
                                showToast('"Enter both" selected! Both Phone number and Email are now active.', 'info');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0284c7',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              Enter both
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Bottom Row: Signature type and Invitee level options */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '18px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    position: 'relative'
                  }}>
                    {/* Left: Signature Type Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setSignatureDropdownOpenId(signatureDropdownOpenId === inv.id ? null : inv.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.82rem',
                          color: '#334155',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <span>Signature type: <strong>{inv.signatureType || 'Aadhaar E-Sign (OTP)'}</strong></span>
                        <ChevronDown size={14} color="#64748b" />
                      </button>

                      {signatureDropdownOpenId === inv.id && (
                        <div style={{
                          position: 'absolute',
                          top: '28px',
                          left: 0,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          zIndex: 30,
                          minWidth: '220px',
                          padding: '6px 0'
                        }}>
                          {[
                            'Aadhaar E-Sign (OTP)',
                            'Aadhaar Biometric (IRIS/Fingerprint)',
                            'Virtual Electronic Sign',
                            'DSC Token (Class 3 Paperless)'
                          ].map(st => (
                            <div
                              key={st}
                              onClick={() => {
                                handleUpdateInvitee(inv.id, 'signatureType', st);
                                setSignatureDropdownOpenId(null);
                              }}
                              style={{
                                padding: '8px 14px',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                color: inv.signatureType === st ? '#0284c7' : '#334155',
                                fontWeight: inv.signatureType === st ? 700 : 500,
                                backgroundColor: inv.signatureType === st ? '#f0f9ff' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>{st}</span>
                              {inv.signatureType === st && <Check size={13} color="#0284c7" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Invitee Level Options Link */}
                    <button
                      type="button"
                      onClick={() => setSelectedInviteeForOptions(inv)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.82rem',
                        color: '#0284c7',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Invitee level options
                    </button>
                  </div>
                </div>
              ))}

              {/* Centered "+ Add Invitee" Button matching screenshot */}
              <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '32px' }}>
                <button
                  type="button"
                  onClick={handleAddInvitee}
                  style={{
                    padding: '8px 22px',
                    backgroundColor: '#2b5c7d', // Exact Leegality dark slate blue
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(43, 92, 125, 0.25)'
                  }}
                >
                  <Plus size={16} /> Add Invitee
                </button>
              </div>
            </div>

            {/* ─── BOTTOM FOOTER BAR (MATCHING SCREENSHOT) ─── */}
            <div style={{
              padding: '16px 36px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'auto'
            }}>
              <button
                type="button"
                onClick={() => setShowJourneyOptionsModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Signing journey options
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    color: '#475569',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedToOtp}
                  style={{
                    padding: '8px 28px',
                    backgroundColor: '#2b5c7d', // Exact Leegality dark slate blue
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(43, 92, 125, 0.3)'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: FINALIZE VIEW (DOCUMENT PREVIEW + AADHAAR OTP E-SIGN) ─── */}
        {activeStep === 3 && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
            <LeegalityDocumentPreview
              activeDocTab={activeDocTab}
              setActiveDocTab={setActiveDocTab}
              tenure={tenure}
              clientInfo={clientInfo}
              clientName={invitees[0]?.name || clientName}
              panNumber={panNumber}
              phone={invitees[0]?.contact || phone}
              email={email}
              serviceName={serviceName}
              grossSales={grossSales}
              netSales={netSales}
              gst={gst}
              date1={date1}
              paymentDate={paymentDate}
              isSignAffixed={true}
              activeStep={activeStep}
              isCompleted={isCompleted}
              documentId={documentId}
            />

            {/* RIGHT COLUMN: STEP 3 FINALIZE SIGNING */}
            <div style={{
              width: '380px',
              backgroundColor: '#ffffff',
              borderLeft: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ flex: 1, padding: '24px 22px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <ShieldCheck size={20} color="#2b5c7d" />
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Finalize Digital E-Sign
                  </h3>
                </div>

                {!isCompleted ? (
                  <form onSubmit={handleFinalizeSigning}>
                    <div style={{
                      padding: '14px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      marginBottom: '16px',
                      fontSize: '0.76rem',
                      color: '#475569',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                        Leegality Aadhaar ESP Gateway (Live)
                      </div>
                      An authenticated Aadhaar OTP e-sign request for <strong>{tenure}</strong> tenure has been dispatched to:
                      <div style={{ marginTop: '6px', fontWeight: 600, color: '#0f172a' }}>
                        • Signer: {invitees[0]?.name || clientName}<br />
                        • Phone: {invitees[0]?.contact || phone}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                        ✓ Harshal Parmar signature pre-stamped
                      </div>
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
                          fontSize: '1.05rem',
                          letterSpacing: '4px',
                          textAlign: 'center',
                          border: '1px solid #2b5c7d',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor: '#f8fafc'
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
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
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
                      color: '#166534',
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
                    <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      MITC and Contract document sealed with Leegality cryptographic audit certificate for <strong>{tenure}</strong> tenure. Auto-synced to Dedicated E-Sign Block.
                    </p>

                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      color: '#475569',
                      textAlign: 'left',
                      marginBottom: '16px',
                      lineHeight: 1.5
                    }}>
                      <div>• <strong>Document ID:</strong> <code>{documentId}</code></div>
                      <div>• <strong>Signer:</strong> {invitees[0]?.name || clientName}</div>
                      <div>• <strong>Service Tenure:</strong> {tenure}</div>
                      <div>• <strong>Creator Self-Sign:</strong> Disabled (InvestEQ omitted)</div>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        backgroundColor: '#2b5c7d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        cursor: 'pointer'
                      }}
                    >
                      Return to CRM Dashboard
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Back Button */}
              <div style={{
                padding: '14px 18px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Back to Invitees
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: INVITEE LEVEL OPTIONS ─── */}
        {selectedInviteeForOptions && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1600,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '460px',
              width: '100%',
              padding: '20px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              fontFamily: "'Inter', sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Invitee Level Options • {selectedInviteeForOptions.name || 'Invitee'}
                </h4>
                <button
                  onClick={() => setSelectedInviteeForOptions(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>• <strong>Authentication Mode:</strong> Aadhaar OTP (Mobile UIDAI ESP)</div>
                <div>• <strong>Link Expiry Duration:</strong> 15 Days from dispatch</div>
                <div>• <strong>Automated Reminders:</strong> Daily SMS & Email (9:00 AM IST)</div>
                <div>• <strong>Capture GPS Location:</strong> Enabled (Audit Certificate Compliance)</div>
                <div>• <strong>Face / Liveness Check:</strong> Optional for SEBI RA T&C</div>
                <div>• <strong>Access Passcode:</strong> Not required (direct encrypted bearer token)</div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  onClick={() => setSelectedInviteeForOptions(null)}
                  style={{
                    padding: '7px 16px',
                    backgroundColor: '#2b5c7d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: SIGNING JOURNEY OPTIONS ─── */}
        {showJourneyOptionsModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1600,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              padding: '20px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              fontFamily: "'Inter', sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Signing Journey Options
                </h4>
                <button
                  onClick={() => setShowJourneyOptionsModal(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>• <strong>Signing Flow:</strong> Remote Electronic Dispatch via SMS & Email</div>
                <div>• <strong>In-Person Signing Mode:</strong> Disabled (Self-service remote Aadhaar ESP)</div>
                <div>• <strong>Completion Redirect URL:</strong> <code>http://localhost:3000/Astra-CRM/</code></div>
                <div>• <strong>Audit Trail Webhook:</strong> Real-time callback to Astra Dedicated E-Sign Block</div>
                <div>• <strong>Self-Sign Exemption:</strong> "I want to sign this document" disabled for InvestEQ</div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  onClick={() => setShowJourneyOptionsModal(false)}
                  style={{
                    padding: '7px 16px',
                    backgroundColor: '#2b5c7d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Confirm & Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: LEEGALITY API v2.1 PAYLOAD PREVIEW ─── */}
        {showPayloadModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1600,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              borderRadius: '8px',
              maxWidth: '620px',
              width: '100%',
              padding: '20px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              fontFamily: "'Inter', sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code size={18} color="#38bdf8" />
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#ffffff' }}>
                    Leegality API v2.1 Dispatch Payload
                  </h4>
                </div>
                <button
                  onClick={() => setShowPayloadModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                Endpoint: <code>POST https://api.leegality.com/v2.1/document/create</code>
              </p>

              <pre style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '0.76rem',
                color: '#38bdf8',
                overflowX: 'auto',
                lineHeight: 1.5,
                maxHeight: '340px'
              }}>
{JSON.stringify({
  profileId: "LEEG_ASTRA_PORTAL_01",
  document: {
    name: "SEBI_MITC_and_Service_Agreement.pdf",
    fields: {
      "Date 1": date1,
      "Service Tenure": tenure,
      "Checkbox 1": "Agreed (Tenure Bound)"
    }
  },
  // CRITICAL: User requirement fulfilled
  iWantToSign: false, // <-- DISABLED: Sender InvestEQ is omitted
  requestFixedOrder: requestFixedOrder,
  invitees: invitees.map(inv => ({
    name: inv.name,
    enterBoth: !!inv.enterBoth,
    phone: inv.phone || (inv.contact && !inv.contact.includes('@') ? inv.contact : ''),
    email: inv.email || (inv.contact && inv.contact.includes('@') ? inv.contact : ''),
    contact: inv.enterBoth
      ? `${inv.phone || ''} / ${inv.email || ''}`
      : (inv.contact || inv.phone || inv.email),
    signatureType: inv.signatureType,
    role: "Client / Signer"
  })),
  preAffixedSignatory: {
    name: "Mr Harshal Parmar",
    designation: "Principal Officer",
    sebiRegNo: "INH000002099",
    dscAffixed: true
  }
}, null, 2)}
              </pre>

              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                fontSize: '0.72rem',
                color: '#86efac',
                lineHeight: 1.5
              }}>
                <strong>API Policy Compliant:</strong> <code>iWantToSign: false</code> guarantees the portal owner (InvestEQ) is not added as a signer. <code>enterBoth: true</code> is automatically selected to enforce two-factor client verification over both SMS (Phone) and Email.
              </div>

              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  onClick={() => setShowPayloadModal(false)}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close Payload
                </button>
              </div>
            </div>
          </div>
        )}
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
