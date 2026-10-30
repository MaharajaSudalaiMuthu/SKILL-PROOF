import { useState, useEffect } from 'react';
import {
  RepoQuizStartResponse,
  RepoQuizQuestionClient,
  RepoQuizResultResponse,
} from '@skillproof/shared';
import {
  CheckCircle,
  XCircle,
  Award,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Code2,
  FileText,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

interface RepositoryQuizModalProps {
  repositoryId: string;
  repositoryName: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: (result: RepoQuizResultResponse) => void;
}

export function RepositoryQuizModal({
  repositoryId,
  repositoryName,
  isOpen,
  onClose,
  onCompleted,
}: RepositoryQuizModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<RepoQuizStartResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [result, setResult] = useState<RepoQuizResultResponse | null>(null);

  // Initialize or fetch latest/start quiz
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers(new Map());
    setCurrentIndex(0);
    setConfirmSubmitOpen(false);

    const startQuiz = async () => {
      try {
        const res = await fetch(`/api/repositories/${repositoryId}/quiz/start`, {
          method: 'POST',
          headers: {
            'X-SkillProof-Request': 'true',
          },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Could not initiate repository quiz.');
        }

        const data: RepoQuizStartResponse = await res.json();
        if (isMounted) {
          setQuizData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to start repository quiz.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    startQuiz();

    return () => {
      isMounted = false;
    };
  }, [isOpen, repositoryId]);

  if (!isOpen) return null;

  const questions: RepoQuizQuestionClient[] = quizData?.questions ?? [];
  const currentQ: RepoQuizQuestionClient | undefined = questions[currentIndex];
  const progressPercent = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const answeredCount = answers.size;

  const handleSelectOption = (index: number) => {
    if (!currentQ || submitting) return;
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentQ.id, index);
      return next;
    });
  };

  const handleSubmitQuiz = async () => {
    if (!quizData) return;
    setSubmitting(true);
    setError(null);

    const submissionPayload = {
      answers: Array.from(answers.entries()).map(([questionId, selectedOptionIndex]) => ({
        questionId,
        selectedOptionIndex,
      })),
    };

    try {
      const res = await fetch(`/api/repositories/${repositoryId}/quiz/${quizData.attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify(submissionPayload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Submission failed.');
      }

      const evalResult: RepoQuizResultResponse = await res.json();
      setResult(evalResult);
      setConfirmSubmitOpen(false);
      if (onCompleted) {
        onCompleted(evalResult);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakeQuiz = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setAnswers(new Map());
    setCurrentIndex(0);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/quiz/start`, {
        method: 'POST',
        headers: {
          'X-SkillProof-Request': 'true',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setQuizData(data);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5',
              }}
            >
              <HelpCircle size={22} />
            </div>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '2px' }}>
                Repository Knowledge Assessment
              </h3>
              <p className="card-subtitle" style={{ fontSize: '0.8125rem' }}>
                Personalized questions generated from actual AST & code findings in <strong>{repositoryName}</strong>
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '0.35rem 0.5rem', color: '#94A3B8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: '#4F46E5' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Analyzing Source Code & Generating Quiz...
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Extracting verified classes, methods, annotations, and test patterns from {repositoryName}.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                textAlign: 'center',
                margin: '1rem 0',
              }}
            >
              <AlertTriangle size={32} color="#EF4444" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ color: '#EF4444', marginBottom: '0.5rem', fontSize: '1rem' }}>
                Unable to Load Repository Assessment
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {error}
              </p>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {/* Results Screen */}
          {result && !loading && (
            <div>
              {/* Score Header Card */}
              <div
                style={{
                  background: result.passed
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.05) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%)',
                  border: `1.5px solid ${result.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  {result.passed ? (
                    <Award size={48} color="#10B981" />
                  ) : (
                    <AlertTriangle size={48} color="#F59E0B" />
                  )}
                </div>

                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {result.percentage}% Score ({result.correctCount} / {result.totalQuestions} Correct)
                </h2>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0.5rem 0 1rem' }}>
                  <span
                    className={result.passed ? 'badge-status-verified' : 'badge-status-claimed'}
                    style={{ fontSize: '0.85rem', padding: '0.25rem 0.75rem' }}
                  >
                    {result.passed ? 'Assessment Passed (≥ 70%)' : 'Needs Review (< 70%)'}
                  </span>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '600px', margin: '0 auto' }}>
                  {result.passed
                    ? `Excellent comprehension of ${repositoryName}'s architecture, Spring Boot conventions, and implementation details.`
                    : `Review the knowledge gaps below to reinforce understanding of patterns implemented in ${repositoryName}.`}
                </p>

                {/* Knowledge Gaps & Assessed Areas Pills */}
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {result.assessedCapabilities.map((area) => {
                    const isGap = result.knowledgeGaps.includes(area);
                    return (
                      <span
                        key={area}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                          backgroundColor: isGap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isGap ? '#EF4444' : '#10B981',
                          border: `1px solid ${isGap ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        }}
                      >
                        {isGap ? `⚠ Knowledge Gap: ${area}` : `✓ Mastered: ${area}`}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Question-by-Question Review */}
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Question-by-Question Code Review ({result.questions.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {result.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '1.25rem',
                      borderLeft: `4px solid ${q.isCorrect ? '#10B981' : '#EF4444'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Question {idx + 1} • {q.category}
                        </span>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {q.title}
                        </h4>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: q.isCorrect ? '#10B981' : '#EF4444',
                        }}
                      >
                        {q.isCorrect ? <CheckCircle size={15} /> : <XCircle size={15} />}
                        {q.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {q.question}
                    </p>

                    {/* Code Reference Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <FileText size={13} color="#4F46E5" />
                      <span>Code Reference:</span>
                      <code style={{ fontSize: '0.75rem', color: '#4F46E5', background: 'rgba(79, 70, 229, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                        {q.fileReference}
                      </code>
                    </div>

                    {/* Options Review */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      {q.options.map((opt, optIdx) => {
                        const isCorrectOption = optIdx === q.correctOptionIndex;
                        const isSelectedOption = optIdx === q.selectedOptionIndex;
                        let optBg = 'var(--bg-subtle)';
                        let optBorder = 'var(--border-color)';
                        let optColor = 'var(--text-secondary)';

                        if (isCorrectOption) {
                          optBg = 'rgba(16, 185, 129, 0.08)';
                          optBorder = '#10B981';
                          optColor = '#065F46';
                        } else if (isSelectedOption && !isCorrectOption) {
                          optBg = 'rgba(239, 68, 68, 0.08)';
                          optBorder = '#EF4444';
                          optColor = '#991B1B';
                        }

                        return (
                          <div
                            key={optIdx}
                            style={{
                              padding: '0.55rem 0.75rem',
                              borderRadius: '6px',
                              backgroundColor: optBg,
                              border: `1px solid ${optBorder}`,
                              color: optColor,
                              fontSize: '0.8125rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{opt}</span>
                            {isCorrectOption && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981' }}>
                                ✓ Correct Answer
                              </span>
                            )}
                            {isSelectedOption && !isCorrectOption && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#EF4444' }}>
                                ✕ Your Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Codebase Explanation */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        borderLeft: '3px solid #4F46E5',
                      }}
                    >
                      <strong style={{ color: '#4F46E5' }}>Source Explanation: </strong>
                      {q.explanation}
                    </div>
                  </div>
                ))}
              </div>

              {/* Results Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={handleRetakeQuiz}>
                  <RotateCcw size={14} /> Retake Assessment
                </button>
                <button className="btn btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Active Quiz Question Screen */}
          {quizData && !result && !loading && currentQ && (
            <div>
              {/* Progress Bar & Header */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Category: {currentQ.category}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {answeredCount} of {questions.length} answered
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(79, 70, 229, 0.12)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      backgroundColor: '#4F46E5',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {currentQ.title}
                </h3>

                <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
                  {currentQ.question}
                </p>

                {/* File Reference Pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(79, 70, 229, 0.06)',
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#4F46E5',
                  }}
                >
                  <Code2 size={14} />
                  <span>Verified Source Anchor: <code>{currentQ.fileReference}</code></span>
                </div>

                {currentQ.codeSnippet && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      border: '1px dashed var(--border-color)',
                    }}
                  >
                    Matched Pattern: {currentQ.codeSnippet}
                  </div>
                )}
              </div>

              {/* Four Selectable Answer Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                {currentQ.options.map((opt, idx) => {
                  const isSelected = answers.get(currentQ.id) === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.06)' : 'var(--bg-surface)',
                        border: isSelected ? '2px solid #4F46E5' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: isSelected ? '6px solid #4F46E5' : '2px solid #94A3B8',
                          backgroundColor: '#FFF',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '0.875rem', color: isSelected ? '#1E1B4B' : 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                        {opt}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="btn btn-ghost"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  style={{ fontSize: '0.85rem' }}
                >
                  <ArrowLeft size={15} /> Previous
                </button>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {currentIndex < questions.length - 1 ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <span>Next</span>
                      <ArrowRight size={15} />
                    </button>
                  ) : null}

                  <button
                    className="btn btn-primary"
                    onClick={() => setConfirmSubmitOpen(true)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <CheckCircle size={15} />
                    <span>Submit Assessment</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmSubmitOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  backgroundColor: '#FFF',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  maxWidth: '440px',
                  width: '90%',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                <HelpCircle size={40} color="#4F46E5" style={{ margin: '0 auto 0.75rem' }} />
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Submit Repository Assessment?
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
                  {answeredCount < questions.length && (
                    <span style={{ color: '#EF4444', display: 'block', marginTop: '0.25rem' }}>
                      Warning: Unanswered questions will be counted as incorrect.
                    </span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmSubmitOpen(false)}
                    disabled={submitting}
                  >
                    Review Answers
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Confirm & Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RepositoryQuizModal;
