import crypto from 'crypto';

export interface WinnowingOptions {
  kGramSize?: number; // k
  windowSize?: number; // w
}

const DEFAULT_K = 15;
const DEFAULT_W = 10;

/**
 * Normalizes Java source code for structural similarity comparison.
 * Comments, string literals, numbers, and whitespace are normalized.
 */
export function normalizeJavaTokens(source: string): string[] {
  // 1. Remove comments
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');

  // 2. Normalize literals
  const normalized = clean
    .replace(/"(?:[^"\\]|\\.)*"/g, ' $STR ')
    .replace(/'(?:[^'\\]|\\.)*'/g, ' $CHR ')
    .replace(/\b\d+(?:\.\d+)?[fFdDlL]?\b/g, ' $NUM ');

  // 3. Extract tokens (keywords, identifiers, punctuation)
  const tokens = normalized.match(/[a-zA-Z_$][a-zA-Z0-9_$]*|[{}()[\];.,<>=!&|+-/*~^]/g) || [];
  return tokens;
}

/**
 * Computes hash for a token k-gram using SHA-256 (truncated to 12 hex chars).
 */
function hashKgram(tokens: string[]): string {
  const text = tokens.join(' ');
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 12);
}

/**
 * Computes Winnowing fingerprints for a given Java source code.
 */
export function computeWinnowingFingerprints(
  source: string,
  options: WinnowingOptions = {}
): Set<string> {
  const k = options.kGramSize ?? DEFAULT_K;
  const w = options.windowSize ?? DEFAULT_W;

  const tokens = normalizeJavaTokens(source);
  if (tokens.length < k) {
    return new Set<string>();
  }

  // 1. Compute k-gram hashes
  const hashes: string[] = [];
  for (let i = 0; i <= tokens.length - k; i++) {
    const kgram = tokens.slice(i, i + k);
    hashes.push(hashKgram(kgram));
  }

  // 2. Winnowing algorithm
  const fingerprints = new Set<string>();
  if (hashes.length < w) {
    // If fewer hashes than window, pick min of whatever exists
    let minHash: string | undefined = hashes[0];
    for (const h of hashes) {
      if (minHash === undefined || h < minHash) minHash = h;
    }
    if (minHash) fingerprints.add(minHash);
    return fingerprints;
  }

  let minIdx = -1;

  for (let i = 0; i <= hashes.length - w; i++) {
    const window = hashes.slice(i, i + w);
    let currentMin: string = window[0] ?? '';
    let currentMinRelativeIdx = 0;

    for (let j = 0; j < window.length; j++) {
      const h = window[j] ?? '';
      if (h <= currentMin) {
        currentMin = h;
        currentMinRelativeIdx = j;
      }
    }

    const currentMinGlobalIdx = i + currentMinRelativeIdx;
    if (currentMinGlobalIdx !== minIdx) {
      minIdx = currentMinGlobalIdx;
      const selected = hashes[minIdx];
      if (selected) {
        fingerprints.add(selected);
      }
    }
  }

  return fingerprints;
}

/**
 * Computes Jaccard containment of candidate fingerprints in reference fingerprints:
 * Containment(A, B) = |A ∩ B| / |A|
 */
export function computeContainment(candidateHashes: Set<string>, referenceHashes: Set<string>): number {
  if (candidateHashes.size === 0) return 0;

  let intersection = 0;
  for (const h of candidateHashes) {
    if (referenceHashes.has(h)) {
      intersection++;
    }
  }

  return Math.round((intersection / candidateHashes.size) * 1000) / 1000;
}
