import { useState, useEffect } from 'react';
import {
  ChallengeDetailResponse,
  ChallengeFile,
  ChallengeRunResult,
  SkillSlug,
} from '@skillproof/shared';
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  FileCode,
  Terminal,
  BookOpen,
  Award,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';

interface ChallengeWorkspaceModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: (result: ChallengeRunResult) => void;
}

export function ChallengeWorkspaceModal({
  slug,
  isOpen,
  onClose,
  onCompleted,
}: ChallengeWorkspaceModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeDetailResponse | null>(null);
  const [files, setFiles] = useState<ChallengeFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<ChallengeRunResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45 * 60);
  const [activeTab, setActiveTab] = useState<'instructions' | 'console'>('instructions');

  // Load challenge detail on mount / open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setResult(null);

    const loadChallenge = async () => {
      try {
        const res = await fetch(`/api/challenges/${slug}`, {
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Failed to load challenge (HTTP ${res.status})`);
        }

        const data: { challenge: ChallengeDetailResponse } = await res.json();
        if (isMounted) {
          setChallenge(data.challenge);
          setFiles(data.challenge.starterFiles.map((f) => ({ ...f })));
          setActiveFileIndex(0);
          setRemainingSeconds((data.challenge.timeLimitMinutes || 45) * 60);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    loadChallenge();

    return () => {
      isMounted = false;
    };
  }, [slug, isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || loading || result) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, loading, result]);

  const handleFileContentChange = (newContent: string) => {
    setFiles((prev) => {
      const copy = [...prev];
      copy[activeFileIndex] = {
        ...copy[activeFileIndex],
        content: newContent,
      };
      return copy;
    });
  };

  const handleResetCurrentFile = () => {
    if (!challenge) return;
    const starter = challenge.starterFiles[activeFileIndex];
    if (starter) {
      handleFileContentChange(starter.content);
    }
  };

  const getCsrfToken = (): string => {
    const match = document.cookie.match(new RegExp('(^| )skillproof_csrf=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  };

  const handleSubmit = async () => {
    if (submitting || !challenge) return;

    setSubmitting(true);
    setError(null);
    setActiveTab('console');

    try {
      const csrfToken = getCsrfToken();
      const res = await fetch(`/api/challenges/${slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          files: files.map((f) => ({ path: f.path, content: f.content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Submission failed with status ${res.status}`);
      }

      const runResult: ChallengeRunResult = await res.json();
      setResult(runResult);
      if (onCompleted) {
        onCompleted(runResult);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentFile = files[activeFileIndex];
  const fileName = currentFile ? currentFile.path.split('/').pop() : '';

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card challenge-modal-container"
        style={{
          width: '95vw',
          maxWidth: '1280px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FileCode size={22} color="#38bdf8" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                  {challenge?.title || 'Practical Coding Challenge'}
                </h2>
                {challenge?.passed && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                    }}
                  >
                    Passed Previously
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Isolated Sandbox Runner (Port 8081) • OpenJDK 11 • HMAC Verification
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: remainingSeconds < 300 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                color: remainingSeconds < 300 ? '#ef4444' : '#38bdf8',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #334155',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            >
              <Clock size={16} />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '6px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading coding challenge workspace...</p>
          </div>
        ) : error && !challenge ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Failed to load challenge</h3>
            <p style={{ color: '#94a3b8' }}>{error}</p>
            <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Column: Instructions & Documentation */}
            <div
              style={{
                width: '38%',
                borderRight: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0b1120',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #334155',
                  backgroundColor: '#1e293b',
                }}
              >
                <button
                  onClick={() => setActiveTab('instructions')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'instructions' ? '2px solid #38bdf8' : '2px solid transparent',
                    color: activeTab === 'instructions' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <BookOpen size={16} /> Instructions
                </button>
                <button
                  onClick={() => setActiveTab('console')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'console' ? '2px solid #38bdf8' : '2px solid transparent',
                    color: activeTab === 'console' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Terminal size={16} /> Sandbox Console {result && (result.passed ? '✓' : '✗')}
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                {activeTab === 'instructions' ? (
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#f8fafc' }}>
                      Challenge Specification
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                      {challenge?.description}
                    </p>

                    <div style={{ marginTop: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Mapped Capabilities
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {challenge?.mappedSkills.map((s) => (
                          <span
                            key={s}
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#38bdf8',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.75rem',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '1.5rem',
                        fontSize: '0.85rem',
                        color: '#cbd5e1',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6',
                        fontFamily: 'inherit',
                      }}
                    >
                      {challenge?.instructions}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#f8fafc' }}>
                      Execution & Grading Output
                    </h3>

                    {result ? (
                      <div>
                        {/* Result summary banner */}
                        <div
                          style={{
                            padding: '1rem',
                            borderRadius: '8px',
                            backgroundColor: result.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${result.passed ? '#10b981' : '#ef4444'}`,
                            marginBottom: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {result.passed ? (
                              <CheckCircle size={20} color="#10b981" />
                            ) : (
                              <XCircle size={20} color="#ef4444" />
                            )}
                            <strong style={{ color: result.passed ? '#10b981' : '#ef4444', fontSize: '0.95rem' }}>
                              {result.passed ? 'ALL TESTS PASSED' : 'CHALLENGE FAILED'}
                            </strong>
                          </div>
                          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                            <span>Tests Passed: <strong>{result.passedTests} / {result.totalTests}</strong></span>
                            <span style={{ margin: '0 0.75rem' }}>•</span>
                            <span>Execution Time: <strong>{result.executionTimeMs} ms</strong></span>
                          </div>

                          {/* Promotion Banner */}
                          {result.passed && result.promotedSkills && result.promotedSkills.length > 0 && (
                            <div
                              style={{
                                marginTop: '0.75rem',
                                paddingTop: '0.75rem',
                                borderTop: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                                <Award size={16} />
                                <strong style={{ fontSize: '0.85rem' }}>
                                  Promoted to VERIFIED Level!
                                </strong>
                              </div>
                              <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.8rem', color: '#a7f3d0' }}>
                                Verified credentials for the following capabilities are ready for issuance:
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {result.promotedSkills.map((slug: SkillSlug) => (
                                  <span
                                    key={slug}
                                    style={{
                                      backgroundColor: 'rgba(16, 185, 129, 0.25)',
                                      color: '#a7f3d0',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ✓ {slug}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Test Console Logs */}
                        <pre
                          style={{
                            backgroundColor: '#030712',
                            padding: '1rem',
                            borderRadius: '6px',
                            border: '1px solid #1e293b',
                            color: '#94a3b8',
                            fontSize: '0.78rem',
                            lineHeight: '1.4',
                            overflowX: 'auto',
                            maxHeight: '350px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          }}
                        >
                          {result.testOutput || 'No output recorded.'}
                        </pre>
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        Click "Run & Submit to Sandbox" below to compile your Java implementation and execute the hidden automated test suite.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Code Editor & Submission */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
              {/* File Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#1e293b',
                  borderBottom: '1px solid #334155',
                  overflowX: 'auto',
                  paddingLeft: '0.5rem',
                }}
              >
                {files.map((file, idx) => {
                  const base = file.path.split('/').pop();
                  const isActive = idx === activeFileIndex;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setActiveFileIndex(idx)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: isActive ? '#0f172a' : 'transparent',
                        border: 'none',
                        borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                        color: isActive ? '#f8fafc' : '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 600 : 400,
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <FileCode size={14} color={isActive ? '#38bdf8' : '#64748b'} />
                      {base}
                    </button>
                  );
                })}

                <div style={{ marginLeft: 'auto', paddingRight: '0.75rem' }}>
                  <button
                    onClick={handleResetCurrentFile}
                    title="Reset to starter file content"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>
              </div>

              {/* Editor Workspace */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <textarea
                  value={currentFile?.content || ''}
                  onChange={(e) => handleFileContentChange(e.target.value)}
                  spellCheck={false}
                  style={{
                    flex: 1,
                    width: '100%',
                    backgroundColor: '#090d16',
                    color: '#e2e8f0',
                    border: 'none',
                    outline: 'none',
                    padding: '1rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    resize: 'none',
                    tabSize: 4,
                  }}
                />
              </div>

              {/* Footer Controls */}
              <div
                style={{
                  padding: '0.85rem 1.5rem',
                  borderTop: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Editing: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{fileName}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {error && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                      {error}
                    </span>
                  )}

                  <button
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={handleSubmit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                    }}
                  >
                    <Play size={16} />
                    {submitting ? 'Compiling & Grading...' : 'Run & Submit to Sandbox'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
