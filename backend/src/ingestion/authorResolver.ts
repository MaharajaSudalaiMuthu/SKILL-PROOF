import { AttributionStatus } from '@skillproof/shared';
import { config } from '../config/index.js';
import { logger } from '../middleware/pinoLogger.js';

export interface ResolvedAuthor {
  sha: string;
  authorLogin: string | null;
  status: AttributionStatus;
}

export class AuthorResolver {
  private cache = new Map<string, { authorLogin: string | null; status: AttributionStatus }>();
  private readonly maxShas: number;
  private readonly apiBaseUrl: string;
  private readonly rateLimitBackoffMs: number;

  constructor() {
    this.maxShas = config.skillproof.github.maxShasResolved;
    this.apiBaseUrl = config.skillproof.github.apiBaseUrl;
    this.rateLimitBackoffMs = config.skillproof.github.rateLimitBackoffMs;
  }

  /**
   * Resolves a collection of commit SHAs to GitHub logins and attribution statuses.
   */
  async resolveCommits(
    repoFullName: string,
    shas: string[],
    userGithubToken: string | null,
    targetUserLogin: string
  ): Promise<Map<string, { authorLogin: string | null; status: AttributionStatus }>> {
    const results = new Map<string, { authorLogin: string | null; status: AttributionStatus }>();
    let apiCallCount = 0;

    for (const sha of shas) {
      const cacheKey = `${repoFullName}:${targetUserLogin}:${sha}`;

      // 1. Check in-memory cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        results.set(sha, cached);
        continue;
      }

      // 2. Check resolution cap
      if (apiCallCount >= this.maxShas) {
        logger.warn(
          { repoFullName, sha, cap: this.maxShas },
          'Max commit SHA resolution cap reached. Marking remaining commits as UNCERTAIN.'
        );
        const fallback = { authorLogin: null, status: 'UNCERTAIN' as const };
        this.cache.set(cacheKey, fallback);
        results.set(sha, fallback);
        continue;
      }

      // 3. Resolve via GitHub Commits API
      apiCallCount++;
      const resolved = await this.fetchCommitAuthor(repoFullName, sha, userGithubToken, targetUserLogin);
      this.cache.set(cacheKey, resolved);
      results.set(sha, resolved);
    }

    return results;
  }

  private async fetchCommitAuthor(
    repoFullName: string,
    sha: string,
    token: string | null,
    targetUserLogin: string,
    attempt = 1
  ): Promise<{ authorLogin: string | null; status: AttributionStatus }> {
    const url = `${this.apiBaseUrl}/repos/${repoFullName}/commits/${sha}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SkillProof-Authorship-Resolver',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 200) {
        const body = (await response.json()) as {
          author?: { login?: string } | null;
          committer?: { login?: string } | null;
        };

        const resolvedLogin = body.author?.login ?? body.committer?.login ?? null;

        if (!resolvedLogin) {
          return { authorLogin: null, status: 'UNCERTAIN' };
        }

        const isUser = resolvedLogin.toLowerCase() === targetUserLogin.toLowerCase();
        return {
          authorLogin: resolvedLogin,
          status: isUser ? 'CONFIRMED' : 'OTHER',
        };
      }

      if (response.status === 404) {
        return { authorLogin: null, status: 'UNCERTAIN' };
      }

      if ((response.status === 403 || response.status === 429) && attempt === 1) {
        logger.warn({ url, status: response.status }, 'GitHub rate limit encountered, backing off...');
        await new Promise((r) => setTimeout(r, this.rateLimitBackoffMs));
        return this.fetchCommitAuthor(repoFullName, sha, token, targetUserLogin, 2);
      }

      logger.warn({ url, status: response.status }, 'GitHub commits API returned non-200 status.');
      return { authorLogin: null, status: 'UNCERTAIN' };
    } catch (err) {
      logger.warn({ url, err }, 'Failed to fetch commit author from GitHub API.');
      return { authorLogin: null, status: 'UNCERTAIN' };
    }
  }

  /**
   * Clears internal resolver cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
