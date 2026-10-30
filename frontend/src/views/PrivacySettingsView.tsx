import { useState, useEffect } from 'react';
import { Shield, Trash2, AlertTriangle, Database, Lock, ArrowLeft, RefreshCw, X } from 'lucide-react';
import { PrivacySummaryResponse } from '@skillproof/shared';

interface PrivacySettingsViewProps {
  onBack: () => void;
  onNotify: (msg: string) => void;
  onAccountDeleted: () => void;
}

export function PrivacySettingsView({ onBack, onNotify, onAccountDeleted }: PrivacySettingsViewProps) {
  const [summary, setSummary] = useState<PrivacySummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<'analysis' | 'account' | null>(null);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/privacy/summary');
      if (res.ok) {
        const data: PrivacySummaryResponse = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed fetching privacy summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleDeleteAnalysis = async () => {
    if (confirmInput !== 'DELETE ANALYSIS DATA') {
      setErrorMsg("Confirmation text must match 'DELETE ANALYSIS DATA' exactly.");
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/privacy/delete-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ confirmText: 'DELETE ANALYSIS DATA' }),
      });

      if (res.ok) {
        onNotify('All analytical evidence, snapshots, and share links purged successfully.');
        setActiveModal(null);
        setConfirmInput('');
        fetchSummary();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed deleting analysis data');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during deletion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmInput !== 'DELETE MY ACCOUNT') {
      setErrorMsg("Confirmation text must match 'DELETE MY ACCOUNT' exactly.");
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/privacy/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ confirmText: 'DELETE MY ACCOUNT' }),
      });

      if (res.ok) {
        onNotify('Account and all associated records permanently purged.');
        setActiveModal(null);
        onAccountDeleted();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed deleting account');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during account purge');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <Lock size={20} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Privacy & Data Controls
            </h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              GDPR-aligned data management, retention disclosures, and self-service erasure (R19)
            </p>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      {/* Principles Disclosure */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          marginBottom: '1.5rem',
          backgroundColor: 'rgba(79, 70, 229, 0.04)',
          border: '1px solid rgba(79, 70, 229, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-primary)', fontSize: '0.875rem' }}>
          <Shield size={18} /> Privacy by Design & Zero Code Retention
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Ephemeral Workspaces:</strong> Repositories are cloned to temporary sandbox containers and purged immediately upon analysis. Zero proprietary source code files are retained.
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Minimal Scopes:</strong> SkillProof requests only read-only public repo access without email or write scopes. Session tokens are encrypted with AES-256-GCM.
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Cryptographic Revocation:</strong> Downloaded credentials cannot be recalled from third parties, but SkillProof immediately marks their public registry verification status as <code className="code-tag">REVOKED</code> upon erasure.
          </li>
        </ul>
      </div>

      {/* Stored Data Inventory */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={16} style={{ color: 'var(--color-primary)' }} /> Stored Data Inventory
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchSummary}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '1rem 0' }}>Calculating data inventory...</div>
        ) : summary ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            <div className="stat-card">
              <span className="stat-card-label">Static Evidence</span>
              <span className="stat-card-value">{summary.dataCounts.evidenceRecords}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Repositories</span>
              <span className="stat-card-value">{summary.dataCounts.repositories}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Assessments</span>
              <span className="stat-card-value">{summary.dataCounts.assessmentAttempts}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Challenge Runs</span>
              <span className="stat-card-value">{summary.dataCounts.sandboxRuns}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Declared Claims</span>
              <span className="stat-card-value">{summary.dataCounts.skillClaims}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Active Credentials</span>
              <span className="stat-card-value">{summary.dataCounts.credentials}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Inventory unavailable.</div>
        )}
      </div>

      {/* Deletion Tiers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Tier 1 Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Tier 1</span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Delete Analysis Data
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Wipes all evidence records, AST findings, file attributions, assessment attempts, challenge runs, skill claims, snapshots, and share links. Active credentials become <code className="code-tag">REVOKED</code> tombstones. Your user account and login remain active.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setActiveModal('analysis');
              setConfirmInput('');
              setErrorMsg(null);
            }}
            style={{
              color: 'var(--color-warning)',
              borderColor: 'var(--color-warning-border)',
              backgroundColor: 'var(--color-warning-light)',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            <Trash2 size={14} /> Delete Analysis Data
          </button>
        </div>

        {/* Tier 2 Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--color-danger-border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Tier 2</span>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--color-danger)' }}>
                Delete Account (Permanent)
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Executes Tier 1 deletion, purges consent records, permanently deletes your user account and stored OAuth tokens, and logs you out immediately. This action cannot be undone.
            </p>
          </div>

          <button
            className="btn btn-danger"
            onClick={() => {
              setActiveModal('account');
              setConfirmInput('');
              setErrorMsg(null);
            }}
            style={{
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            <Trash2 size={14} /> Permanently Delete Account
          </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {activeModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeModal === 'account' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                <AlertTriangle size={18} />
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Confirm {activeModal === 'account' ? 'Permanent Account Deletion' : 'Analysis Data Purge'}
                </h3>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setActiveModal(null)}
                style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                {activeModal === 'account'
                  ? 'This action will completely delete your account, session tokens, cryptographic credentials, and all historical evidence.'
                  : 'This action will wipe all repository evidence, assessments, challenge results, snapshots, and share links.'}
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8125rem', marginBottom: '0.4rem' }}>
                  Type <code style={{ color: activeModal === 'account' ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: 700 }}>
                    {activeModal === 'account' ? 'DELETE MY ACCOUNT' : 'DELETE ANALYSIS DATA'}
                  </code> to confirm:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={activeModal === 'account' ? 'DELETE MY ACCOUNT' : 'DELETE ANALYSIS DATA'}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-danger-light)',
                    border: '1px solid var(--color-danger-border)',
                    color: 'var(--color-danger)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)} style={{ fontSize: '0.8125rem' }}>
                Cancel
              </button>
              <button
                className={activeModal === 'account' ? 'btn btn-danger' : 'btn'}
                onClick={activeModal === 'account' ? handleDeleteAccount : handleDeleteAnalysis}
                disabled={actionLoading}
                style={{
                  fontSize: '0.8125rem',
                  backgroundColor: activeModal === 'account' ? undefined : 'var(--color-warning)',
                  color: '#ffffff',
                }}
              >
                {actionLoading ? 'Purging records...' : 'Confirm Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
