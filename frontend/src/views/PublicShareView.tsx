import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, ExternalLink, FileCode2, ArrowLeft } from 'lucide-react';
import { SharedSkillViewResponse } from '@skillproof/shared';

interface PublicShareViewProps {
  token: string;
  onHome?: () => void;
}

export function PublicShareView({ token, onHome }: PublicShareViewProps) {
  const [data, setData] = useState<SharedSkillViewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function fetchShare() {
      setLoading(true);
      setErrorStatus(null);
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(token)}`);
        if (res.ok) {
          const body: SharedSkillViewResponse = await res.json();
          setData(body);
        } else {
          setErrorStatus(res.status);
          const errBody = await res.json().catch(() => ({}));
          setErrorMessage(errBody.message || 'Share link is invalid or unavailable');
        }
      } catch (err: any) {
        setErrorStatus(500);
        setErrorMessage(err.message || 'Network error connecting to SkillProof');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchShare();
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{ maxWidth: '850px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Retrieving shared capability profile...
        </div>
      </div>
    );
  }

  if (errorStatus || !data) {
    return (
      <div style={{ maxWidth: '650px', margin: '4rem auto', padding: '2rem' }}>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            border: `1px solid ${errorStatus === 410 ? 'var(--color-danger)' : 'var(--border-color)'}`,
          }}
        >
          {errorStatus === 410 ? (
            <XCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
          ) : (
            <AlertTriangle size={48} style={{ color: 'var(--color-warning)', margin: '0 auto 1rem' }} />
          )}

          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {errorStatus === 410
              ? 'Share Link Inactive'
              : errorStatus === 404
              ? 'Share Link Not Found'
              : 'Unable to Load Shared Profile'}
          </h2>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {errorMessage}
          </p>

          {onHome && (
            <button className="btn btn-primary" onClick={onHome} style={{ fontSize: '0.85rem' }}>
              Return to SkillProof
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header Bar */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                Verified Capability Profile
              </h1>
              <span className="badge badge-success">
                Public Share
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Evidence-backed developer skill verification issued by SkillProof
            </p>
          </div>
        </div>

        {onHome && (
          <button
            className="btn btn-secondary"
            onClick={onHome}
            style={{ fontSize: '0.8125rem' }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        )}
      </div>

      {/* Main Capability Hero Card */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              {data.category}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              {data.skillName}
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Developer: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>@{data.developerHandle}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Verified Level
            </div>
            <span
              className={`badge badge-level-${data.level.toLowerCase()}`}
              style={{ fontSize: '0.9375rem', padding: '0.35rem 0.85rem', fontWeight: 700 }}
            >
              {data.level} Level
            </span>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '2rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <div>Evaluated: <strong style={{ color: 'var(--text-primary)' }}>{new Date(data.evaluatedAt).toLocaleDateString()}</strong></div>
          <div>Link Expires: <strong style={{ color: 'var(--text-primary)' }}>{new Date(data.expiresAt).toLocaleDateString()}</strong></div>
        </div>
      </div>

      {/* Limitation Notice Banner */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-primary-light)',
          border: '1px solid var(--color-primary-border)',
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <Shield size={18} style={{ flexShrink: 0 }} />
        <div>{data.limitationNotice}</div>
      </div>

      {/* Supporting Evidence Records */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
          Qualifying Code Evidence Trail ({data.evidence.length})
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          AST syntax matches with confirmed line-level git authorship from public repositories
        </p>

        {data.evidence.length === 0 ? (
          <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
            No static code evidence records linked to this capability share.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.evidence.map((ev, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <FileCode2 size={16} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{ev.filePath}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      #L{ev.startLine}-L{ev.endLine}
                    </span>
                  </div>

                  {ev.githubBlobUrl && (
                    <a
                      href={ev.githubBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Inspect Source <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  <strong>Pattern:</strong> <code className="code-tag">{ev.matchedPattern}</code>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem' }}>
                  <div>Detector: {ev.detectorName}</div>
                  <div>Commit: <code className="code-tag">{ev.commitSha.slice(0, 7)}</code></div>
                  <div>Date: {new Date(ev.commitDate).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anti-Gaming Verification Checks */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Anti-Gaming Integrity Checks
        </h3>
        {data.flags.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.8125rem', fontWeight: 500 }}>
            <CheckCircle size={16} /> All anti-gaming checks passed (no tutorial plagiarism, unmodified forks, or unconfirmed authorship).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.flags.map((f, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-warning-light)',
                  border: '1px solid var(--color-warning-border)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-warning)',
                }}
              >
                <AlertTriangle size={14} />
                <span>
                  <strong>{f.type}</strong> ({f.severity}): {f.explanation}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
