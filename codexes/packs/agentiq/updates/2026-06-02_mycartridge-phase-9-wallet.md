# myCartridge Phase 9 — Wallet integration (template + cartridge config readout)

**Date:** 2026-06-02
**Status:** Phase 9a shipped — WalletTemplate replaces WalletStub, reads cartridge config, surfaces token whitelist + enabled primitives + owner-only payment-request CTA stub. Phase 9b carries the deep wiring (TransactionModal `mode: 'request'`, embedded SmartWalletDrawer with cartridge-scoped EVM token filter).
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §19, §32 Phase 9, §33 row 9
**Predecessors:** Phase 4a (codex_configs), Phase 6 (wizard writes smart_triad_config.wallet), Phase 7 (manager edits it), Phase 8 (cartridge chat context)

## What Phase 9a delivered

The Wallet tab template — cartridge-scoped, real, no-stub. Mounted automatically for every cartridge that has a `wallet-v1` tab.

### Files

| File | Status | Change |
|---|---|---|
| `app/triad/components/codex/tabTemplates/WalletTemplate.tsx` | NEW | Reads `/api/cartridge/[slug]` for the cartridge's `smart_triad_config.wallet` + `token_whitelist`. Renders accepted-tokens chips, an enabled-primitives checklist (cryptoSend/cryptoReceive/paymentRequest/rewardPayout), and an owner-only "Request payment" CTA stub (disabled, labelled "Phase 9b"). Graceful empty states for "wallet disabled" and "lookup failed". |
| `app/triad/components/codex/tabTemplates/registry.tsx` | MODIFIED | Swap `WalletStub` → `WalletTemplate` for `wallet-v1`. |
| `app/triad/components/codex/tabTemplates/StubTemplate.tsx` | MODIFIED | Removed the `WalletStub` factory (no longer referenced). Updated the file-header phase plan comment. |

### How it renders

- **Owner OR member** sees: cartridge title chip, accepted-tokens chips (Q¢, USDC, KNYT — labelled), enabled-primitives checklist.
- **Owner only** (`caller.canEdit === true`) additionally sees: "Request payment" CTA, disabled with a "Phase 9b" tooltip.
- **Wallet not enabled** (cartridge owner left the wizard step 5 wallet toggle off) renders a labelled empty state pointing to the manager's Triad > Wallet panel.
- **Cartridge lookup fails** (persona has no role on the cartridge) renders an amber error line explaining the spine-gated read.

### Cartridge config reads

The template hits `GET /api/cartridge/[slug]` (Phase 7 route). The response shape it consumes:

```ts
{
  ok: true,
  cartridge: {
    title: string,
    tokenWhitelist: string[],          // top-level Phase 4a column
    smartTriadConfig: {                 // top-level Phase 4a column
      wallet: {
        enabled: boolean,
        tokenWhitelist: string[],       // nested copy from the wizard
        primitives: {
          cryptoSend, cryptoReceive,
          paymentRequest, rewardPayout: boolean
        }
      }
    } | null
  },
  caller: { canEdit: boolean }
}
```

The template prefers the nested `smartTriadConfig.wallet.tokenWhitelist` over the top-level array (the wizard writes both, but the nested copy is the source-of-truth shape for the wizard's downstream consumers).

## What Phase 9a explicitly does NOT include

The PRD §19 calls out four MVP wallet primitives + a `TransactionModal mode: 'request'` variant. Phase 9a:

| Item | Phase 9a behaviour | Phase 9b deliverable |
|---|---|---|
| Crypto-send for rewards | Checklist item only | Cartridge-scoped SmartWalletDrawer mount with token-whitelist EVM filter |
| Crypto-send for payments | Checklist item only | Same |
| Crypto-receive | Checklist item only | Same — drawer's address QR / copy already works against the visitor's persona |
| Payment request | CTA button disabled with "Phase 9b" label | `TransactionTab` union extension to add `'request'`, new request-tab body in TransactionModal, owner-fills-it / visitor-fulfils-it flow |
| Token whitelist filter | Surfaced as informational chips | Pushed into SmartWalletDrawer's EVM token list as a real filter |

Each is its own focused commit. Phase 9a is the canonical template + cartridge config readout — the framework that lets Phase 9b drop deeper wallet behaviour in cleanly.

### Why I split this way

The existing `SmartWalletDrawer` (148-line props interface, 2000+ line file) is wired to the runtime's `SmartTriadProvider` state shape (active persona's wallet addresses, payer/recipient, library context, etc.). Mounting it inline inside a cartridge tab template would require:

- Either duplicating the persona/wallet wiring inside the template (high regression risk against the runtime's existing mount in `SmartTriadSurfaces.tsx`).
- Or threading the runtime SmartTriad provider into the tab renderer (touches `TabRenderer.tsx`, `CodexPanelDynamic.tsx`, and the layout shell — much bigger surface).

The cleaner path is Phase 9b: extend SmartWalletDrawer with a `tokenWhitelist?: string[]` prop, then mount it from the existing runtime location with the cartridge slug propagated through the SmartTriad provider. That's a 3-file, 1-day change with a clear contract, vs. ~6-file, 2-day refactor today.

## Privacy / spine alignment

- WalletTemplate's cartridge config read goes through `personaFetch` per CLAUDE.md PARAMOUNT rule (Bearer token attached).
- Phase 7's `GET /api/cartridge/[slug]` already gates on role (member-or-above for read; owner-or-admin for the `canEdit` flag). Wallet config visibility inherits that gate.
- The template never reads or echoes `owner_persona_id` (T0).
- Token-whitelist surfacing as informational chips carries no persona-attributable data; safe to render even in shared / embed surfaces.

## Test posture

- TS clean.
- 42 sibling spine tests pass; 1 pre-existing fail (logged `isDebugBypassEnabled` backlog).
- No WalletTemplate unit test in Phase 9a — the template is a thin presentation layer over the Phase 7 read endpoint; the contract is the response shape, which is already enforced by the route's Zod and the type signature.

## Operator smoke test (after deploy)

1. Open a cartridge created via the wizard (Phase 6) where step 5 enabled wallet.
2. Navigate to the cartridge's Wallet tab.
3. Confirm the accepted-tokens chips list matches what step 5 wrote (Q¢ + USDC defaults; KNYT if opt-in checked).
4. Confirm the enabled-primitives checklist matches the wizard selection.
5. As owner: the "Request payment" CTA is visible but disabled.
6. As a member with non-admin role: chips + checklist visible; CTA hidden.
7. As a non-member: lookup-failed error message (spine-gated read).

## What unlocks next

- **Phase 10 (receipts + catalogue):** wallet primitive invocations (when wired in 9b) emit DVN receipts with `cartridgeSlug` attribution; Ledger tab template aggregates per-cartridge.
- **Phase 9b:** `TransactionModal.TransactionTab` union extension + cartridge-scoped SmartWalletDrawer mount.
- **v0.5 — bespoke per-cartridge ERC-20 deploy + per-cartridge `pricingService` fee-tier overrides.**
