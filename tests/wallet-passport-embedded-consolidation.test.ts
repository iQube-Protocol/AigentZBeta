/**
 * Passport sign-in inside the metaMe wallet — nested-modal repair
 * (operator ruling, 2026-08-02).
 *
 * PRIOR DEFECT: `SmartWalletDrawer`'s persona-menu dropdown (a small
 * `absolute` popover) mounted `PassportConnectPanel`, which — on choosing a
 * wallet profile that needed unlocking — rendered `<UnlockModal>`, a
 * viewport-level `fixed inset-0 z-50 bg-black/80` overlay. Clicking "unlock"
 * from inside a 240px dropdown popped a full-screen modal on top of the
 * drawer that was itself already open: "nested modal inside modal", exactly
 * the anti-pattern the operator named. Separately, a signed-out visitor
 * landing on the Wallet tab's main body saw "Create your first persona to
 * unlock wallet features" — wrong copy for someone who is not even signed in.
 *
 * THE FIX adds an additive, opt-in `embedded` prop to `UnlockModal` (skips
 * the fixed-overlay wrapper, renders inline) and threads it through
 * `PassportConnectPanel` to its own `<UnlockModal>` mount, then:
 *   1. passes `embedded` at the pre-existing dropdown mount (fixes the
 *      nested-modal defect at its actual source), and
 *   2. gives the Wallet tab's own signed-out state a real Passport sign-in
 *      surface (also `embedded`) instead of the wrong "create a persona"
 *      copy — the SAME panel, not a second implementation.
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
    // The overlay treatment must be conditional on `embedded`, not unconditional.
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

describe("SmartWalletDrawer — the nested-modal defect is fixed at its actual source", () => {
  it("the persona-dropdown's PassportConnectPanel mount passes embedded", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const at = src.indexOf("<PassportConnectPanel");
    expect(at, "PassportConnectPanel must still be mounted in the dropdown").toBeGreaterThan(-1);
    const mountBlock = src.slice(at, src.indexOf("/>", at) + 2);
    expect(mountBlock, "the dropdown-nested panel must render its unlock step inline, not as a second overlay").toContain(
      "embedded",
    );
  });

  it("the Wallet tab offers Passport sign-in as its own signed-out state — not the wrong 'create a persona' copy", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const copyAt = src.indexOf("Create your first persona to unlock wallet features");
    expect(copyAt, "could not find the create-persona copy").toBeGreaterThan(-1);
    // The nearest preceding `activeTab === "wallet"` is THIS block's own
    // guard (an earlier, unrelated quick-prompts block also uses the same
    // condition string, so anchoring forward from the first occurrence in
    // the file would walk into the wrong block).
    const walletTabAt = src.lastIndexOf('activeTab === "wallet"', copyAt);
    expect(walletTabAt, "could not find the Wallet tab's own guard").toBeGreaterThan(-1);
    const walletTabBlock = src.slice(walletTabAt, copyAt);
    expect(walletTabBlock).toContain("!sessionEmail");
    const signedOutAt = walletTabBlock.indexOf("!sessionEmail");
    const secondPanelAt = walletTabBlock.indexOf("<PassportConnectPanel", signedOutAt);
    expect(secondPanelAt, "the Wallet tab's signed-out branch must mount PassportConnectPanel").toBeGreaterThan(-1);
    const secondMountBlock = walletTabBlock.slice(secondPanelAt, walletTabBlock.indexOf("/>", secondPanelAt) + 2);
    expect(secondMountBlock).toContain("embedded");
    expect(secondMountBlock).toContain('world="application"');
  });

  it("'Create your first persona' still shows for a SIGNED-IN citizen with no persona yet — never for a signed-out visitor", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const copyAt = src.indexOf("Create your first persona to unlock wallet features");
    expect(copyAt).toBeGreaterThan(-1);
    const walletTabAt = src.lastIndexOf('activeTab === "wallet"', copyAt);
    expect(walletTabAt).toBeGreaterThan(-1);
    // The nearest branch guard before this copy must require hasAnyPersona
    // to be false, gated behind a signed-in check (`: !hasAnyPersona ?` —
    // the else-branch of the `!sessionEmail ? ... : !hasAnyPersona ? ...`
    // chain) — never reachable purely because there is no session at all.
    const before = src.slice(walletTabAt, copyAt);
    expect(before).toMatch(/!hasAnyPersona/);
    expect(before).toMatch(/!sessionEmail\s*\?/);
  });

  it("only ONE PassportConnectPanel implementation is imported — the dropdown and the Wallet-tab mounts both reuse it, never a fork", () => {
    const src = stripComments(readSource(WALLET_DRAWER));
    const importCount = (src.match(/import \{ PassportConnectPanel \}/g) ?? []).length;
    expect(importCount).toBe(1);
    const mountCount = (src.match(/<PassportConnectPanel/g) ?? []).length;
    expect(mountCount).toBe(2);
  });
});
