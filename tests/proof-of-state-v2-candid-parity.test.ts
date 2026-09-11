/**
 * proof_of_state_v2 DID ⟷ AigentZBeta consumer-binding canary.
 *
 * The DID is copied from the canonical iQubeBeta-Program source pinned by the
 * CAP-1 manifest. This test keeps the platform adapter from drifting from the
 * canister surface while the live leg remains dark.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const DID_PATH = 'services/ops/idl/proof_of_state_v2.did';
const TS_PATH = 'services/ops/idl/proof_of_state_v2.ts';

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function methodsFromDid(did: string): Map<string, 'query' | 'update'> {
  const start = did.indexOf('service :');
  expect(start, 'DID has no service block').toBeGreaterThan(-1);
  const body = did.slice(did.indexOf('{', start) + 1);
  const out = new Map<string, 'query' | 'update'>();
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t.startsWith('//') || !t.includes('->')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(t);
    if (!match) continue;
    out.set(match[1], /\bquery\s*;?\s*$/.test(t) ? 'query' : 'update');
  }
  return out;
}

function methodsFromTs(ts: string): Map<string, 'query' | 'update'> {
  const out = new Map<string, 'query' | 'update'>();
  const re = /(\w+):\s*IDL\.Func\(\s*\[[^\]]*\]\s*,\s*\[[^\]]*\]\s*,\s*\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(ts)) !== null) {
    out.set(match[1], /query/.test(match[2]) ? 'query' : 'update');
  }
  return out;
}

describe('proof_of_state_v2 Candid parity', () => {
  const did = methodsFromDid(read(DID_PATH));
  const ts = methodsFromTs(read(TS_PATH));

  it('exposes only the governed v2 surface expected by CAP-1', () => {
    expect([...did.keys()].sort()).toEqual([
      'batch_now',
      'get_batch',
      'get_config',
      'get_pending_count',
      'get_receipt',
      'issue_receipt',
      'record_confirmation',
      'request_anchor',
      'verify_receipt',
    ]);
  });

  it('keeps method names and query/update modes aligned', () => {
    expect([...ts.keys()].sort()).toEqual([...did.keys()].sort());
    for (const [name, mode] of did) {
      expect(ts.get(name), `${name} mode disagrees between DID and TS binding`).toBe(mode);
    }
  });

  it('keeps confirmation separate from anchor request', () => {
    expect(did.get('request_anchor')).toBe('update');
    expect(did.get('record_confirmation')).toBe('update');
    expect(read(TS_PATH)).toContain('BatchAnchorState');
    expect(read(TS_PATH)).toContain('AnchorRequested');
    expect(read(TS_PATH)).toContain('Anchored');
  });
});
