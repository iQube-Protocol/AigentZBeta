/**
 * Passport connect — passkey-first, private-key-is-recovery-only repair
 * (operator ruling, 2026-08-01, see PassportConnectPanel.tsx's own header).
 *
 * PRIOR DEFECT: the idle screen's only enabled action was "Connect", which
 * for any device with no `localWalletStore` entry routed straight to a raw
 * private-key import form — an emergency recovery mechanism standing in as
 * the normal sign-in path, and a wallet-unlock ceremony conflated with
 * wallet restoration.
 *
 * THE FIX reuses the already-built, already-ratified WebAuthn passkey
 * ceremony (`services/passport/passkeyService.ts` +
 * `/api/passport/passkey/{auth,enrol}-{options,verify}`, PRD-PAG-001
 * Amendment A §A.6) rather than inventing a second identity mechanism, and
 * demotes the private-key form behind an explicit "Advanced recovery" path
 * that is never reachable as a default action.
 *
 * These canaries prove (source-authority, comment-blind — this file's own
 * vitest environment is `node`, with no React rendering harness, so every
 * check below is structural rather than a mounted-component behavioral
 * test, matching the sibling
 * tests/passport-connect-no-injected-provider.test.ts convention):
 *
 *   1. The idle screen offers "Continue with passkey" BEFORE "Unlock with
 *      wallet password" — passkey is the primary action, not an alternative.
 *   2. No raw private-key `<input>` is reachable from the idle screen's own
 *      JSX block.
 *   3. `connectWithPasskey` calls the real, existing passkey endpoints and
 *      never a second, parallel local wallet store or an injected provider.
 *   4. `completeSessionFromGrant` is the ONE shared tail both the wallet
 *      persona-choice path and the passkey path call — no duplicated
 *      handoff dance.
 *   5. `NoLocalWalletState` orders a passkey retry and the not-yet-built
 *      recovery mechanisms ahead of the demoted, warning-styled advanced
 *      private-key recovery action.
 *   6. The private-key form (`RestoreWalletForm`) carries an explicit
 *      security warning before its private-key input.
 *   7. `@simplewebauthn/browser` is imported for the client-side WebAuthn
 *      ceremony — not a bespoke implementation of the browser API.
 */

import { describe, it, expect } from "vitest";

import { readSource, stripComments, importAuthority } from "./_lib/sourceAuthority";

const PANEL = "components/companion/PassportConnectPanel.tsx";

describe("Passport connect — passkey is the primary idle action", () => {
  it("the idle screen's 'Continue with passkey' button appears BEFORE 'Unlock with wallet password'", () => {
    const src = stripComments(readSource(PANEL));
    const idleAt = src.indexOf('state.kind === "idle"');
    expect(idleAt).toBeGreaterThan(-1);
    // Bound the search to the idle block only — up to the next top-level
    // state branch, so a later, unrelated match cannot satisfy the ordering
    // check by accident.
    const idleBlockEnd = src.indexOf('state.kind === "working"', idleAt);
    const idleBlock = src.slice(idleAt, idleBlockEnd > -1 ? idleBlockEnd : undefined);
    const passkeyAt = idleBlock.indexOf("Continue with passkey");
    const walletPasswordAt = idleBlock.indexOf("Unlock with wallet password");
    expect(passkeyAt, "'Continue with passkey' must exist in the idle block").toBeGreaterThan(-1);
    expect(walletPasswordAt, "'Unlock with wallet password' must exist in the idle block").toBeGreaterThan(-1);
    expect(passkeyAt).toBeLessThan(walletPasswordAt);
  });

  it("the idle screen never shows a raw private-key label or input (a wallet-password field is not a private key, see 2026-08-02 hierarchy repair)", () => {
    const src = stripComments(readSource(PANEL));
    const idleAt = src.indexOf('state.kind === "idle"');
    const idleBlockEnd = src.indexOf('state.kind === "working"', idleAt);
    const idleBlock = src.slice(idleAt, idleBlockEnd);
    expect(idleBlock).not.toMatch(/private key/i);
    expect(idleBlock).not.toContain('placeholder="0x…"');
  });

  it("recovery is reachable from idle only via an explicit, clearly-labelled link — never the primary button", () => {
    const src = stripComments(readSource(PANEL));
    const idleAt = src.indexOf('state.kind === "idle"');
    const idleBlockEnd = src.indexOf('state.kind === "working"', idleAt);
    const idleBlock = src.slice(idleAt, idleBlockEnd);
    expect(idleBlock).toMatch(/using a new device/i);
    expect(idleBlock).toContain('setState({ kind: "no-local-wallet" })');
  });
});

describe("connectWithPasskey — reuses the real, ratified passkey ceremony", () => {
  function extractFunctionBody(src: string, signatureStart: string): string {
    const start = src.indexOf(signatureStart);
    expect(start, `could not find ${signatureStart}`).toBeGreaterThan(-1);
    let depth = 0;
    let bodyStart = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === "{") {
        if (depth === 0) bodyStart = i;
        depth++;
      } else if (src[i] === "}") {
        depth--;
        if (depth === 0 && bodyStart !== -1) return src.slice(bodyStart, i + 1);
      }
    }
    throw new Error(`unbalanced braces reading ${signatureStart}`);
  }

  it("calls the real /api/passport/passkey/auth-options and /auth-verify routes", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    expect(body).toContain("/api/passport/passkey/auth-options");
    expect(body).toContain("/api/passport/passkey/auth-verify");
  });

  it("never touches the local wallet profile store or the wallet-signing key material", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    for (const forbidden of ["localWalletStore", "getKeyForSigning", "signWithLocalKey", "listLocalWalletProfiles"]) {
      expect(body, `connectWithPasskey must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("never touches an injected provider", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    for (const forbidden of ["window.ethereum", "window.solana", "WalletConnect"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("classifies a failed startAuthentication() via classifyPasskeyStartError, never a generic retry message (2026-08-02 diagnostics repair)", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    expect(body).toContain("classifyPasskeyStartError(err)");
    expect(body).not.toContain("Passkey sign-in was not completed. Please try again.");
  });

  it("calls the shared completeSessionFromGrant tail on success — never a duplicated handoff dance", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    expect(body).toContain("completeSessionFromGrant(");
    // The passkey path has no persona-choice transactionToken to pin.
    expect(body).toMatch(/completeSessionFromGrant\(\s*\{[^}]*\},\s*null,?\s*\)/);
  });

  it("imports @simplewebauthn/browser's startAuthentication and browserSupportsWebAuthn — not a bespoke WebAuthn implementation", () => {
    const graph = importAuthority(readSource(PANEL));
    const swaImport = graph.records.find((r) => r.specifier === "@simplewebauthn/browser");
    expect(swaImport, "PassportConnectPanel.tsx must import @simplewebauthn/browser").toBeTruthy();
    expect(swaImport!.names).toEqual(expect.arrayContaining(["startAuthentication", "browserSupportsWebAuthn"]));
  });
});

describe("finalizeWithPersona and connectWithPasskey share ONE session-completion tail", () => {
  it("completeSessionFromGrant is defined exactly once and called by both paths", () => {
    const src = stripComments(readSource(PANEL));
    const definitions = src.match(/const completeSessionFromGrant = useCallback/g) ?? [];
    expect(definitions.length, "completeSessionFromGrant must be defined exactly once").toBe(1);
    const callSites = src.match(/completeSessionFromGrant\(/g) ?? [];
    // One definition-adjacent reference inside its own dependency array is
    // not a call; count actual invocations via the two call sites below.
    expect(src).toContain("await completeSessionFromGrant(");
    expect(callSites.length).toBeGreaterThanOrEqual(2);
  });

  it("only completeSessionFromGrant calls getSupabaseBrowserClient().auth.verifyOtp — no second, parallel session exchange", () => {
    const src = stripComments(readSource(PANEL));
    const verifyOtpCalls = src.match(/auth\.verifyOtp\(/g) ?? [];
    expect(verifyOtpCalls.length, "verifyOtp should be called exactly once, inside the shared helper").toBe(1);
  });
});

describe("NoLocalWalletState — passkey retry and unbuilt recovery mechanisms outrank the demoted private-key form", () => {
  function extractComponentBody(src: string, name: string): string {
    const start = src.indexOf(`function ${name}(`);
    expect(start, `could not find function ${name}`).toBeGreaterThan(-1);
    return src.slice(start);
  }

  it("orders: passkey retry, pair device, restore backup, recovery method, THEN advanced private-key import", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractComponentBody(src, "NoLocalWalletState");
    const passkeyAt = body.indexOf("Try passkey on this device");
    const pairAt = body.indexOf("Pair another metaMe device");
    const backupAt = body.indexOf("Restore encrypted backup");
    const recoveryMethodAt = body.indexOf("Use an approved recovery method");
    const advancedAt = body.indexOf("Advanced: import recovery key");
    for (const [label, pos] of [
      ["passkey retry", passkeyAt],
      ["pair device", pairAt],
      ["restore backup", backupAt],
      ["recovery method", recoveryMethodAt],
      ["advanced recovery", advancedAt],
    ] as const) {
      expect(pos, `${label} must be present`).toBeGreaterThan(-1);
    }
    expect(passkeyAt).toBeLessThan(pairAt);
    expect(pairAt).toBeLessThan(backupAt);
    expect(backupAt).toBeLessThan(recoveryMethodAt);
    expect(recoveryMethodAt).toBeLessThan(advancedAt);
  });

  it("the advanced private-key action is visually demoted (amber warning treatment), not styled like the other options", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractComponentBody(src, "NoLocalWalletState");
    const advancedAt = body.indexOf("Advanced: import recovery key");
    const buttonStart = body.lastIndexOf("<button", advancedAt);
    const buttonSlice = body.slice(buttonStart, advancedAt);
    expect(buttonSlice).toMatch(/amber/);
  });

  it("the not-yet-built recovery mechanisms remain disabled, labeled affordances — never a broken link", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractComponentBody(src, "NoLocalWalletState");
    for (const label of ["Pair another metaMe device", "Restore encrypted backup", "Use an approved recovery method"]) {
      const at = body.indexOf(label);
      const buttonStart = body.lastIndexOf("<button", at);
      const buttonSlice = body.slice(buttonStart, at);
      expect(buttonSlice, `${label} must be a disabled button`).toContain("disabled");
    }
  });
});

describe("RestoreWalletForm (advanced recovery) — explicit warning before the private-key input", () => {
  it("shows a security warning before the private-key input, not after", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("function RestoreWalletForm(");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start);
    const warningAt = body.search(/never paste it anywhere else|Anyone with this key can control/i);
    const inputAt = body.indexOf('placeholder="0x…"');
    expect(warningAt, "a security warning must exist").toBeGreaterThan(-1);
    expect(inputAt, "the private-key input must exist").toBeGreaterThan(-1);
    expect(warningAt).toBeLessThan(inputAt);
  });

  it("is titled 'Advanced recovery', not a neutral 'Restore your wallet'", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("function RestoreWalletForm(");
    const body = src.slice(start, src.indexOf("function", start + 1) === -1 ? undefined : src.indexOf("export default", start));
    expect(body).toContain("Advanced recovery");
  });
});
