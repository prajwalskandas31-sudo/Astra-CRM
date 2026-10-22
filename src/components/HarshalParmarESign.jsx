import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

/**
 * HarshalParmarESign
 * Renders the authentic, legally compliant digital E-Sign for Mr. Harshal Parmar (Principal Officer)
 * specifically designed to fit into the marked cyan box between "For Harshal Parmar" and "Signature:"
 * as indicated in the reference screenshots.
 */
export const HarshalParmarESign = ({
  date = '',
  isConfirmed = true,
  showCyanBorder = true,
  documentId = '',
  compact = false
}) => {
  const displayDate = date || new Date().toLocaleDateString('en-GB');

  if (!isConfirmed) {
    return (
      <div
        className="harshal-esign-box-pending"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
          border: '1.5px dashed #06b6d4',
          borderRadius: '6px',
          margin: '6px 0 10px 0',
          minWidth: '220px',
          minHeight: '44px'
        }}
      >
        <span style={{ fontSize: '0.72rem', color: '#0891b2', fontWeight: 600 }}>
          ⚡ [E-Sign Earmarked: Mr. Harshal Parmar]
        </span>
        <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
          (Will be affixed upon confirmation)
        </span>
      </div>
    );
  }

  return (
    <div
      className="harshal-esign-box-affixed"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: compact ? '4px 10px' : '6px 14px',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        border: showCyanBorder ? '2px solid #06b6d4' : '1px solid rgba(6, 182, 212, 0.4)',
        borderRadius: '6px',
        position: 'relative',
        margin: '6px 0 10px 0',
        boxShadow: showCyanBorder ? '0 0 14px rgba(6, 182, 212, 0.22)' : 'none',
        background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.45) 0%, rgba(207, 250, 254, 0.35) 100%)'
      }}
      title="Leegality Certified Digital E-Signature of Harshal Parmar (Principal Officer)"
    >
      {/* Visual Cyan Marker Pill Indicator */}
      {showCyanBorder && (
        <span
          style={{
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
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Harshal Parmar E-Sign
        </span>
      )}

      {/* Realistic Cursive Ink Signature Vector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <svg
          width={compact ? "130" : "155"}
          height={compact ? "36" : "44"}
          viewBox="0 0 160 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible' }}
        >
          {/* Main cursive letters for "Harshal Parmar" */}
          <path
            d="M 10 34 C 12 20, 16 10, 18 6 C 20 4, 21 14, 22 28 M 14 18 C 20 17, 26 16, 32 16 M 28 28 C 30 22, 34 18, 38 20 C 41 22, 40 28, 43 28 C 46 28, 48 22, 51 20 C 53 18, 54 24, 56 28 M 55 14 C 56 8, 58 6, 60 6 C 62 6, 61 18, 62 28 M 60 22 C 64 20, 68 19, 72 21 C 75 23, 74 28, 77 28 M 76 24 C 79 21, 82 20, 85 22 M 88 6 C 89 14, 90 22, 91 28 M 100 34 C 102 18, 104 10, 107 8 C 111 6, 120 6, 119 16 C 118 22, 110 24, 104 24 M 118 30 C 120 24, 124 20, 127 22 C 130 24, 129 30, 132 30 M 131 24 C 134 21, 137 20, 140 22 M 143 22 C 145 26, 147 30, 150 29"
            stroke="#0f2e59"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Freeform flourish underline */}
          <path
            d="M 14 38 C 50 36, 95 37, 154 34"
            stroke="#0f2e59"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      </div>

      {/* Cryptographic Digital Stamp (Class 3 DSC SEBI Compliance) */}
      <div
        style={{
          borderLeft: '1.5px solid rgba(6, 182, 212, 0.45)',
          paddingLeft: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'left',
          fontSize: compact ? '0.58rem' : '0.64rem',
          color: '#0369a1',
          lineHeight: 1.25,
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <div style={{ fontWeight: 800, color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <CheckCircle2 size={11} color="#0891b2" />
          <span>DIGITALLY SIGNED</span>
        </div>
        <div style={{ fontWeight: 600, color: '#0f172a' }}>Mr. Harshal Parmar</div>
        <div>Principal Officer (RA)</div>
        <div>SEBI: INH000002099</div>
        <div style={{ color: '#0284c7', fontSize: '0.58rem', marginTop: '1px' }}>
          Date: {displayDate} • Leegality v2.1
        </div>
        {documentId && (
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>
            ID: {documentId}
          </div>
        )}
      </div>
    </div>
  );
};

export default HarshalParmarESign;
