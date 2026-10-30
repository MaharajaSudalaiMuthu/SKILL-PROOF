import { useState, useEffect } from 'react';
import { X, Shield, Download, CheckCircle, AlertTriangle, ExternalLink, Trash2 } from 'lucide-react';
import { CredentialSummary, VerifiableCredential } from '@skillproof/shared';

interface CredentialModalProps {
  skillSlug: string;
  skillName: string;
  currentLevel: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
  onOpenVerify?: (credentialId: string) => void;
}

export function CredentialModal({
  skillSlug,
  skillName,
  currentLevel,
  onClose,
  onNotify,
  onOpenVerify,
}: CredentialModalProps) {
  const [credential, setCredential] = useState<CredentialSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [issuing, setIssuing] = useState<boolean>(false);
  const [revoking, setRevoking] = useState<boolean>(false);

  const fetchCredential = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/credentials');
      if (res.ok) {
        const body = await res.json();
        const active = (body.credentials || []).find(
          (c: CredentialSummary) => c.skillSlug === skillSlug && c.status === 'ACTIVE'
        );
        setCredential(active || null);
      }
    } catch (err) {
      console.error('Failed fetching credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredential();
  }, [skillSlug]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const res = await fetch('/api/credentials/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ skillSlug, validMonths: 12 }),
      });

      if (res.ok) {
        onNotify('Signed Verifiable Credential issued successfully!');
        fetchCredential();
      } else {
        const err = await res.json();
        onNotify(err.message || 'Failed to issue credential');
      }
    } catch (err: any) {
      onNotify(err.message || 'Error issuing credential');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async () => {
    if (!credential) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/credentials/${credential.credentialId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ reason: 'Revoked by developer via dashboard' }),
      });

      if (res.ok) {
        onNotify('Credential revoked successfully.');
        fetchCredential();
      } else {
        onNotify('Failed to revoke credential');
      }
    } catch (err: any) {
      onNotify(err.message || 'Error revoking credential');
    } finally {
      setRevoking(false);
    }
  };

  const handleDownload = async () => {
    if (!credential) return;
    try {
      const res = await fetch(`/api/credentials/${credential.credentialId}`);
      if (res.ok) {
        const json: VerifiableCredential = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `credential-${skillSlug}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onNotify('Downloaded signed credential JSON.');
      }
    } catch (err: any) {
      onNotify('Failed downloading credential document');
    }
  };

  const isEligible = currentLevel === 'OBSERVED' || currentLevel === 'SUPPORTED' || currentLevel === 'VERIFIED';

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Verifiable Cryptographic Credential
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                W3C standard JSON-LD • RFC 8785 Canonical JCS • Ed25519 Signature
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Checking cryptographic credential ledger...
            </div>
          ) : credential ? (
            <div>
              {/* Active Credential Certificate Card */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-xs)',
                  marginBottom: '1.25rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="badge badge-success" style={{ gap: '4px' }}>
                    <CheckCircle size={12} /> Active Credential
                  </span>
                  <span className={`badge badge-level-${credential.level.toLowerCase()}`}>
                    {credential.level} Level
                  </span>
                </div>

                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {credential.skillName}
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    padding: '0.35rem 0.5rem',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.85rem',
                    wordBreak: 'break-all',
                  }}
                >
                  URN: {credential.credentialId}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Issued: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{new Date(credential.issuedAt).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Valid Until: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{new Date(credential.validUntil).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Algorithm: </span>
                    <code className="code-tag">Ed25519</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Canonicalization: </span>
                    <code className="code-tag">RFC 8785</code>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownload}
                  style={{ fontSize: '0.8125rem' }}
                >
                  <Download size={14} /> Download Signed JSON
                </button>

                {onOpenVerify && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onOpenVerify(credential.credentialId)}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <ExternalLink size={14} /> Verify Online
                  </button>
                )}

                <button
                  className="btn btn-outline-danger"
                  onClick={handleRevoke}
                  disabled={revoking}
                  style={{ fontSize: '0.8125rem', marginLeft: 'auto' }}
                >
                  <Trash2 size={14} /> {revoking ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Not Issued State */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Issue Official Cryptographic Credential for {skillName}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                  Generates an authentic Verifiable Credential digitally signed by SkillProof using its RFC 8037 Ed25519 private key. The payload contains cryptographic digests of your qualifying AST code evidence and evaluation scores.
                </p>

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Current Attained Level: <strong style={{ color: 'var(--text-primary)' }}>{currentLevel}</strong>
                </div>
              </div>

              {isEligible ? (
                <button
                  className="btn btn-primary"
                  onClick={handleIssue}
                  disabled={issuing}
                  style={{ width: '100%', fontSize: '0.875rem', padding: '0.6rem 1rem' }}
                >
                  {issuing ? 'Signing with Ed25519 Key...' : `Issue Signed Credential (${currentLevel})`}
                </button>
              ) : (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-warning-light)',
                    border: '1px solid var(--color-warning-border)',
                    fontSize: '0.8125rem',
                    color: 'var(--color-warning)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Cryptographic credentials require at least <strong>Observed</strong> level. Connect a repository and run AST analysis to qualify.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8125rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
