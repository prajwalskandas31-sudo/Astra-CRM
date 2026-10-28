import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useToast } from './ToastNotification';
import { HarshalParmarESign } from './HarshalParmarESign';
import { DigitalSignatureVault } from './DigitalSignatureVault';
import { LiveLeegalityDispatchModal } from './LiveLeegalityDispatchModal';
import { getPrimarySignatory } from '../services/digitalSignatureService';
import { downloadLeegalityFile } from '../services/leegalityService';
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

export const ESignManagementBlock = () => {
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
      showToast(`Leegality created document ${res.apiResult.documentId} for '${targetSale.clientName}'.`, 'success');
    } catch (err) {
      setIsDispatching(false);
      showToast(`Leegality Dispatch Notice: ${err.message}`, 'error');
    }
  };

  const handleDownloadPdf = async (rec) => {
    showToast(`Fetching the signed agreement (${rec.documentId}) from Leegality...`, 'info');
    try {
      await downloadLeegalityFile(rec.documentId, 'signed-pdf');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
    }
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
              <span>● Token held by CRM backend</span>
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
              This stored signature is sent to Leegality with every request and placed in the two RA signature fields (pages 7 and 14) of the agreement.
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
            <div>• <strong>Execution Mode:</strong> Leegality Workflow LzfDhWc (RA Terms &amp; Conditions template)</div>
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
              Stored Signature Preview:
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
              Sent with a 24-hour timestamp (e.g. "Signed: 26-10-2026 17:15:03 IST") taken at the moment of dispatch
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
              Agreements appear here once Leegality reports them COMPLETED. Send one with "Trigger e-KYC & E-Sign" in Sale Approvals.
            </p>
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
                        backgroundColor: 'var(--lg-sky-bg, #e0f2fe)',
                        color: 'var(--lg-sky-text, #0369a1)',
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
                        <Check size={12} /> {rec.verifiedByLeegality ? (rec.signerOfficer?.eSignStatus || '—') : 'Unverified'}
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
                        <CheckCircle2 size={12} /> {rec.verifiedByLeegality ? (rec.clientSigner?.eSignStatus || 'Signed on Leegality') : 'Unverified'}
                      </span>
                    </td>
                    <td>
                      {rec.verifiedByLeegality ? (
                        <span className="badge badge-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                          {rec.status}
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }} title="Created by the old simulated flow; this document ID does not exist on Leegality">
                          Unverified (old simulated record)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => {
                            const sale = sales.find(s => s.id === rec.saleId) || { id: rec.saleId, clientName: rec.clientName };
                            setLiveDispatchData({ sale, result: sale.eSignDetails?.documentId ? sale.eSignDetails : { documentId: rec.documentId } });
                          }}
                          className="btn-secondary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.74rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Live status and signed copy from Leegality"
                        >
                          <Eye size={13} /> Leegality Status
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

      {/* Real Leegality e-KYC & E-Sign Live Dispatch Modal */}
      <LiveLeegalityDispatchModal
        isOpen={!!liveDispatchData}
        sale={liveDispatchData?.sale}
        dispatchResult={liveDispatchData?.result}
        onClose={() => setLiveDispatchData(null)}
      />
    </div>
  );
};

export default ESignManagementBlock;
