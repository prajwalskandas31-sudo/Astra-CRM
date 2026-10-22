import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { 
  X, 
  Lock, 
  UserCheck, 
  Building2, 
  Phone, 
  Mail, 
  Languages, 
  MapPin, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  IndianRupee, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';

export const ClientInformationModal = ({ 
  isOpen, 
  onClose, 
  lead = null, 
  dispositionName = 'Paid / Converted',
  onSuccess = null 
}) => {
  const { currentUser, saveClientInformation } = useCRM();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    email: '',
    language: 'English',
    address: '',
    city: '',
    state: '',
    pincode: '',
    panNumber: '',
    servicePackage: 'Enterprise Growth Suite',
    saleAmount: '50000',
    paymentMode: 'UPI / QR Code',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    agentName: currentUser?.name || 'Sales Representative'
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const firstErrorRef = useRef(null);

  // Prepopulate form when lead changes
  useEffect(() => {
    if (lead) {
      const existing = lead.clientInfo || {};
      const todayStr = new Date().toISOString().split('T')[0];

      setFormData({
        fullName: existing.fullName || lead.contactPerson || '',
        companyName: existing.companyName || lead.clientName || (lead.contactPerson ? `${lead.contactPerson} Enterprises` : ''),
        phone: existing.phone || lead.phone || '',
        email: existing.email || lead.email || (lead.contactPerson ? `${lead.contactPerson.toLowerCase().replace(/[^a-z0-9]/g, '')}@clientdomain.com` : ''),
        language: existing.language || lead.language || 'English',
        address: existing.address || '',
        city: existing.city || '',
        state: existing.state || '',
        pincode: existing.pincode || '',
        panNumber: existing.panNumber || '',
        servicePackage: existing.servicePackage || 'Enterprise Growth Suite',
        saleAmount: existing.saleAmount || (lead.value ? String(lead.value).replace(/[^0-9]/g, '') : '50000'),
        paymentMode: existing.paymentMode || 'UPI / QR Code',
        transactionId: existing.transactionId || '',
        paymentDate: existing.paymentDate || todayStr,
        agentName: existing.agentName || currentUser?.name || lead.assignedToName || 'Sales Representative'
      });
      setFieldErrors({});
    }
  }, [lead, currentUser]);

  // Handle escape key to dismiss workflow
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const validateAndSubmit = (e) => {
    e.preventDefault();

    const mandatoryFields = [
      { key: 'fullName', label: 'Client Full Name' },
      { key: 'companyName', label: 'Company / Business Name' },
      { key: 'phone', label: 'Contact Mobile Number' },
      { key: 'email', label: 'Client Email Address' },
      { key: 'language', label: 'Language Preference' },
      { key: 'address', label: 'Billing Street Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State / Province' },
      { key: 'pincode', label: 'Postal / PIN Code' },
      { key: 'panNumber', label: 'PAN / Tax ID Number' },
      { key: 'servicePackage', label: 'Product / Plan Subscribed' },
      { key: 'saleAmount', label: 'Converted Deal Amount' },
      { key: 'paymentMode', label: 'Payment Mode' },
      { key: 'transactionId', label: 'Transaction / UTR Reference ID' },
      { key: 'paymentDate', label: 'Payment Date' },
      { key: 'agentName', label: 'Assigned Sales Agent' }
    ];

    const errors = {};
    mandatoryFields.forEach(({ key }) => {
      const val = formData[key];
      if (val === undefined || val === null || String(val).trim() === '') {
        errors[key] = 'Fill details';
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('Fill details', 'error');

      // Scroll to the first error field
      setTimeout(() => {
        const firstErrEl = document.querySelector('.client-form-input-error');
        if (firstErrEl) {
          firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrEl.focus();
        }
      }, 50);

      return;
    }

    // All fields valid -> save in CRM Context
    if (lead?.id && saveClientInformation) {
      saveClientInformation(lead.id, formData, dispositionName);
    }

    showToast(`Client Information successfully submitted! Deal locked as '${dispositionName}'.`, 'success');
    
    if (onSuccess) {
      onSuccess(formData);
    }
    onClose();
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1200, 
        backgroundColor: 'rgba(5, 7, 12, 0.88)', 
        backdropFilter: 'blur(10px)',
        padding: '24px 16px',
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
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--accent-border)',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.85), 0 0 30px rgba(99, 102, 241, 0.15)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          className="modal-header" 
          style={{ 
            padding: '18px 24px', 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
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
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              color: '#ffffff'
            }}>
              <ShieldCheck size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
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
                  <Lock size={11} /> Selection Locked: {dispositionName}
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
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mandatory Form Warning Banner */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={17} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 500 }}>
              <strong>Strict Requirement:</strong> Every field on this client form is strictly mandatory. If any field is left blank upon submission, the system blocks the action and displays a <em>"Fill details"</em> error message.
            </span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
            Press Esc or click Dismiss to exit at any time
          </span>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={validateAndSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div 
            className="modal-body" 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px 24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px' 
            }}
          >
            {/* Section 1: Client & Entity Profile */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <UserCheck size={16} color="var(--accent-primary)" />
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  1. Client & Entity Profile
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* 1. Full Name */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Client Full Name <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.fullName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className={fieldErrors.fullName ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.fullName ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.fullName ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 2. Company Name */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Company / Business Name <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.companyName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="e.g. Sharma Enterprises Pvt Ltd"
                    className={fieldErrors.companyName ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.companyName ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.companyName ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 3. Phone */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Contact Mobile Number <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.phone && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className={fieldErrors.phone ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.phone ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.phone ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 4. Email */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Client Email Address <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.email && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="e.g. rahul.sharma@example.com"
                    className={fieldErrors.email ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.email ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.email ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 5. Language */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Language Preference <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.language && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className={fieldErrors.language ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.language ? '#ef4444' : undefined
                    }}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Gujarati">Gujarati</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Billing & Address Verification */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <MapPin size={16} color="#10b981" />
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  2. Billing & Address Information
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* 6. Street Address */}
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Billing Street Address <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.address && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Building / Suite No, Street Name, Tech Park, Landmark..."
                    className={fieldErrors.address ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.address ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.address ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 7. City */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>City <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.city && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className={fieldErrors.city ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.city ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.city ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 8. State */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>State / Region <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.state && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g. Karnataka"
                    className={fieldErrors.state ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.state ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.state ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 9. Pincode */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Postal / PIN Code <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.pincode && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    placeholder="e.g. 560001"
                    className={fieldErrors.pincode ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.pincode ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.pincode ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 10. PAN / Tax ID */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>PAN / Tax ID Number <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.panNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    className={fieldErrors.panNumber ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      textTransform: 'uppercase',
                      borderColor: fieldErrors.panNumber ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.panNumber ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Conversion & Deal Financials */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <CreditCard size={16} color="#f59e0b" />
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  3. Conversion Financials & Deal Details
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* 11. Service Package */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Product / Plan Subscribed <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.servicePackage && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.servicePackage}
                    onChange={(e) => handleChange('servicePackage', e.target.value)}
                    className={fieldErrors.servicePackage ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.servicePackage ? '#ef4444' : undefined
                    }}
                  >
                    <option value="Enterprise Growth Suite">Enterprise Growth Suite</option>
                    <option value="Professional CRM Plan">Professional CRM Plan</option>
                    <option value="Standard Pipeline License">Standard Pipeline License</option>
                    <option value="Premium Advisory Package">Premium Advisory Package</option>
                    <option value="Institutional Custom Tier">Institutional Custom Tier</option>
                  </select>
                </div>

                {/* 12. Sale Amount */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Converted Deal Amount (₹) <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.saleAmount && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.84rem', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      value={formData.saleAmount}
                      onChange={(e) => handleChange('saleAmount', e.target.value)}
                      placeholder="e.g. 50000"
                      className={fieldErrors.saleAmount ? 'client-form-input-error' : ''}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 24px',
                        fontSize: '0.84rem',
                        borderColor: fieldErrors.saleAmount ? '#ef4444' : undefined,
                        boxShadow: fieldErrors.saleAmount ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                      }}
                    />
                  </div>
                </div>

                {/* 13. Payment Mode */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Payment Mode <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.paymentMode && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => handleChange('paymentMode', e.target.value)}
                    className={fieldErrors.paymentMode ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.paymentMode ? '#ef4444' : undefined
                    }}
                  >
                    <option value="UPI / QR Code">UPI / QR Code</option>
                    <option value="Net Banking (IMPS/NEFT)">Net Banking (IMPS/NEFT)</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Direct Bank Transfer">Direct Bank Transfer</option>
                    <option value="Cheque Deposit">Cheque Deposit</option>
                  </select>
                </div>

                {/* 14. Transaction ID */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Transaction / UTR Ref ID <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.transactionId && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.transactionId}
                    onChange={(e) => handleChange('transactionId', e.target.value)}
                    placeholder="e.g. UTR89127391283"
                    className={fieldErrors.transactionId ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.transactionId ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.transactionId ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* 15. Payment Date */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Payment / Conversion Date <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.paymentDate && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleChange('paymentDate', e.target.value)}
                    className={fieldErrors.paymentDate ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.paymentDate ? '#ef4444' : undefined
                    }}
                  />
                </div>

                {/* 16. Agent Name */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Assigned Sales Agent <span style={{ color: '#ef4444' }}>*</span></span>
                    {fieldErrors.agentName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Fill details</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.agentName}
                    onChange={(e) => handleChange('agentName', e.target.value)}
                    placeholder="e.g. Akshata"
                    className={fieldErrors.agentName ? 'client-form-input-error' : ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderColor: fieldErrors.agentName ? '#ef4444' : undefined,
                      boxShadow: fieldErrors.agentName ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : undefined
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Stage: <strong style={{ color: '#10b981' }}>{dispositionName}</strong> (Locked)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Dismiss / Exit Workflow Button */}
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Exit Workflow without saving"
              >
                <X size={14} /> Exit Workflow / Dismiss
              </button>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ 
                  padding: '8px 20px', 
                  fontSize: '0.84rem', 
                  fontWeight: 600, 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderColor: '#10b981',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={15} /> Submit Client Information
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
