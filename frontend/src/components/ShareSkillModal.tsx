import { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Trash2, Clock, Eye } from 'lucide-react';
import { ShareGrantItem } from '@skillproof/shared';

interface ShareSkillModalProps {
  skillSlug: string;
  skillName: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export function ShareSkillModal({ skillSlug, skillName, onClose, onNotify }: ShareSkillModalProps) {
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [shares, setShares] = useState<ShareGrantItem[]>([]);
  const [sharesLoading, setSharesLoading] = useState<boolean>(true);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchShares = async () => {
    setSharesLoading(true);
    try {
      const res = await fetch('/api/shares');
      if (res.ok) {
        const body = await res.json();
        // Filter to current skill
        const filtered = (body.shares || []).filter((s: ShareGrantItem) => s.skillSlug === skillSlug);
        setShares(filtered);
      }
    } catch (err) {
      console.error('Failed fetching shares:', err);
    } finally {
      setSharesLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [skillSlug]);

  const handleCreateShare = async () => {
    setLoading(true);
    setNewShareUrl(null);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkillProof-Request': 'true',
        },
        body: JSON.stringify({ skillSlug, expiryDays }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewShareUrl(data.shareUrl);
        onNotify('Share link created successfully!');
        fetchShares();
      } else {
        const err = await res.json();
        onNotify(err.message || 'Failed creating share link');
      }
    } catch (err: any) {
      onNotify(err.message || 'Error generating share link');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShare = async (id: string) => {
    try {
      const res = await fetch(`/api/shares/${id}/revoke`, {
        method: 'POST',
        headers: {
          'X-SkillProof-Request': 'true',
        },
      });

      if (res.ok) {
        onNotify('Share link revoked immediately.');
        fetchShares();
      } else {
        onNotify('Failed to revoke share link');
      }
    } catch (err: any) {
      onNotify(err.message || 'Error revoking share');
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Share Capability Profile
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Revocable 256-bit cryptographically random tokenized link
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            Generate a targeted, revocable public link for <strong style={{ color: 'var(--text-primary)' }}>{skillName}</strong>. The recipient can inspect qualifying AST evidence and test scores without exposing your full account or other capabilities.
          </p>

          {/* Create Link Card */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Expiration Period</label>
              <select
                className="form-select"
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value, 10))}
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days (Default)</option>
                <option value={90}>90 Days</option>
                <option value={365}>1 Year</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateShare}
              disabled={loading}
              style={{ width: '100%', fontSize: '0.8125rem', padding: '0.55rem' }}
            >
              {loading ? 'Generating 256-bit Token...' : 'Create New Share Link'}
            </button>

            {/* Newly created link alert */}
            {newShareUrl && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-success-light)',
                  border: '1px solid var(--color-success-border)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Active Share Link Ready:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    readOnly
                    value={newShareUrl}
                    className="form-input"
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      padding: '0.4rem 0.6rem',
                      backgroundColor: 'var(--bg-card)',
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCopy(newShareUrl)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.4rem 0.75rem',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Share Grants */}
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Active & Historical Share Links
            </div>

            {sharesLoading ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading share links...</div>
            ) : shares.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                No share links created for this capability yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                {shares.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        className={`badge badge-${s.status === 'ACTIVE' ? 'success' : s.status === 'REVOKED' ? 'danger' : 'warning'}`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        {s.status}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> Expires: {new Date(s.expiresAt).toLocaleDateString()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} /> {s.viewCount} views
                      </span>
                    </div>

                    {s.status === 'ACTIVE' && (
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleRevokeShare(s.id)}
                      >
                        <Trash2 size={12} /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.8125rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
