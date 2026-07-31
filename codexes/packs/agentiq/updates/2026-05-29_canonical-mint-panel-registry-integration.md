# Canonical Mint Panel — iQube Registry integration backlog

**Date:** 2026-05-29
**Branch:** `claude/review-session-setup-V82mB` → dev
**Status:** Phase 7B admin UI v1 shipped; Registry integration deferred

## What shipped

The Canonical Mint Panel (`components/admin/CanonicalMintPanel.tsx`) is the admin UI for triggering on-chain master mints via `POST /api/admin/content-qube/mint-master`. It currently lives at the top of the KNYT Codex Admin surface (`KnytCodexAdminTab.tsx`) because that's the most visible canonical-content admin view today.

What the panel does:

- Lists `content_qubes` rows from a small list endpoint (`GET /api/admin/content-qube/list`) with per-state lifecycle badges and counts.
- Per row: editable owner address field + "Mint master" button with two-step confirm.
- Optimistic local update flips the row badge to `chain-minted` on success.
- Surfaces `skipped` reasons (e.g. `contract_unconfigured`, chainId mismatch) and errors inline next to the row.
- Idempotency-safe: server returns 409 `already_minted` and the panel renders the lock badge.

What it does NOT do (v1 scope):

- Edition mint (ERC-1155). Needs editionId / editionNumber / rarity / holder, which is a richer form. Lands in v2.
- Bulk mint (mint everything in `canonized` state at once). Add when there's an actual operational need.
- Treasury wallet selection. Currently the owner address is per-row free text; future versions should bind to a known set of approved minter destinations.

## Why it lives in `KnytCodexAdminTab` today

The KNYT Codex Admin is the most active canonical-content admin surface in the platform — operators are already there day-to-day. Mounting the panel there gives the highest discoverability without standing up a new admin tab. The panel is a self-contained component (`components/admin/CanonicalMintPanel.tsx`) so it lifts and shifts elsewhere without rework.

## iQube Registry integration — when that workstream ships

The Registry is the canonical surface for iQubes (per the Agent Legibility Profile and the broader iQube spine architecture). When the operator-facing Registry UI ships, the Canonical Mint Panel should move there. Specifically:

1. **Mount the panel in the Registry admin surface** — replace the per-cartridge tab integration with a Registry-level "Canonical Mint" section, scoped by series via the `series` prop.
2. **Read from the canonical Registry list endpoint** instead of `/api/admin/content-qube/list`. The list endpoint here exists as a thin stand-in; the Registry will have its own enumeration with richer metadata (cartridge bindings, access policy, DVN receipt anchors, etc.).
3. **Pre-fill the owner address from the Registry's treasury config** rather than per-row free text. Each Registry-tracked iQube class has a designated mint destination; the panel should default to it and only allow override with a confirm step.
4. **Surface the on-chain state alongside the lifecycle state** — the Registry response already carries `chain_minted_at`, `base_token_id`, and the DVN receipt anchor for any minted row. Render these in the panel UI so the operator sees the full state at a glance, not just the lifecycle badge.
5. **Add the edition mint flow** at the Registry level, where editions are first-class entities with their own rows (`content_qube_editions`). The current per-master mint panel is a v1 simplification.
6. **Remove the mount from `KnytCodexAdminTab`** once Registry is live, to avoid two operator surfaces firing the same on-chain action.

## Operational notes

- The panel uses `personaFetch` (the canonical spine-Bearer helper) so it works correctly across browser, iframe, and embed contexts.
- The chain assertion shipped in `services/chain/baseTokenMint.ts` (commit `89adda9a`) means a misconfigured RPC env var will surface as a loud `Connected RPC is chainId X, expected 8453` error string in the panel rather than silently submitting to the wrong chain.
- The two admin routes that back the panel (`mint-master` + `mint-edition`) are both spine-gated by `cartridgeFlags.isAdmin`. The panel itself does not duplicate the gate — it just makes the calls.

## Files

| Path | Purpose |
|---|---|
| `components/admin/CanonicalMintPanel.tsx` | Reusable panel component (mount anywhere) |
| `app/api/admin/content-qube/list/route.ts` | Admin list endpoint backing the panel |
| `app/api/admin/content-qube/mint-master/route.ts` | Master mint endpoint |
| `app/api/admin/content-qube/mint-edition/route.ts` | Edition mint endpoint (no UI yet) |
| `services/chain/baseTokenMint.ts` | Underlying chain interaction service |
| `app/triad/components/codex/tabs/KnytCodexAdminTab.tsx` | Current mount point (top of HumanView) |
