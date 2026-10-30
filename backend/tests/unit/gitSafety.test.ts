import { describe, it, expect } from 'vitest';
import { validateAndResolveCloneUrl } from '../../src/ingestion/gitCloner.js';

describe('Git Safety & Validation (Unit)', () => {
  it('should accept valid GitHub repository names in owner/repo format', () => {
    const valid1 = validateAndResolveCloneUrl('spring-projects/spring-boot');
    expect(valid1).toBe('https://github.com/spring-projects/spring-boot.git');

    const valid2 = validateAndResolveCloneUrl('octocat/Hello-World.1');
    expect(valid2).toBe('https://github.com/octocat/Hello-World.1.git');
  });

  it('should reject invalid repository names with path traversal or injection characters', () => {
    expect(() => validateAndResolveCloneUrl('../etc/passwd')).toThrow();
    expect(() => validateAndResolveCloneUrl('owner/repo; rm -rf /')).toThrow();
    expect(() => validateAndResolveCloneUrl('owner/repo|curl evil.com')).toThrow();
    expect(() => validateAndResolveCloneUrl('http://evil.com/repo')).toThrow();
    expect(() => validateAndResolveCloneUrl('owner/repo\nnewline')).toThrow();
    expect(() => validateAndResolveCloneUrl('')).toThrow();
  });

  it('should allow customCloneUrl in test environment when specified', () => {
    const custom = 'file:///tmp/fixture-repo.git';
    const resolved = validateAndResolveCloneUrl('octocat/fixture-repo', custom);
    expect(resolved).toBe(custom);
  });
});
