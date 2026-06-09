/**
 * Normalize a PEM string sourced from an env var.
 *
 * Amplify/CloudFront env var inputs can mangle multi-line PEM values in
 * a few ways:
 *   1. Newlines collapsed to spaces ("…KEY----- MHQC…")
 *   2. Newlines encoded as the literal two-character sequence "\n"
 *   3. CRLF line endings
 *   4. Leading/trailing whitespace
 *   5. Stray characters (e.g. trailing `\`) glued to the END marker
 *
 * This helper restores a parseable PEM by handling all cases. Idempotent
 * — a well-formed PEM with real newlines passes through unchanged.
 */
export function normalizePem(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let pem = raw.trim();
  pem = pem.replace(/\\+$/, '');
  pem = pem.replace(/\\n/g, '\n');
  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!pem.includes('-----BEGIN')) return pem;

  pem = pem.replace(/-----BEGIN ([^-]+)----- ?/g, '-----BEGIN $1-----\n');
  pem = pem.replace(/ ?-----END ([^-]+)-----/g, '\n-----END $1-----');

  const lines = pem.split('\n');
  const restored: string[] = [];
  for (const line of lines) {
    if (line.startsWith('-----')) {
      const cleaned = line.replace(/(-----[A-Z][A-Z0-9 ]+-----).*$/, '$1');
      restored.push(cleaned);
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

/**
 * Parse a normalized PEM string into a Signing identity.
 *
 * @dfinity/identity 3.x removed `fromPem` from `Ed25519KeyIdentity` and
 * deprecated `Secp256k1KeyIdentity` to an empty stub. The canonical
 * replacement for secp256k1 EC keys (what dfx generates by default) is the
 * separate `@dfinity/identity-secp256k1` package. This helper tries that
 * first, then falls back to any legacy paths still on the older identity
 * package.
 *
 * Returns the parsed identity, or `null` if no parser accepted the PEM.
 */
export async function parsePemToIdentity(pem: string | null | undefined): Promise<any | null> {
  if (!isPemLike(pem)) return null;

  try {
    const mod: any = await import('@dfinity/identity-secp256k1');
    if (mod?.Secp256k1KeyIdentity?.fromPem) {
      try { return mod.Secp256k1KeyIdentity.fromPem(pem); } catch { /* try next */ }
    }
  } catch { /* package not installed — fall through */ }

  try {
    const idMod: any = await import('@dfinity/identity');
    if (idMod?.Secp256k1KeyIdentity?.fromPem) {
      try { return idMod.Secp256k1KeyIdentity.fromPem(pem); } catch { /* try next */ }
    }
    if (idMod?.Ed25519KeyIdentity?.fromPem) {
      try { return idMod.Ed25519KeyIdentity.fromPem(pem); } catch { /* fallthrough */ }
    }
  } catch { /* identity module not available */ }

  return null;
}

/**
 * Detect identity type for diagnostic surfaces. Returns the same
 * shape every consumer expects: { type, principal }.
 */
export async function detectIdentityFromPem(pem: string | null | undefined): Promise<{
  type: 'ed25519' | 'secp256k1' | 'anonymous';
  principal: string | null;
}> {
  if (!isPemLike(pem)) return { type: 'anonymous', principal: null };

  try {
    const mod: any = await import('@dfinity/identity-secp256k1');
    if (mod?.Secp256k1KeyIdentity?.fromPem) {
      try {
        const id = mod.Secp256k1KeyIdentity.fromPem(pem);
        return { type: 'secp256k1', principal: id.getPrincipal().toText() };
      } catch { /* try next */ }
    }
  } catch { /* not installed */ }

  try {
    const idMod: any = await import('@dfinity/identity');
    if (idMod?.Ed25519KeyIdentity?.fromPem) {
      try {
        const id = idMod.Ed25519KeyIdentity.fromPem(pem);
        return { type: 'ed25519', principal: id.getPrincipal().toText() };
      } catch { /* try next */ }
    }
    if (idMod?.Secp256k1KeyIdentity?.fromPem) {
      try {
        const id = idMod.Secp256k1KeyIdentity.fromPem(pem);
        return { type: 'secp256k1', principal: id.getPrincipal().toText() };
      } catch { /* fallthrough */ }
    }
  } catch { /* not available */ }

  return { type: 'anonymous', principal: null };
}
