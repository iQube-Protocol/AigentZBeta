# KNYT Reputation / Rewards / Tasks — Spine Integration Decisions

**Date:** 2026-05-10
**Status:** Decisions doc — *first commit per the spine integration brief's "decisions-doc-first" rule*. **No feature code lands until the operator reviews and approves this doc.**
**Plan reference:** `2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md`
**Spine state:** Phases 1–3 live (`2026-05-08_phase-1-iam-spine-closure.md`, `2026-05-09_phase-2-encryption-decisions.md`, `2026-05-10_phase-3-closure.md`)
**Author:** KNYT rep/rewards/tasks workstream (claude-code session `claude/review-session-setup-V82mB`)

---

## TL;DR

This doc locks the schemas, action mappings, and receipt cadences for the KNYT
Reputation / Rewards / Tasks workstream so that every gated action flows through
the spine (`getActivePersona`, `evaluateAccess`, `userOwnsAsset`, `buildCodexUrl`,
`emitDecisionReceipt`) — never through parallel resolvers, never with T0 ids in
browser-bound JSON, never with T0 ids in receipts.

Two operator-confirmed calls drive the headline shape:

1. **Reward grants are deferred-mint + async-batched anchored.** Eligibility is
   gated by `evaluateAccess(persona, descriptor, 'invoke')` (async-batched
   receipt). The grant produces a `knyt_claims` row the user redeems later;
   the actual on-chain mint goes through `evaluateAccess(persona, descriptor,
   'mint')` which IS sync per the spine's `policyResolvers.SYNC_RECEIPT_ACTIONS`
   set — appropriate because mint IS the consequential transfer.
2. **Reputation lives in RQH only.** `crm_reputation_events` is deprecated.
   Deltas are written as RQH partition records keyed `<cohortId>:<personaId>`;
   reads come from `fetchReputationFromRQH`. The `crm_persona_reputation`
   column becomes a TTL-cached snapshot for hot reads only.

---

## 1. Persona resolution — server vs browser

| Surface | Source | Notes |
|---|---|---|
| Server (every API route + service in this workstream) | `getActivePersona(request)` from `services/identity/getActivePersona.ts` | Returns T0 `ActivePersonaContext`. Use `personaId` as DB key only. NEVER serialise to JSON. |
| Browser (Tasks tab, Reputation tab, Rewards tab, QuestRail HUD) | `GET /api/wallet/active-persona` returning T1 `ActivePersonaSurface` | Read `displayLabel`, `cartridgeFlags`, `cohortMemberships`, `personaSessionToken`. NEVER any T0 id. |
| Inter-cartridge / cross-codex links | `buildCodexUrl(slug, { personaSessionToken })` | Replaces every `?personaId=` URL today. Receiver server resolves session token → T0 context. |
| Persona-switch reactions | Subscribe to `aa-persona-change-v1` postMessage | The shell broadcasts on switch / sign-out; consumers refetch their T1 state. |

**Replacing today's `/api/wallet/tasks?personaId=` route is task-1 of Phase B
(below).** That endpoint currently reads `personaId` from a query string — a
T0 leak per the spine's privacy contract. It must switch to
`getActivePersona(request)` and strip T0 from every response field.

---

## 2. Reward catalog descriptors

Every reward catalog entry resolves server-side to a `ContentAccessDescriptor`
shape that the spine's `evaluateAccess` already consumes:

```ts
interface RewardDescriptor extends ContentAccessDescriptor {
  // ContentAccessDescriptor already covers assetId, contentClass, state,
  // gating, iqube, receiptEligible. We add reward-specific fields:
  rewardKind: 'task_completion' | 'usage' | 'referral' | 'engagement_streak' | 'manual_grant' | 'cohort_drop';
  /** KNYT amount the persona receives once the deferred claim is redeemed.
   *  Stored in cents-equivalent integer to avoid floating-point drift. */
  knytAmountCents: number;
  /** Optional Q¢ amount (rules: $1 = 100 Q¢ per CLAUDE.md canonical). */
  qcentAmount?: number;
  /** Cohort the reward belongs to (drives RQH partition). */
  cohortId?: string;
}
```

`gating` follows the spine's existing `ContentGatingDescriptor` shape with
credential strings:

| `gating.kind` | `gating.credential` examples | Resolver path |
|---|---|---|
| `free` | n/a | spine returns allow=true with `reason='free'` |
| `payment` | n/a | spine routes through KNYT debit (existing path) |
| `credential` | `cohort:knyt:backers` | RQH cohort resolver (Phase 3.3a, live) — one of the 5 seed cohorts from Phase 3 |
| `credential` | `token:ethereum:0xABC...` | EVM token resolver (Phase 3.3b, live) |
| `credential` | `admin` / `partner` | `cartridgeFlags` short-circuit (Phase 1) |

New rewards, new cohorts, new token requirements all reuse the existing
resolvers — **we do not add a parallel gate**.

---

## 3. Action class → receipt mode mapping

The spine's `policyResolvers.resolveReceiptMode` is canonical. Our workstream
slots into it:

| Workstream action | `AccessAction` | `ReceiptMode` (spine policy) | Why |
|---|---|---|---|
| Show Tasks/Reputation/Rewards tab | `read` | `async` | Idempotent read; no chain consequence |
| Claim a task (start work) | `invoke` | `async` (or `none` if classified non-eligible) | Side-effect on `crm_contributions`; no value movement |
| Submit a contribution | `invoke` | `async-batched` | Receipt-eligible: audit trail of submission |
| Editor accept / reject | `invoke` | `async-batched` | Audit trail of decision |
| **Reward eligibility passes (qualifies for grant)** | **`invoke`** | **`async-batched`** | Per operator decision: grants emit batched receipts, not sync |
| **Reward claim redeem (mint to wallet)** | **`mint`** | **`sync`** | Per spine policy: actual mints are consequential |
| Reputation delta (RQH partition write) | `invoke` | `async-batched` | Audit trail with T2 alias commitment |
| Token-gated content reveal (already covered) | `read` | `async` | Existing path; no new policy |

**The split between `'invoke'` (async-batched) eligibility and `'mint'` (sync)
redemption is what gives us "deferred-mint + async-batched anchored" without
touching `policyResolvers.SYNC_RECEIPT_ACTIONS`.** That set stays as the spine
team defined it; our flow respects the boundary.

### Open item flagged for spine team (not in scope here)

`policyResolvers.ts:53` returns `hint ? 'async' : 'async'` — both branches
return the same value. Looks like a typo where one of them should be
`'async-batched'`. Not a blocker for our work (the receipt mode is `'sync'` for
consequential actions and `'async'` otherwise, both of which work end-to-end),
but worth flagging via QubeTalk if the spine team wants to revisit.

---

## 4. Reputation event schema (RQH-only)

`crm_reputation_events` is **deprecated** by operator decision. The replacement:

### RQH partition convention

```
partition_id = `<cohortId>:<personaId>`
```

Examples:
- `knyt:risers:9de2eecc-...` — fost@knyt's reputation in the KNYT backers cohort
- `agentiq:developers:abc123-...` — a dev's reputation in the AgentiQ developers cohort

### RQH record shape (per delta event)

```jsonc
{
  "partition_id": "knyt:risers:9de2eecc-...",
  "delta": 5,                              // signed integer; can be negative
  "dimension": "community",                // matches crm_persona_reputation columns
  "source_event_id": "<orchestration_event uuid>",
  "source_kind": "task_completion" | "usage" | "referral" | "manual_grant" | "decay",
  "source_ref": "<task_template_slug | reward_id | etc>",
  "ts": "<ISO timestamp>"
}
```

The `source_event_id` is the spine's `OrchestrationEvent` row id — every RQH
delta is paired 1:1 with an alias-anchored OrchestrationEvent so the audit chain
is complete. T2 attribution (`actor_alias_commitment` + `cohort_id`) lives on
the OrchestrationEvent; `partition_id` lives in RQH; the two are linked by
`source_event_id`.

### Triggers (when a delta fires)

| Trigger | Source kind | Default delta | Cohort |
|---|---|---|---|
| Task accepted by editor | `task_completion` | `crm_task_templates.reputation_weight_<dimension>` | from task template's `cohort_id` |
| Knight-of-Attention episode complete | `usage` | configurable per category | `knyt:risers` |
| Bring-a-Knight qualified referral | `referral` | configurable | `knyt:risers` |
| Manual operator grant | `manual_grant` | per-call value | per-call cohort |
| Decay sweep (weekly cron) | `decay` | configurable per dimension | global |

### Reads

```ts
// Replaces every existing read of crm_reputation_events
import { fetchReputationFromRQH } from '@/services/crm/rewardVerificationService';
const rep = await fetchReputationFromRQH(`${cohortId}:${personaId}`);
```

`crm_persona_reputation` columns become a TTL-cached snapshot (5-min TTL; hot
read for the wallet UI). The cache is invalidated on every successful RQH
write, so the wallet badge stays fresh without N+1 RQH calls. Ledger of truth
is RQH; the column is just for performance.

---

## 5. Reward grant lifecycle (deferred-mint + async-batched)

### Phase A — Eligibility check (async-batched receipt)

```ts
import { getActivePersona } from '@/services/identity/getActivePersona';
import { evaluateAccess } from '@/services/access/evaluateAccess';
import { getRewardDescriptor } from '@/services/rewards/getRewardDescriptor';

const persona = await getActivePersona(req);
const descriptor = await getRewardDescriptor(rewardId);
const decision = await evaluateAccess(persona, descriptor, 'invoke');

if (!decision.allow) {
  // surface decision.reason ('credential-required', 'token-required',
  // 'fio-handle-required', etc) to UI
  return { ok: false, reason: decision.reason };
}

// decision.receipt.aliasCommitment + cohortId carry the T2 attribution
// receipt is already emitted (async-batched) by the spine's emitDecisionReceipt
```

### Phase B — Deferred claim creation

If the decision allows, write a `knyt_claims` row in the existing
`services/wallet/knyt/knytLedgerService.createKnytClaim` shape with status
`'pending_redemption'`. The reward `crm_rewards` row gets `status='approved'`
linked to the claim id. **No KNYT moves yet.**

### Phase C — User-initiated redemption (sync receipt + mint)

When the user clicks "Claim 50 KNYT" in the Rewards tab:

```ts
// /api/wallet/knyt/claims/redeem
const persona = await getActivePersona(req);
const claim = await loadKnytClaim(claimId);
const descriptor = await getClaimDescriptor(claim);  // returns mint-action descriptor
const decision = await evaluateAccess(persona, descriptor, 'mint');
// 'mint' is in SYNC_RECEIPT_ACTIONS — receipt anchors before decision returns

if (!decision.allow) return { ok: false, reason: decision.reason };

// Spine has anchored a sync receipt with the alias commitment.
// Now perform the mint — existing knytLedgerService.mintKnyt path:
await mintKnyt(claim.persona_id, claim.knyt_amount, claim.id);
```

This pattern reuses every existing KNYT pipeline and adds spine-mediated gating
+ alias-anchored receipts at both decision points. **Zero parallel logic.**

### What we will NOT do

- **No direct `creditKnyt(personaId, ...)` from the rewards path** — every
  reward credit must flow through the deferred-claim → `'mint'` action chain.
  The recover endpoint from earlier this session keeps using `creditKnyt`
  directly because it's an operator escape-hatch (out-of-band repair); that
  exception is explicit and gated by `ADMIN_OPS_TOKEN`.
- **No bypass of `evaluateAccess`** — every grant decision flows through the
  unified gate. If a reward is "free" (no credential / token / payment), the
  spine returns `allow=true reason='free'` and the receipt still fires.
- **No `personaId` on the `crm_rewards` audit table for browser surfaces** —
  the table itself can store T0 (it's server-internal) but the `/api/wallet/tasks`
  + `/api/wallet/rewards` JSON responses surface only `displayLabel` and
  `cohortId` for cross-persona views.

---

## 6. Task lifecycle states + receipt emission

```
available → claimed → submitted → under_review → accepted → completed
                                             ↘ rejected
```

| Transition | OrchestrationEvent emitted? | `AccessAction` | Receipt mode |
|---|---|---|---|
| `available → claimed` | No (idempotent reservation) | n/a | n/a |
| `claimed → submitted` | **Yes** | `invoke` | `async-batched` |
| `submitted → under_review` | No (operator-side bookkeeping) | n/a | n/a |
| `under_review → accepted` | **Yes** | `invoke` | `async-batched` |
| `under_review → rejected` | **Yes** | `invoke` | `async-batched` |
| `accepted → completed` (reward grant chain) | **Yes** (chains into reward grant pattern §5) | `invoke` then later `mint` | `async-batched` then `sync` |

The OrchestrationEvent rows form the durable audit trail. RQH reputation
deltas link via `source_event_id` (§4). `crm_contributions.id` is the linking
key between the workstream-internal record and the receipt.

### Cross-cartridge task hand-off

When a Marketa task references a KNYT artefact (or vice versa), the link uses
`buildCodexUrl(targetSlug, { personaSessionToken })`. The receiving cartridge
calls `getActivePersona` against the inbound session token and resolves the
same persona without ever transferring `personaId` over the wire.

---

## 7. CRM table → spine mapping (what stays, what moves)

| Table | Status post-spine | Action |
|---|---|---|
| `crm_task_templates` | **Keep** — canonical task definitions | Add `cohort_id` column if not present (drives RQH partition) |
| `crm_contributions` | **Keep** — user submission records | Add `source_event_id UUID` linking to OrchestrationEvent |
| `crm_persona_reputation` | **Demote to cache** | Becomes 5-min TTL snapshot; read-of-truth = RQH |
| `crm_reputation_events` | **Deprecate** — operator decision | New writes go to RQH; old rows preserved but read paths skip them after cutover |
| `crm_rewards` | **Keep** — reward records | Add `source_event_id UUID` + `claim_id UUID` columns; status enum extended with `'pending_redemption' / 'redeemed'` |
| `crm_category_defaults` | **Keep** — reputation weight defaults | No change |
| `knyt_publication_states` | **Keep** | No change (Living Canon lifecycle is orthogonal) |
| `knyt_elections` | **Keep** | No change (21 Sats is orthogonal) |

Migrations to land:

1. `crm_task_templates.cohort_id` — add column, backfill from category mapping
2. `crm_contributions.source_event_id` — add column, FK to `orchestration_events.id` (deferred validation per the FK pattern we hit earlier this session)
3. `crm_rewards.source_event_id`, `crm_rewards.claim_id`, status-enum extension
4. (No migration deletes `crm_reputation_events` — soft-deprecate by routing reads/writes to RQH; physical drop after 30-day audit window)

Each migration is its own commit. None modify `services/identity/`,
`services/access/`, `services/content/encryption.ts`,
`services/content/stateCDelivery.ts`, or `types/access.ts` (per CLAUDE.md
canonical-files rule).

---

## 8. Privacy contract — five forbidden fields canary

```
personaId | authProfileId | rootDid | kybeAttestation | cross-persona fioHandle
```

Tests added with this workstream (mirroring `tests/access-spine.test.ts` and
`tests/persona-broadcast-handshake.test.ts`):

```
tests/access-spine-rewards.test.ts
  - asserts no T0 leak in /api/wallet/tasks JSON response
  - asserts no T0 leak in /api/wallet/rewards JSON response
  - asserts no T0 leak in any reward-grant OrchestrationEvent metadata
  - asserts T2 alias commitment is populated on every reward-eligible event

tests/access-spine-tasks.test.ts
  - asserts no T0 leak in task lifecycle event metadata
  - asserts source_event_id links every receipt-emitting transition

tests/access-spine-reputation.test.ts
  - asserts RQH partition writes carry no T0 in metadata
  - asserts the OrchestrationEvent paired with each delta has T2 attribution
```

The vitest setup mirrors the existing spine tests — no DB required, mocked
supabase + spine-internal stubs.

---

## 9. UI surfaces — what flows through the spine

| Surface | T1 fields used | Spine call | Notes |
|---|---|---|---|
| Tasks tab in `SmartWalletDrawer` | `displayLabel`, `cartridgeFlags`, `cohortMemberships` | `/api/wallet/tasks` (post-refactor; uses `getActivePersona`) | Replaces 6 hardcoded JSX cards with data-driven render |
| Reputation tab | same | `fetchReputationFromRQH` (server-rendered for the radar; client gets the totals only) | 5-dim radar + recent events feed |
| Rewards tab | same | `/api/wallet/rewards` | Claimable list + Claim button → redeem chain (§5C) |
| Order tab right HUD `<QuestRail>` | same | `/api/wallet/tasks` (passes `activeTask`, `rewards`, `ascensionRank`) | Mobile stays hidden per existing logic |

`KnytTab.tsx` is wired to `/api/wallet/tasks` already (pre-spine); the refactor
preserves that contract while removing the T0 leak.

---

## 10. Smoke-test gate

Every merge to dev runs:

```bash
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-knyt-test-persona-uuid> \
  --owned=<satoshi-knyt-investor-or-similar> \
  --txGuard=<knyt-codex-investor>
```

If the workstream adds new spine surface area (e.g. a new credential string
shape, a new action policy decision), we extend `verify-spine.mjs` rather
than building parallel verification. We will NOT modify the canonical spine
files (`services/identity/`, `services/access/*`, etc.).

The exact persona / asset / txGuard tuple to use is "whatever makes most sense
in context" per the operator. Recommendation: a freshly-created internal test
persona seeded with an investor SKU entitlement so the same tuple covers both
ownership and credential gating.

---

## 11. Phase plan (what ships and in what order)

| Phase | Scope | Commit count est. | Operator review gate |
|---|---|---|---|
| **A — This decisions doc** | Schema + action mappings + receipt cadence locked | 1 | **Required (this commit)** |
| **B — Spine-conform existing surfaces** | `/api/wallet/tasks` route uses `getActivePersona`; `purchaseHandler.processPurchase` routes `'transfer'` through `evaluateAccess`; diagnose / recover endpoints layer the spine | 3–4 | After every commit, smoke test |
| **C — DB seed for 3 General task families** | Migration adding `knyt:bring-a-knight`, `knyt:knight-of-attention`, `knyt:herald-of-the-order` to `crm_task_templates` | 1 | After commit |
| **D — Wallet UI wire-up** | Tasks tab live, Reputation tab live, Rewards tab live with Claim button | 4–5 | After every commit |
| **E — Order tab right HUD** | `QuestRail` props from `/api/wallet/tasks` | 1 | After commit |
| **F — Tests + closure doc** | `tests/access-spine-{rewards,tasks,reputation}.test.ts`, extend `verify-spine.mjs`, file closure doc | 2–3 | Final review |

Each phase is its own commit set, one concern per commit, descriptive messages
per CLAUDE.md push rule. Smoke-test gate before every merge to dev.

---

## 12. What we will NOT touch (without operator approval)

Per CLAUDE.md § Identity & Access Spine and the integration brief:

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/identity/cohortAliasService.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/access/receiptEmitter.ts`
- `services/access/tokenOwnership.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

If any of these *needs* to change (e.g. a new credential string shape, a new
action class, a receipt-mode policy update), we file a sub-decision doc and
hand off to the spine team via QubeTalk bridge. We extend by composition, not
by forking.

---

## 13. Operator answers (locked 2026-05-10)

1. **Cohort id for the 3 General task families.** ✅ **`knyt:risers`** —
   distinct from the existing `knyt:backers` seed cohort (which gates
   investor-tier perks). `knyt:risers` is the engagement-cohort whose
   reputation deltas come from the General task families (Bring-a-Knight,
   Knight-of-Attention, Herald-of-the-Order). Phase B / Phase C migrations
   add `knyt:risers` to the cohort directory as a sixth seed cohort.

2. **Reputation decay schedule.** ✅ Weekly cron confirmed. The decay rate
   per dimension is **TBD by operator** before the cron ships — until the
   rate lands, the cron is not deployed and `source_kind='decay'` writes
   never fire. Phase F lands the decay cron stub with the rate as a
   `REPUTATION_DECAY_PCT_PER_WEEK_*` env var per dimension.

3. **`crm_persona_reputation` cache TTL.** ✅ **5 minutes confirmed.**
   Implementation: invalidate the row on every successful RQH write so the
   wallet badge updates immediately after a delta; the 5-min TTL is the
   passive refresh ceiling for hot reads that don't trigger a write.

4. **Test runtime.** ✅ **Vitest confirmed.** All new test files (Phase F)
   use the same vitest setup as `tests/access-spine.test.ts` and
   `tests/persona-broadcast-handshake.test.ts`. No Jest, no Playwright at
   this layer.

5. **Marketa ↔ KNYT cross-cartridge tasks.** ✅ **Fast follow-up.** Out of
   scope for v1 of THIS workstream, but explicitly tracked as a fast
   follow-up. Filed as a separate backlog doc:
   `2026-05-10_marketa-knyt-cross-cartridge-tasks-backlog.md`. The wallet
   wire-up in Phase D leaves the integration point open (BuildCodexUrl is
   already in place; the Marketa side just needs to start sending us
   tasks).

6. **`policyResolvers.ts:53` typo.** ✅ **Spine team via QubeTalk.** Filed
   as a QubeTalk bridge packet under `docs/qubetalk-bridge/outbox/`.
   No code change in this workstream.

---

## 14. Acceptance criteria for this decisions doc

- [x] Operator reviews and approves the 13 numbered sections
- [x] All 6 open questions in §13 have answers
- [x] Doc is registered in `codexes/packs/agentiq/collections.json` under
  `col_updates`
- [ ] Doc is referenced from the next workstream commit's message so the
  audit trail starts here *(Phase B opens this when it ships)*
- [ ] No feature code lands until this is signed off (per the integration
  brief's "decisions-doc-first" rule) *(satisfied; Phase B can begin)*

---

## References

- `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md` — the brief this doc responds to
- `codexes/packs/agentiq/updates/2026-05-08_phase-1-iam-spine-closure.md` — Phase 1 closure
- `codexes/packs/agentiq/updates/2026-05-09_phase-2-encryption-decisions.md` — Phase 2 decisions
- `codexes/packs/agentiq/updates/2026-05-10_phase-3-closure.md` — Phase 3 closure (alias commitment, receipt emitter, batcher)
- `codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md` — predecessor plan written before the spine landed
- `types/access.ts` — full type contract
- `services/access/policyResolvers.ts` — receipt-mode policy
- `services/access/evaluateAccess.ts` — the unified gate
- `services/identity/getActivePersona.ts` — T0 resolver
