import { describe, it, expect } from 'vitest';
import { parsePorcelainBlame } from '../../src/ingestion/gitBlame.js';

describe('Git Blame Porcelain Parser (Unit)', () => {
  it('should parse simple porcelain blame output with a single commit', () => {
    const samplePorcelain = `4b825dc642cb6eb9a060e54bf8d69288fbee4904 1 1 2
author Alice Developer
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice Developer
committer-mail <alice@example.com>
committer-time 1700000000
committer-tz +0000
summary Initial commit
filename src/main/java/App.java
\tpackage com.example;
4b825dc642cb6eb9a060e54bf8d69288fbee4904 2 2
\tpublic class App {}
`;

    const result = parsePorcelainBlame(samplePorcelain);

    expect(result.totalLines).toBe(2);
    expect(result.uniqueShas.size).toBe(1);
    expect(result.uniqueShas.has('4b825dc642cb6eb9a060e54bf8d69288fbee4904')).toBe(true);

    expect(result.ranges.length).toBe(1);
    expect(result.ranges[0]).toEqual({
      startLine: 1,
      endLine: 2,
      commitSha: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      commitDate: new Date(1700000000 * 1000),
      lineCount: 2,
      nonBlankCount: 2,
    });
  });

  it('should parse multi-author blame and correctly group contiguous lines', () => {
    const multiAuthorPorcelain = `1111111111111111111111111111111111111111 1 1 2
author Alice
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice
committer-mail <alice@example.com>
committer-time 1700000000
committer-tz +0000
summary Commit 1
filename src/main/java/Service.java
\tline 1
1111111111111111111111111111111111111111 2 2
\tline 2
2222222222222222222222222222222222222222 1 3 1
author Bob
author-mail <bob@example.com>
author-time 1700500000
author-tz +0000
committer Bob
committer-mail <bob@example.com>
committer-time 1700500000
committer-tz +0000
summary Commit 2
filename src/main/java/Service.java
\tline 3 (by Bob)
1111111111111111111111111111111111111111 3 4
\tline 4 (by Alice)
`;

    const result = parsePorcelainBlame(multiAuthorPorcelain);

    expect(result.totalLines).toBe(4);
    expect(result.uniqueShas.size).toBe(2);
    expect(result.ranges.length).toBe(3);

    // Range 1: Lines 1-2 by Alice
    expect(result.ranges[0]?.startLine).toBe(1);
    expect(result.ranges[0]?.endLine).toBe(2);
    expect(result.ranges[0]?.commitSha).toBe('1111111111111111111111111111111111111111');

    // Range 2: Line 3 by Bob
    expect(result.ranges[1]?.startLine).toBe(3);
    expect(result.ranges[1]?.endLine).toBe(3);
    expect(result.ranges[1]?.commitSha).toBe('2222222222222222222222222222222222222222');

    // Range 3: Line 4 by Alice
    expect(result.ranges[2]?.startLine).toBe(4);
    expect(result.ranges[2]?.endLine).toBe(4);
    expect(result.ranges[2]?.commitSha).toBe('1111111111111111111111111111111111111111');
  });

  it('should accurately count non-blank lines vs blank lines', () => {
    const porcelainWithBlanks = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 3
author Alice
author-mail <alice@example.com>
author-time 1700000000
author-tz +0000
committer Alice
summary Blank test
filename Test.java
\tpublic class Test {
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2
\t
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 3 3
\t}
`;

    const result = parsePorcelainBlame(porcelainWithBlanks);

    expect(result.totalLines).toBe(3);
    expect(result.ranges.length).toBe(1);
    expect(result.ranges[0]?.lineCount).toBe(3);
    expect(result.ranges[0]?.nonBlankCount).toBe(2); // Line 2 is blank whitespace
  });

  it('should return empty ranges for empty blame output', () => {
    const result = parsePorcelainBlame('');
    expect(result.totalLines).toBe(0);
    expect(result.ranges).toEqual([]);
    expect(result.uniqueShas.size).toBe(0);
  });
});
