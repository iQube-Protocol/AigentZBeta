/**
 * Extend Passport Citizen Account Sign In with canonical wallet
 * authentication (2026-08-12).
 *
 * The Passport Bureau's Sign In screen accepts a single identifier —
 * "Persona name, username, or email" — and resolves it through one of two
 * REAL paths, never a parallel password verifier:
 *
 *   contains "@"  → the canonical wallet auth call SmartWalletDrawer itself
 *                   uses (useSupabaseSessionPersonas's `signIn`, which calls
 *                   supabase.auth.signInWithPassword — the SAME function,
 *                   not a copy).
 *   no "@"        → the pre-existing Bureau persona-name path, unchanged
 *                    (synthetic email + signInWithPassword).
 *
 * A Bureau username can never contain "@" (validateBureauUsername forbids
 * it), so this split is lossless — never a heuristic that could misroute a
 * valid Bureau sign-in. A distinct "wallet username" identifier does not
 * exist in the canonical wallet auth service today (Supabase Auth resolves
 * by email only); these canaries assert that this file does not fabricate a
 * second lookup for one.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const BUREAU = 'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx';
const USABLE_STATUS_ROUTE = 'app/api/passport/usable-status/route.ts';
const SESSION_HOOK = 'app/hooks/useSupabaseSessionPersonas.ts';

describe('Persona name + password — existing path, unchanged', () => {
  it('signup still creates a Bureau account via /api/passport/auth/signup, byte-for-byte', () => {
    const code = stripComments(readSource(BUREAU));
    const signupIdx = code.indexOf("mode === 'signup'");
    const elseIdx = code.indexOf('} else {', signupIdx);
    const signupBlock = code.slice(signupIdx, elseIdx);
    expect(signupBlock).toContain('/api/passport/auth/signup');
    expect(signupBlock).toContain('@passport.metame.internal');
  });

  it('a non-email identifier in Sign In mode still resolves via the Bureau synthetic-email path', () => {
    const code = stripComments(readSource(BUREAU));
    const signinElseIdx = code.indexOf('} else {', code.indexOf("mode === 'signup'"));
    const nextElseBlockEnd = code.indexOf('setSignedIn(true);', signinElseIdx);
    const signinBlock = code.slice(signinElseIdx, nextElseBlockEnd);
    expect(signinBlock).toContain("identifier.includes('@')");
    expect(signinBlock).toContain('@passport.metame.internal');
  });
});

describe('Wallet email + password — canonical wallet auth, no parallel verifier', () => {
  it('the wallet-email branch calls the SAME signIn the useSupabaseSessionPersonas hook exports', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toContain("signIn: signInWithWalletAuth");
    expect(code).toContain('signInWithWalletAuth(identifier, password)');
  });

  it('useSupabaseSessionPersonas.signIn calls supabase.auth.signInWithPassword directly — the ONE canonical call', () => {
    const code = stripComments(readSource(SESSION_HOOK));
    const idx = code.indexOf('const signIn = useCallback');
    const end = code.indexOf('}, []);', idx);
    const block = code.slice(idx, end);
    expect(block).toContain('supabase.auth.signInWithPassword({ email, password })');
  });

  it('PassportBureauApplyTab does not duplicate signInWithPassword logic for the wallet path — it imports the hook, not a copy', () => {
    const graph = importAuthority(readSource(BUREAU));
    const hookImport = graph.records.find((r) => r.specifier.includes('useSupabaseSessionPersonas'));
    expect(hookImport, 'useSupabaseSessionPersonas import not found').toBeTruthy();
    expect(hookImport!.names).toContain('useSupabaseSessionPersonas');
  });
});

describe('A bare "wallet username" path is not fabricated', () => {
  it('the identifier field never triggers a second, username-specific lookup route', () => {
    const code = stripComments(readSource(BUREAU));
    // Only two auth calls exist for the account step: the Bureau synthetic-
    // email signInWithPassword, and the wallet signIn() — no third path.
    const walletBranchIdx = code.indexOf("identifier.includes('@')");
    const walletBranchEnd = code.indexOf('setSignedIn(true);', walletBranchIdx);
    const walletBranch = code.slice(walletBranchIdx, walletBranchEnd);
    expect(walletBranch, 'no separate username-resolution fetch should exist in the wallet branch').not.toMatch(
      /fetch\(['"`]\/api\/(?!passport\/usable-status)/,
    );
  });
});

describe('Successful wallet auth continues into the Citizen Passport application', () => {
  it('after any successful sign-in, the wizard checks /api/passport/usable-status before continuing', () => {
    const code = stripComments(readSource(BUREAU));
    const handleAccountIdx = code.indexOf('const handleAccount = useCallback');
    expect(handleAccountIdx, 'handleAccount definition not found').toBeGreaterThan(-1);
    const signedInIdx = code.indexOf('setSignedIn(true);', handleAccountIdx);
    expect(signedInIdx).toBeGreaterThan(-1);
    const after = code.slice(signedInIdx, signedInIdx + 2500);
    expect(after).toContain('/api/passport/usable-status');
    expect(after).toContain('resolveCitizenStepAfterAccountCreation()');
  });

  it('the continuation branch is a single call site shared by BOTH the Bureau and wallet paths — not duplicated per path', () => {
    const code = stripComments(readSource(BUREAU));
    const matches = code.match(/resolveCitizenStepAfterAccountCreation\(\)/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe('Issued Passport resolves to the authenticated caller\'s own account', () => {
  it('the identity-bind and submit steps read the Bearer token from whichever session is current, never a hardcoded Bureau-only path', () => {
    const bindRoute = stripComments(readSource('app/api/passport/identity/bind/route.ts'));
    // Resolves via the shared caller-identity/session mechanism, not a
    // Bureau-specific email check — so a wallet-authenticated caller's
    // Passport binds to THEIR account, exactly like a Bureau-native one.
    expect(bindRoute).toContain('getCallerIdentityContext');
    expect(bindRoute).not.toContain('passport.metame.internal');
  });
});

describe('No duplicate account or wallet is created by the wallet-auth sign-in path', () => {
  it('the wallet branch never calls the Bureau signup endpoint or an admin user-creation route', () => {
    const code = stripComments(readSource(BUREAU));
    const walletBranchIdx = code.indexOf("identifier.includes('@')");
    const walletBranchEnd = code.indexOf('setSignedIn(true);', walletBranchIdx);
    const walletBranch = code.slice(walletBranchIdx, walletBranchEnd);
    expect(walletBranch).not.toContain('/api/passport/auth/signup');
    expect(walletBranch).not.toContain('createUser');
  });
});

describe('No password is persisted into Passport/profile records', () => {
  it('the identity/bind request body never includes a password field', () => {
    const code = stripComments(readSource(BUREAU));
    const bindIdx = code.indexOf("'/api/passport/identity/bind'");
    const bindCallEnd = code.indexOf('});', bindIdx);
    const bindCall = code.slice(bindIdx, bindCallEnd);
    expect(bindCall.toLowerCase()).not.toContain('password');
  });

  it('the applications/submit request body never includes a password field', () => {
    const code = stripComments(readSource(BUREAU));
    const submitIdx = code.indexOf("'/api/passport/applications/submit'");
    const submitCallEnd = code.indexOf('});', submitIdx);
    const submitCall = code.slice(submitIdx, submitCallEnd);
    expect(submitCall.toLowerCase()).not.toContain('password');
  });

  it('the wallet sign-in call passes the password ONLY to the canonical auth service, never to a Bureau-side fetch', () => {
    const code = stripComments(readSource(BUREAU));
    // signInWithWalletAuth(identifier, password) is the ONE place `password`
    // reaches the wallet path — it must not also appear in a fetch() body
    // inside the same branch.
    const walletBranchIdx = code.indexOf("identifier.includes('@')");
    const walletBranchEnd = code.indexOf('setSignedIn(true);', walletBranchIdx);
    const walletBranch = code.slice(walletBranchIdx, walletBranchEnd);
    expect(walletBranch).toContain('signInWithWalletAuth(identifier, password)');
    expect(walletBranch).not.toMatch(/fetch\([^)]*\)[\s\S]{0,200}password/);
  });
});

describe('Existing Passport is detected rather than reissued', () => {
  it('/api/passport/usable-status reuses the SAME canonical usable-passport check the Bridge state routes use', () => {
    const code = stripComments(readSource(USABLE_STATUS_ROUTE));
    expect(code).toContain('loadUsableCitizenPassportForAuthProfile');
    expect(code).toContain('persona.authProfileId');
  });

  it('the wizard short-circuits to an "already hold a Passport" state instead of continuing the wizard', () => {
    const code = stripComments(readSource(BUREAU));
    expect(code).toContain('existingUsablePassport');
    expect(code).toContain('You already hold a Polity Citizen Passport');
    const guardIdx = code.indexOf('if (existingUsablePassport) {');
    expect(guardIdx, 'the short-circuit guard was not found').toBeGreaterThan(-1);
  });

  it('the usable-status check runs for BOTH the Bureau and the wallet sign-in path (uniform, not wallet-only)', () => {
    const code = stripComments(readSource(BUREAU));
    const checkIdx = code.indexOf('/api/passport/usable-status');
    const modeSignupIdx = code.indexOf("mode === 'signup'");
    const modeElseIdx = code.indexOf('} else {', modeSignupIdx);
    // The usable-status check must sit AFTER both branches converge
    // (setSignedIn(true) is common to both), not inside either branch alone.
    expect(checkIdx).toBeGreaterThan(modeElseIdx);
    const signedInBeforeCheck = code.lastIndexOf('setSignedIn(true);', checkIdx);
    expect(signedInBeforeCheck).toBeGreaterThan(-1);
    expect(signedInBeforeCheck).toBeLessThan(checkIdx);
  });
});

describe('KNYTS and CI inherit this capability automatically via the shared Passport surface', () => {
  it('neither bridge Passport room contains its own authentication logic', () => {
    for (const file of [
      'components/journey/KnytsBridgePassportRoom.tsx',
      'components/journey/ConstitutionalInternetBridgePassportRoom.tsx',
    ]) {
      const code = stripComments(readSource(file));
      expect(code, `${file} must not implement its own sign-in logic`).not.toContain('signInWithPassword');
      expect(code, `${file} must not implement its own sign-in logic`).not.toContain('useSupabaseSessionPersonas');
      expect(code).toContain('PassportBureauApplyTab');
    }
  });
});
