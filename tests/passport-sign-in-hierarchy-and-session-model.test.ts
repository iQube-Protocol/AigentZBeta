/**
 * Passport sign-in v2 — hierarchy repair, wallet-password field, passkey
 * diagnostics, and independent session/wallet state model (operator ruling,
 * 2026-08-02, see PassportConnectPanel.tsx's own header for the full trace).
 *
 * Structural checks follow this repo's established source-authority
 * convention (tests/_lib/sourceAuthority.ts, mirrored by the sibling
 * tests/passport-connect-passkey-first.test.ts) — this file's own vitest
 * environment is `node` with no React rendering harness. Behavioral checks
 * exercise `services/wallet/sessionService.ts` directly against a fake
 * `window`/`sessionStorage`, the same pattern
 * tests/passport-connect-no-injected-provider.test.ts uses for
 * `localWalletStore.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { readSource, stripComments, importAuthority, extractJsonResponseBodies } from "./_lib/sourceAuthority";

const PANEL = "components/companion/PassportConnectPanel.tsx";

/**
 * Bracket-balanced body extraction. `signatureStart` must end with the
 * function body's own opening `{` (as in the sibling
 * tests/passport-connect-passkey-first.test.ts convention) — that brace is
 * already "consumed" by the signature text, so counting starts at depth 1
 * from there rather than re-discovering a `{` by scanning forward, which
 * would wrongly match an EARLIER brace embedded in the signature itself
 * (e.g. a return-type annotation like `): { reason: X; message: string } {`).
 */
function extractFunctionBody(src: string, signatureStart: string): string {
  expect(signatureStart.endsWith("{"), "signatureStart must end with the body's opening '{'").toBe(true);
  const sigAt = src.indexOf(signatureStart);
  expect(sigAt, `could not find ${signatureStart}`).toBeGreaterThan(-1);
  const bodyStart = sigAt + signatureStart.length - 1; // index of that opening '{'
  let depth = 1;
  for (let i = bodyStart + 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(bodyStart, i + 1);
    }
  }
  throw new Error(`unbalanced braces reading ${signatureStart}`);
}

function idleBlock(src: string): string {
  const idleAt = src.indexOf('state.kind === "idle"');
  expect(idleAt).toBeGreaterThan(-1);
  const idleBlockEnd = src.indexOf('state.kind === "working"', idleAt);
  return src.slice(idleAt, idleBlockEnd > -1 ? idleBlockEnd : undefined);
}

// ─────────────────────────────────────────────────────────────────────────
// Required ordinary sign-in hierarchy (Recovery always last)
// ─────────────────────────────────────────────────────────────────────────

describe("Passport sign-in hierarchy — passkey, wallet password, username/password, THEN recovery", () => {
  it("a visible wallet-password field/action appears in the primary (idle) sign-in flow", () => {
    const block = idleBlock(stripComments(readSource(PANEL)));
    // Either shape is a legitimate rendering of the SAME affordance —
    // the inline single-profile field, or the multi-profile entry button —
    // but at least one must be present in the idle screen's own source.
    const hasInlineField = block.includes("Wallet password") && block.includes("Unlock and continue");
    const hasMultiProfileEntry = block.includes("Unlock with wallet password");
    expect(hasInlineField || hasMultiProfileEntry, "idle screen must offer a wallet-password path").toBe(true);
  });

  it("orders: passkey, wallet password, username/password, forgot-password, THEN recovery — never any other order", () => {
    const block = idleBlock(stripComments(readSource(PANEL)));
    const passkeyAt = block.indexOf("Continue with passkey");
    const walletPasswordLabelAt = block.indexOf("Wallet password");
    const multiProfileEntryAt = block.indexOf("Unlock and continue");
    const usernamePasswordAt = block.indexOf("Use username and password");
    const forgotAt = block.indexOf("Forgot wallet password?");
    const usingNewDeviceAt = block.indexOf("Using a new device?");
    const recoveryOptionsAt = block.indexOf("Recovery options");

    for (const [label, pos] of [
      ["Continue with passkey", passkeyAt],
      ["Wallet password (either shape)", Math.max(walletPasswordLabelAt, multiProfileEntryAt)],
      ["Use username and password", usernamePasswordAt],
      ["Forgot wallet password?", forgotAt],
      ["Using a new device?", usingNewDeviceAt],
      ["Recovery options", recoveryOptionsAt],
    ] as const) {
      expect(pos, `${label} must be present in the idle block`).toBeGreaterThan(-1);
    }

    const walletPasswordAt = walletPasswordLabelAt > -1 ? walletPasswordLabelAt : multiProfileEntryAt;
    expect(passkeyAt).toBeLessThan(walletPasswordAt);
    expect(walletPasswordAt).toBeLessThan(usernamePasswordAt);
    expect(usernamePasswordAt).toBeLessThan(forgotAt);
    expect(forgotAt).toBeLessThan(usingNewDeviceAt);
    expect(usingNewDeviceAt).toBeLessThan(recoveryOptionsAt);
  });

  it("recovery ('Using a new device?' / 'Recovery options') is the LAST thing in the idle block, after every ordinary method", () => {
    const block = idleBlock(stripComments(readSource(PANEL)));
    const recoveryOptionsAt = block.indexOf("Recovery options");
    const everythingElse = ["Continue with passkey", "Use username and password", "Forgot wallet password?"];
    for (const marker of everythingElse) {
      const at = block.indexOf(marker);
      expect(at, `${marker} must be present`).toBeGreaterThan(-1);
      expect(at).toBeLessThan(recoveryOptionsAt);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Username not required when a local wallet profile is known + fallback
// ─────────────────────────────────────────────────────────────────────────

describe("Wallet-password unlock never requires a username when a local profile is known", () => {
  it("unlockSingleKnownProfile takes only a profile and a password — no username/email parameter", () => {
    const src = stripComments(readSource(PANEL));
    const declAt = src.indexOf("const unlockSingleKnownProfile = useCallback(");
    expect(declAt).toBeGreaterThan(-1);
    expect(src.slice(declAt, declAt + 300)).toContain(
      "async (profile: LocalWalletProfile, password: string)",
    );
    const body = extractFunctionBody(src, "async (profile: LocalWalletProfile, password: string) => {");
    expect(body).not.toMatch(/email|username/i);
  });

  it("the inline wallet-password form has no email/username input alongside it", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("{selectedProfile ? (");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("</form>", start);
    const form = src.slice(start, end);
    expect(form).toContain('type="password"');
    expect(form).not.toContain('type="email"');
  });
});

describe("Username/password fallback remains available", () => {
  it("the idle screen offers 'Sign in with username and password', routing to the username-password state", () => {
    const block = idleBlock(stripComments(readSource(PANEL)));
    expect(block).toContain("Use username and password");
    expect(block).toContain('setState({ kind: "username-password" })');
  });

  it("UsernamePasswordForm signs in via the SAME Supabase client used elsewhere in the app — no parallel client", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("function UsernamePasswordForm(");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start);
    expect(body).toContain("getSupabaseBrowserClient().auth.signInWithPassword(");
  });

  it("a successful username/password sign-in never calls unlockWallet, cacheDecryptedKey, or createSession", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("function UsernamePasswordForm(");
    const body = src.slice(start, src.indexOf("export default PassportConnectPanel"));
    for (const forbidden of ["unlockWallet(", "cacheDecryptedKey(", "createSession(", "recordStrongAuthentication("]) {
      expect(body, `UsernamePasswordForm must not call ${forbidden}`).not.toContain(forbidden);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Passkey failure diagnostics — classified, never a generic retry message
// ─────────────────────────────────────────────────────────────────────────

const CLASSIFY_SIGNATURE =
  'function classifyPasskeyStartError(err: unknown): { reason: PasskeyFailureReason; message: string } {';

describe("Passkey failure diagnostics — classifyPasskeyStartError", () => {
  it("uses @simplewebauthn/browser's own WebAuthnError, not hand-matched DOMException.name strings", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, CLASSIFY_SIGNATURE);
    expect(body).toContain("err instanceof WebAuthnError");
  });

  it("classifies the ambiguous no-credential/cancelled case with the exact required fallback message", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, CLASSIFY_SIGNATURE);
    expect(body).toContain("No passkey is available here. Use your wallet password instead.");
  });

  it("every classified branch names the wallet-password fallback — no dead end", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, CLASSIFY_SIGNATURE);
    const messages = [...body.matchAll(/message:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      if (message.includes("interrupted")) continue; // ceremony-aborted: a real retry, not a dead end
      expect(message, `"${message}" should point at the wallet-password fallback`).toMatch(/wallet password/i);
    }
  });

  it("connectWithPasskey routes startAuthentication failures through classifyPasskeyStartError, and never a bare generic retry string", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    expect(body).toContain("classifyPasskeyStartError(err)");
    expect(body).not.toContain("Passkey sign-in was not completed. Please try again.");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Password-identity audit — findings recorded, not silently assumed
// ─────────────────────────────────────────────────────────────────────────

describe("Password-identity audit is recorded in the panel's own documentation", () => {
  it("names the wallet-encryption and Supabase account passwords as independent, never-synced credentials", () => {
    const src = readSource(PANEL); // prose header — do not strip comments
    expect(src).toMatch(/structurally independent, never-synced credentials/i);
  });

  it("labels the Supabase recovery path 'Recover account access', never 'Recover wallet'", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("Recover account access");
    expect(src).not.toMatch(/recover\s+(your\s+)?wallet\b/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Independent session/wallet state model
// ─────────────────────────────────────────────────────────────────────────

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  keys(): string[] {
    return [...this.store.keys()];
  }
  values(): string[] {
    return [...this.store.values()];
  }
}

describe("sessionService — independent WalletAccessState facts (operator ruling, 2026-08-02)", () => {
  let fakeSessionStorage: FakeStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalSessionStorage = (globalThis as { sessionStorage?: unknown }).sessionStorage;

  beforeEach(() => {
    fakeSessionStorage = new FakeStorage();
    // `window.crypto` (not bare `global.crypto`) so keyService.ts's
    // `getRandomBytes` takes its browser-shaped branch (`getRandomValues`)
    // rather than the legacy Node `crypto.randomBytes` branch, which the
    // WebCrypto polyfill installed by tests/setup/webcrypto.ts does not
    // implement.
    (globalThis as { window?: unknown }).window = { crypto: globalThis.crypto };
    (globalThis as { sessionStorage?: unknown }).sessionStorage = fakeSessionStorage;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { sessionStorage?: unknown }).sessionStorage = originalSessionStorage;
  });

  it("a successful wallet-password unlock creates a bounded wallet session", async () => {
    const { encryptPrivateKey } = await import("@/services/wallet/keyService");
    const { unlockWallet, isWalletUnlocked, getSession } = await import("@/services/wallet/sessionService");

    const encrypted = await encryptPrivateKey("0x".padEnd(66, "1"), "correct horse battery staple 1");
    const result = await unlockWallet("persona-1", encrypted, "correct horse battery staple 1");

    expect(result.success).toBe(true);
    expect(isWalletUnlocked("persona-1")).toBe(true);
    const session = getSession();
    expect(session?.personaId).toBe("persona-1");
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("never persists the plaintext password — only session metadata (personaId/timestamps/flag) is written to sessionStorage", async () => {
    const { encryptPrivateKey } = await import("@/services/wallet/keyService");
    const { unlockWallet } = await import("@/services/wallet/sessionService");

    const plaintextPassword = "this-exact-string-must-never-be-stored";
    const encrypted = await encryptPrivateKey("0x".padEnd(66, "2"), plaintextPassword);
    await unlockWallet("persona-2", encrypted, plaintextPassword);

    for (const value of fakeSessionStorage.values()) {
      expect(value).not.toContain(plaintextPassword);
    }
  });

  it("a wrong password fails unlockWallet and leaves no session behind", async () => {
    const { encryptPrivateKey } = await import("@/services/wallet/keyService");
    const { unlockWallet, isWalletUnlocked } = await import("@/services/wallet/sessionService");

    const encrypted = await encryptPrivateKey("0x".padEnd(66, "3"), "the-real-password-123");
    const result = await unlockWallet("persona-3", encrypted, "totally-wrong-password");

    expect(result.success).toBe(false);
    expect(isWalletUnlocked("persona-3")).toBe(false);
  });

  it("recordStrongAuthentication does NOT imply walletUnlocked — passkey/username-password success must never flip wallet state", async () => {
    const { recordStrongAuthentication, getLastStrongAuthenticationAt, isWalletUnlocked, getWalletAccessState } =
      await import("@/services/wallet/sessionService");

    recordStrongAuthentication();

    expect(getLastStrongAuthenticationAt()).not.toBeNull();
    expect(isWalletUnlocked("persona-passkey-only")).toBe(false);

    const state = getWalletAccessState({
      personaId: "persona-passkey-only",
      sessionAuthenticated: true,
      walletAvailable: true,
    });
    expect(state.sessionAuthenticated).toBe(true);
    expect(state.walletUnlocked).toBe(false);
    expect(state.walletSessionExpiresAt).toBeNull();
    expect(state.lastStrongAuthenticationAt).not.toBeNull();
  });

  it("getWalletAccessState reports all five facts independently — a wallet unlock for one persona never leaks into another's read", async () => {
    const { encryptPrivateKey } = await import("@/services/wallet/keyService");
    const { unlockWallet, getWalletAccessState } = await import("@/services/wallet/sessionService");

    const encrypted = await encryptPrivateKey("0x".padEnd(66, "4"), "persona-4-password");
    await unlockWallet("persona-4", encrypted, "persona-4-password");

    const unlockedRead = getWalletAccessState({
      personaId: "persona-4",
      sessionAuthenticated: true,
      walletAvailable: true,
    });
    expect(unlockedRead.walletUnlocked).toBe(true);
    expect(unlockedRead.walletSessionExpiresAt).not.toBeNull();

    const otherPersonaRead = getWalletAccessState({
      personaId: "persona-5-never-unlocked",
      sessionAuthenticated: true,
      walletAvailable: true,
    });
    expect(otherPersonaRead.walletUnlocked).toBe(false);
    expect(otherPersonaRead.walletSessionExpiresAt).toBeNull();
  });
});

describe("connectWithPasskey never calls the wallet-unlock primitives — passkey success must not imply walletUnlocked", () => {
  it("connectWithPasskey's body never calls unlockWallet, cacheDecryptedKey, or createSession", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    for (const forbidden of ["unlockWallet(", "cacheDecryptedKey(", "createSession("]) {
      expect(body, `connectWithPasskey must not call ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("connectWithPasskey DOES call recordStrongAuthentication on a verified assertion — the holder-control proof is still recorded", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(src, "const connectWithPasskey = useCallback(async () => {");
    expect(body).toContain("recordStrongAuthentication()");
  });
});

describe("The wallet-password proof path records strong authentication exactly where the proof is verified", () => {
  it("handleProofResponse calls recordStrongAuthentication only after pr?.ok, never on a link-required/no-passport branch", () => {
    const src = stripComments(readSource(PANEL));
    const body = extractFunctionBody(
      src,
      "(status: number, pr: Record<string, unknown> | null, profile?: LocalWalletProfile) => {",
    );
    const linkRequiredAt = body.indexOf('kind: "link-passport"');
    const noPassportAt = body.indexOf('kind: "no-passport"');
    const firstRecordAt = body.indexOf("recordStrongAuthentication()");
    expect(firstRecordAt, "handleProofResponse must call recordStrongAuthentication()").toBeGreaterThan(-1);
    expect(firstRecordAt).toBeGreaterThan(linkRequiredAt);
    expect(firstRecordAt).toBeGreaterThan(noPassportAt);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Forgot password — honest "account access" labeling
// ─────────────────────────────────────────────────────────────────────────

describe("Forgot password — recovers account access only, never claims to recover the wallet", () => {
  it("the reset-password completion page exists and is labeled 'account access'", () => {
    const src = readSource("app/auth/reset-password/page.tsx");
    expect(src).toMatch(/recover account access/i);
    expect(src).not.toMatch(/recover\s+(your\s+)?wallet\b/i);
  });

  it("the reset-password page calls Supabase's own updateUser — no bespoke password-reset mechanism", () => {
    const src = stripComments(readSource("app/auth/reset-password/page.tsx"));
    expect(src).toContain("auth.updateUser({ password })");
    expect(src).toContain("PASSWORD_RECOVERY");
  });

  it("states the recovery-email precondition up front rather than letting someone submit into a dead end", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("Password recovery requires a recovery email previously added to this persona");
  });

  it("a non-email identifier in the recovery form is told email recovery is unavailable — never 'a link is on its way'", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("const submitForgotPassword = useCallback(");
    const body = src.slice(start, src.indexOf("[identifier, looksLikeEmail]", start));
    expect(body).toContain("if (!looksLikeEmail)");
    expect(body).toMatch(/Password recovery needs a recovery email/);
  });

  it("UsernamePasswordForm's forgot-password flow uses Supabase's resetPasswordForEmail, redirecting to the completion page", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("function UsernamePasswordForm(");
    const body = src.slice(start);
    expect(body).toContain("auth.resetPasswordForEmail(identifier");
    expect(body).toContain("/auth/reset-password");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Anonymous-first: no email anywhere in the wallet path (ruling, 2026-08-02)
// ─────────────────────────────────────────────────────────────────────────

describe("Anonymous-first — a citizen with no email can possess, unlock and use a Passport wallet", () => {
  /** The recognized-device wallet-unlock block, bounded to its own form. */
  function walletUnlockBlock(src: string): string {
    const start = src.indexOf("{selectedProfile ? (");
    expect(start, "the wallet-unlock block must exist").toBeGreaterThan(-1);
    return src.slice(start, src.indexOf("</form>", start));
  }

  it("the wallet-unlock block contains NO email field, input type, autocomplete or label", () => {
    const block = walletUnlockBlock(stripComments(readSource(PANEL)));
    expect(block).not.toMatch(/email/i);
  });

  it("the wallet-unlock block identifies the wallet by device-local label and address only", () => {
    const block = walletUnlockBlock(stripComments(readSource(PANEL)));
    expect(block).toContain("displayLabel");
    expect(block).toContain("address.slice(");
  });

  it("a device holding several wallets gets a selector — a password cannot say which envelope to decrypt", () => {
    const block = walletUnlockBlock(stripComments(readSource(PANEL)));
    expect(block).toContain("knownProfiles.length > 1");
    expect(block).toContain("<select");
    expect(block).toContain("metame-wallet-select");
  });

  it("a device holding exactly one wallet shows no selector — nothing to choose", () => {
    const block = walletUnlockBlock(stripComments(readSource(PANEL)));
    // The single-profile branch renders a plain label, not a <select>.
    const selectAt = block.indexOf("<select");
    const elseAt = block.indexOf(") : (", selectAt);
    expect(elseAt, "a single-profile else-branch must exist").toBeGreaterThan(selectAt);
  });

  it("zero local wallets hides the block entirely — a password cannot locate an absent wallet", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("knownProfiles.find((p) => p.personaId === selectedProfileId) ?? knownProfiles[0] ?? null");
    expect(src).toContain("{selectedProfile ? (");
  });

  it("the conventional route's identifier is labelled 'Persona or recovery email', never plain 'Email'", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("Persona or recovery email");
    // No bare uppercase EMAIL label survives on the sign-in identifier.
    const start = src.indexOf("metame-account-identifier");
    const around = src.slice(start - 400, start + 400);
    expect(around).not.toMatch(/>\s*Email\s*</);
  });

  it("the identifier input is type=text so a persona handle is not rejected by the browser before the form can explain", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf('id="metame-account-identifier"');
    const input = src.slice(start, start + 300);
    expect(input).toContain('type="text"');
    expect(input).not.toContain('type="email"');
  });
});

describe("Persona sign-in is honestly reported as unbuilt, never disguised as a wrong password", () => {
  it("a non-email identifier short-circuits before any auth call and sets the unavailable notice", () => {
    const src = stripComments(readSource(PANEL));
    const start = src.indexOf("const submitSignIn = useCallback(");
    const body = src.slice(start, src.indexOf("[identifier, looksLikeEmail, password, onSignedIn]", start));
    const guardAt = body.indexOf("if (!looksLikeEmail)");
    const authAt = body.indexOf("signInWithPassword(");
    expect(guardAt, "the persona guard must exist").toBeGreaterThan(-1);
    expect(authAt).toBeGreaterThan(-1);
    // The guard must come BEFORE the auth call, and return.
    expect(guardAt).toBeLessThan(authAt);
    expect(body.slice(guardAt, authAt)).toContain("setPersonaRouteUnavailable(true)");
    expect(body.slice(guardAt, authAt)).toContain("return;");
  });

  it("the notice names the paths that DO work rather than dead-ending", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain('Signing in with a persona name isn');
    expect(src).toContain('t available yet');
    expect(src).toMatch(/passkey/i);
  });

  it("a REAL credential mismatch still gets the generic, non-enumerating message", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("We could not complete sign-in with those details.");
    // The old enumerating message must be gone.
    expect(src).not.toContain("That email and password did not match an account.");
  });

  it("the panel does not claim the wallet and account passwords have converged (the audit says they have not)", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toContain("today a separate credential from your metaMe wallet password");
  });
});

describe("Custody audit is recorded, and the panel points at it", () => {
  it("the audit document exists and classifies the custody state", () => {
    const doc = readSource("codexes/packs/agentiq/updates/2026-08-02_wallet-custody-and-password-identity-audit.md");
    expect(doc).toMatch(/B — REMOTE PACKAGE EXISTS BUT RESTORATION IS INCOMPLETE/);
    // The ten questions must all be answered, not skipped.
    expect(doc).toMatch(/personas\.evm_key/);
    expect(doc).toMatch(/write-only/);
  });

  it("the audit explicitly forbids the unsafe shape", () => {
    const doc = readSource("codexes/packs/agentiq/updates/2026-08-02_wallet-custody-and-password-identity-audit.md");
    expect(doc).toMatch(/persona \+ password → plaintext private key returned by server/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Passkey ENROLMENT — the missing half (root cause, 2026-08-02)
// ─────────────────────────────────────────────────────────────────────────

const ENROL_PANEL = "components/passport/PasskeyEnrolmentPanel.tsx";

describe("Passkey enrolment exists and is reachable — the reason the passkey path never worked", () => {
  it("a client component finally calls the enrol routes, which previously had ZERO callers", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain("/api/passport/passkey/enrol-options");
    expect(src).toContain("/api/passport/passkey/enrol-verify");
  });

  it("uses the library's startRegistration with the optionsJSON shape the installed version declares", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain("startRegistration({ optionsJSON: opt.options })");
  });

  it("both enrol routes are spine endpoints, so they are reached via personaFetch — never raw fetch", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain('personaFetch("/api/passport/passkey/enrol-options"');
    expect(src).toContain('personaFetch("/api/passport/passkey/enrol-verify"');
    expect(src).not.toMatch(/[^a-zA-Z]fetch\("\/api\//);
  });

  it("classifies enrolment failures via WebAuthnError, never a bare retry message", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain("err instanceof WebAuthnError");
    expect(src).toContain("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED");
  });

  it("'already registered' is the AUTHENTICATOR's claim, never durable success on its own", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    const start = src.indexOf("function classifyEnrolmentError(");
    const body = src.slice(start, src.indexOf("\n}", start));
    const prevAt = body.indexOf("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED");
    const branch = body.slice(prevAt, body.indexOf("case", prevAt + 10));
    // It flags the CLAIM; it never sets a ready state by itself.
    expect(branch).toContain("authenticatorClaimsEnrolled: true");
    expect(branch).not.toContain('setState("ready")');
  });

  it("confirms the authenticator's claim against the server before showing ready", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    const at = src.indexOf("if (classified.authenticatorClaimsEnrolled)");
    expect(at, "the claim must be handled explicitly").toBeGreaterThan(-1);
    const branch = src.slice(at, src.indexOf("return;", at));
    expect(branch).toContain("await readCredentials()");
    // Server says none while the authenticator says yes -> repair, not ready.
    expect(branch).toContain('setState("needs-repair")');
  });

  it("even a clean registration success is confirmed by a server reread, never asserted", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    const at = src.indexOf("const count = await readCredentials();");
    expect(at).toBeGreaterThan(-1);
    expect(src).toContain('if (count !== null && count > 0) {');
    expect(src).toContain('setState("ready");');
  });

  it("'could not check' never renders as 'no passkey' — it stays unknown", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    // readCredentials returns null for unavailable, and the mount effect
    // deliberately leaves the state alone in that case.
    expect(src).toContain("if (count === null) return;");
    expect(src).toContain('type PasskeyState = "unknown" | "none" | "ready" | "needs-repair" | "unsupported";');
  });

  it("distinguishes all four required states in what it renders", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain("Passkey ready");
    expect(src).toContain("Passkey needs repair");
    expect(src).toContain("Add a passkey");
    expect(src).toContain("Re-enrol passkey");
  });

  it("an unconfirmed state still lets the citizen enrol — unknown must never lock them out", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    // The button is hidden only when genuinely ready.
    expect(src).toContain("{!ready ? (");
  });

  it("renders nothing where WebAuthn is unsupported — a control that cannot act must not render", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain('if (state === "unsupported") return null;');
  });

  it("resolves browser support after mount, never during render (no SSR/CSR mismatch)", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    expect(src).toContain("if (!browserSupportsWebAuthn()) {");
    expect(src).toContain("useEffect(() => {");
  });

  it("the credentials route returns metadata only — never credential ids or public keys", () => {
    const route = stripComments(readSource("app/api/passport/passkey/credentials/route.ts"));
    for (const body of extractJsonResponseBodies(route)) {
      expect(body).not.toContain("public_key");
      expect(body).not.toContain("credentialId");
    }
    // And it must distinguish "could not check" from "you have none".
    expect(route).toContain("status: 503");
  });

  it("is mounted where a signed-in citizen actually reaches it — the connected-Passport wallet surface", () => {
    const drawer = stripComments(readSource("app/components/content/SmartWalletDrawer.tsx"));
    expect(drawer).toContain("<PasskeyEnrolmentPanel />");
    const graph = importAuthority(readSource("app/components/content/SmartWalletDrawer.tsx"));
    expect(graph.records.some((r) => r.names.includes("PasskeyEnrolmentPanel"))).toBe(true);
  });

  it("enrolment adds a credential only — it never grants access or changes authority", () => {
    const src = stripComments(readSource(ENROL_PANEL));
    for (const forbidden of ["evaluateAccess", "access_grants", "claimAccessInvitation", "unlockWallet("]) {
      expect(src, `enrolment must not touch ${forbidden}`).not.toContain(forbidden);
    }
  });
});
