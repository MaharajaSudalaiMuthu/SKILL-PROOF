import { useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  id: string;
  githubUserId: number;
  githubLogin: string;
  name?: string;
  avatarUrl?: string;
  consentGiven: boolean;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        setUser(null);
        setError(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: UserProfile = await res.json();
      setUser(data);
      setError(null);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-SkillProof-Request': 'true',
        },
      });
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return {
    user,
    loading,
    error,
    refreshUser: fetchCurrentUser,
    logout,
  };
}
