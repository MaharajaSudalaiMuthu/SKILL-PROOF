import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onConsentGranted: () => void;
}

export function ConsentModal({ isOpen, onConsentGranted }: ConsentModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGrantConsent = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({
          consentVersion: '1.0',
          agree: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Consent submission failed with HTTP ${res.status}`);
      }

      onConsentGranted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-warning-light)',
                border: '1px solid var(--color-warning-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning)',
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Developer Analysis Consent Required
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                GDPR Article 6(1)(a) explicit informed consent disclosure
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1rem' }}>
            Before SkillProof can analyze public repository code and calculate evidence levels, we require your explicit, versioned consent in accordance with platform privacy rules:
          </p>

          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <ul
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                margin: 0,
                paddingLeft: '1.25rem',
                lineHeight: 1.6,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Public Repositories Only:</strong> SkillProof inspects only public GitHub repositories owned by your authenticated account.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Authorship Attribution:</strong> Commit history (git porcelain blame) is analyzed solely to attribute code authorship to your login.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Zero Code Retention:</strong> Ephemeral clone workspaces are completely deleted immediately following AST extraction.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Full Right to Erasure:</strong> You can purge all stored evidence records, credentials, or your entire account at any time in Privacy Settings.
              </li>
            </ul>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-light)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={handleGrantConsent}
            disabled={submitting}
            style={{ padding: '0.55rem 1.25rem' }}
          >
            <ShieldCheck size={16} />
            {submitting ? 'Recording Consent...' : 'I Agree & Grant Consent'}
          </button>
        </div>
      </div>
    </div>
  );
}

