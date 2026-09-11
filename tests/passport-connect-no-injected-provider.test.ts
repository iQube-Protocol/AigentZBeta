/**
 * Passport connect signing-surface repair (operator ruling, 2026-08-01).
 *
 * REGRESSION FIXED: `components/companion/PassportConnectPanel.tsx` used to
 * sign the wallet-control challenge through `window.ethereum` — an injected
 * browser-extension provider (MetaMask, Phantom, whichever happened to be
 * installed). The canonical boundary is: the metaMe wallet is the Passport's
 * principal signing surface; MetaMask/Phantom/WalletConnect are optional
 * EXTERNALLY LINKED wallets that must never substitute for it in the
 * Passport authentication path.
 *
 * These canaries prove:
 *   1. Connect with Passport never invokes an injected provider (source
 *      authority, comment-blind per tests/_lib/sourceAuthority.ts — a
 *      module's own header is allowed to NAME window.ethereum in prose
 *      explaining the boundary without failing its own canary).
 *   2. Connect with Passport signs through the local metaMe wallet key
 *      material (`services/wallet/keyService.signMessage`), unlocked via
 *      the same `UnlockModal` + `sessionService` stack every other wallet
 *      surface uses — not a parallel signer.
 *   3. `PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED` is a real, throwable
 *      refusal, not just a comment.
 *   4. The local wallet profile store enumerates/preselects/persists
 *      session-independently — `currentPersonaId` is read only as a UX
 *      hint, never as authority.
 *   5. External wallets remain reachable only through a distinct action
 *      (Restore/Pair/Recover), never as a fallback inside the Connect
 *      ceremony itself.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { readSource, stripComments, importAuthority } from "./_lib/sourceAuthority";
import {
  PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED,
  refuseInjectedProviderForPassportAuth,
} from "@/components/companion/PassportConnectPanel";

const PANEL = "components/companion/PassportConnectPanel.tsx";
const LOCAL_WALLET_STORE = "services/wallet/localWalletStore.ts";

// Executable patterns an injected-provider signing path would need. Checked
// against COMMENT-STRIPPED source only — the file's own header legitimately
// documents this exact boundary in prose, naming these same substrings, and
// must not fail its own canary for doing so (the grep-vs-comment defect
// class tests/_lib/sourceAuthority.ts exists to eliminate).
const FORBIDDEN_LIVE_CODE_PATTERNS = [
  "window.ethereum",
  "window.solana",
  "eth_requestAccounts",
  "personal_sign",
  "WalletConnect",
];

describe("Passport connect never invokes injected providers", () => {
  it("PassportConnectPanel.tsx's live code never references an injected provider", () => {
    const stripped = stripComments(readSource(PANEL));
    for (const pattern of FORBIDDEN_LIVE_CODE_PATTERNS) {
      expect(stripped, `found forbidden live-code pattern "${pattern}"`).not.toContain(pattern);
    }
  });

  it("localWalletStore.ts's live code never references an injected provider either", () => {
    const stripped = stripComments(readSource(LOCAL_WALLET_STORE));
    for (const pattern of FORBIDDEN_LIVE_CODE_PATTERNS) {
      expect(stripped, `found forbidden live-code pattern "${pattern}"`).not.toContain(pattern);
    }
  });

  it("PassportConnectPanel.tsx does not import an EIP-1193/WalletConnect-style provider module", () => {
    const graph = importAuthority(readSource(PANEL));
    const suspiciousSpecifiers = graph.records
      .map((r) => r.specifier)
      .filter((s) => /walletconnect|web3modal|wagmi|@metamask|eip1193|eip-1193/i.test(s));
    expect(suspiciousSpecifiers).toEqual([]);
  });
});

describe("Passport connect opens the metaMe wallet (local key material, not an injected provider)", () => {
  it("imports keyService.signMessage — the local metaMe wallet signer", () => {
    const graph = importAuthority(readSource(PANEL));
    const keyServiceImport = graph.records.find((r) => r.specifier.includes("services/wallet/keyService"));
    expect(keyServiceImport, "PassportConnectPanel.tsx must import services/wallet/keyService").toBeTruthy();
    expect(keyServiceImport!.names).toContain("signMessage");
  });

  it("imports getKeyForSigning from the existing session/unlock stack", () => {
    const graph = importAuthority(readSource(PANEL));
    const sessionServiceImport = graph.records.find((r) => r.specifier.includes("services/wallet/sessionService"));
    expect(sessionServiceImport, "PassportConnectPanel.tsx must import services/wallet/sessionService").toBeTruthy();
    expect(sessionServiceImport!.names).toContain("getKeyForSigning");
  });

  it("imports the existing UnlockModal rather than a parallel unlock UI", () => {
    const graph = importAuthority(readSource(PANEL));
    const unlockModalImport = graph.records.find((r) => r.specifier.includes("app/components/wallet/UnlockModal"));
    expect(unlockModalImport, "PassportConnectPanel.tsx must reuse the existing UnlockModal").toBeTruthy();
  });

  it("imports the local wallet profile store to enumerate this device's wallets", () => {
    const graph = importAuthority(readSource(PANEL));
    const storeImport = graph.records.find((r) => r.specifier.includes("services/wallet/localWalletStore"));
    expect(storeImport).toBeTruthy();
    expect(storeImport!.names).toEqual(
      expect.arrayContaining(["listLocalWalletProfiles", "getPreselectedLocalWalletProfile", "touchLocalWalletProfile"]),
    );
  });
});

describe("PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED — deterministic refusal", () => {
  it("is a real, non-empty refusal code", () => {
    expect(PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED).toBe("PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED");
  });

  it("throws that exact code when invoked", () => {
    expect(() => refuseInjectedProviderForPassportAuth()).toThrow(PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED);
  });
});

// ─── Local wallet profile store — session-independent enumeration ──────────

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
}

const ENCRYPTED_KEY_FIXTURE = { ciphertext: "aa", iv: "bb", salt: "cc", authTag: "dd" };

describe("localWalletStore — session-independent local wallet profiles", () => {
  let fakeLocalStorage: FakeStorage;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    fakeLocalStorage = new FakeStorage();
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("enumerates zero profiles on a fresh device — no session required", async () => {
    const { listLocalWalletProfiles, hasAnyLocalWalletProfile } = await import("@/services/wallet/localWalletStore");
    expect(listLocalWalletProfiles()).toEqual([]);
    expect(hasAnyLocalWalletProfile()).toBe(false);
  });

  it("saves and enumerates a profile written at wallet creation time — no server round trip", async () => {
    const { saveLocalWalletProfile, listLocalWalletProfiles } = await import("@/services/wallet/localWalletStore");
    saveLocalWalletProfile({
      personaId: "persona-1",
      address: "0xabc",
      displayLabel: "Alice",
      encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE,
    });
    const profiles = listLocalWalletProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].personaId).toBe("persona-1");
    expect(profiles[0].address).toBe("0xabc");
  });

  it("preselects the most-recently-used profile when no currentPersonaId hint exists", async () => {
    const { saveLocalWalletProfile, touchLocalWalletProfile, getPreselectedLocalWalletProfile } = await import(
      "@/services/wallet/localWalletStore"
    );
    saveLocalWalletProfile({ personaId: "persona-1", address: "0xa", displayLabel: "A", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    saveLocalWalletProfile({ personaId: "persona-2", address: "0xb", displayLabel: "B", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    touchLocalWalletProfile("persona-2");
    expect(getPreselectedLocalWalletProfile()?.personaId).toBe("persona-2");
  });

  it("prefers the currentPersonaId hint over recency, but ONLY as a preselect — never as authority", async () => {
    const { saveLocalWalletProfile, touchLocalWalletProfile, getPreselectedLocalWalletProfile } = await import(
      "@/services/wallet/localWalletStore"
    );
    saveLocalWalletProfile({ personaId: "persona-1", address: "0xa", displayLabel: "A", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    saveLocalWalletProfile({ personaId: "persona-2", address: "0xb", displayLabel: "B", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    touchLocalWalletProfile("persona-2"); // persona-2 is now most-recently-used
    fakeLocalStorage.setItem("currentPersonaId", "persona-1"); // but the hint points at persona-1
    expect(getPreselectedLocalWalletProfile()?.personaId).toBe("persona-1");
  });

  it("falls back to recency when the currentPersonaId hint matches no local profile", async () => {
    const { saveLocalWalletProfile, getPreselectedLocalWalletProfile } = await import("@/services/wallet/localWalletStore");
    saveLocalWalletProfile({ personaId: "persona-1", address: "0xa", displayLabel: "A", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    fakeLocalStorage.setItem("currentPersonaId", "some-other-persona-not-on-this-device");
    expect(getPreselectedLocalWalletProfile()?.personaId).toBe("persona-1");
  });

  it("returns null when this device holds no local wallet profile at all", async () => {
    const { getPreselectedLocalWalletProfile } = await import("@/services/wallet/localWalletStore");
    expect(getPreselectedLocalWalletProfile()).toBeNull();
  });

  it("removeLocalWalletProfile forgets a profile on this device only", async () => {
    const { saveLocalWalletProfile, removeLocalWalletProfile, listLocalWalletProfiles } = await import(
      "@/services/wallet/localWalletStore"
    );
    saveLocalWalletProfile({ personaId: "persona-1", address: "0xa", displayLabel: "A", encryptedPrivateKey: ENCRYPTED_KEY_FIXTURE });
    removeLocalWalletProfile("persona-1");
    expect(listLocalWalletProfiles()).toEqual([]);
  });
});

// ─── External wallets remain a distinct, non-substituting action ──────────

describe("External wallets never substitute for the Passport authentication surface", () => {
  it("the no-local-wallet recovery state never routes to an injected-provider fallback", () => {
    const stripped = stripComments(readSource(PANEL));
    // The "no local wallet" recovery copy/actions must exist without ever
    // reaching for an injected provider anywhere in the same file.
    expect(stripped).toContain("no-local-wallet");
    for (const pattern of FORBIDDEN_LIVE_CODE_PATTERNS) {
      expect(stripped).not.toContain(pattern);
    }
  });
});
