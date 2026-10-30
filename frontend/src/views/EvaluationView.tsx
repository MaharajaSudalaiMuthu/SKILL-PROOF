import { useState } from 'react';
import { Download, Upload, BarChart3, CheckCircle, FileText, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { AgreementMetrics, ExpertRatingEntry, SkillLevel } from '@skillproof/shared';

interface EvaluationViewProps {
  onBack: () => void;
  onNotify: (msg: string) => void;
}

const SAMPLE_CSV = `subject_id,skill_slug,expert_level,confidence_1_to_5,notes
SUBJ_SAMPLE1,rest-controller-design,OBSERVED,5,Clean @RestController annotations
SUBJ_SAMPLE1,jpa-hibernate-persistence,SUPPORTED,4,Good scenario assessment
SUBJ_SAMPLE1,input-validation,VERIFIED,5,Passed practical coding challenge
SUBJ_SAMPLE2,rest-controller-design,OBSERVED,4,Validated HTTP verb usage
SUBJ_SAMPLE2,spring-security-configuration,CLAIMED,3,Self-reported claim`;

export function EvaluationView({ onBack, onNotify }: EvaluationViewProps) {
  const [csvInput, setCsvInput] = useState<string>(SAMPLE_CSV);
  const [metrics, setMetrics] = useState<AgreementMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/evaluation/export');
      if (!res.ok) throw new Error('Failed to export evaluation data');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skillproof-pilot-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Pseudonymized evaluation dataset exported successfully (Zero PII).');
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = `subject_id,skill_slug,expert_level,confidence_1_to_5,notes
SUBJ_EXAMPLE,rest-controller-design,OBSERVED,5,Demonstrated consistent @RestController and @GetMapping patterns
SUBJ_EXAMPLE,jpa-hibernate-persistence,SUPPORTED,4,Passed scenario assessment with clean entity mappings
SUBJ_EXAMPLE,jwt-issuance-validation,VERIFIED,5,Passed practical coding challenge test suite
`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pilot-evaluation-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseCsvToRatings = (csv: string): ExpertRatingEntry[] => {
    const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const startIndex = lines[0]?.toLowerCase().startsWith('subject') ? 1 : 0;
    const entries: ExpertRatingEntry[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i]?.split(',').map((p) => p.trim());
      if (parts && parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
        entries.push({
          subjectId: parts[0],
          skillSlug: parts[1] as any,
          expertLevel: parts[2].toUpperCase() as SkillLevel,
          confidence: parts[3] ? Number(parts[3]) : undefined,
          notes: parts[4] || undefined,
        });
      }
    }
    return entries;
  };

  const handleComputeAgreement = async () => {
    setLoading(true);
    setError(null);
    try {
      let ratings: ExpertRatingEntry[] = [];
      const trimmed = csvInput.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        ratings = JSON.parse(trimmed);
      } else {
        ratings = parseCsvToRatings(trimmed);
      }

      if (ratings.length === 0) {
        throw new Error('Please provide at least one valid rating row (subject_id, skill_slug, expert_level).');
      }

      const res = await fetch('/api/evaluation/agreement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ ratings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to compute agreement');
      }

      const data = await res.json();
      setMetrics(data.metrics);
      onNotify(`Agreement computed across ${data.metrics.totalPairs} evaluated pairs.`);
    } catch (err: any) {
      setError(err.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const getKappaInterpretation = (kappa: number) => {
    if (kappa >= 0.81) return { text: 'Almost Perfect', color: 'var(--color-success)' };
    if (kappa >= 0.61) return { text: 'Substantial Agreement', color: '#10b981' };
    if (kappa >= 0.41) return { text: 'Moderate Agreement', color: 'var(--color-primary)' };
    if (kappa >= 0.21) return { text: 'Fair Agreement', color: '#f59e0b' };
    return { text: 'Slight / Chance Agreement', color: '#ef4444' };
  };

  const ORDERED_LEVELS: SkillLevel[] = ['NONE', 'CLAIMED', 'OBSERVED', 'SUPPORTED', 'VERIFIED'];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
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
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Pilot Evaluation & Faculty Concordance (R26)
            </h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Empirical validation suite: pseudonymized data export, expert rating ingestion, and Cohen&apos;s Kappa concordance
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

      {error && (
        <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Dataset Export Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Download size={18} style={{ color: 'var(--color-primary)' }} />
          1. Pseudonymized Dataset Export (Zero PII Retention)
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
          Generates structured evaluation vectors across all 8 canonical Java & Spring Boot capabilities. Developer IDs are
          hashed deterministically via HMAC-SHA256 (<code className="code-tag">SUBJ_&lt;8hex&gt;</code>). GitHub logins, emails, repository URLs, commit SHAs, and IP addresses are completely scrubbed.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleDownloadExport}
            disabled={downloading}
          >
            {downloading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            Download Pseudonymized Dataset (JSON)
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadTemplate}
          >
            <FileText size={14} /> Download Blank CSV Template
          </button>
        </div>
      </div>

      {/* Ingestion & Rating Input Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Upload size={18} style={{ color: 'var(--color-success)' }} />
          2. Ingest Expert Human Ratings & Compute Concordance
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Paste ratings in CSV format (<code className="code-tag">subject_id,skill_slug,expert_level,confidence,notes</code>) or JSON array:
        </p>

        <textarea
          rows={6}
          value={csvInput}
          onChange={(e) => setCsvInput(e.target.value)}
          placeholder="subject_id,skill_slug,expert_level,confidence,notes"
          className="form-textarea"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            marginBottom: '0.75rem',
            lineHeight: 1.4,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCsvInput(SAMPLE_CSV)}
            style={{ fontSize: '0.8125rem' }}
          >
            Reset to Sample Template
          </button>

          <button
            className="btn btn-primary"
            onClick={handleComputeAgreement}
            disabled={loading}
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <BarChart3 size={14} />}
            Compute Inter-Rater Agreement
          </button>
        </div>
      </div>

      {/* Metrics & Concordance Report */}
      {metrics && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
              Statistical Concordance Report
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Evaluated Pairs: <strong style={{ color: 'var(--text-primary)' }}>{metrics.totalPairs}</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <span className="stat-card-label">Exact Percentage Agreement</span>
              <span className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
                {(metrics.percentAgreement * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unadjusted match ratio</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Cohen&apos;s Kappa (Unweighted)</span>
              <span className="stat-card-value" style={{ color: getKappaInterpretation(metrics.cohensKappa).color }}>
                {metrics.cohensKappa.toFixed(3)}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: getKappaInterpretation(metrics.cohensKappa).color }}>
                {getKappaInterpretation(metrics.cohensKappa).text}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Linear Weighted Kappa</span>
              <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
                {metrics.weightedKappaLinear.toFixed(3)}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Linear ordinal penalty</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Quadratic Weighted Kappa</span>
              <span className="stat-card-value" style={{ color: '#7c3aed' }}>
                {metrics.weightedKappaQuadratic.toFixed(3)}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quadratic distance penalty</span>
            </div>
          </div>

          {/* 5x5 Confusion Matrix */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              5x5 Capability Confusion Matrix (Rows = Platform Automated, Columns = Expert Human)
            </h4>
            <div className="table-wrapper">
              <table className="data-table" style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Platform \ Expert</th>
                    {ORDERED_LEVELS.map((lvl) => (
                      <th key={lvl}>{lvl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ORDERED_LEVELS.map((rowLevel) => (
                    <tr key={rowLevel}>
                      <td style={{ fontWeight: 600, textAlign: 'left' }}>
                        {rowLevel}
                      </td>
                      {ORDERED_LEVELS.map((colLevel) => {
                        const count = metrics.confusionMatrix[rowLevel]?.[colLevel] || 0;
                        const isDiagonal = rowLevel === colLevel;
                        return (
                          <td
                            key={colLevel}
                            style={{
                              fontWeight: count > 0 ? 700 : 400,
                              backgroundColor: isDiagonal && count > 0
                                ? 'var(--color-success-light)'
                                : count > 0
                                ? 'var(--color-primary-light)'
                                : undefined,
                              color: isDiagonal && count > 0 ? 'var(--color-success)' : undefined,
                            }}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
