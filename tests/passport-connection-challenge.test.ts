/**
 * Passport-native access — challenge canaries.
 *
 * PRD-PAG-001 Amendment A §A.9.4. These are the prerequisite half of the
 * plan: the challenge store must be single-use and pre-session BEFORE any
 * route mints a session from it.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  buildConnectionChallengeMessage,
  CHALLENGE_TTL_MS,
  sha256,
} from '@/services/passport/connectionChallenge';

const SERVICE = 'services/passport/connectionChallenge.ts';
const MIGRATION = 'supabase/migrations/20260819000000_passport_connection_challenges.sql';

/** Drop `--` lines and COMMENT ON prose, leaving only executable SQL. */
function stripSqlProse(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .replace(/COMMENT ON[\s\S]*?;/g, '');
}

describe('the pre-session law — ruling 8', () => {
  it('THE negative canary: nothing in the challenge path names an identity the caller cannot have', () => {
    // A caller at challenge time has no session. A parameter, column or return
    // field asking for one of these would rebuild the exact circular
    // dependency Amendment A exists to remove.
    for (const file of [SERVICE, MIGRATION]) {
      // `stripComments` is TypeScript-AST-based, so it does not touch SQL
      // comments. Both files DOCUMENT this boundary by naming the forbidden
      // identifiers — the grep-vs-comment defect `_lib/sourceAuthority` warns
      // about, where a compliant file fails its own canary.
      const code = file.endsWith('.sql') ? stripSqlProse(readSource(file)) : stripComments(readSource(file));
      for (const forbidden of ['personaId', 'persona_id', 'authProfileId', 'auth_profile_id', 'didPersonaId', 'did_persona_id']) {
        expect(code, `${file} references ${forbidden} in a pre-session path`).not.toContain(forbidden);
      }
    }
  });

  it('the caller is named by an opaque connection handle, not a derived one', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain('provisionalConnectionId');
    // Randomly generated, never derived from anything about the citizen.
    expect(code).toMatch(/pcx_\$\{crypto\.randomBytes/);
  });

  it('the challenge message carries no persona and binds what it should', () => {
    const msg = buildConnectionChallengeMessage({
      audience: 'metame',
      origin: 'https://dev-beta.aigentz.me',
      nonce: 'abc123',
      requestedAction: 'connect',
      expiresAt: '2026-07-26T12:00:00.000Z',
    });
    expect(msg).toContain('Application: metame');
    expect(msg).toContain('Origin: https://dev-beta.aigentz.me');
    expect(msg).toContain('Nonce: abc123');
    expect(msg).toContain('Expires: 2026-07-26T12:00:00.000Z');
    expect(msg.toLowerCase()).not.toContain('persona');
  });

  it('a step-up challenge says so, so a connect proof cannot be spent on one', () => {
    const base = { audience: 'a', origin: 'o', nonce: 'n', expiresAt: 'e' } as const;
    const connect = buildConnectionChallengeMessage({ ...base, requestedAction: 'connect' });
    const stepUp = buildConnectionChallengeMessage({ ...base, requestedAction: 'step_up' });
    expect(connect).not.toEqual(stepUp);
    expect(stepUp).toContain('step-up');
  });
});

describe('single use is a database guarantee — ruling 7', () => {
  it('consumption is a conditional update, never read-then-write', () => {
    // Two proofs racing one nonce would both pass a read check and both mint a
    // session. Only the conditional update can be won exactly once.
    const code = stripComments(readSource(SERVICE));
    const spend = code.slice(code.indexOf('.update({ consumed_at'));
    expect(spend, 'the spend no longer filters on an unconsumed row').toContain(
      ".is('consumed_at', null)",
    );
  });

  it('the challenge is spent BEFORE the signature is judged', () => {
    // Otherwise a failed signature leaves the nonce live and an attacker can
    // grind signatures against one challenge until something verifies.
    const code = stripComments(readSource(SERVICE));
    const spendAt = code.indexOf(".is('consumed_at', null)");
    const verifyAt = code.indexOf('verifyMessage(input.message');
    expect(spendAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeGreaterThan(-1);
    expect(spendAt, 'signature verification now precedes the spend').toBeLessThan(verifyAt);
  });

  it('the raw nonce is never stored — only its hash', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain('nonce_hash: sha256(nonce)');
    expect(code, 'the raw nonce is being persisted').not.toMatch(/nonce:\s*nonce,/);
    expect(sha256('x')).toHaveLength(64);
  });

  it('the signer is recovered, never taken from the caller', () => {
    // The wallet address on the request is untrusted input.
    const code = stripComments(readSource(SERVICE));
    expect(code).toMatch(/recovered = normaliseAddress\('evm', verifyMessage\(/);
    const result = code.slice(code.indexOf('return {\n    ok: true,'));
    expect(result).toContain('walletAddress: recovered');
  });

  it('challenges are short-lived', () => {
    expect(CHALLENGE_TTL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe('the migration is additive and fails closed', () => {
  it('creates its own table and alters nothing existing', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.passport_connection_challenges');
    // Rollback is DROP TABLE and nothing else (§A.9.3).
    expect(sql, 'the migration mutates an existing table').not.toMatch(/ALTER TABLE(?!.*passport_connection_challenges)/);
  });

  it('carries deny-all RLS like the gateway session store', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql, 'a policy grants access to a non-service caller').not.toMatch(/CREATE POLICY/i);
  });

  it('the nonce hash is unique, so one signature cannot answer two challenges', () => {
    expect(readSource(MIGRATION)).toMatch(/nonce_hash text NOT NULL UNIQUE/);
  });
});
