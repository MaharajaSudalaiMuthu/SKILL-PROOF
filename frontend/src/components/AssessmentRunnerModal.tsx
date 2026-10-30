import { useState, useEffect } from 'react';
import {
  SkillSlug,
  AssessmentAttemptStartResponse,
  AssessmentQuestionClientView,
  AssessmentResultResponse,
} from '@skillproof/shared';
import {
  Clock,
  CheckCircle,
  XCircle,
  Award,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Code2,
} from 'lucide-react';

interface AssessmentRunnerModalProps {
  skillSlug: SkillSlug;
  skillName: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (result: AssessmentResultResponse) => void;
}

export function AssessmentRunnerModal({
  skillSlug,
  skillName,
  isOpen,
  onClose,
  onCompleted,
}: AssessmentRunnerModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttemptStartResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<AssessmentResultResponse | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15 * 60);

  // 1. Start or resume attempt when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers(new Map());
    setCurrentIndex(0);

    const startAssessment = async () => {
      try {
        const res = await fetch(`/api/assessments/${skillSlug}/start`, {
          method: 'POST',
          headers: {
            'X-SkillProof-Request': 'true',
          },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Could not start assessment.');
        }

        const data: AssessmentAttemptStartResponse = await res.json();
        if (isMounted) {
          setAttempt(data);
          const expiryTime = new Date(data.expiresAt).getTime();
          const secondsLeft = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
          setRemainingSeconds(secondsLeft);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to start assessment.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    startAssessment();

    return () => {
      isMounted = false;
    };
  }, [isOpen, skillSlug]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!attempt || result || remainingSeconds <= 0) return;

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
  }, [attempt, result, remainingSeconds]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, optionIndex);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!attempt) return;

    setSubmitting(true);
    setError(null);

    const formattedAnswers = attempt.questions.map((q) => ({
      questionId: q.questionId,
      selectedOptionIndex: answers.get(q.questionId) ?? -1,
    }));

    try {
      const res = await fetch(`/api/assessments/${attempt.attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Submission failed.');
      }

      const resData: AssessmentResultResponse = await res.json();
      setResult(resData);
      onCompleted(resData);
    } catch (err: any) {
      setError(err.message || 'Failed to submit answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const questions: AssessmentQuestionClientView[] = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.length > 0 && questions.every((q) => answers.has(q.questionId));

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '820px' }}>
        {/* Header Row */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="code-tag" style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                Scenario-Based Assessment (R7, R8)
              </span>
            </div>
            <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{skillName}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Pass threshold: $\ge 66\%$ ($\ge 2$ of 3 questions) to advance to Supported level.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {attempt && !result && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: remainingSeconds < 120 ? 'var(--color-danger-light)' : 'var(--bg-subtle)',
                  color: remainingSeconds < 120 ? 'var(--color-danger)' : 'var(--text-primary)',
                  border: `1px solid ${remainingSeconds < 120 ? 'var(--color-danger-border)' : 'var(--border-color)'}`,
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                <Clock size={15} />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            )}
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">


        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading scenario assessment questions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1rem',
              color: 'var(--color-danger)',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <AlertTriangle size={18} /> {error}
            </div>
          </div>
        )}

        {/* In-Progress Assessment Questions */}
        {!loading && !result && currentQuestion && (
          <div>
            {/* Progress Bar & Question Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.questionId}
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: answers.has(q.questionId)
                        ? 'var(--color-primary)'
                        : idx === currentIndex
                        ? 'var(--color-primary-light)'
                        : 'var(--bg-subtle)',
                      border: `1px solid ${idx === currentIndex ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      color: answers.has(q.questionId) ? '#ffffff' : idx === currentIndex ? 'var(--color-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Question Title & Scenario */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {currentQuestion.title}
              </h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                {currentQuestion.scenario}
              </p>

              {/* Code Snippet Block (if provided) */}
              {currentQuestion.codeSnippet && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                    <Code2 size={12} /> Production Context Snippet:
                  </div>
                  <pre
                    style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                      color: '#38bdf8',
                      lineHeight: 1.5,
                    }}
                  >
                    {currentQuestion.codeSnippet}
                  </pre>
                </div>
              )}
            </div>

            {/* 4 Options Radio List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.75rem' }}>
              {currentQuestion.options.map((optionText, optIdx) => {
                const isSelected = answers.get(currentQuestion.questionId) === optIdx;
                return (
                  <div
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQuestion.questionId, optIdx)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.06)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '0.875rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'var(--shadow-xs)',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                          }}
                        />
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {optionText}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation & Submit Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-primary)' }}
              >
                <ArrowLeft size={14} /> Previous
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {currentIndex < questions.length - 1 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      backgroundColor: allAnswered ? 'var(--color-success)' : 'var(--color-primary)',
                      padding: '0.5rem 1.25rem',
                      fontWeight: 600,
                    }}
                  >
                    {submitting ? 'Scoring Answers...' : 'Submit Assessment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results & Rubric View (Post-Submission) */}
        {result && (
          <div>
            <div
              style={{
                backgroundColor: result.passed ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                border: `1px solid ${result.passed ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                textAlign: 'center',
                marginBottom: '1.5rem',
              }}
            >
              {result.passed ? (
                <>
                  <Award size={44} color="var(--color-success)" style={{ margin: '0 auto 0.5rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', margin: '0 0 0.25rem 0' }}>
                    Assessment Passed! Score: {result.score}%
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                    You correctly answered {result.correctCount} of {result.totalQuestions} questions ($\ge 66\%$).
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 600, marginTop: '0.35rem' }}>
                    Capability level successfully promoted to SUPPORTED!
                  </p>
                </>
              ) : (
                <>
                  <XCircle size={44} color="var(--color-danger)" style={{ margin: '0 auto 0.5rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-danger)', margin: '0 0 0.25rem 0' }}>
                    Assessment Not Passed. Score: {result.score}%
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                    You correctly answered {result.correctCount} of {result.totalQuestions} questions. A score of $\ge 66\%$ is required to attain the Supported level.
                  </p>
                </>
              )}
            </div>

            {/* Detailed Rubric Breakdown per Question */}
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
              Rubric & Detailed Explanations
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
              {result.questions.map((q, idx) => (
                <div
                  key={q.questionId}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${q.isCorrect ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1.125rem',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      QUESTION #{idx + 1}
                    </span>
                    {q.isCorrect ? (
                      <span className="badge badge-success" style={{ gap: '4px' }}>
                        <CheckCircle size={12} /> Correct
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ gap: '4px' }}>
                        <XCircle size={12} /> Incorrect
                      </span>
                    )}
                  </div>

                  <h5 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {q.title}
                  </h5>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                    {q.scenario}
                  </p>

                  <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Your Choice: </span>
                    <strong style={{ color: q.isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {q.selectedOptionIndex >= 0 ? q.options[q.selectedOptionIndex] : 'No answer selected'}
                    </strong>
                  </div>

                  {!q.isCorrect && (
                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Correct Choice: </span>
                      <strong style={{ color: 'var(--color-success)' }}>{q.options[q.correctOptionIndex]}</strong>
                    </div>
                  )}

                  <div
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      marginTop: '0.5rem',
                    }}
                  >
                    <strong style={{ color: 'var(--color-primary)' }}>Technical Rubric Rationale: </strong>
                    {q.rubricExplanation}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.5rem 1.5rem' }}>
                Done / Return to Profile
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
