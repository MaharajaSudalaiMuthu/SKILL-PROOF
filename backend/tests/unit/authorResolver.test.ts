import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { AuthorResolver } from '../../src/ingestion/authorResolver.js';
import { config } from '../../src/config/index.js';

describe('AuthorResolver (Unit)', () => {
  let resolver: AuthorResolver;
  const baseUrl = config.skillproof.github.apiBaseUrl;
  const repo = 'octocat/hello-world';
  const targetLogin = 'octocat';

  beforeEach(() => {
    resolver = new AuthorResolver();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should mark commit as CONFIRMED when GitHub author login matches target user', async () => {
    const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    nock(baseUrl)
      .get(`/repos/${repo}/commits/${sha}`)
      .reply(200, {
        sha,
        author: { login: 'octocat' },
      });

    const results = await resolver.resolveCommits(repo, [sha], 'mock_token', targetLogin);
    const resolved = results.get(sha);

    expect(resolved).toBeDefined();
    expect(resolved?.authorLogin).toBe('octocat');
    expect(resolved?.status).toBe('CONFIRMED');
  });

  it('should mark commit as OTHER when GitHub author login is a different user', async () => {
    const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    nock(baseUrl)
      .get(`/repos/${repo}/commits/${sha}`)
      .reply(200, {
        sha,
        author: { login: 'collaborator' },
      });

    const results = await resolver.resolveCommits(repo, [sha], 'mock_token', targetLogin);
    const resolved = results.get(sha);

    expect(resolved).toBeDefined();
    expect(resolved?.authorLogin).toBe('collaborator');
    expect(resolved?.status).toBe('OTHER');
  });

  it('should mark commit as UNCERTAIN when commit author has no GitHub login or returns 404', async () => {
    const sha = 'cccccccccccccccccccccccccccccccccccccccc';
    nock(baseUrl)
      .get(`/repos/${repo}/commits/${sha}`)
      .reply(200, {
        sha,
        author: null,
        committer: null,
      });

    const results = await resolver.resolveCommits(repo, [sha], 'mock_token', targetLogin);
    const resolved = results.get(sha);

    expect(resolved).toBeDefined();
    expect(resolved?.authorLogin).toBeNull();
    expect(resolved?.status).toBe('UNCERTAIN');
  });

  it('should use in-memory cache to avoid duplicate API requests for the same SHA', async () => {
    const sha = 'dddddddddddddddddddddddddddddddddddddddd';
    // Expect only 1 HTTP request
    const scope = nock(baseUrl)
      .get(`/repos/${repo}/commits/${sha}`)
      .once()
      .reply(200, {
        sha,
        author: { login: 'octocat' },
      });

    const results1 = await resolver.resolveCommits(repo, [sha], 'mock_token', targetLogin);
    expect(results1.get(sha)?.status).toBe('CONFIRMED');

    // Second call should hit cache and not make another HTTP request
    const results2 = await resolver.resolveCommits(repo, [sha], 'mock_token', targetLogin);
    expect(results2.get(sha)?.status).toBe('CONFIRMED');

    expect(scope.isDone()).toBe(true);
  });
});
