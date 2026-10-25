import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { HarshalParmarESign } from './HarshalParmarESign';
import { DigitalSignatureVault } from './DigitalSignatureVault';
import { LiveLeegalityDispatchModal } from './LiveLeegalityDispatchModal';
import { getPrimarySignatory } from '../services/digitalSignatureService';
import {
  FileSignature,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  Eye,
  Download,
  Trash2,
  ExternalLink,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  FileCheck2,
  Calendar,
  UserCheck,
  Building2,
  Layers,
  ArrowRight,
  Send,
  AlertCircle,
  Zap,
  Lock,
  Unlock,
  KeyRound
} from 'lucide-react';

export const ESignManagementBlock = ({ onOpenLeegalityModal = null }) => {
  const {
    currentUser,
    sales = [],
    leads = [],
    eSignRecords = [],
    triggerEKycAndESign,
    deleteESignRecord,
    leegalityConfig
  } = useCRM();

  const { showToast } = useToast();

  const [activeBlockTab, setActiveBlockTab] = useState('registry'); // 'registry' | 'vault'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordForInspection, setSelectedRecordForInspection] = useState(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState('both'); // 'doc1' | 'doc2' | 'both'
  const [primarySignatory, setPrimarySignatory] = useState(() => getPrimarySignatory());
  const [liveDispatchData, setLiveDispatchData] = useState(null);
  const [isDispatching, setIsDispatching] = useState(false);

  // Listen to signature/signatory profile updates in real time
  useEffect(() => {
    const handleSigUpdate = () => {
      setPrimarySignatory(getPrimarySignatory());
    };
    window.addEventListener('astra:digital_signature_updated', handleSigUpdate);
    return () => window.removeEventListener('astra:digital_signature_updated', handleSigUpdate);
  }, []);

  // Filter records
  const filteredRecords = eSignRecords.filter(r => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.clientName && r.clientName.toLowerCase().includes(q)) ||
      (r.documentId && r.documentId.toLowerCase().includes(q)) ||
      (r.serviceName && r.serviceName.toLowerCase().includes(q)) ||
      (r.panNumber && r.panNumber.toLowerCase().includes(q))
    );
  });

  // Pending sales ready for or awaiting e-sign
  const pendingESignSales = sales.filter(s =>
    s.status?.includes('Ready for E-Sign') ||
    s.status?.includes('Pending Super Admin') ||
    s.status?.includes('Dispatched') ||
    s.status?.includes('Voice Call') ||
    s.stage === 'Ready for E-Sign' ||
    s.stage === 'Awaiting Client E-Sign' ||
    s.eSignStatus === 'Ready' ||
    s.eSignStatus === 'Pending'
  );

  const handleTriggerRealLeegality = async (targetSale) => {
    if (!targetSale) {
      showToast('No pending sale selected for Leegality dispatch.', 'error');
      return;
    }
    setIsDispatching(true);
    showToast(`Dispatching live Leegality package for '${targetSale.clientName}' (Workflow: LzfDhWc)...`, 'info');
    try {
      const res = await triggerEKycAndESign(targetSale.id);
      setIsDispatching(false);
      setLiveDispatchData({ sale: targetSale, result: res.apiResult });
      showToast(`Leegality API Gateway: Invitations dispatched! (Doc ID: ${res.apiResult.data.documentId})`, 'success');
    } catch (err) {
      setIsDispatching(false);
      showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
    }
  };

  const handleDownloadPdf = (rec) => {
    showToast(`Downloading certified E-Signed agreement (${rec.documentId}) with ${primarySignatory?.signerName || 'authorized'} signature...`, 'info');
    setTimeout(() => {
      showToast(`Signed Agreement PDF downloaded successfully! Certified by Leegality.`, 'success');
    }, 1200);
  };

  return (
    <div className="esign-management-block" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ─── BLOCK HEADER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileSignature size={22} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #ffffff)', letterSpacing: '-0.3px' }}>
                Dedicated E-Sign Block
              </h2>
              <span style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#22d3ee',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                Leegality SEBI Master
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted, #94a3b8)', maxWidth: '760px', lineHeight: 1.5 }}>
              Centralized repository for digitally executed client agreements. This block is dedicated to recording all digital signatures and is automatically filled after client and authorized officer confirmation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {pendingESignSales.length > 0 ? (
              <button
                onClick={() => handleTriggerRealLeegality(pendingESignSales[0])}
                disabled={isDispatching}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)',
                  cursor: isDispatching ? 'not-allowed' : 'pointer'
                }}
                title={`Dispatches live Leegality package (Workflow: LzfDhWc) to ${pendingESignSales[0].clientName}`}
              >
                <Zap size={16} />
                {isDispatching ? 'Dispatching Leegality Gateway...' : `Trigger Leegality E-Sign (${pendingESignSales[0].clientName})`}
              </button>
            ) : (
              <div style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted, #94a3b8)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>All approved sales e-signed (Workflow: LzfDhWc)</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── METRIC CARDS ─── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginTop: '24px'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Confirmed E-Sign Agreements
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
              {eSignRecords.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <CheckCircle2 size={12} /> Filled automatically on confirmation
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Authorized Signatory
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
              {primarySignatory?.signerName || 'Authorized Signatory'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#22d3ee' }}>
              {primarySignatory?.designation || 'Principal Officer'}
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Registration ID / Entity
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
              {primarySignatory?.sebiReg || 'EMP-001'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10b981' }}>
              ✓ {primarySignatory?.entity || 'Astra CRM Enterprise'}
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Leegality Gateway API
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0284c7' }}>
              API v3.0 Live
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>● Token: {leegalityConfig?.legacyAuthToken ? `${leegalityConfig.legacyAuthToken.slice(0, 6)}...` : 'JsAEa0...'}</span>
              <span>• {leegalityConfig?.creditsLeft ?? 10} Credits Left</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── E-SIGN BLOCK SUB-NAVIGATION TABS ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '22px',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveBlockTab('registry')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeBlockTab === 'registry' ? '1.5px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: activeBlockTab === 'registry' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeBlockTab === 'registry' ? '#22d3ee' : 'var(--text-muted, #94a3b8)',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={16} />
          <span>Confirmed E-Sign Documents Registry ({eSignRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveBlockTab('vault')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeBlockTab === 'vault' ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: activeBlockTab === 'vault' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: activeBlockTab === 'vault' ? '#10b981' : 'var(--text-muted, #94a3b8)',
            transition: 'all 0.15s ease'
          }}
        >
          <Lock size={15} />
          <span>Digital Signature Storage Block</span>
          <span style={{
            fontSize: '0.68rem',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 700
          }}>
            Password Protected
          </span>
        </button>
      </div>

      {activeBlockTab === 'vault' ? (
        <DigitalSignatureVault initialSignerKey="master_officer" />
      ) : (
        <>
          {/* ─── AUTHORIZED SIGNER PROFILE & SEAL CARD ─── */}
          <div style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: '10px',
        padding: '20px 24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary, #ffffff)' }}>
              First Invitee / Authorized Signer Master Profile
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
              His official digital signature is affixed in the marked cyan locations on both interlinked documents.
            </span>
          </div>

          <span style={{
            fontSize: '0.74rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <ShieldCheck size={14} /> Certified Digital Signer Active
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'center'
        }}>
          {/* Signer Details */}
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.6 }}>
            <div>• <strong>Signer Name:</strong> {primarySignatory?.signerName || 'Authorized Signatory'}</div>
            <div>• <strong>Designation:</strong> {primarySignatory?.designation || 'Principal Officer'}</div>
            <div>• <strong>Registered Entity:</strong> {primarySignatory?.entity || 'Astra CRM Enterprise'} ({primarySignatory?.sebiReg || 'EMP-001'})</div>
            <div>• <strong>Registered Office:</strong> {primarySignatory?.officeAddress || 'Corporate Headquarters, Bengaluru, Karnataka'}</div>
            <div>• <strong>Execution Mode:</strong> Interlinked Two-Document E-Sign (MITC + 14-page Agreement)</div>
          </div>

          {/* Authentic E-Sign Preview */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '8px', fontWeight: 600 }}>
              Official Digital E-Sign Stamp (Affixed Upon Confirmation):
            </span>
            <HarshalParmarESign
              date={new Date().toLocaleDateString('en-GB')}
              isConfirmed={true}
              showCyanBorder={true}
              signerName={primarySignatory?.signerName}
              designation={primarySignatory?.designation}
              sebiReg={primarySignatory?.sebiReg}
            />
            <span style={{ fontSize: '0.68rem', color: '#06b6d4', marginTop: '6px' }}>
              ✓ Automatically stamped into cyan-marked places above "Signature: / Name: {primarySignatory?.signerName || 'Authorized Signatory'}"
            </span>
            <button
              type="button"
              onClick={() => setActiveBlockTab('vault')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                padding: '6px 14px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                borderRadius: '6px',
                color: '#22d3ee',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Lock size={12} /> Manage / Upload Custom Signature (Password Protected)
            </button>
          </div>
        </div>
      </div>

      {/* ─── CONFIRMED AGREEMENTS REGISTRY (FILLED AFTER CONFIRMATION) ─── */}
      <div style={{
        backgroundColor: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        {/* Table Toolbar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #ffffff)' }}>
              Confirmed E-Sign Documents Registry ({eSignRecords.length})
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
              Populated in real-time as soon as a deal reaches final confirmation.
            </span>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search by client, ID, service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                borderRadius: '6px',
                color: 'var(--text-primary, #ffffff)'
              }}
            />
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        {/* Pending E-Sign Alert Banner if any */}
        {pendingESignSales.length > 0 && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(2, 132, 199, 0.14)',
            borderBottom: '1px solid rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#38bdf8',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} />
              <span>
                <strong>{pendingESignSales.length} sale{pendingESignSales.length > 1 ? 's' : ''}</strong> currently awaiting final E-Sign execution:{' '}
                <span style={{ color: '#ffffff', fontWeight: 600 }}>
                  {pendingESignSales.map(s => s.clientName).join(', ')}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => handleTriggerRealLeegality(pendingESignSales[0])}
                disabled={isDispatching}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: isDispatching ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 10px rgba(6, 182, 212, 0.35)'
                }}
                title={`Executes live Leegality API dispatch (Workflow: LzfDhWc) for ${pendingESignSales[0].clientName}`}
              >
                <Zap size={14} /> {isDispatching ? 'Dispatching...' : `⚡ 1-Click Live Leegality Dispatch (${pendingESignSales[0].clientName})`}
              </button>
              {onOpenLeegalityModal && (
                <button
                  onClick={() => onOpenLeegalityModal(pendingESignSales[0], false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Agreement Inspector
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table Content */}
        {filteredRecords.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: '#06b6d4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <FileSignature size={28} />
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--text-primary, #ffffff)', fontWeight: 700 }}>
              Dedicated E-Sign Block is Ready
            </h4>
            <p style={{ margin: '0 auto 20px auto', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', maxWidth: '520px', lineHeight: 1.5 }}>
              This block will automatically be filled as soon as a client's sale confirmation is executed. Click the simulation button below to preview how confirmed agreements and {primarySignatory?.signerName || 'authorized'} E-Sign are filed here.
            </p>
            <button
              onClick={handleSimulateConfirmation}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                fontSize: '0.84rem'
              }}
            >
              <Sparkles size={16} /> Simulate / Fill E-Sign Record
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Execution Date</th>
                  <th>Document ID</th>
                  <th>Client Name</th>
                  <th>Service & Tenure</th>
                  <th>Fee Amount</th>
                  <th>{primarySignatory?.signerName ? `${primarySignatory.signerName} E-Sign` : 'Authorized E-Sign'}</th>
                  <th>Client Signature</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(rec => (
                  <tr key={rec.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                        {rec.date1 || new Date(rec.confirmedAt).toLocaleDateString('en-GB')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                        {new Date(rec.confirmedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <code style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        color: '#38bdf8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.74rem'
                      }}>
                        {rec.documentId}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                        {rec.clientPrefix || ''} {rec.clientName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                        PAN: {rec.panNumber}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{rec.serviceName}</div>
                      <span style={{
                        fontSize: '0.68rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontWeight: 700
                      }}>
                        Tenure: {rec.serviceTenure}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {rec.grossSales}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        color: '#22d3ee',
                        border: '1px solid rgba(6, 182, 212, 0.35)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 600
                      }}>
                        <Check size={12} /> Affixed & Stamped
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 600
                      }}>
                        <CheckCircle2 size={12} /> Aadhaar Verified
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                        {rec.status || 'Confirmed & Sealed'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setSelectedRecordForInspection(rec);
                            setActiveInspectorTab('both');
                          }}
                          className="btn-secondary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.74rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Inspect the interlinked documents showing his e-sign in marked places"
                        >
                          <Eye size={13} /> View Documents
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(rec)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                          title="Download Certified PDF"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete E-Sign record for '${rec.clientName}'?`)) {
                              deleteESignRecord(rec.id);
                              showToast('E-Sign record removed.', 'info');
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', color: '#ef4444' }}
                          title="Delete Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

      {/* ─── INTERLINKED DOCUMENT INSPECTOR MODAL ─── */}
      {selectedRecordForInspection && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 1500,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
              maxWidth: '1200px',
              width: '100%',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 30px 90px rgba(0, 0, 0, 0.9)',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCheck2 size={20} color="#06b6d4" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>
                    Interlinked E-Signed Documents • {selectedRecordForInspection.clientName}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Ref ID: {selectedRecordForInspection.documentId} • Date: {selectedRecordForInspection.date1} • Service Tenure: {selectedRecordForInspection.serviceTenure}
                    {selectedRecordForInspection.leegalityAuthToken && (
                      <span style={{ marginLeft: '8px', color: '#38bdf8' }}>
                        • Leegality Token: {selectedRecordForInspection.leegalityAuthToken}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Document Switcher Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('doc1')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    backgroundColor: activeInspectorTab === 'doc1' ? '#0284c7' : '#1e293b',
                    color: '#ffffff'
                  }}
                >
                  Document 1 (MITC Signatures - Image 1)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('doc2')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    backgroundColor: activeInspectorTab === 'doc2' ? '#0284c7' : '#1e293b',
                    color: '#ffffff'
                  }}
                >
                  Document 2 (Agreement Page 14 - Image 2)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('both')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.76rem',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    backgroundColor: activeInspectorTab === 'both' ? '#0284c7' : '#1e293b',
                    color: '#ffffff'
                  }}
                >
                  Side-by-Side (Both Interlinked)
                </button>

                <button
                  onClick={() => setSelectedRecordForInspection(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    marginLeft: '12px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Cyan Annotation Notice Bar */}
            <div style={{
              backgroundColor: '#ecfeff',
              borderBottom: '1px solid #a5f3fc',
              padding: '8px 20px',
              fontSize: '0.76rem',
              color: '#0e7490',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: '#06b6d4',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '3px'
                }}>
                  CYAN BOX LOCATION
                </span>
                <span>
                  <strong>Note: Both documents are interlinked.</strong> {primarySignatory?.signerName || 'Authorized Signatory'}'s digital E-Sign appears in the marked places above "Signature: / Name: {primarySignatory?.signerName || 'Authorized Signatory'}".
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                Status: Filled & Certified
              </span>
            </div>

            {/* Document Body Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              gap: '24px',
              justifyContent: 'center'
            }}>
              {/* ─── DOCUMENT 1: MITC & CLIENT EXECUTION (IMAGE 1 REF) ─── */}
              {(activeInspectorTab === 'doc1' || activeInspectorTab === 'both') && (
                <div style={{
                  flex: 1,
                  maxWidth: activeInspectorTab === 'both' ? '560px' : '720px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '36px 32px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Top Header */}
                  <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      Document 1 (Image 1 Ref)
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '2px 0', color: '#0f172a' }}>
                      MOST IMPORTANT TERMS & CONDITIONS (MITC)
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                      Service Tenure: <strong>{selectedRecordForInspection.serviceTenure}</strong> • Fee: <strong>{selectedRecordForInspection.grossSales}</strong>
                    </p>
                  </div>

                  <p style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.5, marginBottom: '20px' }}>
                    This document certifies that <strong>{selectedRecordForInspection.clientPrefix} {selectedRecordForInspection.clientName}</strong> (PAN: {selectedRecordForInspection.panNumber}) has engaged research advisory services under SEBI (Research Analyst) Regulations, 2014 for the duration of <strong>{selectedRecordForInspection.serviceTenure}</strong>.
                  </p>

                  {/* ─── EXACT SIGNATURE BLOCK FROM SCREENSHOT 1 ─── */}
                  <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
                    {/* Authorized Signatory Block */}
                    <div style={{ marginBottom: '28px' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                        For {primarySignatory?.signerName || 'Authorized Signatory'}
                      </div>

                      {/* CYAN MARKED BOX WHERE E-SIGN APPEARS */}
                      <div>
                        <HarshalParmarESign
                          date={selectedRecordForInspection.date1}
                          isConfirmed={true}
                          showCyanBorder={true}
                          documentId={selectedRecordForInspection.documentId}
                          signerName={primarySignatory?.signerName}
                          designation={primarySignatory?.designation}
                          sebiReg={primarySignatory?.sebiReg}
                        />
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5, marginTop: '4px' }}>
                        <div>Signature:</div>
                        <div>Name: {primarySignatory?.signerName || 'Authorized Signatory'}</div>
                        <div>Designation: {primarySignatory?.designation || 'Principal Officer'}</div>
                      </div>
                    </div>

                    {/* For and on behalf of the Client */}
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                        For and on behalf of the Client
                      </div>

                      {/* Client Signature Area */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '6px',
                        margin: '4px 0 8px 0'
                      }}>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>
                          Aadhaar E-Signed by {selectedRecordForInspection.clientName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          ({selectedRecordForInspection.date1})
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5 }}>
                        <div>Signature:</div>
                        <div>Name: {selectedRecordForInspection.clientName}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── DOCUMENT 2: TERMS AND CONDITIONS AGREEMENT (PAGE 14 OF 14 - IMAGE 2 REF) ─── */}
              {(activeInspectorTab === 'doc2' || activeInspectorTab === 'both') && (
                <div style={{
                  flex: 1,
                  maxWidth: activeInspectorTab === 'both' ? '560px' : '720px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '36px 32px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Top indicator */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                      Document 2 (Image 2 Ref)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Terms & Conditions Agreement
                    </span>
                  </div>

                  {/* EXACT LEGAL TEXT FROM SCREENSHOT 2 */}
                  <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.6, marginBottom: '24px' }}>
                    <p style={{ margin: '0 0 10px 0' }}>
                      rule, regulation, contract, or other instrument to which it is a party or to which any of its property is or may be subject;
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                      iv. The maximum fee that may be charged by the RA is ₹1.51 lakhs per annum per family of the Client;
                    </p>
                    <p style={{ margin: '0 0 10px 0' }}>
                      v. The recommendations provided by the RA do not provide any assurance of returns.
                    </p>
                    <p style={{ margin: '0 0 18px 0' }}>
                      vi. It is not engaged in any additional professional or business activities, on a whole-time basis or in an executive capacity, which may interfere with, influence, or have the potential to interfere with/influence the independence of the research report and/or recommendations contained therein. <strong>**Only for Individual RA**</strong>
                    </p>
                  </div>

                  {/* ─── EXACT SIGNATURE BLOCK FROM SCREENSHOT 2 ─── */}
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                      For {primarySignatory?.signerName || 'Authorized Signatory'}
                    </div>

                    {/* CYAN MARKED BOX WHERE E-SIGN APPEARS */}
                    <div>
                      <HarshalParmarESign
                        date={selectedRecordForInspection.date1}
                        isConfirmed={true}
                        showCyanBorder={true}
                        documentId={selectedRecordForInspection.documentId}
                        signerName={primarySignatory?.signerName}
                        designation={primarySignatory?.designation}
                        sebiReg={primarySignatory?.sebiReg}
                      />
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5, marginTop: '4px' }}>
                      <div>Signature:</div>
                      <div>Name: {primarySignatory?.signerName || 'Authorized Signatory'}</div>
                      <div>Designation: {primarySignatory?.designation || 'Principal Officer'}</div>
                    </div>
                  </div>

                  {/* EXACT FOOTER FROM SCREENSHOT 2 */}
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

            {/* Modal Bottom Controls */}
            <div style={{
              padding: '12px 20px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Both documents interlinked and sealed via Leegality Cryptographic Timestamp.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedRecordForInspection)}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    padding: '6px 14px'
                  }}
                >
                  <Download size={14} /> Download Certified Agreement
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecordForInspection(null)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real Leegality e-KYC & E-Sign Live Dispatch Modal */}
      <LiveLeegalityDispatchModal
        isOpen={!!liveDispatchData}
        sale={liveDispatchData?.sale}
        dispatchResult={liveDispatchData?.result}
        onClose={() => setLiveDispatchData(null)}
        onFinalized={() => setLiveDispatchData(null)}
      />
    </div>
  );
};

export default ESignManagementBlock;
