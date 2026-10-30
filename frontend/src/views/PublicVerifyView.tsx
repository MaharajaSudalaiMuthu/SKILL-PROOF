import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, Search, FileJson, ArrowLeft } from 'lucide-react';
import { VerifyCredentialResponse } from '@skillproof/shared';

interface PublicVerifyViewProps {
  initialCredentialId?: string;
  onHome?: () => void;
}

export function PublicVerifyView({ initialCredentialId, onHome }: PublicVerifyViewProps) {
  const [tab, setTab] = useState<'id' | 'json'>('id');
  const [credentialId, setCredentialId] = useState<string>(initialCredentialId || '');
  const [pastedJson, setPastedJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerifyCredentialResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleVerifyById = async (idToVerify: string) => {
    if (!idToVerify.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(idToVerify.trim())}/verify`);
      const data: VerifyCredentialResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed connecting to verification service');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyByJson = async () => {
    if (!pastedJson.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const parsed = JSON.parse(pastedJson);
      const res = await fetch('/api/credentials/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: parsed }),
      });
      const data: VerifyCredentialResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid JSON format or network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCredentialId) {
      handleVerifyById(initialCredentialId);
    }
  }, [initialCredentialId]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
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
            <Shield size={20} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Public Credential Verification
            </h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Verify authentic SkillProof cryptographic credentials with Ed25519 digital signatures
            </p>
          </div>
        </div>

        {onHome && (
          <button
            className="btn btn-secondary"
            onClick={onHome}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        )}
      </div>

      {/* Verification Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          className={tab === 'id' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => {
            setTab('id');
            setErrorMsg(null);
          }}
        >
          <Search size={14} /> Verify by Credential ID
        </button>

        <button
          className={tab === 'json' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => {
            setTab('json');
            setErrorMsg(null);
          }}
        >
          <FileJson size={14} /> Verify by Pasted JSON Proof
        </button>
      </div>

      {/* Input Section */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        {tab === 'id' ? (
          <div>
            <label className="form-label">
              Credential Identifier (URN)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="urn:skillproof:credential:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleVerifyById(credentialId)}
                disabled={loading || !credentialId.trim()}
              >
                {loading ? 'Verifying...' : 'Verify Credential'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="form-label">
              Paste Verifiable Credential Document (VC-Style JSON)
            </label>
            <textarea
              className="form-textarea"
              rows={8}
              placeholder='{ "id": "urn:skillproof:credential:...", "proof": { "proofValue": "..." } }'
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                marginBottom: '0.85rem',
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleVerifyByJson}
              disabled={loading || !pastedJson.trim()}
            >
              {loading ? 'Verifying Cryptographic Signature...' : 'Verify Cryptographic Signature'}
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-danger-light)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger)',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={16} />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Verification Result Display */}
      {result && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            border: `1px solid ${
              result.valid && result.status === 'ACTIVE'
                ? '#10b981'
                : result.status === 'REVOKED'
                ? '#ef4444'
                : '#f59e0b'
            }`,
            backgroundColor: 'var(--bg-card)',
          }}
        >
          {/* Status Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem',
              backgroundColor:
                result.valid && result.status === 'ACTIVE'
                  ? 'var(--color-success-light)'
                  : result.status === 'REVOKED'
                  ? 'var(--color-danger-light)'
                  : 'var(--color-warning-light)',
              border: `1px solid ${
                result.valid && result.status === 'ACTIVE'
                  ? 'var(--color-success-border)'
                  : result.status === 'REVOKED'
                  ? 'var(--color-danger-border)'
                  : 'var(--color-warning-border)'
              }`,
            }}
          >
            {result.valid && result.status === 'ACTIVE' ? (
              <CheckCircle size={22} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            ) : result.status === 'REVOKED' ? (
              <XCircle size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={22} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            )}

            <div>
              <div
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color:
                    result.valid && result.status === 'ACTIVE'
                      ? 'var(--color-success)'
                      : result.status === 'REVOKED'
                      ? 'var(--color-danger)'
                      : 'var(--color-warning)',
                }}
              >
                {result.valid && result.status === 'ACTIVE'
                  ? 'Cryptographically Valid & Active'
                  : result.status === 'REVOKED'
                  ? 'Credential Revoked'
                  : result.status === 'SUPERSEDED'
                  ? 'Credential Superseded'
                  : result.status === 'EXPIRED'
                  ? 'Credential Expired'
                  : result.status === 'INVALID_SIGNATURE'
                  ? 'Tampering Detected — Invalid Signature'
                  : 'Verification Notice'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {result.reason ||
                  (result.valid
                    ? 'Ed25519 digital signature verified against official SkillProof public key and active ledger status confirmed.'
                    : 'Credential failed verification checks.')}
              </div>
            </div>
          </div>

          {/* Credential Payload Summary */}
          {result.credential && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="stat-card">
                <span className="stat-card-label">Capability</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {result.credential.credentialSubject.skillName}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Attained Level</span>
                <div>
                  <span className={`badge badge-level-${result.credential.credentialSubject.level.toLowerCase()}`}>
                    {result.credential.credentialSubject.level} Level
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Developer</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  @{result.credential.credentialSubject.githubLogin}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Issuer</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {result.credential.issuer.name}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Issuance Date</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {new Date(result.credential.issuanceDate).toLocaleDateString()}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Valid Until</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {new Date(result.credential.validUntil).toLocaleDateString()}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Signature Algorithm</span>
                <span className="code-tag" style={{ width: 'fit-content' }}>
                  {result.credential.proof.type}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-card-label">Evidence Trail</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {result.credential.credentialSubject.evidenceSummary.staticEvidenceCount} static findings
                  {result.credential.credentialSubject.evidenceSummary.assessmentPassed ? ' • Assessment Passed' : ''}
                  {result.credential.credentialSubject.evidenceSummary.challengePassed ? ' • Challenge Passed' : ''}
                </span>
              </div>
            </div>
          )}

          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Verified at: {new Date(result.verifiedAt).toLocaleString()}</span>
            <span>Canonical Standard: RFC 8785 (JCS) + RFC 8037</span>
          </div>
        </div>
      )}
    </div>
  );
}
