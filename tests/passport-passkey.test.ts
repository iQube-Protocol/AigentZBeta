/**
 * Passkey enrolment + unlock canaries — holder-control level 2.
 *
 * PRD-PAG-001 Amendment A §A.6 (ratified 2026-07-27). The load-bearing ones
 * first: single-use spend-before-verify (ruling 7), the pre-session law on
 * the unlock routes (ruling 8), and T0 discipline on everything
 * client-bound.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import {
  passkeyUserHandle,
  challengeNonceFromClientData,
} from '@/services/passport/passkeyService';

const SERVICE = 'services/passport/passkeyService.ts';
const CHALLENGE_SERVICE = 'services/passport/connectionChallenge.ts';
const MIGRATION = 'supabase/migrations/20260823000000_passport_passkey_credentials.sql';
const ENROL_OPTIONS = 'app/api/passport/passkey/enrol-options/route.ts';
const ENROL_VERIFY = 'app/api/passport/passkey/enrol-verify/route.ts';
const AUTH_OPTIONS = 'app/api/passport/passkey/auth-options/route.ts';
const AUTH_VERIFY = 'app/api/passport/passkey/auth-verify/route.ts';

describe('single use is the SAME database guarantee — ruling 7', () => {
  it('the WebAuthn ceremonies spend through the one authoritative store, not a sibling', () => {
    const graph = importAuthority(readSource(SERVICE));
    const challengeImport = graph.records.find((r) => r.specifier.includes('connectionChallenge'));
    expect(challengeImport, 'passkeyService no longer uses the canonical challenge store').toBeTruthy();
    expect(challengeImport?.names).toContain('spendChallenge');
    expect(challengeImport?.names).toContain('issuePasskeyChallenge');
  });

  it('the challenge is SPENT before the registration attestation is judged', () => {
    const code = stripComments(readSource(SERVICE));
    const enrol = code.slice(code.indexOf('export async function completePasskeyEnrolment'));
    const spendAt = enrol.indexOf('spendChallenge');
    const verifyAt = enrol.indexOf('verifyRegistrationResponse');
    expect(spendAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeGreaterThan(-1);
    expect(spendAt, 'attestation verification now precedes the spend').toBeLessThan(verifyAt);
  });

  it('the challenge is SPENT before the assertion is judged — and before any credential lookup', () => {
    const code = stripComments(readSource(SERVICE));
    const auth = code.slice(code.indexOf('export async function completePasskeyAuthentication'));
    const spendAt = auth.indexOf('spendChallenge');
    const lookupAt = auth.indexOf("eq('credential_id'");
    const verifyAt = auth.indexOf('verifyAuthenticationResponse');
    expect(spendAt).toBeGreaterThan(-1);
    expect(spendAt).toBeLessThan(lookupAt);
    expect(spendAt).toBeLessThan(verifyAt);
  });

  it('a ceremony challenge can never be spent on the other ceremony, or on the wallet path', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain("expectedActions: ['passkey_enrol']");
    expect(code).toContain("expectedActions: ['passkey_auth']");
    const wallet = stripComments(readSource(CHALLENGE_SERVICE));
    expect(wallet).toContain("expectedActions: ['connect', 'step_up']");
  });

  it('parity: the migration CHECK carries exactly the code union of requested actions', () => {
    const code = stripComments(readSource(CHALLENGE_SERVICE));
    const union = code.match(/export type RequestedAction =([^;]+);/)?.[1] ?? '';
    const codeActions = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const sql = readSource(MIGRATION);
    const check = sql.match(/requested_action IN \(([^)]+)\)/)?.[1] ?? '';
    const sqlActions = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(codeActions.length).toBeGreaterThan(0);
    expect(sqlActions).toEqual(codeActions);
  });

  it('the nonce the spend is keyed by is recovered from what the authenticator signed over', () => {
    const nonce = 'a'.repeat(64);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: Buffer.from(nonce, 'utf8').toString('base64url'),
        origin: 'https://dev-beta.aigentz.me',
      }),
      'utf8',
    ).toString('base64url');
    expect(challengeNonceFromClientData(clientDataJSON)).toBe(nonce);
    expect(challengeNonceFromClientData('not-base64-json')).toBeNull();
    expect(challengeNonceFromClientData('')).toBeNull();
  });
});

describe('the pre-session law holds on unlock — ruling 8', () => {
  it('THE canary: neither unlock route authenticates its caller', () => {
    // A passkey unlock exists to establish the session; requiring one would
    // rebuild the circular dependency Amendment A removed.
    for (const file of [AUTH_OPTIONS, AUTH_VERIFY]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} authenticates its caller`).not.toContain('getActivePersona');
      expect(code, `${file} authenticates its caller`).not.toContain('getCallerIdentityContext');
      expect(code, `${file} authenticates its caller`).not.toContain('resolvePersonaOrTimeout');
      expect(code, `${file} uses the persona-bearing transport`).not.toContain('personaFetch');
    }
  });

  it('both enrolment routes DO authenticate, through the canonical caller resolution', () => {
    for (const file of [ENROL_OPTIONS, ENROL_VERIFY]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} lost its authentication`).toContain('getCallerIdentityContext');
      expect(code, `${file} built a parallel resolver`).not.toMatch(/jwt\.decode|jsonwebtoken/);
    }
  });

  it('no route or service in the passkey path names an identity a pre-session caller cannot have', () => {
    for (const file of [SERVICE, AUTH_OPTIONS, AUTH_VERIFY, MIGRATION]) {
      const code = file.endsWith('.sql')
        ? readSource(file)
            .split('\n')
            .filter((l) => !l.trimStart().startsWith('--'))
            .join('\n')
            .replace(/COMMENT ON[\s\S]*?;/g, '')
        : stripComments(readSource(file));
      for (const forbidden of ['personaId', 'persona_id', 'authProfileId', 'auth_profile_id', 'didPersonaId', 'rootDid', 'root_did']) {
        expect(code, `${file} references ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('unlock never enumerates credentials for a claimed identity', () => {
    const code = stripComments(readSource(SERVICE));
    const auth = code.slice(
      code.indexOf('export async function beginPasskeyAuthentication'),
      code.indexOf('export async function completePasskeyAuthentication'),
    );
    expect(auth).toContain('allowCredentials: []');
  });
});

describe('T0 discipline on everything client-bound', () => {
  it('the unlock response carries no internal identifier', () => {
    const code = stripComments(readSource(AUTH_VERIFY));
    const responses = code.slice(code.indexOf('export async function POST'));
    for (const forbidden of ['authUserId', 'auth_user_id', 'kybeId', 'rootIdentityId', 'email']) {
      expect(responses, `the unlock route returns ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('resolution failures collapse to one opaque reason — no probing which credentials exist', () => {
    const code = stripComments(readSource(AUTH_VERIFY));
    expect(code).toContain("error: 'no_constitutional_access'");
    for (const leak of ['credential_unknown', 'verification_failed', 'counter_regression']) {
      expect(code, `the unlock route discloses ${leak}`).not.toContain(`'${leak}'`);
    }
  });

  it('the WebAuthn user handle is a one-way commitment, never the raw principal id', () => {
    const handle = passkeyUserHandle('11111111-2222-3333-4444-555555555555');
    expect(handle).toMatch(/^[0-9a-f]{32}$/);
    expect(handle).not.toContain('1111');
    expect(passkeyUserHandle('11111111-2222-3333-4444-555555555555')).toBe(handle); // deterministic
    expect(passkeyUserHandle('other-user')).not.toBe(handle);
    const code = stripComments(readSource(SERVICE));
    expect(code, 'the raw auth user id is being used as the WebAuthn handle').not.toMatch(
      /userID: new Uint8Array\(Buffer\.from\((input\.)?authUserId/,
    );
  });

  it('the origin is server-determined on every route, never body-supplied', () => {
    /*
     * The INTENT here is unchanged and is the security property: a caller must
     * never nominate the relying party its own credential is bound to.
     *
     * The MECHANISM changed (operator, 2026-08-02). This canary previously
     * required `request.nextUrl.origin` — and thereby froze a real defect in
     * place. Behind Amplify's CloudFront that expression yields the LAMBDA's
     * host, not the domain the user is on, so `rpIdFromOrigin()` minted every
     * challenge for a relying party the browser has never visited and WebAuthn
     * refused, correctly, every time. The operator saw "Passkeys aren't
     * configured correctly for this address".
     *
     * `resolveRequestOrigin` honours `x-forwarded-host`/`x-forwarded-proto`,
     * which is what makes the rpID the user's actual domain. It is still
     * entirely server-side: the value comes from proxy headers, never from the
     * request body.
     */
    for (const file of [ENROL_OPTIONS, ENROL_VERIFY, AUTH_OPTIONS, AUTH_VERIFY]) {
      const code = stripComments(readSource(file));
      expect(code).toContain('origin: resolveRequestOrigin(request)');
      expect(code, `${file} lets the caller nominate its own origin`).not.toMatch(/body\?\.origin/);
      // The expression that could never match the user's domain must not return.
      expect(code, `${file} is back on the Lambda's own origin`).not.toContain('origin: request.nextUrl.origin');
    }
  });

  it('options and verify resolve the origin the SAME way', () => {
    // The challenge is minted with one rpID and verified against another. If
    // the two ever resolve differently, every passkey stops working at once
    // and the failure looks like a broken authenticator.
    for (const [options, verify] of [
      [ENROL_OPTIONS, ENROL_VERIFY],
      [AUTH_OPTIONS, AUTH_VERIFY],
    ]) {
      expect(stripComments(readSource(options))).toContain('resolveRequestOrigin(request)');
      expect(stripComments(readSource(verify))).toContain('resolveRequestOrigin(request)');
    }
  });
});

describe('the migration is additive and fails closed', () => {
  it('creates the credential store with deny-all RLS and no client policy', () => {
    const sql = readSource(MIGRATION);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.passport_passkey_credentials');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql, 'a policy grants access to a non-service caller').not.toMatch(/CREATE POLICY/i);
  });

  it('one credential, one binding — the credential id is unique', () => {
    expect(readSource(MIGRATION)).toMatch(/credential_id text NOT NULL UNIQUE/);
  });

  it('the only touch on an existing table is the requested_action vocabulary', () => {
    const sql = readSource(MIGRATION);
    const alters = [...sql.matchAll(/ALTER TABLE\s+(\S+)/g)].map((m) => m[1]);
    for (const target of alters) {
      // Its own table (RLS enable) or the challenge store's action CHECK —
      // never any other existing table.
      expect([
        'public.passport_passkey_credentials',
        'public.passport_connection_challenges',
      ]).toContain(target);
    }
    expect(sql, 'a column was added to the challenge store').not.toMatch(/ADD COLUMN/i);
  });
});

describe('the charter rule travels with the code', () => {
  it('the verbatim holder-control rule is documented where the ceremonies live', () => {
    const rule =
      'additional passkey enrolment is optional for ordinary access; cryptographic holder-control proof is not optional; step-up is mandatory where consequence requires it';
    expect(readSource(SERVICE).replace(/\s*\*\s*/g, ' ')).toContain(rule);
    expect(readSource(MIGRATION).replace(/\s*--\s*/g, ' ').replace(/\n/g, ' ')).toContain(rule);
  });

  it('unlock walks to an ACTIVE Passport before any session — possession is not access', () => {
    const code = stripComments(readSource(SERVICE));
    const auth = code.slice(code.indexOf('export async function completePasskeyAuthentication'));
    const principalAt = auth.indexOf('resolvePassportPrincipalForAuthUser');
    const sessionAt = auth.indexOf('issuePassportSession');
    expect(principalAt).toBeGreaterThan(-1);
    expect(sessionAt).toBeGreaterThan(-1);
    expect(principalAt, 'the session is minted before the Passport is checked').toBeLessThan(sessionAt);
  });

  it('the session is the ordinary Supabase envelope — no second mint path (ruling 4)', () => {
    const code = stripComments(readSource(SERVICE));
    expect(code).toContain('issuePassportSession');
    expect(code, 'a bespoke session mint appeared in the passkey path').not.toMatch(
      /generateLink|jwt\.sign|createSessionToken/,
    );
  });

  it('touches no protected spine or DVN file', () => {
    const graph = importAuthority(readSource(SERVICE));
    for (const r of graph.records) {
      expect(r.specifier, `passkeyService imports ${r.specifier}`).not.toMatch(
        /getActivePersona|evaluateAccess|policyResolvers|personaSessionToken|services\/content\/|services\/dvn\/|services\/ops\//,
      );
    }
  });
});
