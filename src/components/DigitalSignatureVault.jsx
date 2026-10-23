import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { HarshalParmarESign } from './HarshalParmarESign';
import {
  getAllSignatures,
  getSignature,
  saveDigitalSignature,
  resetToDefaultSignature,
  verifySignerPassword,
  isVaultUnlockedInSession,
  setVaultSessionUnlocked,
  processSignatureFile,
  generateDemoSignaturePNG,
  generateSampleStampPNG,
  extractDetailsFromSignatureImage,
  DEFAULT_OFFICER_SIGNATURE,
  SIGNATORY_PRESETS
} from '../services/digitalSignatureService';
import {
  Lock,
  Unlock,
  KeyRound,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  FileSignature,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Sliders,
  Check,
  Info,
  Calendar,
  User,
  Building2,
  ExternalLink,
  ArrowRight,
  Edit3,
  Users,
  Scan,
  Cpu
} from 'lucide-react';

export const DigitalSignatureVault = ({
  initialSignerKey = 'master_officer',
  onSignatureUpdated = null,
  embedded = false
}) => {
  const { currentUser, users = [] } = useCRM();
  const { showToast } = useToast();

  // Vault Lock State
  const [isUnlocked, setIsUnlocked] = useState(() => isVaultUnlockedInSession());
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Active Signer Selection
  const [selectedSignerKey, setSelectedSignerKey] = useState(initialSignerKey);
  const [signaturesMap, setSignaturesMap] = useState(() => getAllSignatures());

  // Preview display mode: 'cyan-box' | 'white-paper' | 'dark'
  const [previewBg, setPreviewBg] = useState('cyan-box');

  // Edit Signatory Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    signerName: '',
    designation: '',
    entity: '',
    sebiReg: ''
  });
  const [profilePassword, setProfilePassword] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Update / Upload Signature File Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedPreviewData, setStagedPreviewData] = useState(null);
  const [makeTransparent, setMakeTransparent] = useState(true);
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // OCR & Extracted Details State
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ stage: 'idle', percent: 0, message: '' });
  const [ocrData, setOcrData] = useState(null);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [stagedDetails, setStagedDetails] = useState({
    signerName: '',
    designation: '',
    entity: '',
    sebiReg: '',
    officeAddress: ''
  });

  // Inline Signatory Details Quick Edit State
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineForm, setInlineForm] = useState({
    signerName: '',
    designation: '',
    entity: '',
    sebiReg: '',
    officeAddress: ''
  });
  const [inlinePassword, setInlinePassword] = useState('');
  const [showInlinePassword, setShowInlinePassword] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Password re-authentication for saving/updating
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset confirmation modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fileInputRef = useRef(null);

  // Listen for storage changes across tabs or window events
  useEffect(() => {
    const handleUpdate = () => {
      setSignaturesMap(getAllSignatures());
    };
    window.addEventListener('astra:digital_signature_updated', handleUpdate);
    return () => window.removeEventListener('astra:digital_signature_updated', handleUpdate);
  }, []);

  const activeSignature = signaturesMap[selectedSignerKey] || {
    ...DEFAULT_OFFICER_SIGNATURE,
    id: selectedSignerKey,
    signerName: selectedSignerKey === 'master_officer'
      ? DEFAULT_OFFICER_SIGNATURE.signerName
      : (currentUser?.name || 'Authorized Signatory'),
    designation: selectedSignerKey === 'master_officer'
      ? DEFAULT_OFFICER_SIGNATURE.designation
      : (currentUser?.role || 'Executive')
  };

  // Sync profile form when opening profile modal
  useEffect(() => {
    if (isProfileModalOpen) {
      setProfileForm({
        signerName: activeSignature.signerName || '',
        designation: activeSignature.designation || '',
        entity: activeSignature.entity || 'Astra CRM Enterprise',
        sebiReg: activeSignature.sebiReg || ''
      });
      setProfilePassword('');
      setProfileError('');
    }
  }, [isProfileModalOpen, selectedSignerKey]);

  // Sync staged details and reset OCR when upload modal opens
  useEffect(() => {
    if (isUploadModalOpen) {
      setStagedDetails({
        signerName: activeSignature.signerName || '',
        designation: activeSignature.designation || '',
        entity: activeSignature.entity || 'Astra CRM Enterprise',
        sebiReg: activeSignature.sebiReg || '',
        officeAddress: activeSignature.officeAddress || 'Corporate Headquarters, Bengaluru, Karnataka'
      });
      setStagedFile(null);
      setStagedPreviewData(null);
      setOcrData(null);
      setIsOcrScanning(false);
      setUpdatePassword('');
      setUpdateError('');
    }
  }, [isUploadModalOpen, selectedSignerKey]);

  // Sync inline form when entering inline editing mode
  useEffect(() => {
    if (isInlineEditing) {
      setInlineForm({
        signerName: activeSignature.signerName || '',
        designation: activeSignature.designation || '',
        entity: activeSignature.entity || 'Astra CRM Enterprise',
        sebiReg: activeSignature.sebiReg || '',
        officeAddress: activeSignature.officeAddress || 'Corporate Headquarters, Bengaluru, Karnataka'
      });
      setInlinePassword('');
      setInlineError('');
    }
  }, [isInlineEditing, selectedSignerKey]);

  // ─── Vault Unlock Handler ───────────────────────────────────────────────
  const handleUnlock = (e) => {
    e?.preventDefault();
    setAuthError('');
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setAuthError('Please enter your password to unlock the digital signature vault.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      const isValid = verifySignerPassword(trimmed, currentUser, users);
      setIsVerifying(false);

      if (isValid) {
        setIsUnlocked(true);
        setVaultSessionUnlocked(true);
        setPasswordInput('');
        setAuthError('');
        showToast('Digital Signature Vault unlocked successfully.', 'success');
      } else {
        setAuthError('Incorrect password. Please enter your valid account or administrator password.');
        showToast('Authentication failed: Incorrect password.', 'error');
      }
    }, 250);
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setVaultSessionUnlocked(false);
    setPasswordInput('');
    setAuthError('');
    setIsUploadModalOpen(false);
    setIsProfileModalOpen(false);
    setIsResetModalOpen(false);
    showToast('Digital Signature Vault locked for security.', 'info');
  };

  // ─── Save Signatory Profile with Password Re-Authentication ──────────────
  const handleConfirmSaveProfile = (e) => {
    e?.preventDefault();
    setProfileError('');

    if (!profileForm.signerName.trim()) {
      setProfileError('Signatory Name is required.');
      return;
    }

    const trimmedPassword = profilePassword.trim();
    if (!trimmedPassword) {
      setProfileError('Password re-entry is required to confirm updating signatory details.');
      return;
    }

    setIsSavingProfile(true);
    setTimeout(() => {
      try {
        const updated = saveDigitalSignature({
          key: selectedSignerKey,
          signaturePayload: {
            signerName: profileForm.signerName.trim(),
            designation: profileForm.designation.trim() || 'Authorized Signatory',
            entity: profileForm.entity.trim() || 'Astra CRM Enterprise',
            sebiReg: profileForm.sebiReg.trim()
          },
          password: trimmedPassword,
          currentUser,
          allUsers: users
        });

        setSignaturesMap(getAllSignatures());
        setIsSavingProfile(false);
        setIsProfileModalOpen(false);
        setProfilePassword('');
        setProfileError('');
        showToast(`Signatory profile updated to '${updated.signerName}' (${updated.designation})!`, 'success');
        if (onSignatureUpdated) onSignatureUpdated(updated);
      } catch (err) {
        setIsSavingProfile(false);
        setProfileError(err.message || 'Failed to update signatory profile. Check your password.');
        showToast(err.message || 'Profile update failed', 'error');
      }
    }, 250);
  };

  // ─── File Selection & OCR Processing ─────────────────────────────────────
  const handleFileChange = async (file) => {
    if (!file) return;
    setIsProcessingImage(true);
    setStagedFile(file);
    setUpdateError('');

    try {
      const processed = await processSignatureFile(file, {
        makeTransparent,
        enhanceContrast
      });
      setStagedPreviewData(processed);

      // Trigger automatic smart OCR detection with real progress tracking
      setIsOcrScanning(true);
      setOcrProgress({ stage: 'init', percent: 15, message: 'Initializing Tesseract OCR engine...' });
      const extracted = await extractDetailsFromSignatureImage(
        file,
        processed.dataUrl,
        (p) => setOcrProgress(p)
      );
      setIsOcrScanning(false);
      setOcrData(extracted);

      if (extracted.success) {
        setStagedDetails(prev => ({
          ...prev,
          signerName: extracted.detectedName || prev.signerName,
          designation: extracted.detectedDesignation || prev.designation,
          entity: extracted.detectedEntity || prev.entity,
          sebiReg: extracted.detectedRegId || prev.sebiReg
        }));

        if (extracted.hasPrintedText) {
          showToast(`OCR Scan complete: Detected '${extracted.detectedName}' from image text!`, 'success');
        } else {
          showToast(`Signature loaded. Stylized cursive detected (no machine typeface). Review or edit details below!`, 'info');
        }
      }
    } catch (err) {
      showToast(err.message || 'Error processing signature file', 'error');
      setUpdateError(err.message);
    } finally {
      setIsProcessingImage(false);
      setIsOcrScanning(false);
    }
  };

  const handleRunManualOcr = async () => {
    if (!stagedFile && !stagedPreviewData) {
      showToast('Please select or upload a signature file first to run OCR.', 'info');
      return;
    }
    setIsOcrScanning(true);
    setOcrProgress({ stage: 'init', percent: 20, message: 'Re-analyzing image pixels with OCR engine...' });
    try {
      const extracted = await extractDetailsFromSignatureImage(
        stagedFile,
        stagedPreviewData?.dataUrl,
        (p) => setOcrProgress(p)
      );
      setOcrData(extracted);
      setStagedDetails(prev => ({
        ...prev,
        signerName: extracted.detectedName || prev.signerName,
        designation: extracted.detectedDesignation || prev.designation,
        entity: extracted.detectedEntity || prev.entity,
        sebiReg: extracted.detectedRegId || prev.sebiReg
      }));
      showToast(`OCR re-analyzed: ${extracted.tags.join(' • ')}`, 'success');
    } catch (err) {
      showToast('OCR analysis encountered an issue', 'error');
    } finally {
      setIsOcrScanning(false);
    }
  };

  const handleLoadSampleStamp = async () => {
    setIsProcessingImage(true);
    setUpdateError('');
    try {
      const stamp = generateSampleStampPNG(
        stagedDetails.signerName || 'Srinivas R',
        stagedDetails.designation || 'Managing Director & Authorized Signatory',
        stagedDetails.entity || 'Astra CRM Enterprise',
        stagedDetails.sebiReg || 'EMP-001'
      );
      setStagedFile({ name: stamp.fileName, size: 32000, type: 'image/png' });
      setStagedPreviewData(stamp);

      setIsOcrScanning(true);
      setOcrProgress({ stage: 'init', percent: 20, message: 'Scanning official stamp with OCR engine...' });

      const extracted = await extractDetailsFromSignatureImage(
        { name: stamp.fileName },
        stamp.dataUrl,
        (p) => setOcrProgress(p)
      );

      setOcrData(extracted);
      if (extracted.success) {
        setStagedDetails(prev => ({
          ...prev,
          signerName: extracted.detectedName || prev.signerName,
          designation: extracted.detectedDesignation || prev.designation,
          entity: extracted.detectedEntity || prev.entity,
          sebiReg: extracted.detectedRegId || prev.sebiReg
        }));
        showToast(`OCR Success: Read '${extracted.detectedName}' from stamp pixels!`, 'success');
      }
    } catch (err) {
      showToast('Error testing sample stamp OCR', 'error');
    } finally {
      setIsProcessingImage(false);
      setIsOcrScanning(false);
    }
  };

  const handleFilterToggle = async (transparentNext, contrastNext) => {
    setMakeTransparent(transparentNext);
    setEnhanceContrast(contrastNext);
    if (stagedFile) {
      setIsProcessingImage(true);
      try {
        const processed = await processSignatureFile(stagedFile, {
          makeTransparent: transparentNext,
          enhanceContrast: contrastNext
        });
        setStagedPreviewData(processed);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // ─── Inline Details Quick Save ───────────────────────────────────────────
  const handleConfirmSaveInline = (e) => {
    e?.preventDefault();
    setInlineError('');

    if (!inlineForm.signerName.trim()) {
      setInlineError('Signatory Name is required.');
      return;
    }

    const trimmedPassword = inlinePassword.trim();
    if (!trimmedPassword) {
      setInlineError('Password re-entry is required to confirm updating signatory details.');
      return;
    }

    setIsSavingInline(true);
    setTimeout(() => {
      try {
        const updated = saveDigitalSignature({
          key: selectedSignerKey,
          signaturePayload: {
            signerName: inlineForm.signerName.trim(),
            designation: inlineForm.designation.trim() || 'Authorized Signatory',
            entity: inlineForm.entity.trim() || 'Astra CRM Enterprise',
            sebiReg: inlineForm.sebiReg.trim(),
            officeAddress: inlineForm.officeAddress?.trim() || activeSignature.officeAddress
          },
          password: trimmedPassword,
          currentUser,
          allUsers: users
        });

        setSignaturesMap(getAllSignatures());
        setIsSavingInline(false);
        setIsInlineEditing(false);
        setInlinePassword('');
        setInlineError('');
        showToast(`Signatory details updated to '${updated.signerName}' (${updated.designation})!`, 'success');
        if (onSignatureUpdated) onSignatureUpdated(updated);
      } catch (err) {
        setIsSavingInline(false);
        setInlineError(err.message || 'Failed to update signatory profile. Check your password.');
        showToast(err.message || 'Profile update failed', 'error');
      }
    }, 250);
  };

  // ─── Save / Update Signature with Password Verification ──────────────────
  const handleConfirmSaveSignature = (e) => {
    e?.preventDefault();
    setUpdateError('');

    if (!stagedPreviewData?.dataUrl && !activeSignature.signatureDataUrl) {
      setUpdateError('Please select or upload a signature file first.');
      return;
    }

    if (!stagedDetails.signerName?.trim()) {
      setUpdateError('Signatory Name is required.');
      return;
    }

    const trimmedPassword = updatePassword.trim();
    if (!trimmedPassword) {
      setUpdateError('Password re-entry is required to confirm updating the digital signature & details.');
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      try {
        const payload = {
          signerName: stagedDetails.signerName.trim(),
          designation: stagedDetails.designation.trim() || 'Authorized Signatory',
          entity: stagedDetails.entity.trim() || 'Astra CRM Enterprise',
          sebiReg: stagedDetails.sebiReg.trim(),
          officeAddress: stagedDetails.officeAddress?.trim() || activeSignature.officeAddress
        };

        if (stagedPreviewData?.dataUrl) {
          payload.signatureDataUrl = stagedPreviewData.dataUrl;
          payload.fileName = stagedPreviewData.fileName;
          payload.fileType = stagedPreviewData.fileType;
          payload.fileSize = stagedPreviewData.fileSize;
          payload.dimensions = stagedPreviewData.dimensions;
        }

        const updated = saveDigitalSignature({
          key: selectedSignerKey,
          signaturePayload: payload,
          password: trimmedPassword,
          currentUser,
          allUsers: users
        });

        setSignaturesMap(getAllSignatures());
        setIsSaving(false);
        setIsUploadModalOpen(false);
        setStagedFile(null);
        setStagedPreviewData(null);
        setOcrData(null);
        setUpdatePassword('');
        setUpdateError('');
        showToast(`Digital signature & details updated for ${updated.signerName}!`, 'success');
        if (onSignatureUpdated) onSignatureUpdated(updated);
      } catch (err) {
        setIsSaving(false);
        setUpdateError(err.message || 'Failed to update signature. Verify your password.');
        showToast(err.message || 'Update failed', 'error');
      }
    }, 300);
  };

  // ─── Reset to Default Signature with Password Verification ───────────────
  const handleConfirmReset = (e) => {
    e?.preventDefault();
    setResetError('');

    const trimmedPassword = resetPassword.trim();
    if (!trimmedPassword) {
      setResetError('Password re-entry is required to confirm resetting the digital signature.');
      return;
    }

    setIsResetting(true);
    setTimeout(() => {
      try {
        const res = resetToDefaultSignature({
          key: selectedSignerKey,
          password: trimmedPassword,
          currentUser,
          allUsers: users
        });

        setSignaturesMap(getAllSignatures());
        setIsResetting(false);
        setIsResetModalOpen(false);
        setResetPassword('');
        setResetError('');
        showToast(`Digital signature reset for ${activeSignature.signerName}.`, 'info');
        if (onSignatureUpdated) onSignatureUpdated(res);
      } catch (err) {
        setIsResetting(false);
        setResetError(err.message || 'Failed to reset signature. Verify your password.');
        showToast(err.message || 'Reset failed', 'error');
      }
    }, 300);
  };

  // ─── Download Signature ──────────────────────────────────────────────────
  const handleDownload = () => {
    const dataUrl = activeSignature.signatureDataUrl || generateDemoSignaturePNG(activeSignature.signerName).dataUrl;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${activeSignature.signerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_digital_signature.png`;
    link.click();
    showToast(`Downloaded signature file '${link.download}'.`, 'success');
  };

  // ─── Dynamic Cursive Signature Generator for Active Name ─────────────────
  const handleGenerateCursiveForActiveName = () => {
    const cursive = generateDemoSignaturePNG(activeSignature.signerName);
    setStagedFile(null);
    setStagedPreviewData(cursive);
    showToast(`Generated cursive signature for '${activeSignature.signerName}'. Enter password to save.`, 'info');
  };

  // =========================================================================
  // VIEW 1: LOCKED STATE (PASSWORD AUTHENTICATION SCREEN)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div
        className="digital-signature-vault-locked"
        style={{
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          padding: '28px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: embedded ? '0' : '24px'
        }}
      >
        {/* Glow ambient background elements */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0
            }}>
              <Lock size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-primary, #ffffff)',
                  letterSpacing: '-0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Digital Signature Security Vault
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Shield size={11} /> Password Protected Block
                </span>
              </div>
              <p style={{
                fontSize: '0.84rem',
                color: 'var(--text-muted, #94a3b8)',
                margin: '6px 0 0',
                maxWidth: '680px',
                lineHeight: 1.5
              }}>
                Secure, encrypted repository for authorized digital signatures. Upload JPG or PNG signatures for any authorized signatory or CRM user, and maintain full control to update or change them anytime by re-entering your account password.
              </p>
            </div>
          </div>

          {/* Current User Identity Badge */}
          {currentUser && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #cbd5e1)'
            }}>
              <User size={13} color="#38bdf8" />
              <span>Signed in: <strong style={{ color: '#ffffff' }}>{currentUser.name}</strong> ({currentUser.role})</span>
            </div>
          )}
        </div>

        {/* Authentication Card Form */}
        <div style={{
          maxWidth: '540px',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '22px 24px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <KeyRound size={16} color="#38bdf8" />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              Password Verification Required
            </span>
          </div>

          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.78rem',
                color: 'var(--text-muted, #94a3b8)',
                marginBottom: '6px',
                fontWeight: 500
              }}>
                Enter Password to Unlock Signature Block
              </label>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your account or admin password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 12px',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    border: authError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    color: '#ffffff',
                    outline: 'none',
                    fontFamily: showPassword ? 'inherit' : 'ui-monospace, monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {authError && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '0.76rem',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <AlertCircle size={13} /> {authError}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '16px'
            }}>
              <button
                type="submit"
                disabled={isVerifying}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  backgroundColor: '#0284c7',
                  borderRadius: '6px',
                  cursor: isVerifying ? 'wait' : 'pointer'
                }}
              >
                <Unlock size={15} />
                {isVerifying ? 'Verifying...' : 'Unlock Signature Vault'}
              </button>

              {/* Demo Helper Pill for instant testing convenience */}
              <button
                type="button"
                onClick={() => {
                  const pass = currentUser?.password || 'superadmin123';
                  setPasswordInput(pass);
                  setAuthError('');
                }}
                style={{
                  background: 'none',
                  border: '1px dashed rgba(56, 189, 248, 0.4)',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Click to automatically fill user password"
              >
                <span>Demo Key: <code>{currentUser?.password || 'admin123'}</code></span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: UNLOCKED STATE (MANAGEMENT & UPDATE BLOCK)
  // =========================================================================
  return (
    <div
      className="digital-signature-vault-unlocked"
      style={{
        borderRadius: '12px',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        backgroundColor: 'var(--bg-card, #1e293b)',
        padding: '24px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
        marginBottom: embedded ? '0' : '24px',
        position: 'relative'
      }}
    >
      {/* ── Top Header Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        paddingBottom: '18px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>

            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-primary, #ffffff)',
              letterSpacing: '-0.3px'
            }}>
              Digital Signature Storage Block
            </h3>

            <span style={{
              fontSize: '0.72rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} /> Vault Unlocked & Active
            </span>
          </div>

          <p style={{
            fontSize: '0.84rem',
            color: 'var(--text-muted, #94a3b8)',
            margin: 0,
            maxWidth: '740px',
            lineHeight: 1.5
          }}>
            Store and manage authenticated digital signatures for any signatory or team member. Upload JPG/PNG signatures, customize signer names & designations, and update files anytime with password authentication.
          </p>
        </div>

        {/* Lock Vault Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleLock}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Lock this vault immediately"
          >
            <Lock size={13} /> Lock Vault
          </button>
        </div>
      </div>

      {/* ── Signer Selector & Presets ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedSignerKey('master_officer')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: selectedSignerKey === 'master_officer' ? '1.5px solid #06b6d4' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              backgroundColor: selectedSignerKey === 'master_officer' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              color: selectedSignerKey === 'master_officer' ? '#22d3ee' : 'var(--text-muted, #94a3b8)',
              fontSize: '0.82rem',
              fontWeight: selectedSignerKey === 'master_officer' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            <Building2 size={15} />
            <span>Primary Signatory: <strong>{signaturesMap['master_officer']?.signerName || 'Srinivas R'}</strong></span>
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => setSelectedSignerKey(currentUser.id || 'current_user')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: selectedSignerKey === (currentUser.id || 'current_user') ? '1.5px solid #38bdf8' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                backgroundColor: selectedSignerKey === (currentUser.id || 'current_user') ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                color: selectedSignerKey === (currentUser.id || 'current_user') ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                fontSize: '0.82rem',
                fontWeight: selectedSignerKey === (currentUser.id || 'current_user') ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              <User size={15} />
              <span>My User Signature ({currentUser.name})</span>
            </button>
          )}

          {/* User Directory quick picker dropdown */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              value={selectedSignerKey}
              onChange={(e) => setSelectedSignerKey(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-secondary, #cbd5e1)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="master_officer" style={{ backgroundColor: '#1e293b' }}>
                🏢 Primary Official Signatory ({signaturesMap['master_officer']?.signerName || 'Srinivas R'})
              </option>
              {users.map(u => (
                <option key={u.id} value={u.id} style={{ backgroundColor: '#1e293b' }}>
                  👤 {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Edit Signatory Profile Button */}
        <button
          type="button"
          onClick={() => setIsProfileModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#38bdf8',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          title="Edit signatory name, title, entity and registration number"
        >
          <Edit3 size={13} /> Edit Signer Profile & Name
        </button>
      </div>

      {/* ── Main Signature Display Card ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'stretch'
      }}>
        {/* Left Column: Signature Visual Canvas Preview */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                Live Digital Signature Preview:
              </span>

              {/* Background preview switches */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setPreviewBg('cyan-box')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: previewBg === 'cyan-box' ? '#0891b2' : 'transparent',
                    color: previewBg === 'cyan-box' ? '#ffffff' : '#94a3b8'
                  }}
                  title="Cyan marked box preview as on official Leegality agreement"
                >
                  Cyan E-Sign Box
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('white-paper')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: previewBg === 'white-paper' ? '#ffffff' : 'transparent',
                    color: previewBg === 'white-paper' ? '#0f172a' : '#94a3b8'
                  }}
                  title="Clean white legal paper background"
                >
                  White Paper
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('dark')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: previewBg === 'dark' ? '#334155' : 'transparent',
                    color: previewBg === 'dark' ? '#ffffff' : '#94a3b8'
                  }}
                >
                  Dark Contrast
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div style={{
              borderRadius: '8px',
              padding: '24px 18px',
              minHeight: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              backgroundColor: previewBg === 'white-paper'
                ? '#ffffff'
                : previewBg === 'dark'
                  ? '#090d16'
                  : 'rgba(6, 182, 212, 0.05)',
              border: previewBg === 'cyan-box'
                ? '2px solid #06b6d4'
                : previewBg === 'white-paper'
                  ? '1px solid #cbd5e1'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: previewBg === 'cyan-box' ? '0 0 16px rgba(6, 182, 212, 0.2)' : 'none'
            }}>
              {previewBg === 'cyan-box' && (
                <span style={{
                  position: 'absolute',
                  top: '-9px',
                  left: '12px',
                  backgroundColor: '#06b6d4',
                  color: '#ffffff',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase'
                }}>
                  {activeSignature.signerName} E-Sign
                </span>
              )}

              {/* Signature Graphic Display */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {activeSignature.signatureDataUrl ? (
                  <img
                    src={activeSignature.signatureDataUrl}
                    alt={`${activeSignature.signerName} Digital Signature`}
                    style={{
                      maxWidth: '260px',
                      maxHeight: '80px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                ) : (
                  <img
                    src={generateDemoSignaturePNG(activeSignature.signerName).dataUrl}
                    alt={`${activeSignature.signerName} Calligraphy Signature`}
                    style={{
                      maxWidth: '260px',
                      maxHeight: '80px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                )}

                <div style={{
                  fontSize: '0.64rem',
                  color: previewBg === 'white-paper' ? '#0369a1' : '#38bdf8',
                  fontWeight: 600
                }}>
                  {activeSignature.isCustomUploaded ? '✓ Custom Uploaded Signature File' : `✓ Calligraphy Signature for '${activeSignature.signerName}'`}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons for Signature */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginTop: '16px',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={() => {
                setStagedFile(null);
                setStagedPreviewData(null);
                setUpdatePassword('');
                setUpdateError('');
                setIsUploadModalOpen(true);
              }}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#0284c7',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Upload size={14} />
              {activeSignature.isCustomUploaded ? 'Change / Update Signature File' : 'Upload Signature (JPG/PNG)'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary, #cbd5e1)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
                title="Download signature image file"
              >
                <Download size={14} /> Download
              </button>

              {activeSignature.isCustomUploaded && (
                <button
                  type="button"
                  onClick={() => {
                    setResetPassword('');
                    setResetError('');
                    setIsResetModalOpen(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '6px',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  title="Reset to default cursive signature"
                >
                  <Trash2 size={14} /> Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Signature Metadata & Governance Details */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              paddingBottom: '12px'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#ffffff' }}>
                  {activeSignature.signerName}
                </h4>
                <div style={{ fontSize: '0.76rem', color: '#06b6d4' }}>
                  {activeSignature.designation}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  backgroundColor: activeSignature.isCustomUploaded ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: activeSignature.isCustomUploaded ? '#38bdf8' : '#10b981',
                  border: activeSignature.isCustomUploaded ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 600
                }}>
                  {activeSignature.isCustomUploaded ? 'Custom Uploaded File' : 'Calligraphy Signature'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInlineEditing(!isInlineEditing)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: isInlineEditing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                    border: isInlineEditing ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(6, 182, 212, 0.35)',
                    color: isInlineEditing ? '#f87171' : '#22d3ee',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Quickly edit signatory identity details"
                >
                  <Edit3 size={12} /> {isInlineEditing ? 'Cancel Edit' : 'Edit Details'}
                </button>
              </div>
            </div>

            {isInlineEditing ? (
              /* Inline Edit Form */
              <form onSubmit={handleConfirmSaveInline} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                    Signatory Full Name *
                  </label>
                  <input
                    type="text"
                    value={inlineForm.signerName}
                    onChange={(e) => setInlineForm({ ...inlineForm, signerName: e.target.value })}
                    placeholder="e.g. Srinivas R"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                    Designation / Title *
                  </label>
                  <input
                    type="text"
                    value={inlineForm.designation}
                    onChange={(e) => setInlineForm({ ...inlineForm, designation: e.target.value })}
                    placeholder="e.g. Managing Director / Principal Officer"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                      Entity / Company
                    </label>
                    <input
                      type="text"
                      value={inlineForm.entity}
                      onChange={(e) => setInlineForm({ ...inlineForm, entity: e.target.value })}
                      placeholder="e.g. Astra CRM Enterprise"
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                      Registration / ID
                    </label>
                    <input
                      type="text"
                      value={inlineForm.sebiReg}
                      onChange={(e) => setInlineForm({ ...inlineForm, sebiReg: e.target.value })}
                      placeholder="e.g. EMP-001 or INH000002099"
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div style={{ marginTop: '4px' }}>
                  <label style={{ fontSize: '0.72rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', fontWeight: 600 }}>
                    <KeyRound size={12} /> Password to Confirm
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showInlinePassword ? 'text' : 'password'}
                      value={inlinePassword}
                      onChange={(e) => {
                        setInlinePassword(e.target.value);
                        if (inlineError) setInlineError('');
                      }}
                      placeholder="Enter account password"
                      style={{
                        width: '100%',
                        padding: '6px 32px 6px 10px',
                        borderRadius: '5px',
                        border: inlineError ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.8rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowInlinePassword(!showInlinePassword)}
                      style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showInlinePassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  {inlineError && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '3px' }}>{inlineError}</div>}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    disabled={isSavingInline}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: isSavingInline ? 'wait' : 'pointer'
                    }}
                  >
                    <Check size={13} /> {isSavingInline ? 'Saving...' : 'Save Details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInlineEditing(false)}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: 'transparent',
                      color: '#94a3b8',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '5px',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Specifications Key-Value List */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #cbd5e1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Registered Entity:</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{activeSignature.entity || 'Astra CRM Enterprise'}</span>
                </div>

                {activeSignature.sebiReg && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Registration / Emp ID:</span>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>{activeSignature.sebiReg}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>File Name:</span>
                  <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>
                    {activeSignature.fileName || `${activeSignature.signerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_signature.png`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Format / MIME:</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    {activeSignature.fileType?.split('/')?.[1] || 'PNG'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Resolution:</span>
                  <span>{activeSignature.dimensions ? `${activeSignature.dimensions.width} × ${activeSignature.dimensions.height} px` : '480 × 160 px'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Last Modified:</span>
                  <span>
                    {activeSignature.uploadedAt
                      ? new Date(activeSignature.uploadedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                      : 'System Default Initialized'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Modified By:</span>
                  <span style={{ color: '#ffffff' }}>{activeSignature.uploadedBy || 'System'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Security & Pipeline Callout */}
          <div style={{
            marginTop: '16px',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.74rem',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <Sparkles size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#22d3ee' }}>Document Pipeline Integration:</strong> The digital signature configured for <strong>{activeSignature.signerName}</strong> is auto-affixed onto client agreements and Leegality workflows upon deal confirmation.
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: EDIT SIGNATORY PROFILE (NAME, TITLE, ENTITY, REGISTRATION)
          ===================================================================== */}
      {isProfileModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    Edit Signatory Profile Details
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Set custom name, designation & entity for document execution
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Presets for Convenient Testing */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '6px' }}>
                Quick Presets:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SIGNATORY_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        signerName: preset.name,
                        designation: preset.designation,
                        entity: preset.entity,
                        sebiReg: preset.sebiReg
                      });
                      showToast(`Loaded preset '${preset.name}'`, 'info');
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      cursor: 'pointer'
                    }}
                  >
                    + {preset.name} ({preset.id.includes('demo') ? 'Demo' : 'Signer'})
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Input Form */}
            <form onSubmit={handleConfirmSaveProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Signatory Full Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.signerName}
                    onChange={(e) => setProfileForm({ ...profileForm, signerName: e.target.value })}
                    placeholder="e.g. Srinivas R or Rajesh Kumar"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Designation / Title *
                  </label>
                  <input
                    type="text"
                    value={profileForm.designation}
                    onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                    placeholder="e.g. Managing Director / Principal Officer / Super Admin"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Entity / Company Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.entity}
                    onChange={(e) => setProfileForm({ ...profileForm, entity: e.target.value })}
                    placeholder="e.g. Astra CRM Enterprise"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Registration / Employee ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={profileForm.sebiReg}
                    onChange={(e) => setProfileForm({ ...profileForm, sebiReg: e.target.value })}
                    placeholder="e.g. EMP-001 or INH000002099"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Password Re-Authentication Field */}
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '18px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#f87171',
                  marginBottom: '6px'
                }}>
                  <KeyRound size={14} />
                  <span>Enter Password to Authorize Profile Update</span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showProfilePassword ? 'text' : 'password'}
                    placeholder="Enter account password"
                    value={profilePassword}
                    onChange={(e) => {
                      setProfilePassword(e.target.value);
                      if (profileError) setProfileError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      fontSize: '0.84rem',
                      borderRadius: '6px',
                      border: profileError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #94a3b8)',
                      cursor: 'pointer'
                    }}
                  >
                    {showProfilePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {profileError && (
                  <div style={{ color: '#ef4444', fontSize: '0.74rem', marginTop: '6px' }}>
                    {profileError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    backgroundColor: '#0284c7',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: isSavingProfile ? 'wait' : 'pointer'
                  }}
                >
                  <Check size={14} />
                  {isSavingProfile ? 'Saving...' : 'Save Signatory Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: UPLOAD / UPDATE SIGNATURE FILE (WITH PASSWORD RE-AUTH)
          ===================================================================== */}
      {isUploadModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Upload size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    Upload Signature File
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Target Signatory: <strong>{activeSignature.signerName}</strong> ({activeSignature.designation})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
            />

            {/* Drag & Drop Upload Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #38bdf8' : '2px dashed rgba(255, 255, 255, 0.2)',
                backgroundColor: isDragging ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                borderRadius: '10px',
                padding: '24px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '16px'
              }}
            >
              <ImageIcon size={38} color={isDragging ? '#38bdf8' : '#94a3b8'} style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                {stagedFile ? stagedFile.name : 'Click to Browse or Drag & Drop Signature File'}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
                Supported Formats: <strong>PNG, JPG, JPEG, WEBP, SVG</strong> (Max 5MB)
              </div>
            </div>

            {/* Generate Calligraphy Cursive Button for the Active Name */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
                Generate cursive calligraphy for <strong>{activeSignature.signerName}</strong>:
              </span>
              <button
                type="button"
                onClick={handleGenerateCursiveForActiveName}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={12} /> Generate Cursive Signature
              </button>
            </div>

            {/* Processing Toggles */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              padding: '14px',
              borderRadius: '8px',
              marginBottom: '18px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                Processing Filters:
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={makeTransparent}
                  onChange={(e) => handleFilterToggle(e.target.checked, enhanceContrast)}
                />
                <span><strong>Make Transparent:</strong> Automatically remove white paper background from photographed/scanned JPGs</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enhanceContrast}
                  onChange={(e) => handleFilterToggle(makeTransparent, e.target.checked)}
                />
                <span><strong>Enhance Contrast:</strong> Deepen ink darkness for maximum legibility</span>
              </label>
            </div>

            {/* Staged Image Preview */}
            {stagedPreviewData && (
              <div style={{
                marginBottom: '20px',
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1.5px dashed #0891b2',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
                  Processed Signature Preview ({stagedPreviewData.dimensions?.width}×{stagedPreviewData.dimensions?.height} px • {stagedPreviewData.fileSize}):
                </div>
                <img
                  src={stagedPreviewData.dataUrl}
                  alt="Staged signature preview"
                  style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* ── SECTION 2: SMART OCR DETECTION & EDITABLE SIGNATORY DETAILS ── */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: '#22d3ee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Scan size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                      Signatory Identity & OCR Extraction
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                      Auto-detected via Optical Character Recognition from image pixels & fully editable
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleLoadSampleStamp}
                    disabled={isOcrScanning}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: isOcrScanning ? 'not-allowed' : 'pointer'
                    }}
                    title="Generate a sample corporate rubber seal and test OCR text recognition"
                  >
                    <Sparkles size={13} /> Test Sample Stamp
                  </button>

                  <button
                    type="button"
                    onClick={handleRunManualOcr}
                    disabled={isOcrScanning || (!stagedFile && !stagedPreviewData)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(6, 182, 212, 0.12)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      color: '#22d3ee',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: (isOcrScanning || (!stagedFile && !stagedPreviewData)) ? 'not-allowed' : 'pointer',
                      opacity: (!stagedFile && !stagedPreviewData) ? 0.6 : 1
                    }}
                  >
                    <Cpu size={13} /> {isOcrScanning ? 'Scanning OCR...' : '⚡ Run OCR Scan'}
                  </button>
                </div>
              </div>

              {/* Explanatory Helper Banner if no file is chosen yet */}
              {!stagedFile && !stagedPreviewData && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '14px',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <span>
                    💡 <strong>To run OCR:</strong> Drag & drop or select an image file above. The OCR engine automatically analyzes the image pixels for printed text, seals, or employee IDs.
                  </span>
                </div>
              )}

              {/* OCR Scanning Progress Bar */}
              {isOcrScanning && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#22d3ee', fontWeight: 600 }}>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{ocrProgress.message || 'Scanning image pixels with Tesseract OCR...'}</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#67e8f9', fontWeight: 700 }}>
                      {ocrProgress.percent || 25}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${ocrProgress.percent || 25}%`,
                      height: '100%',
                      backgroundColor: '#06b6d4',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* OCR Extracted Notice Badge & Raw Text Preview */}
              {ocrData && !isOcrScanning && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  backgroundColor: ocrData.hasPrintedText ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.08)',
                  border: ocrData.hasPrintedText ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: ocrData.hasPrintedText ? '#34d399' : '#38bdf8'
                    }}>
                      {ocrData.hasPrintedText ? (
                        <>
                          <CheckCircle2 size={14} /> OCR Read Success ({ocrData.confidence}% Confidence)
                        </>
                      ) : (
                        <>
                          <Info size={14} /> Handwritten Cursive Signature Detected
                        </>
                      )}
                    </div>

                    {ocrData.rawText && (
                      <button
                        type="button"
                        onClick={() => setShowRawOcr(!showRawOcr)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#93c5fd',
                          fontSize: '0.7rem',
                          textDecoration: 'underline',
                          cursor: 'pointer'
                        }}
                      >
                        {showRawOcr ? 'Hide Raw OCR Text' : 'View Raw OCR Text'}
                      </button>
                    )}
                  </div>

                  {!ocrData.hasPrintedText && (
                    <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '8px', lineHeight: 1.4 }}>
                      Pure handwritten signatures contain ink loops rather than machine typeface. You can easily adjust or verify your name, title, and registration ID directly in the editable inputs below!
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ocrData.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: ocrData.hasPrintedText ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                          color: ocrData.hasPrintedText ? '#a7f3d0' : '#bae6fd',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 500
                        }}
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>

                  {/* Expandable Raw OCR Text Box */}
                  {showRawOcr && ocrData.rawText && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                        RAW PIXEL TEXT EXTRACTED BY TESSERACT OCR:
                      </div>
                      {ocrData.rawText}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Presets Inside Upload Modal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Quick Presets:</span>
                {SIGNATORY_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setStagedDetails(prev => ({
                        ...prev,
                        signerName: preset.name,
                        designation: preset.designation,
                        entity: preset.entity,
                        sebiReg: preset.sebiReg
                      }));
                      showToast(`Loaded details for '${preset.name}'`, 'info');
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#38bdf8',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>

              {/* Editable Details Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                      Signatory Full Name *
                    </label>
                    <input
                      type="text"
                      value={stagedDetails.signerName}
                      onChange={(e) => setStagedDetails({ ...stagedDetails, signerName: e.target.value })}
                      placeholder="e.g. Srinivas R"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.84rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                      Designation / Title *
                    </label>
                    <input
                      type="text"
                      value={stagedDetails.designation}
                      onChange={(e) => setStagedDetails({ ...stagedDetails, designation: e.target.value })}
                      placeholder="e.g. Managing Director / Principal Officer"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.84rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                      Registered Entity / Company
                    </label>
                    <input
                      type="text"
                      value={stagedDetails.entity}
                      onChange={(e) => setStagedDetails({ ...stagedDetails, entity: e.target.value })}
                      placeholder="e.g. Astra CRM Enterprise"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.84rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                      Registration ID / Employee Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={stagedDetails.sebiReg}
                      onChange={(e) => setStagedDetails({ ...stagedDetails, sebiReg: e.target.value })}
                      placeholder="e.g. EMP-001 or INH000002099"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.84rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── MANDATORY PASSWORD RE-AUTHENTICATION FORM ── */}
            <form onSubmit={handleConfirmSaveSignature}>
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '18px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#f87171',
                  marginBottom: '6px'
                }}>
                  <KeyRound size={15} />
                  <span>Password Re-Authentication Required</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', margin: '0 0 10px 0' }}>
                  To maintain strict security, re-enter your password to authorize updating this digital signature and its details.
                </p>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showUpdatePassword ? 'text' : 'password'}
                    placeholder="Enter your account password"
                    value={updatePassword}
                    onChange={(e) => {
                      setUpdatePassword(e.target.value);
                      if (updateError) setUpdateError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: updateError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpdatePassword(!showUpdatePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #94a3b8)',
                      cursor: 'pointer'
                    }}
                  >
                    {showUpdatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {updateError && (
                  <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '6px' }}>
                    {updateError}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isProcessingImage || (!stagedPreviewData && !activeSignature.signatureDataUrl)}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    backgroundColor: '#10b981',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: (isSaving || isProcessingImage || (!stagedPreviewData && !activeSignature.signatureDataUrl)) ? 'not-allowed' : 'pointer',
                    opacity: (!stagedPreviewData && !activeSignature.signatureDataUrl) ? 0.6 : 1
                  }}
                >
                  <Check size={15} />
                  {isSaving ? 'Verifying & Saving...' : 'Confirm & Save Signature and Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: RESET CONFIRMATION
          ===================================================================== */}
      {isResetModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                Reset Signature File
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5, marginBottom: '16px' }}>
              Revert the signature for <strong>{activeSignature.signerName}</strong> to default system cursive calligraphy?
            </p>

            <form onSubmit={handleConfirmReset}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '6px' }}>
                  Re-enter Password to Authorize Reset:
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="Enter account password"
                    value={resetPassword}
                    onChange={(e) => {
                      setResetPassword(e.target.value);
                      if (resetError) setResetError('');
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 12px',
                      fontSize: '0.86rem',
                      borderRadius: '6px',
                      border: resetError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted, #94a3b8)',
                      cursor: 'pointer'
                    }}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {resetError && (
                  <div style={{ color: '#ef4444', fontSize: '0.76rem', marginTop: '6px' }}>
                    {resetError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: isResetting ? 'wait' : 'pointer'
                  }}
                >
                  {isResetting ? 'Verifying...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalSignatureVault;
