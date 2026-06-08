/**
 * Normalize a PEM string sourced from an env var.
 *
 * Amplify/CloudFront env var inputs can mangle multi-line PEM values in
 * a few ways:
 *   1. Newlines collapsed to spaces ("…KEY----- MHQC…")
 *   2. Newlines encoded as the literal two-character sequence "\n"
 *   3. CRLF line endings
 *   4. Leading/trailing whitespace
 *
 * This helper restores a parseable PEM by handling all three cases. Idempotent
 * — a well-formed PEM with real newlines passes through unchanged.
 */
export function normalizePem(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let pem = raw.trim();
  pem = pem.replace(/\\n/g, '\n');
  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!pem.includes('-----BEGIN')) return pem;

  pem = pem.replace(/-----BEGIN ([^-]+)----- ?/g, '-----BEGIN $1-----\n');
  pem = pem.replace(/ ?-----END ([^-]+)-----/g, '\n-----END $1-----');

  const lines = pem.split('\n');
  const restored: string[] = [];
  for (const line of lines) {
    if (line.startsWith('-----')) {
      restored.push(line);
      continue;
    }
    const compact = line.replace(/\s+/g, '');
    if (!compact) continue;
    for (let i = 0; i < compact.length; i += 64) {
      restored.push(compact.slice(i, i + 64));
    }
  }
  return restored.join('\n') + '\n';
}

export function isPemLike(pem: string | null | undefined): pem is string {
  return !!pem && pem.includes('-----BEGIN') && pem.includes('KEY');
}
