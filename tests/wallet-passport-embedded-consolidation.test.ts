/**
 * Passport sign-in inside the metaMe wallet — nested-modal repair AND
 * wallet-surface convergence (operator rulings, 2026-08-02).
 *
 * PRIOR DEFECT 1: `SmartWalletDrawer`'s persona-menu dropdown (a small
 * `absolute` popover) mounted `PassportConnectPanel`, which — on choosing a
 * wallet profile that needed unlocking — rendered `<UnlockModal>`, a
 * viewport-level `fixed inset-0 z-50 bg-black/80` overlay. Clicking "unlock"
 * from inside a 240px dropdown popped a full-screen modal on top of the
 * drawer that was itself already open: "nested modal inside modal".
 *
 * FIX 1 adds an additive, opt-in `embedded` prop to `UnlockModal` (skips the
 * fixed-overlay wrapper, renders inline) and threads it through
 * `PassportConnectPanel` to its own `<UnlockModal>` mount.
 *
 * PRIOR DEFECT 2 (containment, not architecture): even embedded, an
 * authentication ceremony mounted inside a small account popover was still
 * the wrong SURFACE. The governing rule: "the persona menu may INITIATE
 * Passport sign-in, it may not HOST it." The same defect existed on the
 * Wallet tab's own signed-out state, which briefly (2026-08-02, superseded
 * same day) embedded its own second copy of the ceremony directly in the
 * tab body — and neither entry point worked from any OTHER tab, since
 * `initialTab` gated whether a signed-out visitor ever saw a way in at all.
 *
 * FIX 2 adds a wallet-LEVEL surface override, `WalletSurface` (null |
 * 'PASSPORT_SIGN_IN' | 'PASSPORT_CONNECTED' | 'RECOVERY_OPTIONS'), rendered
 * ABOVE the entire tab-nav + tab-content region — not one more tab, not a
 * second popup. Every entry point (the persona-dropdown's row, the Wallet
 * tab's own fallback prompt, and an auto-open effect for any signed-out
 * visitor regardless of `initialTab`) sets this ONE piece of state and
 * closes whatever menu/dropdown it fired from; NEITHER entry point mounts
 * `PassportConnectPanel` directly any more — only the overlay branch does,
 * so there is exactly ONE mount of the ceremony in the whole file.
 *
 * Every check below is source-authority (comment-blind), matching the
 * sibling passport-connect test files' convention for this repo's `node`
 * vitest environment (no React rendering harness).
 */

import { describe, it, expect } from "vitest";

import { readSource, stripComments } from "./_lib/sourceAuthority";

const UNLOCK_MODAL = "app/components/wallet/UnlockModal.tsx";
const PANEL = "components/companion/PassportConnectPanel.tsx";
const WALLET_DRAWER = "app/components/content/SmartWalletDrawer.tsx";

describe("UnlockModal — embedded prop skips the viewport-level overlay", () => {
  it("accepts an embedded prop, defaulting to false so every existing call site is unaffected", () => {
    const src = stripComments(readSource(UNLOCK_MODAL));
    expect(src).toMatch(/embedded\?:\s*boolean/);
    expect(src).toMatch(/embedded\s*=\s*false/);
  });

  it("the fixed, viewport-covering overlay class only applies when NOT embedded", () => {
    const src = stripComments(readSource(UNLOCK_MODAL));
    expect(src).toContain("fixed inset-0 z-50");
    const overlayAt = src.indexOf("fixed inset-0 z-50");
    const before = src.slice(Math.max(0, overlayAt - 300), overlayAt);
    expect(before).toMatch(/embedded\s*\?/);
  });

  it("the embedded branch never carries a backdrop or fixed positioning", () => {
    const src = stripComments(readSource(UNLOCK_MODAL));
    const ternaryAt = src.search(/embedded\s*\?/);
    expect(ternaryAt).toBeGreaterThan(-1);
    const colonAt = src.indexOf(":", ternaryAt);
    const embeddedBranch = src.slice(ternaryAt, colonAt);
    expect(embeddedBranch).not.toContain("fixed");
    expect(embeddedBranch).not.toContain("backdrop");
    expect(embeddedBranch).not.toContain("bg-black/80");
  });
});

describe("PassportConnectPanel — threads embedded through to its own UnlockModal mount", () => {
  it("declares an embedded prop, defaulting to false", () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/embedded\?:\s*boolean/);
    expect(src).toMatch(/embedded\s*=\s*false/);
  });

  it("passes embedded straight through to <UnlockModal>", () => {
    const src = stripComments(readSource(PANEL));
    const at = src.indexOf("<UnlockModal");
    expect(at).toBeGreaterThan(-1);
    const mountBlock = src.slice(at, src.indexOf("/>", at) + 2);
    expect(mountBlock).toMatch(/embedded=\{embedded\}/);
  });
});

describe("SmartWalletDrawer — WalletSurface type and state", () => {
  it("declares the exact WalletSurface literal union the operator specified", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    expect(src).toMatch(
      /type WalletSurface = null \| "PASSPORT_SIGN_IN" \| "PASSPORT_CONNECTED" \| "RECOVERY_OPTIONS";/,
    );
  });

  it("initializes walletSurface to null — every existing tab renders unchanged by default", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    expect(src).toMatch(/const \[walletSurface, setWalletSurface\] = useState<WalletSurface>\(null\);/);
  });
});

describe("SmartWalletDrawer — the persona menu INITIATES sign-in, it does not HOST it", () => {
  it("the dropdown's Passport row is a plain button, never a mounted PassportConnectPanel", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const doorAt = src.indexOf("Sign in with Passport");
    expect(doorAt, "the persona-menu entry row is missing").toBeGreaterThan(-1);
    const buttonStart = src.lastIndexOf("<button", doorAt);
    const buttonEnd = src.indexOf("</button>", doorAt);
    const buttonBlock = src.slice(buttonStart, buttonEnd);
    expect(buttonBlock, "the dropdown must not mount the ceremony itself").not.toContain("<PassportConnectPanel");
  });

  it("clicking the door closes the dropdown AND sets walletSurface — never one without the other", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const doorAt = src.indexOf("Sign in with Passport");
    const buttonStart = src.lastIndexOf("<button", doorAt);
    const onClickAt = src.indexOf("onClick", buttonStart);
    const onClickEnd = src.indexOf("}}", onClickAt);
    const onClickBlock = src.slice(onClickAt, onClickEnd);
    expect(onClickBlock).toContain("setPersonaMenuOpen(false)");
    expect(onClickBlock).toContain("setWalletSurface('PASSPORT_SIGN_IN')");
  });
});

describe("SmartWalletDrawer — the wallet-surface override replaces tab content regardless of which tab was active", () => {
  it("the override branches on walletSurface === null, ABOVE the tab-nav and tab-content region", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const branchAt = src.indexOf("walletSurface === null ? (");
    expect(branchAt, "could not find the walletSurface === null branch").toBeGreaterThan(-1);
    const tabNavAt = src.indexOf('wallet-tab-nav px-3', branchAt);
    expect(tabNavAt, "the tab-nav must be INSIDE the null branch, not the other way around").toBeGreaterThan(branchAt);
  });

  it("the non-null branch renders PassportConnectPanel for PASSPORT_SIGN_IN, independent of activeTab", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const elseBranchAt = src.indexOf(") : (", src.indexOf("walletSurface === null ? ("));
    expect(elseBranchAt).toBeGreaterThan(-1);
    const signInAt = src.indexOf("walletSurface === 'PASSPORT_SIGN_IN'", elseBranchAt);
    expect(signInAt, "PASSPORT_SIGN_IN branch not found in the override").toBeGreaterThan(-1);
    const panelAt = src.indexOf("<PassportConnectPanel", signInAt);
    expect(panelAt).toBeGreaterThan(-1);
    const mountBlock = src.slice(panelAt, src.indexOf("/>", panelAt) + 2);
    expect(mountBlock).toContain('world="application"');
    expect(mountBlock).toContain("embedded");
    // This branch's condition never mentions activeTab or a specific
    // DrawerTab — the whole point is tab-independence.
    const conditionLine = src.slice(src.lastIndexOf("\n", signInAt), signInAt);
    expect(conditionLine).not.toContain("activeTab");
  });

  it("a successful connection transitions to PASSPORT_CONNECTED and re-pins the persona through the SAME context setter every other switch uses", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const signInAt = src.indexOf("walletSurface === 'PASSPORT_SIGN_IN'");
    const panelAt = src.indexOf("<PassportConnectPanel", signInAt);
    const onConnectedBlock = src.slice(panelAt, src.indexOf("/>", panelAt) + 2);
    expect(onConnectedBlock).toContain("ctxSetActivePersonaId(pinned)");
    expect(onConnectedBlock).toContain("refreshPersonas()");
    expect(onConnectedBlock).toContain("setWalletSurface('PASSPORT_CONNECTED')");
  });

  it("PASSPORT_CONNECTED shows Citizen Passport / resolved persona / session / wallet status, then offers Continue — never a dead end", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const connectedAt = src.indexOf("walletSurface === 'PASSPORT_CONNECTED' && (");
    expect(connectedAt).toBeGreaterThan(-1);
    const nextBranchAt = src.indexOf("RECOVERY_OPTIONS", connectedAt);
    const connectedBlock = src.slice(connectedAt, nextBranchAt > -1 ? nextBranchAt : connectedAt + 3000);
    expect(connectedBlock).toContain("Passport connected");
    expect(connectedBlock).toContain("connectedPassport?.passportClass");
    expect(connectedBlock).toMatch(/activePersona\?\.displayName/);
    expect(connectedBlock).toContain("isWalletUnlocked");
    expect(connectedBlock).toContain("Continue to Wallet Home");
  });

  it("Back clears walletSurface and never fabricates a preserved-tab state — activeTab itself is never touched", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    // Anchor on the Back button's own unique gating condition, not the bare
    // word "Back" or the generic ") : (" pattern — both occur many times
    // elsewhere in the (unchanged) tab system's own inner ternaries.
    const gateAt = src.indexOf("walletSurface !== 'PASSPORT_CONNECTED'");
    expect(gateAt, "the Back button's gating condition is missing").toBeGreaterThan(-1);
    const backAt = src.indexOf("Back", gateAt);
    expect(backAt, "no Back control found after the gating condition").toBeGreaterThan(-1);
    const buttonStart = src.lastIndexOf("<button", backAt);
    const onClickAt = src.indexOf("onClick", buttonStart);
    expect(src.slice(onClickAt, backAt)).toContain("setWalletSurface(null)");
    // No setActiveTab call anywhere in the override branch — restoring the
    // prior tab is implicit (activeTab was never changed in the first place).
    const closeAt = src.indexOf("\n      </div>\n\n      {/* Unlock Modal */}", gateAt);
    const overrideBody = src.slice(gateAt, closeAt > -1 ? closeAt : gateAt + 4000);
    expect(overrideBody).not.toContain("setActiveTab(");
  });

  it("the override never invokes an injected external-wallet provider", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const gateAt = src.indexOf("walletSurface !== 'PASSPORT_CONNECTED'");
    const closeAt = src.indexOf("\n      </div>\n\n      {/* Unlock Modal */}", gateAt);
    const overrideBody = src.slice(gateAt, closeAt > -1 ? closeAt : gateAt + 4000);
    for (const forbidden of ["window.ethereum", "window.solana", "WalletConnect", "eth_requestAccounts"]) {
      expect(overrideBody, `override must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("RECOVERY_OPTIONS is a reserved, honest placeholder — no pair-device/cloud-backup/recovery-contact backend is introduced", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const recoveryAt = src.indexOf("walletSurface === 'RECOVERY_OPTIONS'");
    expect(recoveryAt, "RECOVERY_OPTIONS branch is missing from the type/render contract").toBeGreaterThan(-1);
    const blockEnd = src.indexOf(")}", recoveryAt);
    const block = src.slice(recoveryAt, blockEnd);
    // Nothing sets this surface anywhere in the file — no new capability was
    // wired to it, so no fetch/service call belongs inside its render branch.
    expect(block).not.toContain("fetch(");
    expect((src.match(/setWalletSurface\('RECOVERY_OPTIONS'\)/g) ?? []).length).toBe(0);
    for (const forbidden of ["pair", "Pair", "cloud-backup", "recovery-contact", "recoveryContact"]) {
      expect(block, `RECOVERY_OPTIONS render must not name an unbuilt capability as if it existed: ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });
});

describe("SmartWalletDrawer — an auto-open effect converges every signed-out landing, regardless of initialTab", () => {
  it("waits for session resolution, fires at most once, and resets once genuinely signed in", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const effectAt = src.indexOf("autoPromptedPassportSignInRef");
    expect(effectAt, "the auto-open guard ref is missing").toBeGreaterThan(-1);
    const useEffectAt = src.indexOf("useEffect(", effectAt);
    const effectBody = src.slice(useEffectAt, src.indexOf("}, [sessionEmail, sessionPersonasLoading, walletSurface]);", useEffectAt));
    expect(effectBody).toContain("if (sessionPersonasLoading) return;");
    expect(effectBody).toContain("autoPromptedPassportSignInRef.current = false;");
    expect(effectBody).toContain("if (autoPromptedPassportSignInRef.current) return;");
    expect(effectBody).toContain("setWalletSurface('PASSPORT_SIGN_IN');");
  });

  it("guards on walletSurface !== null too, so it never fights an already-open or already-dismissed surface", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const effectAt = src.indexOf("autoPromptedPassportSignInRef.current) return;");
    const nextLines = src.slice(effectAt, effectAt + 200);
    expect(nextLines).toContain("if (walletSurface !== null) return;");
  });
});

describe("SmartWalletDrawer — one ceremony, one mount, everywhere else is an entry point", () => {
  it("only ONE PassportConnectPanel mount exists in the whole file — the dropdown and Wallet-tab rows are plain entry buttons, not forks of the ceremony", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const importCount = (src.match(/import \{ PassportConnectPanel(?:, type PassportFacts)? \}/g) ?? []).length;
    expect(importCount).toBe(1);
    const mountCount = (src.match(/<PassportConnectPanel/g) ?? []).length;
    expect(mountCount, "exactly one PassportConnectPanel mount — the wallet-surface override").toBe(1);
  });

  it("the Wallet tab's own signed-out fallback is an entry button, not an embedded copy of the ceremony", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const copyAt = src.indexOf("Create your first persona to unlock wallet features");
    expect(copyAt).toBeGreaterThan(-1);
    const walletTabAt = src.lastIndexOf('activeTab === "wallet"', copyAt);
    expect(walletTabAt).toBeGreaterThan(-1);
    const walletTabBlock = src.slice(walletTabAt, copyAt);
    expect(walletTabBlock).toContain("!sessionEmail");
    expect(walletTabBlock, "the Wallet tab must not mount a second copy of the ceremony").not.toContain(
      "<PassportConnectPanel",
    );
    expect(walletTabBlock).toContain("setWalletSurface('PASSPORT_SIGN_IN')");
  });

  it("'Create your first persona' still shows for a SIGNED-IN citizen with no persona yet — never for a signed-out visitor", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const copyAt = src.indexOf("Create your first persona to unlock wallet features");
    expect(copyAt).toBeGreaterThan(-1);
    const walletTabAt = src.lastIndexOf('activeTab === "wallet"', copyAt);
    expect(walletTabAt).toBeGreaterThan(-1);
    const before = src.slice(walletTabAt, copyAt);
    expect(before).toMatch(/!hasAnyPersona/);
    expect(before).toMatch(/!sessionEmail\s*\?/);
  });
});

/**
 * A FAILED PERSONA LOAD IS NOT AN EMPTY ACCOUNT (operator report, 2026-08-02).
 *
 * The operator, signed in with existing personas, saw "No personas yet.
 * Create one to get started." `useSupabaseSessionPersonas` returned early on
 * any non-OK response — 401, 5xx, or the 12s abort — WITHOUT setting state, so
 * `sessionPersonas` stayed `[]` and rendered identically to a genuinely empty
 * account. Two harms, not one: the real failure was invisible (nothing on
 * screen said a request had failed), and the remedy offered was actively
 * wrong — an operator who already has personas is invited to create a
 * duplicate.
 *
 * This is the same fail-faithful discipline the passkey and review-access
 * work already applies: unknown must remain unknown. It must never collapse
 * into absence, and absence must never be presented as fact when the only
 * thing established is that the question could not be answered.
 */
describe("persona load failure is distinguishable from an empty account", () => {
  const HOOK = "app/hooks/useSupabaseSessionPersonas.ts";

  it("the hook exposes personasLoadFailed on its public contract, not just internally", () => {
    const src = stripComments(readSource(HOOK));
    const ifaceAt = src.indexOf("export interface SessionIdentity");
    expect(ifaceAt).toBeGreaterThan(-1);
    const iface = src.slice(ifaceAt, src.indexOf("}", ifaceAt));
    expect(iface, "SessionIdentity must declare personasLoadFailed").toMatch(
      /personasLoadFailed:\s*number\s*\|\s*null/,
    );
    expect(src, "and the hook must actually return it").toMatch(/return\s*\{[^}]*personasLoadFailed[^}]*\}/);
  });

  it("every non-OK / thrown persona fetch records the failure instead of returning silently", () => {
    const src = stripComments(readSource(HOOK));
    // The non-OK branch must set the status before returning — a bare
    // `return;` here is the exact defect this suite exists to prevent.
    expect(src).toMatch(/if\s*\(!res\.ok\)\s*\{[\s\S]{0,400}?setPersonasLoadFailed\(res\.status\)/);
    // And the catch must record it too — an aborted/failed request is
    // "unknown", not "none".
    // (`stripComments` blanks comments in place, preserving length — the gap
    // here is mostly the explanatory comment, not code.)
    expect(src).toMatch(/catch[\s\S]{0,400}?setPersonasLoadFailed\(0\)/);
    // A successful load clears it, so the unknown state is never sticky.
    expect(src).toMatch(/setPersonasLoadFailed\(null\)/);
  });

  it("the persona dropdown's create-persona prompt is gated on a CONFIRMED empty list", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const promptAt = src.indexOf("No personas yet. Create one to get started.");
    expect(promptAt).toBeGreaterThan(-1);
    // Walk back to the JSX guard that renders it.
    const guardAt = src.lastIndexOf("sessionEmail &&", promptAt);
    expect(guardAt).toBeGreaterThan(-1);
    const guard = src.slice(guardAt, promptAt);
    expect(
      guard,
      "the empty-state prompt must require personasLoadFailed === null — a load we could not complete says nothing about whether personas exist",
    ).toContain("personasLoadFailed === null");
  });

  it("the Wallet tab's create-persona fallback is likewise gated, and offers Retry when the load failed", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const promptAt = src.indexOf("Create your first persona to unlock wallet features");
    expect(promptAt).toBeGreaterThan(-1);
    const failedAt = src.lastIndexOf("Your personas could not be loaded.", promptAt);
    expect(
      failedAt,
      "the could-not-load branch must be evaluated BEFORE the create-persona branch, or an unknown list falls through to it",
    ).toBeGreaterThan(-1);
    const between = src.slice(failedAt, promptAt);
    expect(between).toContain("refreshPersonas()");
    expect(between, "the failure branch must not offer persona creation as the remedy").not.toContain(
      "setPersonaSetupOpen(true)",
    );
  });

  it("no caller passes an argument to refreshPersonas — the hook takes none and forces a refetch itself", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const bad = src.match(/refreshPersonas\(\s*[^)\s]/g) ?? [];
    expect(bad, `refreshPersonas takes no parameters; found ${bad.join(", ")}`).toHaveLength(0);
  });
});
