/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) Implementation
 *
 * Requirements:
 * 1. Whitespace removed outside strings.
 * 2. Object keys sorted lexicographically by UTF-16 code units.
 * 3. Minimal string escaping according to RFC 8785 / ECMA-404.
 * 4. Floats/integers formatted according to standard ECMAScript JSON rules (-0 normalized to 0).
 * 5. Undefined properties omitted.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  const type = typeof value;

  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (type === 'number') {
    if (!Number.isFinite(value)) {
      return 'null';
    }
    // Normalize -0 to 0
    if (Object.is(value, -0)) {
      return '0';
    }
    return JSON.stringify(value);
  }

  if (type === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const serializedElements = value.map((item) => {
      const canonical = canonicalizeJson(item);
      return canonical === undefined ? 'null' : canonical;
    });
    return `[${serializedElements.join(',')}]`;
  }

  if (type === 'object') {
    // If object has toJSON, invoke it first
    const obj = typeof (value as any).toJSON === 'function' ? (value as any).toJSON() : value;
    if (obj === null || typeof obj !== 'object') {
      return canonicalizeJson(obj);
    }
    if (Array.isArray(obj)) {
      return canonicalizeJson(obj);
    }

    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const entries: string[] = [];

    for (const key of keys) {
      const val = (obj as Record<string, unknown>)[key];
      if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
        const canonicalVal = canonicalizeJson(val);
        if (canonicalVal !== undefined) {
          entries.push(`${JSON.stringify(key)}:${canonicalVal}`);
        }
      }
    }

    return `{${entries.join(',')}}`;
  }

  return undefined as any;
}
