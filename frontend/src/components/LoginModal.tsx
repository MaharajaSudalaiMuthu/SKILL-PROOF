import { useState } from 'react';
import { Shield, UserPlus, Sparkles, X, Github, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a GitHub username or developer handle.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to sign in.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong during sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setLoading(true);
    window.location.href = '/api/auth/dev-login';
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.125rem' }}>Developer Sign In</h3>
              <p className="card-subtitle">Create a new account or log into your capability workspace</p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '0.25rem 0.5rem', color: '#94A3B8' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                GitHub Username / Handle <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  @
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '1.75rem' }}
                  placeholder="e.g. torvalds or your_handle"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                If you are new, this creates your developer account and profile instantly.
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Display Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              disabled={loading}
            >
              <UserPlus size={15} />
              <span>{loading ? 'Signing in...' : 'Sign In / Create Account'}</span>
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1.25rem 0',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
            <span style={{ padding: '0 0.75rem' }}>OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDevLogin}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', borderColor: '#4F46E5', color: '#4F46E5' }}
            >
              <Sparkles size={15} color="#4F46E5" />
              <span>⚡ One-Click Demo Account (@dev_expert)</span>
            </button>

            <a
              href="/api/auth/github"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border-color)' }}
            >
              <Github size={15} />
              <span>GitHub OAuth Web Authorization</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
