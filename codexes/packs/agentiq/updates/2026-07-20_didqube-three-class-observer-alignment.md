# DidQube Three-Class Model — Observer/Spine Alignment + Canon Ratification

**Date:** 2026-07-20 · **Status:** ratified (operator, in-session) · **Session branch:** `claude/agentiq-onboarding-docs-jrbeha`

## The incident

The IRL accession observer (progress bar + welcome page) flattened every
credential onto the **active spine persona's id**. A citizen who claimed their
passport under one persona and observed from another saw the passport (and its
access grant) read as absent, while delegation read green — a self-contradictory
workflow state. Root cause: **observation at the wrong DidQube class**, not a
transport bug. (A transport violation — persona-unaware `authedFetchHeaders`
fetches — was found and gated in the same session; see the persona-spine gate,
`scripts/check-persona-spine.mjs`.)

## The ratified model (now canon: `inv.polity.310–316`)

Three DidQube classes, three observation levels:

| Class | Table(s) | What it is | What it underpins |
|---|---|---|---|
| **Kybe DID** | `kybe_identity` | Anonymized proof-of-life; **World ID** is the humanity verification | **The Polity Passport** — the person's anonymized credential |
| **Root DID** | `root_identity` (`kybe_id` → kybe; `auth_user_id` → session) | Proof of identity (potentially KYC-grade, identifiable) | The person's identified anchor |
| **Persona** | `did_persona` (`root_id` → root) + spine `personas` | Integration/interaction faces toward legacy systems and agents | Where **agents are bounded in action** |

Ratified principles (full statements in `canonical-invariants.seed.json`):

- **310** — the three-class definition (kybe / root / persona, anchored in that order).
- **311** — the passport is **kybe-driven**: it attaches to proven personhood, a level beneath persona; never a property of one persona.
- **312** — citizen-level access rights sit at the **personhood** level.
- **313** — the bounded agent is **bound to the citizen's passport** but **acts through a persona**, inheriting that persona's identifiability state.
- **314** — the person remains **anonymous by default**; identity is surfaced only via the persona.
- **315** — **standing accrues to the person**; the passport enables continuity of personhood anonymously.
- **316** — every credential is observed **at its own class**; flattening observation onto a single class is a constitutional violation.

## What was built

1. **`services/identity/personhoodResolver.ts`** (new) — walks the real chain:
   Bearer → auth user → `root_identity` → `kybe_id` → sibling roots →
   `did_persona` set, plus the person's spine personas (merged auth profiles).
   Composition only: reuses `getCallerIdentityContext` (the ONE token parser,
   additively extended with a server-internal `authUserId`) and
   `getMergedLinkedAuthProfileIds`. Fail-degraded to the active persona.
2. **`/api/participation/my-access`** — observes passport by BOTH keys
   (`persona_id` for spine-path issuance, `did_persona_id` for the bureau-minted
   kybe chain); access grants across the person's personas; delegation
   person-level for the "has delegated" observation (bound to the passport),
   persona-scoped for the acting context. T0 discipline: only booleans/roles
   serialise.
3. **Canon:** `inv.polity.310–316` appended to
   `codexes/packs/irl/foundation/canonical-invariants.seed.json` as `canonical`
   (operator-ratified governance/definitions per the epistemic-honesty
   discipline — these are how the protocol works, not empirical hypotheses).

## Operator action — ingest the new canon rows

```bash
git pull iqp dev && node scripts/ingest-canonical-invariants.mjs --dry-run && node scripts/ingest-canonical-invariants.mjs
```

## Open follow-ons (deliberate, not slipped in)

- **Enforcement points** (e.g. experiment run gates) still evaluate grants at
  persona level. If entitlement enforcement should be person-level per 312,
  that is a separate ratified change.
- **Standing accrual** (315): current standing services accrue per persona /
  per delegate; aligning accrual to the person is a workstream, not a patch.
- **World ID `invalid_action`** (reported same day): no commit in this session
  touched the verify path (`services/passport/personhoodProof.ts`, env
  allowlist intact). Server verifies with `WORLD_ID_ACTION_ID ?? 'polity-passport-verify'`.
  If it verified fine yesterday, check the Amplify dev-branch value of
  `WORLD_ID_ACTION_ID` / `NEXT_PUBLIC_WORLD_ID_ACTION_ID` against the action
  slug in the Worldcoin Developer Portal for `WORLD_ID_APP_ID`'s app.
