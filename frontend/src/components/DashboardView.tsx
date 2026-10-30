import { useEffect, useState, useCallback } from 'react';
import {
  SkillCapabilitySummary,
  SkillSlug,
  SkillLevel,
  SKILL_SLUGS,
  SKILL_DEFINITIONS,
} from '@skillproof/shared';
import {
  CheckCircle,
  AlertTriangle,
  Award,
  Eye,
  FileCheck,
  Code2,
  Database,
  Shield,
  FileText,
  Layers,
  FlaskConical,
  Clock,
} from 'lucide-react';

interface CapabilitiesResponse {
  capabilities: SkillCapabilitySummary[];
  totalFlagsCount: number;
  blockingFlagsCount: number;
}

interface DashboardViewProps {
  user: {
    githubLogin: string;
    avatarUrl?: string;
    name?: string;
  } | null;
  onSelectSkill: (skillSlug: SkillSlug) => void;
  onNotify?: (msg: string) => void;
}

const DEFAULT_CAPABILITIES: SkillCapabilitySummary[] = SKILL_SLUGS.map((slug, idx) => ({
  slug,
  name: SKILL_DEFINITIONS[slug].name,
  description: SKILL_DEFINITIONS[slug].description,
  displayOrder: idx + 1,
  maxAttainableLevel: SKILL_DEFINITIONS[slug].maxAttainableLevel,
  currentLevel: 'CLAIMED' as SkillLevel,
  isClaimed: true,
  claimedAt: null,
  awardedAt: null,
  totalRecencyWeight: 0.0,
  qualifyingFindingsCount: 0,
  reasons: ['Self-claimed by developer'],
  missingRequirements: ['Requires repository scan with static detector matches'],
  nextAction: 'Import repository or connect GitHub account',
  limitations: [],
  flagsCount: 0,
}));

const CAPABILITY_CONFIG: Record<
  SkillSlug,
  {
    icon: typeof Code2;
    accentClass: string;
    accentColor: string;
    shortTitle: string;
    shortDesc: string;
  }
> = {
  'rest-controller-design': {
    icon: Code2,
    accentClass: 'card-accent-indigo',
    accentColor: '#6366F1',
    shortTitle: 'REST Controller Design',
    shortDesc: 'Build REST endpoints with proper HTTP verbs, params & status.',
  },
  'jpa-hibernate-persistence': {
    icon: Database,
    accentClass: 'card-accent-blue',
    accentColor: '#3B82F6',
    shortTitle: 'JPA & Hibernate',
    shortDesc: 'Map entities, repositories & use standard methods.',
  },
  'spring-security-configuration': {
    icon: Shield,
    accentClass: 'card-accent-emerald',
    accentColor: '#10B981',
    shortTitle: 'Security Configuration',
    shortDesc: 'Configure filters, auth rules & password encoding.',
  },
  'jwt-issuance-validation': {
    icon: FileText,
    accentClass: 'card-accent-amber',
    accentColor: '#F59E0B',
    shortTitle: 'JWT Issuance & Validation',
    shortDesc: 'Generate, validate & handle JWT tokens securely.',
  },
  'structured-exception-handling': {
    icon: AlertTriangle,
    accentClass: 'card-accent-pink',
    accentColor: '#EC4899',
    shortTitle: 'Exception Handling',
    shortDesc: 'Use @ControllerAdvice & custom exception types.',
  },
  'unit-tests-meaningful-assertions': {
    icon: FlaskConical,
    accentClass: 'card-accent-cyan',
    accentColor: '#06B6D4',
    shortTitle: 'Unit Tests',
    shortDesc: 'Write tests with JUnit, Mockito & verifying behavior.',
  },
  'transaction-management': {
    icon: Layers,
    accentClass: 'card-accent-indigo',
    accentColor: '#6366F1',
    shortTitle: 'Transaction Management',
    shortDesc: 'Use @Transactional & manage persistence operations.',
  },
  'input-validation': {
    icon: CheckCircle,
    accentClass: 'card-accent-blue',
    accentColor: '#3B82F6',
    shortTitle: 'Input Validation',
    shortDesc: 'Validate parameters & enforce constraints.',
  },
};

export function DashboardView({ user, onSelectSkill, onNotify: _onNotify }: DashboardViewProps) {
  const [data, setData] = useState<CapabilitiesResponse>({
    capabilities: DEFAULT_CAPABILITIES,
    totalFlagsCount: 0,
    blockingFlagsCount: 0,
  });

  const fetchCapabilities = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const res = await fetch('/api/capabilities');
      if (res.ok) {
        const json: CapabilitiesResponse = await res.json();
        setData(json);
      }
    } catch (err: any) {
      console.error('Failed to fetch capabilities:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  const capabilities = data?.capabilities ?? [];
  const verifiedCount = capabilities.filter((c) => c.currentLevel === 'VERIFIED').length;
  const supportedCount = capabilities.filter((c) => c.currentLevel === 'SUPPORTED').length;
  const observedCount = capabilities.filter((c) => c.currentLevel === 'OBSERVED').length;
  const claimedCount = capabilities.filter((c) => c.currentLevel === 'CLAIMED').length;

  const getLevelBadge = (level: SkillLevel) => {
    switch (level) {
      case 'VERIFIED':
        return <span className="badge-status-verified">Verified</span>;
      case 'SUPPORTED':
        return <span className="badge-status-supported">Supported</span>;
      case 'OBSERVED':
        return <span className="badge-status-observed">Observed</span>;
      case 'CLAIMED':
        return <span className="badge-status-claimed">Claimed</span>;
      default:
        return <span className="badge-status-unclaimed">Unclaimed</span>;
    }
  };

  return (
    <div>
      {/* 1. Hero Banner Matching Mockup */}
      <div className="capabilities-hero-banner">
        <div>
          <div className="hero-label">CAPABILITIES</div>
          <h1 className="hero-title">Developer Capability Verification</h1>
          <p className="hero-subtitle">8 core capabilities. Real evidence. Verified skills.</p>
        </div>

        <div className="hero-right-badge">
          <div className="hero-icon-pill">
            <Code2 size={22} />
          </div>
          <div className="hero-badge-tag">
            ✦ Your skills.<br />Backed by proof.
          </div>
        </div>
      </div>

      {/* 2. Summary Stat Bar Matching Mockup */}
      <div className="capabilities-summary-bar">
        {/* Total Circular Badge */}
        <div className="summary-circle-total">
          <div className="summary-circle-donut">8</div>
          <div className="summary-total-text">
            <span className="summary-total-title">Capabilities</span>
            <span className="summary-total-sub">Total available</span>
          </div>
        </div>

        {/* Verified */}
        <div className="summary-stat-group">
          <div className="summary-stat-icon-wrap">
            <CheckCircle size={18} color="#10B981" />
          </div>
          <div className="summary-stat-info">
            <div className="summary-stat-row">
              <span className="summary-stat-num">{verifiedCount}</span>
              <span className="summary-stat-label">Verified</span>
            </div>
            <span className="summary-stat-sub">With evidence</span>
          </div>
        </div>

        {/* Supported */}
        <div className="summary-stat-group">
          <div className="summary-stat-icon-wrap">
            <Award size={18} color="#8B5CF6" />
          </div>
          <div className="summary-stat-info">
            <div className="summary-stat-row">
              <span className="summary-stat-num">{supportedCount}</span>
              <span className="summary-stat-label">Supported</span>
            </div>
            <span className="summary-stat-sub">Partial evidence</span>
          </div>
        </div>

        {/* Observed */}
        <div className="summary-stat-group">
          <div className="summary-stat-icon-wrap">
            <Eye size={18} color="#3B82F6" />
          </div>
          <div className="summary-stat-info">
            <div className="summary-stat-row">
              <span className="summary-stat-num">{observedCount}</span>
              <span className="summary-stat-label">Observed</span>
            </div>
            <span className="summary-stat-sub">With activity</span>
          </div>
        </div>

        {/* Claimed */}
        <div className="summary-stat-group">
          <div className="summary-stat-icon-wrap">
            <FileCheck size={18} color="#F59E0B" />
          </div>
          <div className="summary-stat-info">
            <div className="summary-stat-row">
              <span className="summary-stat-num">{claimedCount > 0 ? claimedCount : 8}</span>
              <span className="summary-stat-label">Claimed</span>
            </div>
            <span className="summary-stat-sub">Needs evidence</span>
          </div>
        </div>

        {/* Next Step Promo Tile */}
        <div className="summary-next-step-box">
          <div className="next-step-icon">➔</div>
          <div className="next-step-content">
            <span className="next-step-title">Next Step</span>
            <span className="next-step-sub">Import evidence or declare self-claims to get started.</span>
          </div>
        </div>
      </div>

      {/* Anti-Gaming Alerts Banner (Disclosed transparently if any flags exist) */}
      {data && data.blockingFlagsCount > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-light)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>Anti-Gaming Notice: Evidence Exclusion Active (R4, R13, R14)</strong>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              {data.blockingFlagsCount} BLOCKING flag(s) detected. Repositories with unmodified forks or tutorial replication are excluded from capability score computation.
            </p>
          </div>
        </div>
      )}

      {/* 3. The 8 Capability Cards (4 Columns × 2 Rows Matching Mockup) */}
      <div className="grid-cards-exact">
        {capabilities.map((cap) => {
          const cfg = CAPABILITY_CONFIG[cap.slug] || {
            icon: Code2,
            accentClass: 'card-accent-indigo',
            accentColor: '#6366F1',
            shortTitle: cap.name,
            shortDesc: cap.description,
          };
          const IconComp = cfg.icon;

          return (
            <div key={cap.slug} className={`skill-card-exact ${cfg.accentClass}`}>
              <div>
                {/* Header: Icon + Number Pill on left, Status Badge on right */}
                <div className="card-header-exact">
                  <div className="card-header-left">
                    <IconComp size={16} color={cfg.accentColor} />
                    <span className="card-num-pill">{cap.displayOrder}</span>
                  </div>
                  {getLevelBadge(cap.currentLevel)}
                </div>

                {/* Title & Short Description */}
                <h3 className="card-title-exact">{cfg.shortTitle}</h3>
                <p className="card-desc-exact">{cfg.shortDesc}</p>
              </div>

              <div>
                {/* Metrics Box (Findings & Recency) */}
                <div className="card-metrics-box">
                  <div className="card-metric-item">
                    <FileText size={13} color="#94A3B8" />
                    <div className="card-metric-text">
                      <span className="card-metric-label">Findings</span>
                      <span className="card-metric-val">{cap.qualifyingFindingsCount}</span>
                    </div>
                  </div>

                  <div className="card-metric-item">
                    <Clock size={13} color="#94A3B8" />
                    <div className="card-metric-text">
                      <span className="card-metric-label">Recency</span>
                      <span className="card-metric-val">{cap.totalRecencyWeight.toFixed(2)} (12m)</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions: Add Evidence ➔ & Details ➔ */}
                <div className="card-footer-actions">
                  <button
                    className="btn-card-primary"
                    onClick={() => onSelectSkill(cap.slug)}
                    title={`Inspect and add evidence for ${cfg.shortTitle}`}
                  >
                    Add Evidence ➔
                  </button>

                  <button
                    className="btn-card-link"
                    onClick={() => onSelectSkill(cap.slug)}
                    title={`View evidence trail and code anchors for ${cfg.shortTitle}`}
                  >
                    Details ➔
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardView;
