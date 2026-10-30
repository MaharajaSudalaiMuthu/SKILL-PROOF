import { useEffect, useState, useCallback } from 'react';
import {
  SkillDetailResponse,
  SkillSlug,
  SkillLevel,
} from '@skillproof/shared';
import {
  ArrowLeft,
  CheckCircle,
  Award,
  Eye,
  FileCheck,
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  GitCommit,
  FileCode,
  ShieldAlert,
  Info,
  Clock,
  RefreshCw,
  Play,
  Share2,
  Shield,
} from 'lucide-react';
import { AssessmentRunnerModal } from './AssessmentRunnerModal.js';
import { ChallengeWorkspaceModal } from './ChallengeWorkspaceModal.js';
import { ShareSkillModal } from './ShareSkillModal.js';
import { CredentialModal } from './CredentialModal.js';


const SKILL_TO_CHALLENGE_MAP: Partial<Record<SkillSlug, { slug: string; name: string }>> = {
  'rest-controller-design': { slug: 'rest-api-secure-vault', name: 'Secure Secret Vault REST Service' },
  'spring-security-configuration': { slug: 'rest-api-secure-vault', name: 'Secure Secret Vault REST Service' },
  'jwt-issuance-validation': { slug: 'rest-api-secure-vault', name: 'Secure Secret Vault REST Service' },
  'input-validation': { slug: 'rest-api-secure-vault', name: 'Secure Secret Vault REST Service' },
  'jpa-hibernate-persistence': { slug: 'order-persistence-engine', name: 'Transactional Order Persistence Engine' },
  'transaction-management': { slug: 'order-persistence-engine', name: 'Transactional Order Persistence Engine' },
  'structured-exception-handling': { slug: 'order-persistence-engine', name: 'Transactional Order Persistence Engine' },
};

interface SkillDetailViewProps {
  skillSlug: SkillSlug;
  onBack: () => void;
  onNotify?: (msg: string) => void;
}

export function SkillDetailView({ skillSlug, onBack, onNotify }: SkillDetailViewProps) {
  const [data, setData] = useState<SkillDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState<boolean>(false);
  const [showChallengeModal, setShowChallengeModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showCredentialModal, setShowCredentialModal] = useState<boolean>(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/capabilities/${skillSlug}`);
      if (!res.ok) {
        throw new Error(`Failed to load skill details (${res.status})`);
      }
      const json: SkillDetailResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Failed to load skill details:', err);
      setError(err.message || 'Could not load capability details');
    } finally {
      setLoading(false);
    }
  }, [skillSlug]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const getLevelBadge = (level: SkillLevel) => {
    switch (level) {
      case 'VERIFIED':
        return (
          <span className="badge badge-level-verified" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
            <CheckCircle size={13} /> Verified Level
          </span>
        );
      case 'SUPPORTED':
        return (
          <span className="badge badge-level-supported" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
            <Award size={13} /> Supported Level
          </span>
        );
      case 'OBSERVED':
        return (
          <span className="badge badge-level-observed" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
            <Eye size={13} /> Observed Level
          </span>
        );
      case 'CLAIMED':
        return (
          <span className="badge badge-level-claimed" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
            <FileCheck size={13} /> Claimed Level
          </span>
        );
      default:
        return (
          <span className="badge badge-level-none" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}>
            <HelpCircle size={13} /> Unclaimed
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Gathering capability evidence trail and AST matches...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <AlertTriangle size={32} color="var(--color-danger)" style={{ margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--color-danger)', marginBottom: '1rem', fontWeight: 500 }}>{error || 'Capability not found'}</p>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={13} /> Back to Developer Profile
        </button>
      </div>
    );
  }

  const { summary, evidenceTrail, relevantFlags, reportLimitationNote } = data;

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> Back to Developer Profile
        </button>
      </div>

      {/* Skill Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span className="code-tag">CAPABILITY #{summary.displayOrder}</span>
              <span className="code-tag" style={{ color: 'var(--text-muted)' }}>{summary.slug}</span>
            </div>
            <h1 className="page-title" style={{ margin: '0 0 0.5rem' }}>{summary.name}</h1>
            <p className="section-subtitle" style={{ maxWidth: '850px', fontSize: '0.9375rem', lineHeight: 1.55 }}>
              {summary.description}
            </p>
          </div>
          <div>{getLevelBadge(summary.currentLevel)}</div>
        </div>

        {/* Level Limitations & Attainability Note */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.8125rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Max Attainable Level:</span>
            <div style={{ fontWeight: 600, color: summary.maxAttainableLevel === 'SUPPORTED' ? 'var(--color-warning)' : 'var(--text-primary)' }}>
              {summary.maxAttainableLevel}
              {summary.maxAttainableLevel === 'SUPPORTED' && ' (Capped per R11)'}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Declared Claim:</span>
            <div style={{ fontWeight: 600 }}>
              {summary.isClaimed ? (
                <span style={{ color: 'var(--color-success)' }}>
                  Yes {summary.claimedAt && `(${new Date(summary.claimedAt).toLocaleDateString()})`}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No self-reported claim</span>
              )}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Qualifying AST Findings:</span>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{summary.qualifyingFindingsCount} evidence items</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Recency Weight:</span>
            <div style={{ fontWeight: 600, color: summary.totalRecencyWeight >= 1.0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
              {summary.totalRecencyWeight.toFixed(2)} (decay threshold: 1.0)
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Reasons Awarded & Next Action / Missing Requirements */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Why this level was awarded */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <CheckCircle size={16} color="var(--color-success)" /> Why This Level Was Awarded
          </h3>
          {summary.reasons.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {summary.reasons.map((reason, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>
                  {reason}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No qualifying evidence or declared claims recorded yet.
            </p>
          )}
        </div>

        {/* Next Action & Missing Requirements */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Info size={16} color="var(--color-primary)" /> Next Actions & Criteria
          </h3>
          {summary.nextAction && (
            <div
              style={{
                backgroundColor: 'var(--color-primary-light)',
                border: '1px solid var(--color-primary-border)',
                padding: '0.65rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                marginBottom: '0.75rem',
                color: 'var(--text-primary)'
              }}
            >
              <strong style={{ color: 'var(--color-primary)' }}>Recommended Action:</strong> {summary.nextAction}
            </div>
          )}

          {summary.missingRequirements.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                CRITERIA TO ADVANCE:
              </div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {summary.missingRequirements.map((req, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.assessmentEligible && (
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAssessmentModal(true)}
                style={{ width: '100%' }}
              >
                <Play size={13} /> Take Scenario Assessment (Advance to Supported)
              </button>
            </div>
          )}

          {(data.challengeEligible || summary.currentLevel === 'SUPPORTED') && summary.maxAttainableLevel === 'VERIFIED' && SKILL_TO_CHALLENGE_MAP[skillSlug] && (
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowChallengeModal(true)}
                style={{ width: '100%', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
              >
                <Play size={13} /> Take Coding Challenge (Advance to Verified)
              </button>
            </div>
          )}

          {/* Share & Credential Actions (R16, R18) */}
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowShareModal(true)}
              style={{ flex: 1 }}
            >
              <Share2 size={13} /> Share Skill
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCredentialModal(true)}
              style={{ flex: 1, color: 'var(--color-primary)' }}
            >
              <Shield size={13} /> Credential Proof
            </button>
          </div>
        </div>
      </div>

      {/* Relevant Anti-Gaming Flags Disclosure */}
      {relevantFlags.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--color-warning-border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-warning)' }}>
            <ShieldAlert size={16} /> Anti-Gaming Disclosures ({relevantFlags.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {relevantFlags.map((flag, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: flag.severity === 'BLOCKING' ? 'var(--color-danger-light)' : 'var(--color-warning-light)',
                  border: `1px solid ${flag.severity === 'BLOCKING' ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
                  padding: '0.65rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ color: flag.severity === 'BLOCKING' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{flag.flagType}</strong>
                  <span
                    className={`badge ${flag.severity === 'BLOCKING' ? 'badge-danger' : 'badge-warning'}`}
                  >
                    {flag.severity}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{flag.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Trail Inspector (R20) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Evidence Trail & Code Anchors (R20)</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Deterministic JavaParser AST detector matches with confirmed porcelain git blame attribution
            </p>
          </div>
          <span className="badge badge-neutral">
            {evidenceTrail.length} AST finding{evidenceTrail.length === 1 ? '' : 's'}
          </span>
        </div>

        {evidenceTrail.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <FileCode size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p>No static evidence records found for this capability.</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Import a repository with Java code to begin automated pattern detection.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {evidenceTrail.map((ev) => (
              <div
                key={ev.id}
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.25rem',
                }}
              >
                {/* Header row: File path, Line range, GitHub blob link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 600 }}>{ev.repositoryFullName}</span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <GitCommit size={11} /> <code>{ev.commitSha.substring(0, 7)}</code>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      <code className="code-tag" style={{ color: 'var(--color-primary)' }}>{ev.filePath}:{ev.startLine}-{ev.endLine}</code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {ev.githubBlobUrl && (
                      <a
                        href={ev.githubBlobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={12} /> View on GitHub
                      </a>
                    )}
                  </div>
                </div>

                {/* Badges: Attribution, Validity, Recency, Detector */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.75rem' }}>
                  <span
                    className={`badge ${ev.attributionStatus === 'CONFIRMED' ? 'badge-success' : 'badge-danger'}`}
                  >
                    Attribution: {ev.attributionStatus}
                  </span>
                  <span
                    className={`badge ${ev.validityStatus === 'VALID' ? 'badge-info' : 'badge-danger'}`}
                  >
                    Status: {ev.validityStatus}
                  </span>
                  <span className="badge badge-neutral">
                    <Clock size={10} /> Recency: {ev.recencyWeight.toFixed(2)}
                  </span>
                  <span className="badge badge-neutral">
                    Detector: {ev.detectorName}
                  </span>
                </div>

                {/* Pattern Matched */}
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Matched AST Pattern:</strong>{' '}
                  <code className="code-tag">
                    {ev.matchedPattern}
                  </code>
                </div>

                {/* Transparent Limitations (R20 requirement) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div
                    style={{
                      backgroundColor: 'var(--color-success-light)',
                      border: '1px solid var(--color-success-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: '0.2rem' }}>
                      ✓ What this evidence shows:
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ev.whatThisShows || 'Demonstrates implementation of canonical syntactic patterns.'}
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--color-warning-light)',
                      border: '1px solid var(--color-warning-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '0.2rem' }}>
                      ⚠ What this evidence does NOT prove:
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ev.whatThisDoesNotProve || 'Does not guarantee high-concurrency safety or deep operational robustness.'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclosed Limitation Statement */}
      <div className="disclaimer-banner">
        <strong>Transparency Disclosure (R20):</strong> {reportLimitationNote}
      </div>

      {/* In-Browser Assessment Modal (R21) */}
      <AssessmentRunnerModal
        skillSlug={skillSlug}
        skillName={summary.name}
        isOpen={showAssessmentModal}
        onClose={() => setShowAssessmentModal(false)}
        onCompleted={(result) => {
          fetchDetail();
          if (result.passed) {
            onNotify?.(`Assessment passed (${result.score}%)! Capability promoted to SUPPORTED.`);
          }
        }}
      />

      {/* Practical Coding Challenge Modal (R21) */}
      {showChallengeModal && SKILL_TO_CHALLENGE_MAP[skillSlug] && (
        <ChallengeWorkspaceModal
          slug={SKILL_TO_CHALLENGE_MAP[skillSlug]!.slug}
          isOpen={showChallengeModal}
          onClose={() => setShowChallengeModal(false)}
          onCompleted={(result) => {
            fetchDetail();
            if (result.passed) {
              onNotify?.(`Practical challenge passed! Capability promoted to VERIFIED.`);
            } else {
              onNotify?.(`Challenge submitted: ${result.passedTests}/${result.totalTests} tests passed.`);
            }
          }}
        />
      )}

      {/* Share Skill Modal (R18) */}
      {showShareModal && (
        <ShareSkillModal
          skillSlug={skillSlug}
          skillName={summary.name}
          onClose={() => setShowShareModal(false)}
          onNotify={(msg) => onNotify?.(msg)}
        />
      )}

      {/* Verifiable Credential Modal (R16, R17) */}
      {showCredentialModal && (
        <CredentialModal
          skillSlug={skillSlug}
          skillName={summary.name}
          currentLevel={summary.currentLevel}
          onClose={() => setShowCredentialModal(false)}
          onNotify={(msg) => onNotify?.(msg)}
          onOpenVerify={(id) => {
            window.location.href = `/verify/${encodeURIComponent(id)}`;
          }}
        />
      )}
    </div>
  );
}

