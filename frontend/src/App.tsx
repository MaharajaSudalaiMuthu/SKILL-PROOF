import { useEffect, useState } from 'react';
import { SkillSlug } from '@skillproof/shared';
import {
  Shield,
  CheckCircle,
  RefreshCw,
  LogOut,
  FolderGit2,
  Lock,
  BarChart3,
  LayoutGrid,
  Settings,
  Code2,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth.js';
import { ConsentModal } from './components/ConsentModal.js';
import { LoginModal } from './components/LoginModal.js';
import { RepositoriesView } from './components/RepositoriesView.js';
import { DashboardView } from './components/DashboardView.js';
import { SkillDetailView } from './components/SkillDetailView.js';
import { PublicVerifyView } from './views/PublicVerifyView.js';
import { PublicShareView } from './views/PublicShareView.js';
import { PrivacySettingsView } from './views/PrivacySettingsView.js';
import { EvaluationView } from './views/EvaluationView.js';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    readyState: number;
  };
  edition: string;
}

export function App() {
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'capabilities' | 'evidence' | 'credentials' | 'settings'>('capabilities');
  const [settingsSubTab, setSettingsSubTab] = useState<'privacy' | 'evaluation'>('privacy');
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<SkillSlug | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<string>(window.location.pathname);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error('Failed to connect to health endpoint:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Public Shared Skill Route (R18)
  if (routePath.startsWith('/shared/')) {
    const shareToken = routePath.replace('/shared/', '');
    return (
      <div className="container">
        <PublicShareView
          token={shareToken}
          onHome={() => {
            window.history.pushState({}, '', '/');
            setRoutePath('/');
          }}
        />
      </div>
    );
  }

  // Public Credential Verification Route (R16, R17)
  if (routePath.startsWith('/verify')) {
    const credentialId = routePath.startsWith('/verify/') && routePath !== '/verify/'
      ? decodeURIComponent(routePath.replace('/verify/', ''))
      : undefined;
    return (
      <div className="container">
        <PublicVerifyView
          initialCredentialId={credentialId}
          onHome={() => {
            window.history.pushState({}, '', '/');
            setRoutePath('/');
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Top Thin Institutional Ribbon */}
      <div className="disclaimer-banner">
        <div>
          <strong>V.S.B. Engineering College, Karur</strong> — Dept. of CCE
          <span style={{ margin: '0 8px', opacity: 0.4 }}>•</span>
          <em>Static analysis cannot capture overall design quality; capability levels describe deterministic evidence strength.</em>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {healthLoading ? (
            <span className="badge badge-warning">Checking...</span>
          ) : health && health.status === 'UP' ? (
            <span className="badge badge-success" title="MongoDB 8.0 Active">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Engine Online
            </span>
          ) : (
            <span className="badge badge-danger">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              Engine Offline
            </span>
          )}
        </div>
      </div>

      {/* Top Navbar (Matching Exact Mockup) */}
      <nav className="navbar">
        <div className="navbar-inner">
          {/* Brand Logo & Title on Left */}
          <div className="navbar-brand">
            <div className="navbar-logo-icon">
              <Shield size={18} />
            </div>
            <div>
              <div className="navbar-title">SkillProof</div>
              <div className="navbar-subtitle">Developer Capability Verification Platform</div>
            </div>
          </div>

          {/* Right Action Controls Matching Mockup */}
          <div className="navbar-actions">
            {/* Verify Credentials Button */}
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedSkillSlug(null);
                setActiveTab('credentials');
              }}
              title="Verify Ed25519 Cryptographic Credentials"
              style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}
            >
              <Shield size={14} style={{ color: '#4F46E5' }} />
              <span>Verify Credentials</span>
            </button>

            {/* Sync Button */}
            <button
              className="btn btn-ghost"
              onClick={() => {
                fetchHealth();
                refreshUser();
                setNotification('Capabilities and session synchronized.');
              }}
              title="Synchronize session and capabilities"
              style={{ fontSize: '13px' }}
            >
              <RefreshCw size={13} />
              <span>Sync</span>
            </button>

            {/* User Profile Badge Pill */}
            {authLoading ? (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>
            ) : user ? (
              <div className="user-badge-pill">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.githubLogin}
                    style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                  />
                ) : (
                  <div className="user-avatar-circle">
                    {user.githubLogin.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                    @{user.githubLogin}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    Active
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setLoginModalOpen(true)}
                  style={{
                    fontSize: '12.5px',
                    padding: '0.42rem 0.85rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title="Sign In or Create a Developer Account"
                >
                  <UserPlus size={14} />
                  <span>Sign In / Create Account</span>
                </button>

                <div
                  className="user-badge-pill"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setLoginModalOpen(true)}
                  title="Click to sign in or switch account"
                >
                  <div className="user-avatar-circle">DE</div>
                  <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                      @dev_expert
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      Demo Ready
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Two-Column Layout (Sidebar + Main Content Matching Mockup) */}
      <div className="app-layout-body">
        {/* Left Sidebar Navigation */}
        <aside className="app-sidebar">
          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeTab === 'capabilities' && !selectedSkillSlug ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('capabilities');
                setSelectedSkillSlug(null);
              }}
            >
              <LayoutGrid size={17} />
              <span>Capabilities</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'evidence' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('evidence');
                setSelectedSkillSlug(null);
              }}
            >
              <FolderGit2 size={17} />
              <span>Evidence</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'credentials' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('credentials');
                setSelectedSkillSlug(null);
              }}
            >
              <Shield size={17} />
              <span>Credentials</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setSelectedSkillSlug(null);
              }}
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>
          </nav>

          {/* Sidebar Promo Card Matching Mockup */}
          <div className="sidebar-promo-card">
            <div className="sidebar-promo-top">
              <div className="sidebar-promo-icon">
                <Code2 size={15} />
              </div>
              <ArrowRight size={14} color="#3B82F6" />
            </div>
            <div className="sidebar-promo-title">Build Trust. Show What You Can Do.</div>
            <div className="sidebar-promo-desc">
              SkillProof helps you verify your developer capabilities with real evidence.
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="app-main-content">
          {/* Login / Account Creation Modal */}
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onSuccess={() => {
              refreshUser();
              setNotification('Welcome! Successfully signed in.');
            }}
          />

          {/* Consent Modal Overlay */}
          {user && !user.consentGiven && (
            <ConsentModal
              isOpen={true}
              onConsentGranted={() => {
                refreshUser();
              }}
            />
          )}

          {/* Notification Toast */}
          {notification && (
            <div
              style={{
                backgroundColor: 'var(--color-success-light)',
                border: '1px solid var(--color-success-border)',
                color: 'var(--color-success)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.875rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} />
                <span>{notification}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Conditional View Rendering */}
          {selectedSkillSlug ? (
            <SkillDetailView
              skillSlug={selectedSkillSlug}
              onBack={() => setSelectedSkillSlug(null)}
              onNotify={(msg) => setNotification(msg)}
            />
          ) : activeTab === 'capabilities' ? (
            <DashboardView
              user={user}
              onSelectSkill={(slug) => setSelectedSkillSlug(slug)}
              onNotify={(msg) => setNotification(msg)}
            />
          ) : activeTab === 'evidence' ? (
            <RepositoriesView onNotify={(msg) => setNotification(msg)} />
          ) : activeTab === 'credentials' ? (
            <PublicVerifyView
              onHome={() => {
                setActiveTab('capabilities');
                setSelectedSkillSlug(null);
              }}
            />
          ) : (
            <div>
              {/* Settings Sub-Tabs (Privacy & Pilot Evaluation) */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button
                  className={`btn ${settingsSubTab === 'privacy' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsSubTab('privacy')}
                >
                  <Lock size={14} /> Privacy & GDPR Erasure (R19)
                </button>
                <button
                  className={`btn ${settingsSubTab === 'evaluation' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSettingsSubTab('evaluation')}
                >
                  <BarChart3 size={14} /> Pilot Evaluation & Concordance (R26)
                </button>
              </div>

              {settingsSubTab === 'privacy' ? (
                <PrivacySettingsView
                  onBack={() => setActiveTab('capabilities')}
                  onNotify={(msg) => setNotification(msg)}
                  onAccountDeleted={() => {
                    refreshUser();
                    setActiveTab('capabilities');
                  }}
                />
              ) : (
                <EvaluationView
                  onBack={() => setActiveTab('capabilities')}
                  onNotify={(msg) => setNotification(msg)}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
