# Passport Connect signing-surface repair — metaMe wallet, not injected providers

**Date:** 2026-08-01
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Trigger:** operator ruling — `Connect with your Passport` was invoking Phantom/MetaMask
via `window.ethereum`, which is architecturally wrong. The metaMe wallet is the Passport's
principal signing surface; external wallets are optional linked wallets, never a substitute.

## The regression

`components/companion/PassportConnectPanel.tsx` signed the wallet-control challenge via:

```ts
const eth = provider(); // reads window.ethereum
await eth.request({ method: "eth_requestAccounts" });
await eth.request({ method: "personal_sign", params: [ch.message, address] });
```

Traced path: **Connect button → `connect()` → `provider()` (`window.ethereum`) →
`eth_requestAccounts` → `choose-wallet` (injected account chooser) → `performProof()` →
`personal_sign`**. Whatever extension happened to be installed (Phantom, MetaMask, …) became
the de facto Passport authentication surface — never the intended design.

## The corrected order (anonymous-first, unchanged)

No Supabase session is required before signing, and the client never needs to know the
authoritative persona before signing:

```
resolve local wallet candidate → prove control (sign) → server recovers the address
→ server resolves the authenticated Passport/persona → establish session
```

`localStorage.currentPersonaId` is used **only** to preselect/label the last-used local wallet
— never as authentication or authority. The `/api/passport-connect/challenge` and
`/api/passport-connect/proof` server contract is **unchanged**: `keyService.signMessage`
produces the same EIP-191 personal-sign signature format an injected provider would have, so
the server needed zero changes.

## What shipped

- **`services/wallet/localWalletStore.ts`** (new) — a session-independent, browser-local index
  of encrypted metaMe wallet profiles created/imported on this device
  (`personaId`, `address`, `displayLabel`, `encryptedPrivateKey`, `lastUsedAt`). Never
  authoritative — a UX convenience cache only. Dual-written from
  `services/wallet/personaService.ts::createPersona` alongside the existing server persona
  write.
- **`components/companion/PassportConnectPanel.tsx`** (rewritten) — `provider()` /
  `window.ethereum` / `eth_requestAccounts` / `personal_sign` removed entirely. `choose-wallet`
  (injected account chooser) replaced by `select-wallet-profile` (local metaMe wallet
  profiles, always an explicit click — even for a single profile, no auto-pick). Unlock via
  the existing `UnlockModal` + `sessionService` stack; sign via
  `keyService.signMessage`. New `no-local-wallet` state offers first-party recovery only
  (**Restore metaMe wallet** — real, working private-key import; **Pair another metaMe
  device** / **Recover wallet** — honestly labeled "coming soon", not fabricated; **Begin
  Passport creation** — described, not linked to a guessed URL, since the creation wizard has
  no verified standalone route).
- **`PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED`** — exported refusal constant +
  `refuseInjectedProviderForPassportAuth()`, a deterministic throw for any future code path
  that reintroduces injected-provider signing into this file.
- **`app/passport-connect/page.tsx`** — header addendum: the two mount points
  (companion/application) still exist for storage-partition/handoff reasons, independent of
  `window.ethereum`, which is no longer used at all.

## Known, tracked gap (not solved by this repair)

The local wallet **profile index** is itself per-origin `localStorage` — a wallet profile
saved in the top-level app is not visible from inside the Companion extension's partitioned
iframe. That is the same partition class the file already documented for
`window.ethereum` reachability, now surfaced honestly as **"Pair another metaMe device"**
(disabled, not fabricated) in the `no-local-wallet` state rather than silently assumed solved.

## Tests

- `tests/passport-connect-no-injected-provider.test.ts` (new, 17 canaries): comment-blind
  source-authority checks that live code never references `window.ethereum`/`window.solana`/
  `eth_requestAccounts`/`personal_sign`/`WalletConnect`; import-authority checks that the panel
  imports `keyService.signMessage`, `sessionService.getKeyForSigning`, the existing
  `UnlockModal`, and `localWalletStore`; behavioral tests for `localWalletStore` enumeration/
  preselect-hint/recency/removal; refusal-constant behavioral test.
- `tests/passport-connection-challenge.test.ts` — 3 "ruling 6" canaries updated to assert the
  corrected signing/chooser shape (`signWithLocalKey`/`getKeyForSigning`,
  `select-wallet-profile`, `profiles: LocalWalletProfile[]`) instead of the removed
  injected-provider shape. Same invariants, corrected implementation detail.
- Full suite: 225 files / 3775 tests passing.

`tsc --noEmit` is currently broken repo-wide in this sandbox on an unrelated pre-existing
config mismatch (`tsconfig.json`'s `ignoreDeprecations: "6.0"` is invalid for the installed
TypeScript 5.9.3) — confirmed present before this change and out of scope here.
