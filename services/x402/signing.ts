import * as ed from '@noble/ed25519';

function buildSigningMessage(headers: Record<string, string>, payload: any): Uint8Array {
  const parts = [
    headers['x-402-intent'] || '',
    headers['x-402-sender'] || '',
    headers['x-402-recipient'] || '',
    headers['x-402-asset'] || '',
    headers['x-402-amount'] || '0',
    headers['x-402-ref'] || '',
    headers['x-402-proof-hash'] || '',
  ];
  const body = JSON.stringify(payload || {});
  const enc = new TextEncoder();
  return enc.encode(parts.join('\n') + '\n' + body);
}

export async function verifyX402Signature(headers: Record<string, string>, payload: any): Promise<boolean> {
  const sig = headers['x-402-signature'];
  const pub = headers['x-402-sender-pub'] || '';
  if (!sig || !pub) return false;
  try {
    const msg = buildSigningMessage(headers, payload);
    const sigBytes = Buffer.from(sig.replace('ed25519:', ''), 'hex');
    const pubBytes = Buffer.from(pub.replace('ed25519:', ''), 'hex');
    return await ed.verify(sigBytes, msg, pubBytes);
  } catch {
    return false;
  }
}
