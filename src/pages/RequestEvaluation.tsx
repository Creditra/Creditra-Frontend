import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type Step = 1 | 2 | 3 | 4 | 5;
type EvalState = 'idle' | 'running' | 'success' | 'rejected' | 'error';

const COLOR = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
};

const btn = {
  primary: {
    background: COLOR.accent,
    color: 'white',
    border: 'none',
    padding: '0.55rem 1rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
  secondary: {
    background: 'transparent',
    color: COLOR.text,
    border: `1px solid ${COLOR.border}`,
    padding: '0.55rem 1rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
  danger: {
    background: 'transparent',
    color: COLOR.danger,
    border: `1px solid ${COLOR.danger}`,
    padding: '0.55rem 1rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
  ghost: {
    background: 'transparent',
    color: COLOR.muted,
    border: 'none',
    padding: '0.55rem 0.5rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
  } as React.CSSProperties,
};

const inputStyle: React.CSSProperties = {
  background: COLOR.surface,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  padding: '0.5rem 0.75rem',
  color: COLOR.text,
  minWidth: 220,
};

interface EvalResult {
  approved: boolean;
  creditLimit?: number;
  apr?: number;
  riskScore?: number;
  reason?: string;
}

export function RequestEvaluation() {
  const [step, setStep] = useState<Step>(1);
  const [evalState, setEvalState] = useState<EvalState>('idle');
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState(45); // seconds
  const [result, setResult] = useState<EvalResult | null>(null);
  const [revenueFile, setRevenueFile] = useState<File | null>(null);
  const [hasIdentityBond, setHasIdentityBond] = useState(false);
  const [agreeTermsPreviewed, setAgreeTermsPreviewed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const totalSteps = 5;
  const stepTitle = useMemo(() => {
    switch (step) {
      case 1: return 'Initiate Evaluation';
      case 2: return 'Optional Information';
      case 3: return 'Evaluation in Progress';
      case 4: return 'Results';
      case 5: return 'Confirmation';
    }
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    setEvalState('running');
    // Simulate evaluation work with progress and ETA countdown
    setProgress(0);
    setEta(45);
    const start = Date.now();
    const totalMs = 45000; // 45s simulated
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(99, Math.round((elapsed / totalMs) * 100));
      setProgress(pct);
      setEta(Math.max(0, Math.ceil((totalMs - elapsed) / 1000)));
      if (elapsed >= totalMs) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        // Randomize outcome with small chance of error
        const r = Math.random();
        if (r < 0.1) {
          setEvalState('error');
        } else if (r < 0.6) {
          const risk = 660 + Math.round(Math.random() * 120);
          setResult({
            approved: true,
            creditLimit: 100000 + Math.round(Math.random() * 400000),
            apr: 7 + Math.round(Math.random() * 400) / 100, // 7–11%
            riskScore: Math.min(800, risk),
          });
          setEvalState('success');
        } else {
          setResult({
            approved: false,
            reason: 'Insufficient on-chain activity and limited repayment history detected.',
          });
          setEvalState('rejected');
        }
        setProgress(100);
        setStep(4);
      }
    }, 250);
    return () => {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [step]);

  const cancelEvaluation = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setEvalState('idle');
    setProgress(0);
    setEta(45);
    setResult(null);
    setStep(1);
  };

  const restartEvaluation = () => {
    setEvalState('idle');
    setResult(null);
    setStep(1);
  };

  const startEvaluation = () => {
    setStep(3);
  };

  const acceptCreditLine = () => {
    setStep(5);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 0.3rem', color: COLOR.text }}>Open Credit Line</h1>
          <p style={{ margin: 0, color: COLOR.muted }}>Request a new adaptive credit line by initiating a transparent on-chain evaluation.</p>
        </div>
        <Link to="/credit-lines" style={{ ...btn.secondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 } as React.CSSProperties}>← Back to Credit Lines</Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <p style={{ margin: 0, color: COLOR.muted, fontSize: 'var(--font-size-small)' }}>Step {step} of {totalSteps}</p>
          <p style={{ margin: 0, color: COLOR.muted, fontSize: 'var(--font-size-small)' }}>{stepTitle}</p>
        </div>
        <div style={{ height: 6, background: COLOR.border, borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ height: '100%', width: `${(step - 1) / (totalSteps - 1) * 100}%`, background: COLOR.accent, borderRadius: 4, transition: 'width 200ms' }} />
        </div>

        {/* Content */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <p style={{ margin: 0, color: COLOR.muted }}>
                We evaluate your on-chain wallet history and activity patterns to propose a credit limit and terms.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: COLOR.muted }}>
                <li>Analyzes wallet age, transaction volume, and counterparties</li>
                <li>Assesses repayment behavior and risk signals</li>
                <li>Does not custody funds and never signs transactions</li>
              </ul>
              <p style={{ margin: 0, color: COLOR.muted }}>Estimated evaluation time: ≈ 45 seconds</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={btn.secondary} onClick={() => navigate(-1)}>Cancel</button>
              <button style={btn.primary} onClick={() => setStep(2)}>Start</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: COLOR.muted }}>
                Provide optional information to improve your offer. These are not required.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem', color: COLOR.muted }}>
                    Revenue attestation (PDF/CSV)
                    <span title="Upload recent revenue statements or attestations to potentially improve your limit and APR." style={{ marginLeft: 6, color: COLOR.accent, cursor: 'help' }}>ⓘ</span>
                  </span>
                  <input
                    type="file"
                    onChange={e => setRevenueFile(e.target.files?.[0] || null)}
                    style={{ ...inputStyle, padding: '0.35rem 0.5rem' }}
                    accept=".pdf,.csv"
                  />
                  {revenueFile && <span style={{ fontSize: '0.8rem', color: COLOR.muted }}>Attached: {revenueFile.name}</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={hasIdentityBond}
                    onChange={e => setHasIdentityBond(e.target.checked)}
                  />
                  <span style={{ color: COLOR.text }}>
                    Link identity bond
                    <span title="If you’ve posted an identity bond, linking it may improve your risk profile." style={{ marginLeft: 6, color: COLOR.accent, cursor: 'help' }}>ⓘ</span>
                  </span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button style={btn.ghost} onClick={() => { setRevenueFile(null); setHasIdentityBond(false); }}>Clear</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={btn.secondary} onClick={() => setStep(1)}>Back</button>
                <button style={btn.primary} onClick={startEvaluation}>Begin Evaluation</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${COLOR.border}`, borderTopColor: COLOR.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ color: COLOR.text, fontWeight: 600 }}>Evaluating wallet activity…</span>
              </div>
              <div style={{ height: 8, background: COLOR.border, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: COLOR.accent, transition: 'width 250ms' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: COLOR.muted, fontSize: '0.85rem' }}>
                <span>{progress}% complete</span>
                <span>≈ {eta}s remaining</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: COLOR.muted }}>
                <li>Scanning wallet age and transaction history</li>
                <li>Analyzing risk signals and repayment behavior</li>
                <li>Comparing to peer cohorts and market conditions</li>
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={btn.danger} onClick={cancelEvaluation}>Cancel Evaluation</button>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === 4 && (
          <div>
            {evalState === 'error' && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: 8, border: `1px solid rgba(248,81,73,0.3)`, background: 'rgba(248,81,73,0.1)', color: COLOR.text }}>
                <strong style={{ color: COLOR.danger }}>Evaluation failed.</strong>
                <p style={{ margin: '0.35rem 0 0', color: COLOR.muted }}>A network error occurred while analyzing your wallet. Please try again.</p>
              </div>
            )}

            {evalState === 'success' && result?.approved && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'Credit Limit Offered', value: formatCurrency(result.creditLimit || 0), color: COLOR.accent },
                    { label: 'Interest Rate (APR)', value: `${result.apr?.toFixed(2)}%`, color: COLOR.text },
                    { label: 'Risk Score', value: String(result.riskScore), color: result.riskScore && result.riskScore >= 700 ? COLOR.success : COLOR.warning },
                  ].map(k => (
                    <div key={k.label} className="card" style={{ marginBottom: 0 }}>
                      <p style={{ margin: '0 0 0.35rem', color: COLOR.muted, fontSize: 'var(--font-size-tiny)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
                      <p style={{ margin: 0, fontWeight: 700, color: k.color, fontSize: 'var(--font-size-h2)' }}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <details style={{ border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: '0.75rem 1rem' }} onToggle={e => setAgreeTermsPreviewed((e.target as HTMLDetailsElement).open)}>
                  <summary style={{ cursor: 'pointer', color: COLOR.text, fontWeight: 600 }}>
                    Preview Terms and Conditions
                    <span title="Review your proposed terms before accepting." style={{ marginLeft: 8, color: COLOR.accent, cursor: 'help' }}>ⓘ</span>
                  </summary>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', color: COLOR.muted }}>
                    <li>Variable APR based on ongoing risk score updates</li>
                    <li>Credit limit may adjust with material changes in activity</li>
                    <li>No prepayment penalties; interest accrues on utilized balance only</li>
                    <li>Subject to protocol-wide risk management policies</li>
                  </ul>
                </details>
              </div>
            )}

            {evalState === 'rejected' && !result?.approved && (
              <div className="card" style={{ marginBottom: 0 }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: COLOR.text }}>Application Rejected</p>
                <p style={{ margin: 0, color: COLOR.muted }}>{result?.reason || 'Your application did not meet our minimum risk criteria.'}</p>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', color: COLOR.muted }}>
                  <li>Increase on-chain activity and maintain consistent counterparties</li>
                  <li>Provide revenue attestations to strengthen credit profile</li>
                  <li>Consider posting an identity bond to reduce risk</li>
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: 8 }}>
              <button style={btn.secondary} onClick={restartEvaluation}>Try Again</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={btn.ghost} onClick={() => navigate('/credit-lines')}>Contact Support</button>
                <button
                  style={{ ...btn.primary, opacity: evalState === 'success' && result?.approved && agreeTermsPreviewed ? 1 : 0.5, pointerEvents: evalState === 'success' && result?.approved && agreeTermsPreviewed ? 'auto' as const : 'none' }}
                  onClick={acceptCreditLine}
                >
                  Accept Credit Line
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, border: `1px solid rgba(63,185,80,0.35)`, background: 'rgba(63,185,80,0.15)' }}>
              <p style={{ margin: 0, color: COLOR.text, fontWeight: 700 }}>Credit line created successfully</p>
              <p style={{ margin: '0.35rem 0 0', color: COLOR.muted }}>You can now view and manage your new line from the Credit Lines page.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Link to="/credit-lines" style={{ ...btn.primary, textDecoration: 'none' } as React.CSSProperties}>Go to Credit Lines</Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer helper text */}
      <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.8rem' }}>
        Need help? Review the terms preview and optional fields. You can cancel the evaluation any time before completion.
      </p>
    </>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

