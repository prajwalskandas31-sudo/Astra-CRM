import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { isBackendAuthoritative, verifyPasswordWithServer } from '../services/backendConfig';
import { 
  X, 
  Lock, 
  UserCheck, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ShieldCheck, 
  ArrowRight,
  Upload,
  Trash2,
  Plus,
  Send,
  Eye,
  Paperclip,
  KeyRound,
  FileCheck2,
  FileSpreadsheet,
  FileImage,
  Sparkles
} from 'lucide-react';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (NCT)', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const SERVICE_TENURES = [
  'Demo',
  '1 month',
  '2 months',
  '3 months',
  '6 months',
  '9 months',
  '12 months'
];

export const ClientInformationModal = ({ 
  isOpen, 
  onClose, 
  lead = null, 
  dispositionName = 'Paid / Converted',
  onSuccess = null 
}) => {
  const { 
    currentUser, 
    services, 
    financialSettings, 
    checkDuplicatePhone2,
    submitClientInformationReview 
  } = useCRM();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    panNumber: '',
    clientCategory: 'Individual', // Individual | Non-Individual
    clientPrefix: 'Mr.',          // Mr. | Miss | Mrs.
    clientName: '',
    firmName: '',
    gstin: '',
    gstCertificateFile: null,
    email: '',
    phone1: '',
    phone2: '',
    paymentDate: new Date().toISOString().split('T')[0],
    serviceName: '',
    serviceTenure: '3 months',
    transactionNumbers: [''], // Up to 5 (min 1)
    grossSales: '',
    netSales: '0.00',
    gst: '0.00',
    clientState: 'Maharashtra'
  });

  const [transactionAttachments, setTransactionAttachments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [phone2Error, setPhone2Error] = useState('');
  
  // Admin Gross Limit Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overridePasswordInput, setOverridePasswordInput] = useState('');
  const [overridePasswordError, setOverridePasswordError] = useState('');
  const [isLimitOverridden, setIsLimitOverridden] = useState(false);
  const [pendingGrossAmount, setPendingGrossAmount] = useState('');

  // GST Certificate upload ref
  const gstFileInputRef = useRef(null);
  const txnAttachmentInputRef = useRef(null);

  // Prepopulate form when lead changes
  useEffect(() => {
    if (lead) {
      const existing = lead.clientInfo || {};
      const todayStr = new Date().toISOString().split('T')[0];
      const initialServices = services && services.length > 0 ? services[0].name : 'Equity Cash & Intraday Pro';

      const existingTxnNumbers = existing.transactionNumbers && Array.isArray(existing.transactionNumbers) && existing.transactionNumbers.length > 0
        ? existing.transactionNumbers
        : (existing.transactionId ? [existing.transactionId] : ['']);

      const gross = existing.grossSales || existing.saleAmount || (lead.value ? String(lead.value).replace(/[^0-9]/g, '') : '50000');
      const cFactor = financialSettings?.cDivisorFactor || 1.18;
      const numGross = parseFloat(gross) || 0;
      const calcNet = (numGross / cFactor).toFixed(2);
      const calcGst = (numGross - parseFloat(calcNet)).toFixed(2);

      setFormData({
        panNumber: existing.panNumber || '',
        clientCategory: existing.clientCategory || 'Individual',
        clientPrefix: existing.clientPrefix || 'Mr.',
        clientName: existing.clientName || lead.contactPerson || '',
        firmName: existing.firmName || (lead.clientName && lead.clientName !== lead.contactPerson ? lead.clientName : ''),
        gstin: existing.gstin || '',
        gstCertificateFile: existing.gstCertificateFile || null,
        email: existing.email || lead.email || '',
        phone1: lead.phone || existing.phone1 || '',
        phone2: existing.phone2 || '',
        paymentDate: existing.paymentDate || todayStr,
        serviceName: existing.serviceName || initialServices,
        serviceTenure: existing.serviceTenure || '3 months',
        transactionNumbers: existingTxnNumbers,
        grossSales: gross,
        netSales: calcNet,
        gst: calcGst,
        clientState: existing.clientState || 'Maharashtra'
      });

      if (existing.transactionAttachments && Array.isArray(existing.transactionAttachments)) {
        setTransactionAttachments(existing.transactionAttachments);
      } else {
        setTransactionAttachments([]);
      }

      setFieldErrors({});
      setPhone2Error('');
      setIsLimitOverridden(false);
    }
  }, [lead, services, financialSettings]);

  // Recalculate Net Sales & GST whenever grossSales changes
  const calculateFinancials = (grossVal) => {
    const grossNum = parseFloat(grossVal) || 0;
    const cFactor = financialSettings?.cDivisorFactor || 1.18;
    const net = grossNum > 0 ? (grossNum / cFactor).toFixed(2) : '0.00';
    const gstVal = grossNum > 0 ? (grossNum - parseFloat(net)).toFixed(2) : '0.00';
    return { net, gst: gstVal };
  };

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'grossSales') {
        const { net, gst } = calculateFinancials(value);
        updated.netSales = net;
        updated.gst = gst;

        // Check Limit Rule: Super Admin sets a maximum allowed value
        const maxLimit = financialSettings?.maxGrossSales || 200000;
        const enteredVal = parseFloat(value) || 0;
        if (enteredVal > maxLimit && !isLimitOverridden) {
          setPendingGrossAmount(value);
          setShowOverrideModal(true);
        }
      }

      return updated;
    });

    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Checking Rule for Phone Number 2
  const handlePhone2Blur = () => {
    if (!formData.phone2 || formData.phone2.trim() === '') {
      setPhone2Error('');
      return;
    }

    const check = checkDuplicatePhone2(formData.phone2, lead?.id);
    if (check.isDuplicate) {
      setPhone2Error(`Number is already available (Belongs to ${check.originalOwner?.name || 'another lead'})`);
      showToast('Number is already available. Alert sent to original lead owner.', 'error');
    } else {
      setPhone2Error('');
    }
  };

  // Transaction Numbers Handlers (Up to 5, at least 1 compulsory)
  const handleTxnChange = (index, val) => {
    const updated = [...formData.transactionNumbers];
    updated[index] = val;
    setFormData(prev => ({ ...prev, transactionNumbers: updated }));

    if (fieldErrors[`txn_${index}`]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[`txn_${index}`];
        return copy;
      });
    }
  };

  const handleAddTxnField = () => {
    if (formData.transactionNumbers.length >= 5) {
      showToast('Maximum of 5 transaction IDs allowed.', 'warning');
      return;
    }
    setFormData(prev => ({
      ...prev,
      transactionNumbers: [...prev.transactionNumbers, '']
    }));
  };

  const handleRemoveTxnField = (index) => {
    if (formData.transactionNumbers.length <= 1) {
      showToast('At least 1 transaction ID is compulsory.', 'warning');
      return;
    }
    const updated = formData.transactionNumbers.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, transactionNumbers: updated }));
  };

  // GST Certificate Soft Copy Handler
  const handleGSTFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        gstCertificateFile: {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type,
          dataUrl: reader.result
        }
      }));
      showToast(`GST certificate '${file.name}' attached.`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Transaction Attachments Handler (1 to 5 attachments compulsory)
  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (transactionAttachments.length + files.length > 5) {
      showToast(`Cannot upload more than 5 transaction attachments. (Current: ${transactionAttachments.length})`, 'error');
      return;
    }

    files.forEach(file => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowed.includes(file.type)) {
        showToast(`'${file.name}' format not supported. Use PDF, JPG, or PNG.`, 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setTransactionAttachments(prev => [
          ...prev,
          {
            id: 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            type: file.type,
            dataUrl: reader.result,
            uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    showToast(`${files.length} attachment(s) added.`, 'info');
  };

  const handleRemoveAttachment = (attId) => {
    setTransactionAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Password Override for Gross Sales Max Limit
  const handleVerifyOverridePassword = async (e) => {
    e.preventDefault();
    const correctPassword = financialSettings?.adminOverridePassword || 'admin123';
    const authorized = isBackendAuthoritative()
      ? await verifyPasswordWithServer(overridePasswordInput.trim(), 'admin')
      : overridePasswordInput.trim() === correctPassword;
    if (authorized) {
      setIsLimitOverridden(true);
      setShowOverrideModal(false);
      setOverridePasswordInput('');
      setOverridePasswordError('');
      showToast('Administrator override authorized. High-value sale unlocked.', 'success');
    } else {
      setOverridePasswordError('Incorrect administrator password. Contact Super Admin to override.');
    }
  };

  // Send to Review Validation & Submission
  const handleSendToReview = (e) => {
    e.preventDefault();

    const errors = {};

    // 1. Mandatory Core Fields (per PDF Matrix)
    if (!formData.panNumber?.trim()) errors.panNumber = 'Fill details';
    if (!formData.clientName?.trim()) errors.clientName = 'Fill details';
    if (!formData.email?.trim()) errors.email = 'Fill details';
    if (!formData.paymentDate?.trim()) errors.paymentDate = 'Fill details';
    if (!formData.serviceName?.trim()) errors.serviceName = 'Fill details';
    if (!formData.serviceTenure?.trim()) errors.serviceTenure = 'Fill details';
    if (!formData.grossSales || parseFloat(formData.grossSales) <= 0) errors.grossSales = 'Fill details';
    if (!formData.clientState?.trim()) errors.clientState = 'Fill details';

    // 2. Conditional Fields for "Non-Individual"
    if (formData.clientCategory === 'Non-Individual') {
      if (!formData.firmName?.trim()) errors.firmName = 'Fill details';
      if (!formData.gstin?.trim()) errors.gstin = 'Fill details';
      if (!formData.gstCertificateFile) errors.gstCertificateFile = 'Fill details';
    }

    // 3. Transaction Numbers (At least 1 compulsory)
    const validTxns = formData.transactionNumbers.filter(t => t && t.trim() !== '');
    if (validTxns.length === 0) {
      errors.transactionNumbers = 'Fill details';
      errors.txn_0 = 'Fill details';
    }

    // 4. Checking Rule: Phone 2 Duplicate Block
    if (formData.phone2 && formData.phone2.trim() !== '') {
      const check = checkDuplicatePhone2(formData.phone2, lead?.id);
      if (check.isDuplicate) {
        errors.phone2 = 'Number is already available';
        setPhone2Error(`Number is already available (Belongs to ${check.originalOwner?.name || 'another lead'})`);
        showToast('Number is already available. Alert sent to original lead owner.', 'error');
      }
    }

    // 5. Gross Limit Rule check
    const maxLimit = financialSettings?.maxGrossSales || 200000;
    if (parseFloat(formData.grossSales) > maxLimit && !isLimitOverridden) {
      errors.grossSales = 'Kindly contact administrator';
      setShowOverrideModal(true);
      showToast('Kindly contact administrator: Amount exceeds maximum threshold.', 'error');
      return;
    }

    // 6. Extra Options: Transaction Attachments (1 to 5 compulsory)
    if (transactionAttachments.length < 1) {
      errors.attachments = 'Please upload at least 1 transaction attachment (up to 5 allowed)';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('Fill details', 'error');

      // Scroll to first error field
      setTimeout(() => {
        const firstErr = document.querySelector('.client-form-input-error');
        if (firstErr) {
          firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErr.focus?.();
        }
      }, 50);

      return;
    }

    // All Validated -> Submit for Review
    const finalData = {
      ...formData,
      transactionNumbers: validTxns,
      phone1: formData.phone1 || lead?.phone,
      agentName: currentUser?.name || 'Executive',
      agentId: currentUser?.id || 'usr-5'
    };

    if (lead?.id) {
      submitClientInformationReview(lead.id, finalData, transactionAttachments);
    }

    showToast('Client Information submitted! Automated approval email sent to Super Admin.', 'success');

    if (onSuccess) {
      onSuccess(finalData);
    }
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1200, 
        backgroundColor: 'rgba(5, 7, 12, 0.92)', 
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
          maxWidth: '890px', 
          width: '100%', 
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--accent-border)',
          boxShadow: '0 25px 80px -10px rgba(0, 0, 0, 0.9), 0 0 40px rgba(99, 102, 241, 0.18)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          className="modal-header" 
          style={{ 
            padding: '16px 24px', 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(16, 185, 129, 0.08) 100%)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              color: '#ffffff'
            }}>
              <ShieldCheck size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  Client Information Page
                </h3>
                <span 
                  className="badge" 
                  style={{ 
                    backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                    color: '#10b981', 
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '3px 8px'
                  }}
                >
                  <Lock size={11} /> Locked: {dispositionName}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  sCRM Spec v2.4.0
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target Lead: <strong style={{ color: 'var(--text-primary)' }}>{lead?.contactPerson || 'Selected Lead'}</strong> ({lead?.phone || 'No phone'}) • Language: <strong>{lead?.language || 'English'}</strong>
              </p>
            </div>
          </div>

          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            title="Dismiss / Exit Workflow"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Spec Requirement Alert Banner */}
        <div style={{
          padding: '10px 24px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.79rem', color: '#fca5a5', fontWeight: 500 }}>
              <strong>Strict Requirement:</strong> All fields displayed on this form are mandatory upon submission unless marked optional. Leaving any required field blank will trigger: <em>"Fill details"</em>.
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Press Esc to exit
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSendToReview} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div 
            className="modal-body" 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '18px 24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px' 
            }}
          >
            {/* ─── SECTION 1: Identity & Category Matrix ─── */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <UserCheck size={16} color="var(--accent-primary)" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  1. Client Identity & Category
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {/* 1. PAN Number */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>PAN Number <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.panNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    className={fieldErrors.panNumber ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      textTransform: 'uppercase',
                      borderColor: fieldErrors.panNumber ? '#ef4444' : undefined
                    }}
                  />
                </div>

                {/* 2. Client Category (Individual / Non-Individual) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px' }}>
                    Client Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.clientCategory}
                    onChange={(e) => handleChange('clientCategory', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  >
                    <option value="Individual">Individual</option>
                    <option value="Non-Individual">Non-Individual (Corporate / Firm)</option>
                  </select>
                </div>

                {/* 3. Prefix & Client Name */}
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Client Name (Exactly as shown on PAN Card) <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.clientName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={formData.clientPrefix}
                      onChange={(e) => handleChange('clientPrefix', e.target.value)}
                      style={{ width: '90px', padding: '8px 10px', fontSize: '0.84rem' }}
                    >
                      <option value="Mr.">Mr.</option>
                      <option value="Miss">Miss</option>
                      <option value="Mrs.">Mrs.</option>
                    </select>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => handleChange('clientName', e.target.value)}
                      placeholder="e.g. Harshal Parmar"
                      className={fieldErrors.clientName ? 'client-form-input-error' : ''}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '0.84rem',
                        borderColor: fieldErrors.clientName ? '#ef4444' : undefined
                      }}
                    />
                  </div>
                </div>

                {/* ─── CONDITIONAL NON-INDIVIDUAL FIELDS ─── */}
                {formData.clientCategory === 'Non-Individual' && (
                  <>
                    {/* Firm Name */}
                    <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Firm / Company Name <span style={{ color: '#ef4444' }}>*</span></span>
                        {fieldErrors.firmName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.firmName}
                        onChange={(e) => handleChange('firmName', e.target.value)}
                        placeholder="e.g. Apex Global Securities Pvt Ltd"
                        className={fieldErrors.firmName ? 'client-form-input-error' : ''}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.84rem',
                          borderColor: fieldErrors.firmName ? '#ef4444' : undefined
                        }}
                      />
                    </div>

                    {/* GSTIN Number */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>GSTIN Number <span style={{ color: '#ef4444' }}>*</span></span>
                        {fieldErrors.gstin && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.gstin}
                        onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                        placeholder="e.g. 29AAAAA0000A1Z5"
                        maxLength={15}
                        className={fieldErrors.gstin ? 'client-form-input-error' : ''}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.84rem',
                          textTransform: 'uppercase',
                          borderColor: fieldErrors.gstin ? '#ef4444' : undefined
                        }}
                      />
                    </div>

                    {/* GSTIN Certificate Soft Copy Upload */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>GST Certificate Soft Copy <span style={{ color: '#ef4444' }}>*</span></span>
                        {fieldErrors.gstCertificateFile && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                      </label>
                      <input
                        type="file"
                        ref={gstFileInputRef}
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleGSTFileChange}
                        style={{ display: 'none' }}
                      />
                      {formData.gstCertificateFile ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem'
                        }}>
                          <span style={{ color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                            ✓ {formData.gstCertificateFile.name} ({formData.gstCertificateFile.size})
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, gstCertificateFile: null }))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => gstFileInputRef.current?.click()}
                          className="btn-secondary"
                          style={{
                            width: '100%',
                            fontSize: '0.8rem',
                            padding: '7px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            borderColor: fieldErrors.gstCertificateFile ? '#ef4444' : undefined
                          }}
                        >
                          <Upload size={14} /> Upload GST Copy (PDF/JPG/PNG)
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ─── SECTION 2: Contact Details & Lead Matching ─── */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <Mail size={16} color="#3b82f6" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  2. Contact Information & Phone Duplicate Check
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {/* Email ID */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Email ID <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.email && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="e.g. client@example.com"
                    className={fieldErrors.email ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.email ? '#ef4444' : undefined
                    }}
                  />
                </div>

                {/* Phone Number 1 (Read-only, Cannot be edited) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Phone Number 1</span>
                    <Lock size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>(From lead, cannot be edited)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.phone1}
                    readOnly
                    disabled
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                      border: '1px solid var(--border-subtle)'
                    }}
                  />
                </div>

                {/* Phone Number 2 (Optional, with strict checking rule) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Phone Number 2 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></span>
                    {phone2Error && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>Number is already available</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.phone2}
                    onChange={(e) => {
                      handleChange('phone2', e.target.value);
                      if (phone2Error) setPhone2Error('');
                    }}
                    onBlur={handlePhone2Blur}
                    placeholder="Optional 2nd mobile number"
                    className={phone2Error ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: phone2Error ? '#ef4444' : undefined
                    }}
                  />
                  {phone2Error && (
                    <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px', display: 'block' }}>
                      ⚠️ {phone2Error}
                    </span>
                  )}
                </div>

                {/* Client State (Based on address proof) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Client State (Address Proof) <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.clientState && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.clientState}
                    onChange={(e) => handleChange('clientState', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  >
                    {INDIAN_STATES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ─── SECTION 3: Service, Payment & Financial Formula ─── */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                <CreditCard size={16} color="#10b981" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  3. Service Subscription & Financial Calculations
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {/* Date of Payment */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Date of Payment <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.paymentDate && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleChange('paymentDate', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  />
                </div>

                {/* Service Name (Super Admin Managed) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Service Name <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.serviceName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.serviceName}
                    onChange={(e) => handleChange('serviceName', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  >
                    {services && services.map(srv => (
                      <option key={srv.id} value={srv.name}>{srv.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Tenure */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Service Tenure <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.serviceTenure && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.serviceTenure}
                    onChange={(e) => handleChange('serviceTenure', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  >
                    {SERVICE_TENURES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Gross Sales (A) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gross Sales (A) ₹ <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.grossSales && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{fieldErrors.grossSales}</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.84rem', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      value={formData.grossSales}
                      onChange={(e) => handleChange('grossSales', e.target.value)}
                      placeholder="e.g. 50000"
                      className={fieldErrors.grossSales ? 'client-form-input-error' : ''}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 24px',
                        fontSize: '0.84rem',
                        borderColor: fieldErrors.grossSales ? '#ef4444' : undefined
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Max limit: ₹{financialSettings?.maxGrossSales?.toLocaleString('en-IN') || '2,00,000'} {isLimitOverridden && '(Override Active)'}
                  </span>
                </div>

                {/* Net Sales (B) - Automatically Calculated A ÷ C */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Net Sales (B)</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 500 }}>(A ÷ C, where C={financialSettings?.cDivisorFactor || 1.18})</span>
                  </label>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#818cf8'
                  }}>
                    ₹ {Number(formData.netSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* GST - Automatically Calculated A - B */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>GST (A - B)</span>
                    <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 500 }}>(18% Tax Component)</span>
                  </label>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#10b981'
                  }}>
                    ₹ {Number(formData.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Transaction Numbers List (Up to 5, at least 1 compulsory) */}
              <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>
                    Transaction / UTR Reference Numbers (1 to 5 IDs, min 1 compulsory) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {formData.transactionNumbers.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddTxnField}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={13} /> Add Transaction ID ({formData.transactionNumbers.length}/5)
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                  {formData.transactionNumbers.map((txn, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={txn}
                        onChange={(e) => handleTxnChange(idx, e.target.value)}
                        placeholder={`Transaction ID ${idx + 1}${idx === 0 ? ' (Compulsory) *' : ''}`}
                        className={fieldErrors[`txn_${idx}`] ? 'client-form-input-error' : ''}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          fontSize: '0.82rem',
                          borderColor: fieldErrors[`txn_${idx}`] ? '#ef4444' : undefined
                        }}
                      />
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTxnField(idx)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px',
                            cursor: 'pointer'
                          }}
                          title="Remove this Transaction ID"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── SECTION 4: EXTRA OPTIONS - TRANSACTION ATTACHMENTS ─── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
              border: `1px solid ${fieldErrors.attachments ? '#ef4444' : 'var(--accent-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Paperclip size={16} color="var(--accent-primary)" />
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Extra Options: Transaction Attachments (1 to 5 Compulsory) <span style={{ color: '#ef4444' }}>*</span>
                  </h4>
                </div>

                <span style={{
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: transactionAttachments.length >= 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: transactionAttachments.length >= 1 ? '#10b981' : '#ef4444',
                  fontWeight: 600
                }}>
                  {transactionAttachments.length} of 5 Files Attached (Min 1 Compulsory)
                </span>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                Upload payment proofs, UTR receipts, or bank debit advice screenshots (Formats: PDF, JPG, PNG). At least 1 file is compulsory before sending to Super Admin review.
              </p>

              {/* Upload Input & Trigger */}
              <input
                type="file"
                ref={txnAttachmentInputRef}
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleAttachmentUpload}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => txnAttachmentInputRef.current?.click()}
                  disabled={transactionAttachments.length >= 5}
                  style={{
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: transactionAttachments.length >= 5 ? 0.6 : 1
                  }}
                >
                  <Upload size={14} /> Upload Attachments (PDF / JPG / PNG)
                </button>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Max 5 MB per attachment
                </span>
              </div>

              {/* Attachments List */}
              {transactionAttachments.length === 0 ? (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: fieldErrors.attachments ? '#ef4444' : 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}>
                  {fieldErrors.attachments || 'No transaction attachments uploaded yet. At least 1 file is compulsory.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {transactionAttachments.map((att, i) => (
                    <div 
                      key={att.id || i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem'
                      }}
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
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{att.size}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Remove attachment"
                      >
                        <Trash2 size={13} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div 
            className="modal-footer" 
            style={{ 
              padding: '14px 24px', 
              borderTop: '1px solid var(--border-default)', 
              background: 'var(--bg-table-head)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Disposition: <strong style={{ color: '#10b981' }}>{dispositionName}</strong>
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Net: <strong>₹{Number(formData.netSales).toLocaleString('en-IN')}</strong> | GST: <strong>₹{Number(formData.gst).toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Exit Workflow Button */}
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                Cancel / Exit
              </button>

              {/* Send to Review Button */}
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ 
                  padding: '8px 22px', 
                  fontSize: '0.86rem', 
                  fontWeight: 600, 
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={15} /> Send to Review
              </button>
            </div>
          </div>
        </form>

        {/* ─── POPUP: "Kindly contact administrator" (Admin Override Password Modal) ─── */}
        {showOverrideModal && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div 
              style={{
                maxWidth: '440px',
                width: '100%',
                background: 'var(--bg-modal)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(239, 68, 68, 0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ef4444', fontWeight: 700 }}>
                    Kindly contact administrator
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    High-Value Gross Sale Threshold Exceeded
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                fontSize: '0.8rem',
                color: '#fca5a5',
                lineHeight: 1.4
              }}>
                The entered Gross Sale of <strong>₹{Number(formData.grossSales || pendingGrossAmount || 0).toLocaleString('en-IN')}</strong> exceeds the maximum allowed limit of <strong>₹{financialSettings?.maxGrossSales?.toLocaleString('en-IN') || '2,00,000'}</strong> set by the Super Admin.
                <br /><br />
                <em>An administrator password is required to override this restriction and continue.</em>
              </div>

              <form onSubmit={handleVerifyOverridePassword}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <KeyRound size={13} /> Administrator Override Password
                  </label>
                  <input
                    type="password"
                    value={overridePasswordInput}
                    onChange={(e) => {
                      setOverridePasswordInput(e.target.value);
                      setOverridePasswordError('');
                    }}
                    placeholder={isBackendAuthoritative() ? 'Enter an Admin or Super Admin account password' : 'Enter Admin Password (e.g. admin123)'}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: overridePasswordError ? '#ef4444' : undefined
                    }}
                  />
                  {overridePasswordError && (
                    <span style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                      {overridePasswordError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowOverrideModal(false);
                      setOverridePasswordInput('');
                      setOverridePasswordError('');
                      // Revert to limit
                      handleChange('grossSales', String(financialSettings?.maxGrossSales || 200000));
                    }}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    Cancel & Cap to Limit
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      padding: '6px 16px',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderColor: '#ef4444'
                    }}
                  >
                    Authorize Override
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
