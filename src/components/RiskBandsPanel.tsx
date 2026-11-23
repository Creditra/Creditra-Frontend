import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { RISK_COLOR, COLOR } from '../utils/tokens';

import { RiskBand, RiskBandLevel } from './RiskBand';
import './RiskBandsPanel.css';

interface RiskBandData {
  name: string;
  description: string;
  aprRange: string;
  limitGuidance: string;
  minScore: number;
  color: string;
  level: RiskBandLevel;
}

const RISK_BANDS: RiskBandData[] = [
  {
    name: 'Excellent',
    description: 'Highest tier of creditworthiness with optimal terms.',
    aprRange: '5% – 10%',
    limitGuidance: 'Maximum available limits',
    minScore: 700,
    color: COLOR.success,
    level: 'success',
  },
  {
    name: 'Good',
    description: 'Strong credit profile with competitive rates.',
    aprRange: '11% – 20%',
    limitGuidance: 'High to medium limits',
    minScore: 600,
    color: COLOR.warning,
    level: 'warning',
  },
  {
    name: 'Caution',
    description: 'Moderate risk; terms may be more restrictive.',
    aprRange: '21% – 30%',
    limitGuidance: 'Limited initial limits',
    minScore: 500,
    color: COLOR.danger,
    level: 'danger',
  },
  {
    name: 'Recovery',
    description: 'High risk; focused on rebuilding credit history.',
    aprRange: '31%+',
    limitGuidance: 'Minimum baseline limits',
    minScore: 0,
    color: COLOR.danger,
    level: 'danger',
  },
];

interface RiskBandsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}

export function RiskBandsPanel({ isOpen, onClose, triggerRef }: RiskBandsPanelProps) {
  const modalRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="risk-bands-panel"
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 1000, 
        display: 'flex', 
        justifyContent: 'flex-end', 
        animation: 'fadeIn 0.2s ease' 
      }}
      onClick={onClose}
      role="presentation"
    >
      {/* Backdrop */}
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', 
          transition: 'opacity 0.2s ease' 
        }} 
        aria-hidden="true" 
      />

      {/* Side Panel */}
      <div 
        ref={modalRef}
        style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: 400, 
          height: '100%', 
          background: COLOR.surface, 
          borderLeft: `1px solid ${COLOR.border}`, 
          boxShadow: '-10px 0 30px rgba(0,0,0,0.3)', 
          display: 'flex', 
          flexDirection: 'column', 
          animation: 'slideInRight 0.3s ease',
          outline: 'none'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-bands-title"
      >
        {/* Header */}
        <div style={{ 
          padding: '1.5rem', 
          borderBottom: `1px solid ${COLOR.border}`, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h2 id="risk-bands-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: COLOR.text }}>
            Risk Score Bands
          </h2>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: COLOR.muted, 
              fontSize: '1.5rem', 
              cursor: 'pointer', 
              padding: '0.25rem', 
              lineHeight: 1 
            }}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '1.5rem', 
          overflowY: 'auto', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: COLOR.muted, lineHeight: 1.5 }}>
            Your risk score determines your eligibility, credit limit, and APR. 
            Here is how the bands are mapped.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {RISK_BANDS.map(band => (
              <RiskBand 
                key={band.name}
                level={band.level}
                style={{ marginBottom: '0.5rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: COLOR.text, fontSize: '1rem' }}>{band.name}</span>
                  <span style={{ fontSize: '0.75rem', color: COLOR.muted, background: 'rgba(139,148,158,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                    {band.minScore}+
                  </span>
                </div>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: COLOR.muted, lineHeight: 1.4 }}>
                  {band.description}
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 4 }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APR Range</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: COLOR.text, fontWeight: 500 }}>{band.aprRange}</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 4 }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Limit Guidance</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: COLOR.text, fontWeight: 500 }}>{band.limitGuidance}</p>
                  </div>
                </div>
              </RiskBand>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '1.25rem', 
          borderTop: `1px solid ${COLOR.border}`, 
          textAlign: 'center' 
        }}>
          <button 
            onClick={onClose}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              background: COLOR.accent, 
              color: COLOR.bg, 
              border: 'none', 
              borderRadius: 6, 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
