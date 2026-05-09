# Spine Integration Brief — Identity, Assets, Receipts (for KNYT Reputation/Rewards/Tasks)

**Date:** 2026-05-09
**Audience:** Agent working on the KNYT reputation, rewards, and task-management workstream
**Status:** Spine is fully shipped (Phase 1 + Phase 2 closed; Phase 3 receipts pending). Build on top of it now.
**Branch this brief tracks:** `claude/blockchain-identity-ai-foundation-lEyk2` → dev

---

## Read this first (10 min, no skipping)

The spine is live. Everything you build for reputation, rewards, and tasks **must** go through it for two reasons:
1. **Privacy contract** — receipts attribute via cohort alias commitments, NOT personaId/rootDid. Violating this leaks compliance-bearing identifiers onto chain.
2. **Single decision authority** — every gated action (content read, reward grant, task completion) flows through `evaluateAccess`. Don't write parallel gates; extend the spine.

If you take one thing from this brief: **never read `personaId` from the browser, never write `personaId` into a receipt, never duplicate the decision logic.** Use the canonical functions below.

---

## Canonical contracts you'll consume

### Identifier exposure tiers (don't mix them)

| Tier | Where it lives | Examples | What you can do |
|---|---|---|---|
| **T0** server-internal | Server only (Lambda) | `personaId`, `authProfileId`, `rootDid`, `fioHandle` | Use as DB key, pass to internal services. NEVER serialise to JSON for the browser, NEVER include in receipts. |
| **T1** browser-safe | Postmessage + JSON responses | `personaSessionToken` (HMAC envelope), `displayLabel`, `ownFioHandle`, `cartridgeFlags` | Render in UI, log for debugging, use as a refresh trigger. |
| **T2** public-network | DVN, Bitcoin ordinals | `cohortAliasCommitment`, `cohortId` | Public attribution. The ONLY identifier allowed in receipts. |

### `ActivePersonaContext` (T0)

What `getActivePersona()` returns server-side:

```ts
interface ActivePersonaContext {
  personaId: string;           // T0 — server-internal UUID
  authProfileId: string;       // T0 — multi-email-merged caller id
  identifiability: 'anonymous' | 'pseudo' | 'semi' | 'full';
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
  cohortMemberships: string[];
  fioHandle?: string | null;   // T0 — null until on-chain registration
  source: 'session-cookie' | 'session-token' | 'api-key' | 'postmessage-token';
}
```

### `ActivePersonaSurface` (T1) — the only thing browser code reads

Returned by `GET /api/wallet/active-persona`:

```ts
interface ActivePersonaSurface {
  personaSessionToken: string;     // opaque HMAC envelope, server-resolves to T0
  displayLabel: string | null;     // user's pet name (e.g. "Knight")
  ownFioHandle: string | null;     // caller's own FIO handle only
  identifiability: Identifiability;
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
  cohortMemberships: string[];
  sessionExpiresAt: string;
}
```

### `AccessDecision`

What `evaluateAccess()` returns:

```ts
interface AccessDecision {
  allow: boolean;
  reason: 'free' | 'owned' | 'credential-met' | 'token-proof-verified' |
          'payment-required' | 'credential-required' | 'token-required' |
          'fio-handle-required' | 'policy-blocked' | 'guardian-vetoed';
  deliveryMode: 'plain-redirect' | 'decrypt-stream' | 'page-image-proxy' | 'token-proof-stream';
  receipt: {
    mode: 'sync' | 'async-batched' | 'none';
    aliasCommitment?: string;      // T2 — the ONLY id in receipts
    cohortId?: string;             // T2 — group attribution
  };
}
```

---

## The functions you'll use

All on the server side. Don't bypass them.

### Identity resolution

```ts
import { getActivePersona } from '@/services/identity/getActivePersona';

// In any API route:
const persona = await getActivePersona(request);
if (!persona) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// Now you have ActivePersonaContext (T0). Use persona.personaId as your DB key.
```

### Asset ownership check

```ts
import { userOwnsAsset } from '@/services/rewards/assetOwnership';

const ownership = await userOwnsAsset(persona.personaId, assetId);
if (ownership.owned) { /* grant reward / mark task complete */ }
```

### Access decision (the unified gate)

```ts
import { getContentDescriptor } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

const descriptor = await getContentDescriptor(assetId);
const decision = await evaluateAccess(persona, descriptor, 'read');
// Or 'mint' / 'transfer' / 'payment-settle' for tx-class actions.
if (!decision.allow) {
  return NextResponse.json(
    { error: 'denied', reason: decision.reason },
    { status: 403 },
  );
}
```

### Browser-side identity (T1 surface only)

```ts
// Your client code — call once on mount + on aa-persona-change-v1 broadcast
const res = await fetch('/api/wallet/active-persona', {
  headers: { Authorization: `Bearer ${supabaseAccessToken}` },
});
const surface: ActivePersonaSurface = await res.json();
// Use surface.displayLabel for display, surface.personaSessionToken for forwarding,
// surface.cartridgeFlags for optimistic UI rendering.
// Server re-validates flags — never trust the client's view.
```

### Inter-cartridge / cross-codex links

If reputation/rewards/tasks navigates between codexes, propagate identity via URL:

```ts
import { buildCodexUrl } from '@/utils/codex-nav';

href={buildCodexUrl('knyt-codex', {
  tab: 'rewards',
  personaSessionToken: surface.personaSessionToken,  // preferred (T1)
  // personaId: persona.personaId,                   // DEPRECATED — Phase 5 removes this
  from: 'reputation',
  fromTab: 'leaderboard',
})}
```

CLAUDE.md § Inter-Cartridge Navigation has the full canonical rule. Never rely on localStorage alone.

---

## Privacy contract — non-negotiable

### Receipts attribute via T2, never T0

When you emit an `OrchestrationEvent` for a reward grant, task completion, or reputation update:

```ts
// ✅ CORRECT
emitOrchestrationEvent({
  event_type: 'reward_granted',
  actor_alias_commitment: decision.receipt.aliasCommitment,  // T2
  cohort_id: decision.receipt.cohortId,                      // T2
  metadata: { /* asset_id, amount, etc — NO personaId */ },
});

// ❌ WRONG — leaks T0 onto the chain
emitOrchestrationEvent({
  event_type: 'reward_granted',
  actor_persona_id: persona.personaId,    // FORBIDDEN
  actor_root_did: persona.rootDid,         // FORBIDDEN
});
```

Phase 1 emits a deterministic placeholder for `aliasCommitment` until the cohortAliasService lands in Phase 3. Until then, treat `decision.receipt.aliasCommitment` as opaque; don't inspect it. When Phase 3 ships, the placeholder is replaced by a live escrow-canister-signed value and your code keeps working.

### Identifiability floor for agents

If the actor is an agent persona (delegate), the receipt's identifiability is clamped to the floor of (agent declared, operator current). The spine handles this in `getActivePersona`; you don't need to compute it. Just trust `persona.identifiability`.

### Five forbidden fields (canary)

Never include any of these in JSON the browser sees, in OrchestrationEvent metadata, or in receipts:

| Field | Why |
|---|---|
| `personaId` | T0 — server-internal only |
| `authProfileId` | T0 — multi-email-merged caller id |
| `rootDid` | T0 — compliance-bearing (`did:fio:` family) |
| `kybeAttestation` | KYC layer; reveal only via `discloseCredential()` |
| `fioHandle` (when not the caller's own) | Cross-persona reveal violates handle privacy |

Tests in `tests/persona-broadcast-handshake.test.ts` and `tests/access-spine.test.ts` enforce this. Mirror the canary pattern in your test suite.

---

## Integration points for KNYT workstream

### Reputation

- Reputation reads keyed by `persona.personaId` (T0) on the server, surfaced as a number on the T1 surface. Don't expose the underlying entries.
- Reputation deltas are receipt-eligible — call `evaluateAccess` with `action='read'` (or `'invoke'` if it modifies state) and emit an OrchestrationEvent with the alias-anchored handle.
- Cohort aggregates use `persona.cohortMemberships` — the spine populates this; you don't compute it.
- **Don't** create a parallel `reputation_personas` table that copies `personaId` outside the spine. Use the existing `personas.reputation_score` and `personas.reputation_bucket` columns or join on `persona_id`.

### Rewards

- Distribution / claim / transfer is a tx-class action. The spine guards via `fio-handle-required` — don't try to grant rewards to personas without a registered FIO handle, the spine will deny.
- Asset ownership uses `userOwnsAsset(persona.personaId, assetId)` — already canonical.
- Reward catalog gating: build a `ContentAccessDescriptor` for each reward (free / payment / credential / token-required) and run it through `evaluateAccess`. Don't roll your own gate.

### Task management

- Task assignments key off `persona.personaId` (T0). UI shows `surface.displayLabel`.
- Task completion fires through `evaluateAccess` if the completion gates content (e.g. unlocking a chapter). Otherwise emit an OrchestrationEvent directly with alias-anchored attribution.
- Task delegation — when an agent persona acts on behalf of a human — the spine's identifiability clamp ensures the receipt records the most-restrictive level. You don't need extra logic.
- For task hand-off across cartridges (Marketa task → KNYT task), use `buildCodexUrl` with the personaSessionToken so the spine resolves the same persona in the destination codex.

---

## Database keys you can rely on

Your tables can reference these directly:

| Column | Source | Use as |
|---|---|---|
| `persona_id` | `personas.id` (TEXT or UUID — check both, schema is heterogeneous) | FK for any per-persona row |
| `auth_profile_id` | `crm_auth_profiles.id` (canonical id, multi-email merged) | FK for cross-persona aggregation (one human, multiple personas) |
| `tenant_id` | `personas.tenant_id` | Multi-tenant isolation |
| `cohort_id` | TBD — Phase 3 lands `cohort_groups` table | Cohort attribution for receipts |

Never store the FIO handle as a foreign key; use `persona_id`. The handle is mutable per-rotation; the persona id is stable.

---

## Don't build these (the spine already provides them)

| What you might be tempted to build | What to use instead |
|---|---|
| Your own `getCurrentPersona()` reading from JWT | `getActivePersona(request)` |
| Your own auth gate before granting rewards | `evaluateAccess(persona, descriptor, 'transfer')` |
| Your own FIO-handle-required check before tx | The spine already denies with `reason='fio-handle-required'`; just surface that to the UI |
| Your own admin / partner role checker | `persona.cartridgeFlags.isAdmin / isPartner` (server-resolved, browser-safe to read) |
| A parallel persona switcher | The spine emits `aa-persona-change-v1` postMessage; subscribe to it |
| Your own decryption for state-C content | `streamStateCPlaintext` from `services/content/stateCDelivery` |

---

## Where to put your work

- **API routes:** `app/api/<your-area>/...` — typical layer-3 (Service) per CLAUDE.md
- **Services:** `services/rewards/`, `services/reputation/`, `services/tasks/` — internal logic
- **Types:** add to `types/` — keep `types/access.ts` untouched (canonical contract)
- **Tests:** `tests/` — follow `tests/access-spine.test.ts` patterns (vitest, no DB)
- **Updates / decision docs:** `codexes/packs/agentiq/updates/YYYY-MM-DD_<topic>.md` and register in `codexes/packs/agentiq/collections.json` under `col_updates`

---

## Files to read before writing code

In this order:

1. `types/access.ts` — full type definitions (read 100% of it)
2. `services/identity/getActivePersona.ts` — the resolver, end-to-end
3. `services/access/evaluateAccess.ts` — the decision gate
4. `services/content/getContentDescriptor.ts` — descriptor builder (state derivation rules)
5. `services/rewards/assetOwnership.ts` — the ownership primitive
6. `app/api/wallet/active-persona/route.ts` — example of T0 → T1 stripping
7. `services/access/policyResolvers.ts` — credential / cohort / token routing logic
8. `codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md` — the plan v8 (long, but the §11 decision log is essential)

Then skim:
9. `codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` — context
10. `codexes/packs/agentiq/updates/2026-05-08_phase-1-iam-spine-closure.md` — closure record
11. `codexes/packs/agentiq/updates/2026-05-09_phase-2-encryption-decisions.md` — Phase 2 decisions

---

## Smoke test before merging anything

Run this against your branch on dev-beta:

```bash
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-persona-you-own> \
  --owned=<an-asset-the-persona-owns> \
  --txGuard=<an-asset-id>
```

All checks must pass. If you've extended the spine surface, add a new check to `scripts/verify-spine.mjs` rather than building parallel verification.

---

## Two coordination rules

1. **Don't modify `services/identity/`, `services/access/`, `services/content/encryption.ts`, or `types/access.ts`** without operator approval. These are the canonical contract — extend by composition, don't fork.
2. **Announce shared-file edits via QubeTalk bridge** (see CLAUDE.md § QubeTalk Bridge). Especially for `app/api/wallet/personas/route.ts`, `services/wallet/multiEmailIdentity.ts`, and the persona row schema.

---

## Open questions you can answer in your first commit

- **What's the canonical schema for reputation events?** Plan §11.b mentions `reputation_events` but it's not built yet. Pick a shape, file it as a decisions doc in `codexes/packs/agentiq/updates/`, and pull-request the migration.
- **Cohort group taxonomy** — Phase 3 lands the `cohort_groups` table and the cohortAliasService. If your reputation/rewards plumbing needs cohort routing earlier, file a sub-decision doc and align with the Phase 3 plan in §Phase 3 of the unified IAM doc.
- **Receipt batching cadence** — sync vs async-batched is per-action; the spine's `policyResolvers.resolveReceiptMode` is the authority. If you need a new action class, extend that resolver, don't fork.

---

## TL;DR for the agent

- Read 11 files (list above) before any code lands
- Use `getActivePersona`, `evaluateAccess`, `userOwnsAsset`, `buildCodexUrl` — never rebuild them
- T0 ids stay server-side. Receipts attribute via T2 alias commitments. Surface T1 to browsers
- FIO required for tx-class actions; spine denies otherwise — surface the deny reason in your UI
- Run `verify-spine.mjs` before merging
- Land your decisions in `codexes/packs/agentiq/updates/` so the next agent starts where you left off
