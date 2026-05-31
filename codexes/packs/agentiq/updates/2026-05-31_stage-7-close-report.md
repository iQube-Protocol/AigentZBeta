# Stage 7 Close Report — AigentQube governance block on cards + mintSaga card_publishing flip

**Status:** Stage 7 complete on `claude/dreamy-gates-mMqNv`. AigentQube cards now carry a KNYT-framework-aligned governance block; mint saga `card_publishing` step warmups the legibility card endpoint; full T0-leak + Zod round-trip test coverage.
**Date:** 2026-05-31
**Branch commits this batch:** `4cb9a5ea` (single-commit batch — governance + saga + tests + this close report follow-up).

---

## What Stage 7 delivered

### Governance block on AigentQube cards

`types/iqube/legibility.ts`:

- New **`IQubeAgentGovernance`** type — surfaces KNYT framework §10/11/12/14 fields on the agent-facing card:
  - **Three-layer identity** (§10): `root_agent_id`, `deployment_id`, `persona_alias_commitment`
  - **Rights** (§11): `allowed_actions`, `cartridge_scopes`, `tool_scopes`, `data_scopes`, optional `payment_authority`
  - **Constraints** (§11): `prohibited_actions`, `prohibited_cartridges`, `must_disclose_as_agent`, `requires_human_approval`
  - **Obligations** (§12 + §14): `receipt_required_for`, `charter_accepted`, `charter_version`, `trust_band` (0..4 progression)
  - **Revocation**: `revocable_by` (root_owner / cartridge_admin / platform_admin), `revocation_receipt_required`
- `IQubeCard.agent_governance` is **optional and primitive-specific** — only populated when `primitive_type === 'AigentQube'`. ContentQube / ToolQube / DataQube / ClusterQube / ModelQube cards omit the field entirely. Existing consumers unaffected.
- All identifiers in the block are T1/T2-safe by construction. `root_agent_id` is the public iQube identifier (e.g. `aigent-marketa`), never a `personaId`.

### Zod validation

`services/iqube/legibility/schemas.ts`:

- New **`IQubeAgentGovernanceSchema`** validates the full shape with strict literal unions:
  - `trust_band` ∈ `{0, 1, 2, 3, 4}` (rejects 5+)
  - `payment_authority.currency` ∈ `{'qc', 'usdc', 'usd'}` (rejects others)
  - `revocable_by` ∈ `{'root_owner', 'cartridge_admin', 'platform_admin'}`
- `IQubeCardSchema` extended with `agent_governance: IQubeAgentGovernanceSchema.optional()`.

### Card builder

`services/iqube/legibility/cardBuilder.ts`:

- `LegibilitySource.agent_governance` field — source adapters can populate directly (preferred for live DB-backed data), or leave unset and let the builder synthesise via `defaultAigentGovernance()`.
- `buildIQubeCard` surfaces `agent_governance` when `primitive_type === 'AigentQube'`. Source-provided override beats default.
- **`defaultAigentGovernance(src)`** — conservative defaults per PRD v1.1 §B.6:

| Field | Default | Rationale |
|---|---|---|
| `payment_authority` | `undefined` (NULL) | v1.1 §B.6 — non-null requires canonization-queue approval |
| `must_disclose_as_agent` | `true` | Default-on; trust earned by overriding |
| `trust_band` | `0` | KNYT §14 entry tier; charter acceptance raises |
| `charter_accepted` | `false` | Default-deny until canonization signs charter |
| `revocable_by` | `['platform_admin']` | Highest authority only by default |
| `revocation_receipt_required` | `true` | Audit-mandatory revocation |
| `prohibited_actions` | `['mint_derivative', 'fork', 'revoke_access']` | Mutating verbs gated |
| `requires_human_approval` | Same as prohibited until charter | Defence-in-depth |

### Mint saga `card_publishing` flip

`services/registry/mintSaga.ts::card_publishing`:

- Previously a placeholder (Stage 5 marker `deferred_to_stage_7`).
- Now performs a best-effort warmup `fetch()` of `/api/iqubes/[id]/card` so the runtime cache is primed for the next agent query.
- Records `{card_url, observed_status, observed_at}` in `idempotency_keys.card_published` — operator surface can confirm post-mint observation.
- Failure path advances to `card_publish_pending` (transient state) so the reconciler retries.
- Cards regenerate on-demand from sources, so this step is observational rather than a durability step. No "publish" record needed.

### Tests

`tests/aigent-governance.test.ts` (~210 LOC, 17 cases):

1. **Card population by primitive** — AigentQube carries the field; ContentQube + ToolQube don't.
2. **Default values match PRD v1.1 §B.6** — payment_authority NULL, trust_band 0, must_disclose_as_agent true, revocable_by platform_admin only, charter_accepted false, mutating verbs in requires_human_approval.
3. **Source-provided governance overrides defaults verbatim** — including custom trust_band, payment_authority, and acceptance state.
4. **T0 sentinel leak guard** — 3 sentinels (personaId, authProfileId, rootDid). No sentinel ever appears in the serialised card; hostile content placed in `description` doesn't propagate into the governance block.
5. **Zod round-trip** — default + source-provided both pass. Tampered values (trust_band=5, currency='btc') rejected.

---

## What flipped from placeholder

| Saga step | Stage 5 marker | Stage 7 behaviour |
|---|---|---|
| `receipt_emitting` | (Stage 6 already flipped to real `emitOrchestrationEvent`) | (no change) |
| `card_publishing` | `{ deferred_to_stage_7: true }` | Real warmup `fetch()` + observation record |

The mint saga now drives **fully through MINT_COMPLETE with real receipt + card observation** for any iQube it touches. Non-content primitive chain mints still mark `non_content_primitive_stage7` in the `chain_minting` step (DB promotion of AigentQube / ToolQube is legibility fast-follow #3 — not in Stage 7 scope).

---

## Stage 7 vs scope

PRD v1.0 §10 Stage 7 scope:
1. ✅ Governance block on AigentQube cards
2. ✅ Zod schemas for the variant
3. ✅ Tests for no-T0-leak + governance block round-trip
4. ✅ Mint saga `card_publishing` step real (v1.1 §C delta)

**Out of Stage 7 scope (handled elsewhere):**
- Non-content primitive chain mints — requires DB promotion of AigentQube + ToolQube to dedicated tables (legibility fast-follow #3). Saga marks the deferral cleanly; promotion is its own ticket.
- Real Phase 2 KNYT framework data (charter version source-of-truth, trust band progression rules) — the canonization queue is where charter signing surfaces operationally, but the rules engine is Phase 2 work.

---

## Authority matrix — Stage 7 state

| Domain | Authority | Stage 7 state |
|---|---|---|
| Agent governance shape | `types/iqube/legibility.ts::IQubeAgentGovernance` | ✅ Canonical type; T1/T2-safe by construction |
| Governance defaults | `cardBuilder::defaultAigentGovernance` | ✅ PRD v1.1 §B.6 defaults; payment_authority always starts NULL |
| Governance source-of-truth | Source adapter (preferred) → defaults (fallback) | ✅ Source override beats default in builder |
| Zod validation | `IQubeAgentGovernanceSchema` | ✅ Strict literal unions; rejects bad values |
| Card refresh post-mint | `mintSaga.card_publishing` | ✅ Best-effort warmup; on-demand card regeneration |
| Payment authority approval | Canonization queue (Stage 3) | Unchanged — non-null `payment_authority_proposed` surfaces separate operator confirm step |

---

## Smoke-test path

```bash
# Once Amplify deploys, fetch an AigentQube card via the legibility surface
curl -s https://dev-beta.aigentz.me/api/iqubes/aigent-marketa/card | jq '.agent_governance'
```

Expected: AigentQube card carries an `agent_governance` block with the default fields above. Trust_band=0, payment_authority undefined (omitted), must_disclose_as_agent=true.

Fetch a ContentQube card:

```bash
curl -s https://dev-beta.aigentz.me/api/iqubes/<contentqube-uuid>/card | jq '.agent_governance'
```

Expected: `null` (field absent from ContentQube cards).

Run the tests locally:

```bash
npx vitest --config vitest.config.mjs run tests/aigent-governance.test.ts
```

All 17 cases should pass.

---

## Branch state

36 commits on `claude/dreamy-gates-mMqNv` since dev merge:

```
PRD v0.1 → v1.1                                    (4 docs)
Stage 0 audit                                       (3 commits)
Stage 1                                             (5 + close)
Stage 2                                             (4 + close)
Stage 8 partial                                     (4 + close)
Stage 3                                             (2 commits)
Stage 4                                             (2 + close)
Stage 5                                             (3 + close)
Stage 6                                             (3 + close)
Stage 7                                             (1 + this close)
```

---

## Remaining stages (per "work through the stages")

| Item | Scope | Est |
|---|---|---|
| **Stage 9** | Phase 2 stubs at `services/registry/phase2/*` — interface-only | 1–2 days |
| **Action Vocabulary tab** | Thin list view over `services/iqube/legibility/actionMap.ts` review queue | <1 day |
| **Docs tab** | Markdown reader for PRD trail | <1 day |
| **Cleanup PR** | Delete `useOwnedEntitlements.ts` + `/api/codex/owned` + remove `app/api/iqube/persona/qripto/mint/route.ts` after 2026-06-30 observation window | <1 day |
| **AigentQube + ToolQube DB promotion** | Legibility fast-follow #3 — `aigent_qubes` + `tool_qubes` tables with versioning, then non-content chain mints unblock in `mintSaga.token_qube_created → chain_minting` | Separate workstream |

Continuing to Stage 9 next.

---

**End of Stage 7 close report.**
