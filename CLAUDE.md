# CLAUDE.md — Dev Rules for AigentZ / iQube Protocol

This file governs how AI agents (Claude Code and others) should work in this codebase.
Update it as new patterns and rules are established.

---

## Platform Ontology — MANDATORY READING (read before writing any code or copy)

**All agents MUST read `docs/platform-ontology.md` before writing any code, UI copy, or documentation.**

The ontology file defines the canonical spelling and meaning of core platform terms. Using a
non-canonical spelling is a bug. Key terms governed by the ontology:

- **BlakQube** — not "Black Cube", "Black Qube", or "black_cube" in display. BLAK = Binary Logic Avoiding Knowledge.
- **aigentMe** — not "Agent Me", "AgentMe". The sovereign identity layer and confidentiality guardian.
- **iQube** — not "iqube" or "IQube". The core data primitive.
- **AigentZ** — the primary orchestration agent.
- **PSC-001** — Polity Capability Preservation Standard. Governs all HMS cases.
- **DVN** — Decentralised Verification Network. Never spell out differently.
- **MAF** — Mobility Activation File. The HMS intake record.

Full definitions, usage rules, and the complete classification ladder are in `docs/platform-ontology.md`.

---

## HMS Identifier Isolation — NO RAW IDs IN LOCKER, DVN, OR CHAIN (PARAMOUNT)

**The case ID (`caseId`), persona ID (`personaId`), and any delegated agent identifier MUST NEVER appear in:**
- Passport locker item `display_name` or any locker metadata
- DVN receipt payloads
- Walrus blob metadata or Sui chain records
- Any network-bound or chain-bound data structure

These are **T0 identifiers** — server-internal only. They are subject to the same protections as `personaId`, `authProfileId`, and `rootDid` (see Identity & Access Spine section below).

### Required pattern — T2-safe commitment references

All locker tagging, DVN receipt construction, and chain-bound metadata for HMS cases MUST use a **server-computed commitment reference** derived via a one-way hash function. This reference is:

- **Deterministic**: same input always yields the same ref — idempotent re-tagging works
- **One-way**: the commitment cannot be reversed to recover the source identifier
- **T2-safe**: safe for DVN receipt payloads, Walrus blob metadata, and on-chain anchoring

**Canonical implementation for case-scoped locker refs:**

```ts
// Server-side only — in an API route, NEVER in client code
import { createHash } from 'crypto';
const lockerRef = createHash('sha256')
  .update('hms:locker:' + caseId)   // namespace prefix prevents cross-type collisions
  .digest('hex')
  .slice(0, 16);                     // 16-char hex commitment — T2-safe
// Return only lockerRef to client — caseId NEVER leaves this function
```

**The client tags locker items as `[HMS:${lockerRef}] ${name}` — the lockerRef is the commitment, not the caseId.**

### Applies to ALL identifiers in the HMS context

| Identifier | Tier | What you MUST use instead |
|---|---|---|
| `caseId` (UUID) | T0 | `sha256('hms:locker:' + caseId).hex().slice(0,16)` commitment |
| `personaId` (UUID) | T0 | T1 surface only — NEVER in DVN/chain/locker |
| Delegated agent ID | T0 | Agent commitment derived the same way |
| `authProfileId` | T0 | NEVER serialised — same rule as the spine |

### Route that computes locker refs

`GET /api/mobility/cases/[caseId]/locker-ref` — verifies caller owns the case, then returns the T2-safe commitment. **All client-side locker operations MUST fetch this ref first.** Never derive it client-side (that would expose caseId in network traffic or client state).

### Why this is non-negotiable

A locker item `display_name` containing a raw `caseId` UUID will appear in DVN receipt payloads and potentially on-chain. The `caseId` is a T0 identifier that carries subject re-identification risk — an observer who correlates two receipts with the same `caseId` can link mobility activities to the same family unit, defeating the BlakQube compartmentalisation guarantee. The same principle extends to any delegated agent identifier issued under the case.

---

## Push Commit Messages — MANDATORY (top priority, do not override)

**Every push to GitHub / dev / any deploy-triggering branch MUST carry a commit message that names the actual content being pushed. Generic merge messages are forbidden.**

This rule is **non-negotiable** and must not be reduced, removed, or worked around by any agent. The operator should be able to read the commit history and immediately know which push corresponds to which change without opening GitHub.

### Forbidden — never produce these:

- `Merge remote-tracking branch 'origin/claude/<session>' into dev` (the default git-generated message)
- `Merge branch X` with no further detail
- `merge dev` with no follow-up describing what's being pushed
- `--no-edit` on any merge that hits dev / main / a deployable branch

### Required — every merge / push to dev must include:

1. The session branch being merged (so the operator can correlate)
2. A short summary of WHAT changed in this push (one phrase, like the imperative commit subject style elsewhere in this repo)

### Correct examples

```
merge dev: sync before pushing inline-remix refactor (fc82cb7)
merge dev: sync before pushing X-Frame-Options fix (f71efd8) + KB timeout bump
merge origin/dev -m "merge dev: sync before pushing thinking-dots Lovable spec (d76dbd1)"
```

### How to enforce this when pushing

When using `git merge origin/dev` before pushing to dev, **ALWAYS** pass `-m` with a descriptive message naming the commits being pushed:

```bash
git merge origin/dev -m "merge dev: sync before pushing <feature/fix> (<commit>)"
```

### The auto-merge workflow is the enforcement point — keep it fixed on `main` AND `dev` (root cause of recurring generic merges)

The `merge-claude-to-dev.yml` workflow is what writes the dev merge commit the operator sees in the Amplify build history. GitHub runs the copy of the workflow that lives **in the pushed `claude/**` branch**, so the merge message is only as good as the workflow version that branch carries. The **correct** step is:

```yaml
SUBJECT="$(git log -1 --pretty=%s origin/${{ github.ref_name }})"
git merge --ff-only origin/${{ github.ref_name }} || \
  git merge origin/${{ github.ref_name }} -m "merge ${{ github.ref_name }}: ${SUBJECT}"
```

The **broken** version is the old `git merge … --no-edit` fallback — it produces `Merge remote-tracking branch 'origin/claude/<session>' into dev`, the exact boilerplate this rule forbids.

**Why it keeps regressing:** the fix has historically lived only on session branches (and `dev`), while `main` kept the stale `--no-edit` version. Any new session branch seeded from a base that lacks the fix reverts to generic merges. **To fix it once and for all, the corrected workflow must be present on BOTH `dev` and `main`.** An agent that cannot push to `main` (session branches are `claude/**`-only) MUST flag this to the operator with the exact sync command rather than leaving it — e.g.:

```bash
# operator, from a clone with push rights to main:
git fetch origin dev main && git checkout main && \
  git checkout origin/dev -- .github/workflows/merge-claude-to-dev.yml && \
  git commit -m "sync auto-merge workflow: descriptive dev merge messages" && \
  git push origin main
```

This rule **applies to every agent** working on this repo (Claude Code, Codex, Lovable, any future agent). It applies regardless of the kind of change (code, doc, config). It applies to every push. There are no exceptions.

---

## No Guessing or Hallucinating — Zero Tolerance

**Never guess, invent, or assume any value that cannot be verified from the codebase or a source provided by the operator.**

This applies without exception to:

- **URLs and domains** — never construct or infer a production/staging/dev URL. If a URL is not found in `.env.example`, env files, config files, or code in this repo, say "I cannot find this URL in the codebase — please provide it."
- **Environment variable values** — only read from actual env files. Never assume a value.
- **API endpoints, route paths, slugs, IDs** — always verify from source files before stating. If uncertain, search first; if not found, say so.
- **Third-party service configuration** — do not guess account IDs, project IDs, bucket names, or region names.
- **Any other factual value** — if it is not in the codebase or explicitly provided by the operator, do not state it as fact.

**When a value cannot be found:** say exactly that — "I cannot find X in the codebase. Please provide it." Do not fill the gap with a plausible-sounding guess.

Guessing critical values (especially URLs) wastes the operator's time, breaks integrations, and erodes trust. This rule is non-negotiable.

---

## Outbound Email Attachments — MUST INCLUDE URL (NON-NEGOTIABLE)

**Any outbound email (Gmail draft, Marketa send, cohort blast, transactional reply, any other email surface) that references an attached artifact, document, deck, doc, sheet, PDF, image, or any other file MUST include the URL to that artifact in the email body. If the body says "attached" / "see attached" / "find attached" / "I've attached" / "please review the attached" / any equivalent phrase, the URL MUST be in the body next to the reference. There are no exceptions.**

This rule applies to every code path that drafts or sends email on the platform — `services/google/gmail/*`, `services/marketa/*`, `services/connectors/gmail*`, `services/connectors/marketa*`, the campaign send scripts, the LLM email-drafter prompts, and any future surface that produces email body text.

### Forbidden — never produce these:

- A body that says "Please find the brief attached" with no link.
- A body that lists "Attached: Strategic plan" with no link.
- A body that says "I've attached the deck for your review" with no link.
- A body that references a Google Doc / Sheet / Slides / PDF by name without the corresponding view link.

### Required — every email body that references an attachment MUST:

1. Include the artifact's accessible URL (the `locationUrl` field on `ArtifactCardData`, the Google Drive share URL, the Supabase Storage URL for gated content via the signed-redirect route, etc.) inline with the reference.
2. Format the reference so a human reading the email knows what to click — e.g. "Please review the [Strategic Plan](https://docs.google.com/document/d/.../edit)" or "Strategic plan: https://docs.google.com/...".
3. Never refer to an attachment that isn't actually attached AND doesn't have a URL. If neither is true, rewrite the body to not mention an attachment at all.

### Enforcement layer in LLM email-drafters

When the email body is drafted by an LLM (the `handleDraftEmail` / `handleDraftMarketa` paths), the system prompt MUST instruct the LLM that if it references an attached artifact in the body, it MUST also include the URL inline. If the LLM doesn't have a URL for what it's about to reference, it MUST omit the reference entirely — never write "attached" without a link.

Server-side validation should reject any drafted body that contains an "attached"-class phrase but no URL in the body, and require a regeneration. This sanity-check belongs in the draft endpoint, not just the LLM prompt.

### Why this is non-negotiable

A recipient who reads "Please find the brief attached" and sees no attachment + no link experiences immediate trust erosion in the sender, the platform, and the underlying agent. It looks like a bot mistake or a phishing failure. Every email that ships with this defect costs the operator credibility we can't easily recover.

This rule applies to every agent working on this repo (Claude Code, Codex, Lovable, any future agent) and every email-producing surface. There are no exceptions, no "alpha-phase" carve-outs, no "we'll add the link later" deferrals.

---

## Q¢ (Q-cent) Pricing — Canonical Conversion

**$1 = 100 Q¢. One Q¢ is worth $0.01.**

This is the canonical conversion across every surface (wallet, store cart, content purchase, codex tabs, runtime, embed routes, API, ledger, anywhere a Q¢ value appears). It applies to AigentZ / iQube Protocol, the Venture Lab α / KNYT codex programmes, and every future cartridge that surfaces Q¢ pricing.

### Rules for any code that handles Q¢

1. **Storage** — store Q¢ as integer cents (no decimals). The DB column `amount_qc` (and equivalents like `amount_qcent`, `spent_qcents`) is a count of cents, not a USD value.
2. **Conversion helpers** — when you need to display USD next to a Q¢ count, use `usd = qc / 100`. When you need to convert a USD amount to Q¢, use `qc = Math.round(usd * 100)`.
3. **Display** — the user-facing primary price for any rail (KNYT, Q¢, USDC, PayPal) renders in **USD** for parity with the store's payment modal. If you also show the Q¢ count, render it as a secondary line: `$9.00` primary, `900 Q¢` secondary.
4. **Never assume `qcent === usd`** — older code in `app/services/token/pricingService.ts` (e.g. `convertFromKnyt`, `convertFromQcent`, `convertFromUsdc`, `calculatePaymentPricing`) returns `qcent` as a USD-equivalent value, not a cents count. Treat those return values as USD when consuming, and prefer the cart-quote / multi-rail helpers for new surfaces. Do not propagate the `qcent === usd` assumption further.
5. **Submit copy** — Q¢ rail buttons should say `Pay $X.XX with Q¢`, not `Pay X.XX Q¢`, to keep the principal display in USD. Show the Q¢ count separately if useful.

If you encounter a value labelled `qc` / `qcent` / `q_cent` / `qCents` and aren't sure whether it's a cents count or a USD value, **trace it back to its source before using it** — getting this wrong moves money by 100×.

---

## Operator Instructions — Always Provide Runnable Scripts

When the operator needs to take any action, always provide the exact command(s) to run — never describe steps in prose that require manual interpretation.

- **Shell commands**: provide a single copyable block the operator can paste directly into their terminal, including any `git pull` needed to get the latest code first.
- **SQL**: provide a single copyable block the operator can paste directly into the Supabase SQL editor. Never say "run this migration" without providing the exact SQL inline.
- **Never say** "add X to Amplify", "configure Y in the dashboard", or "run script Z" without providing the exact value or the exact command.
- If multiple commands are needed, chain them into one block with `&&` so a single paste runs everything.

### Documents for review — ALWAYS provide the link, unprompted (the operator should never have to ask)

Whenever you produce or update ANY document the operator may want to read or review — a PRD, spec, charter, update/session doc, report, or plan — you MUST surface a way to open it in the same message, without being asked:

1. **A deep link to read it**, in this order of preference:
   - a **published Artifact link** (render the doc via the Artifact tool — best for a clean, shareable review view), and/or
   - the **in-app deep link** to where the doc is registered (e.g. AgentiQ cartridge → Updates tab for `agentiq/updates/*`; IRL OS cartridge → Foundation for `codexes/packs/irl/foundation/*`), built with the dev host (`dev-beta.aigentz.me`) — never a guessed URL, and
   - the **repo file path** as the always-available fallback.
2. **For anything the operator must run** — a migration or any SQL — paste the **exact SQL inline** in a single copyable block (this is the existing "SQL" rule above; it is not optional and applies every time a schema/data change ships). Never say "run the migration" and point at a filename without the SQL in the message.

The operator has repeatedly had to ask for review links and for the SQL to run. Providing both proactively, every time, is now mandatory — treat a doc-producing or migration-producing turn as incomplete until the link(s) and any SQL are in the reply.

---

## Security — Access Gates (PARAMOUNT)

**NEVER remove, weaken, or bypass any access control gate without explicit written consent from an admin.**

This includes but is not limited to:

- `adminOnly` flags on codex tabs, routes, or UI components
- Role checks (`isAdmin`, `isSuperAdmin`, RBAC guards)
- Supabase Row Level Security (RLS) policies
- API route authentication middleware
- Feature flags that gate sensitive functionality

**If a gate appears to be blocking legitimate access**, the correct response is to:
1. Report the access issue to the operator and ask for explicit authorisation to change it
2. Investigate the auth resolution path (how `isAdmin` is set, what role is required) and fix the upstream auth flow — not remove the gate
3. Never remove a gate as a debugging shortcut or workaround

Violating this rule is a critical security incident regardless of intent.

---

## Identity & Access Spine — CANONICAL SoT (PARAMOUNT)

**Every backend touchpoint involving identity, asset correlation, content gating, or rewards MUST flow through the identity spine. Do not build parallel resolvers, parallel gates, or parallel decision logic.**

The spine is the single source of truth for:
- "Who is the active persona?" → `getActivePersona(request)`
- "Does this persona own this asset?" → `userOwnsAsset(personaId, assetId)`
- "Should this read/tx be allowed?" → `evaluateAccess(persona, descriptor, action)`
- "What does the browser see about this persona?" → `GET /api/wallet/active-persona` (T1 surface)
- "How do I link across cartridges?" → `buildCodexUrl(slug, { personaSessionToken, ... })`

### Identifier exposure tiers — never mix them

| Tier | Where it lives | Examples | What you can do |
|---|---|---|---|
| **T0** server-internal | Server only (Lambda) | `personaId`, `authProfileId`, `rootDid`, `fioHandle` | DB key, internal services. NEVER serialise to JSON, NEVER include in receipts. |
| **T1** browser-safe | postMessage + JSON | `personaSessionToken`, `displayLabel`, `ownFioHandle`, `cartridgeFlags` | Render in UI, log for debugging. |
| **T2** public-network | DVN, ordinals | `cohortAliasCommitment`, `cohortId` | The ONLY identifier allowed in receipts. |

### Five fields that MUST NEVER appear in browser-bound JSON or chain-bound receipts

| Field | Reason |
|---|---|
| `personaId` | T0 — server-internal only |
| `authProfileId` | T0 — multi-email-merged caller id |
| `rootDid` | T0 — compliance-bearing (`did:fio:` family) |
| `kybeAttestation` | KYC layer; reveal only via `discloseCredential()` |
| Cross-persona `fioHandle` | The caller's OWN handle is OK on T1; resolving someone else's is forbidden |

Tests in `tests/persona-broadcast-handshake.test.ts` and `tests/access-spine.test.ts` enforce this. Mirror the canary pattern in any test suite you add.

### Owner self-view exception + the three-level reference model (operator-ratified 2026-07-18)

The T0 rule's enforcement boundary is the **network/chain boundary** — DVN receipts, persona broadcasts, locker metadata, chain payloads, and the T1 `active-persona` surface. It does NOT forbid an owner-authenticated, Bearer-scoped self-view route from returning the **caller's own** persona UUIDs (the same exposure class as `/api/wallet/persona`): the client is the sovereign surface where an owner decrypts and sees their own BlakQube-secured data. Never extend this to other users' identifiers, and never feed a self-view value into any receipt/broadcast/chain path.

The raw persona UUID is a **private root identifier, not a public key**. Three reference levels serve three trust domains (full doc: `codexes/packs/agentiq/updates/2026-07-18_three-level-persona-reference-model.md`):

1. **Private Persona UUID** — owner recovery/support/config handle; wallet self-view only (masked by default, copy with warning).
2. **Polity Public Reference** — `personaPublicRef()` in `services/identity/personaReferences.ts` (same sha256/16-hex derivation as the DVN pipeline's `hashPersonaRef`); the stable governed-ecosystem handle; the ONLY persona identifier for receipts.
3. **Pairwise External Service Reference** — keyed HMAC per (persona, audience), issued/revoked via `/api/wallet/identity/references`; the handle for third-party services (prevents cross-service correlation).

Never describe level 2 as unlinkable across services, and never present the raw UUID as the credential to paste into third parties.

### Don't rebuild these — the spine already provides them

| Tempting parallel implementation | Use this instead |
|---|---|
| Your own `getCurrentPersona()` reading JWT | `getActivePersona(request)` |
| Your own auth gate before granting rewards | `evaluateAccess(persona, descriptor, 'transfer')` |
| Your own FIO-handle-required check | The spine denies with `reason='fio-handle-required'`; surface that |
| Your own admin / partner role checker | `persona.cartridgeFlags.{isAdmin,isPartner}` (server-resolved) |
| Your own per-cartridge admin role checker | `persona.cartridgeFlags.adminCartridges: string[]` (server-resolved). Slugs only. `isAdmin: true` satisfies any per-cartridge check. Credential class: `admin-cartridge:<slug>` |
| Your own client-side `fetch(/api/...)` for spine endpoints | `personaFetch` from `utils/personaSpine` — see "Client-side spine fetches" below |
| Your own decryption for state-C content | `streamStateCPlaintext` from `services/content/stateCDelivery` |
| Your own persona-switch listener | Subscribe to the `aa-persona-change-v1` postMessage |

### Client-side spine fetches — MUST use `personaFetch`, never raw `fetch` (PARAMOUNT)

Any client-side call to a route that resolves the caller through the spine (`getActivePersona` or `getCallerIdentityContext`) requires the Supabase Bearer token in the `Authorization` header. Cookies + `credentials: 'same-origin'` are **NOT** sufficient — the spine ignores cookies entirely for auth.

Routes that fall under this rule include (non-exhaustive):
- `/api/wallet/active-persona`
- `/api/persona/*`
- `/api/assistant/*` (bootstrap, brief, move-forward, ask-agent, intent, etc.)
- `/api/admin/*` (every diagnostic + admin route)
- `/api/access/*`
- `/api/connectors/*`

**Use this:**

```ts
import { personaFetch } from "@/utils/personaSpine";

const res = await personaFetch("/api/persona/cartridge-admin-grants", {
  cache: "no-store",
});
```

`personaFetch` calls `getSupabaseAccessToken()` and attaches it as `Authorization: Bearer <token>` before delegating to fetch. It's the single canonical client surface for spine-aware HTTP.

**Never use this for spine endpoints:**

```ts
// ❌ ALWAYS RETURNS 401 — no Bearer token attached
fetch("/api/persona/...", { credentials: "same-origin" });
fetch("/api/persona/...");  // same problem
```

The bug pattern: when a hook / utility uses raw `fetch`, every spine endpoint returns 401, the hook silently falls into its empty / fail-closed state, and downstream gates (admin tabs, paywalls, persona switches) deny without any console error. Symptoms feel like "the feature just doesn't work for this user" — but the operator IS authenticated; the FE is just failing to attach the token. Cost the team a multi-hour debug loop on 2026-05-26 with the admin-tab visibility regression.

#### `authedFetchHeaders` is ALSO forbidden for spine endpoints — it is persona-UNAWARE (2026-07-20 incident)

**`authedFetchHeaders` / `getSupabaseAccessToken` + `fetch` is NOT an acceptable substitute for `personaFetch` on a spine endpoint.** It attaches the Bearer token (so it does not 401), which makes it *look* like it works — but it carries **no persona selection**. On a spine endpoint, `getActivePersona` then resolves a **fallback persona**, not the operator's currently-active one. For an operator who owns several personas (the normal case), the surface silently reads the WRONG persona's state: passport shows absent, delegation shows inactive, grants show empty — for data that genuinely exists on the active persona. This is MORE dangerous than the raw-`fetch` 401 because it fails *silently and plausibly* (real-looking data for the wrong identity) instead of failing closed.

**The whole point of the spine is that identity is resolved ONE way, everywhere. Two transports that resolve two different personas is the exact inconsistency the spine exists to abolish.** A component that reads passport via `authedFetchHeaders` and access via `personaFetch` will show a self-contradictory state and flip between renders. This happened in `AccessionProgressBar` on 2026-07-20 and cost a live-debugging loop.

**Required — pass the active persona hint whenever the surface knows it:**

```ts
import { personaFetch } from "@/utils/personaSpine";

// A surface that receives the active personaId (embed prop, context, bridge)
// MUST pass it as personaIdHint so the spine resolves THAT persona — not a
// fallback. Every read on the surface uses the SAME hint, so they agree.
const res = await personaFetch("/api/participation/my-access", {
  cache: "no-store",
  personaIdHint: personaId,   // ← the embed's resolvedPersonaId / ctx persona
});
```

If a surface does not have the personaId to hand, `personaFetch` falls back to `localStorage['currentPersonaId']` (the spine's own record of the active persona) — still correct, still the spine. What is NEVER acceptable is bypassing the spine to attach the Bearer yourself.

#### Hard checklist — before you write ANY client→`/api/*` call

1. Does the route handler call `getActivePersona` or `getCallerIdentityContext`? If yes → it is a spine endpoint.
2. Client call to a spine endpoint → **`personaFetch` only.** Never `fetch(...)`, never `authedFetchHeaders(...) + fetch(...)`, never axios/XHR.
3. If the surface has the active `personaId` (prop / context / bridge), pass it as `personaIdHint`. All reads on the surface use the same hint.
4. A single component MUST NOT mix `personaFetch` with any other transport for identity reads — one transport, one resolved persona, or the state self-contradicts.

**Enforcement:** `tests/persona-spine-fetch.test.ts` is the canary — it greps client components for `authedFetchHeaders`/raw `fetch` against the spine-endpoint allowlist and FAILS the build if a new one appears. If you add a spine surface, it must pass this test; do not weaken the test to make a violation pass. Identity is the foundation of the entire protocol — a break here compounds through every gate, receipt, and grant downstream. There are no "just this once" exceptions, no "it works with the Bearer" shortcuts, and no alpha-phase carve-outs.

**Debugging from DevTools / a browser URL bar** — neither sends the Authorization header. Pull the token from `localStorage` and attach it manually:

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const parsed = JSON.parse(localStorage.getItem(k));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  const r = await fetch('/api/<path>', { headers: { Authorization: `Bearer ${token}` } });
  console.log(JSON.stringify(await r.json(), null, 2));
})();
```

### Files you MUST NOT modify without operator approval

- `services/identity/getActivePersona.ts`
- `services/identity/personaSessionToken.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/content/encryption.ts`
- `services/content/stateCDelivery.ts`
- `types/access.ts`

These are the canonical contract. Extend by composition, not by forking.

### Smoke test gate before merging spine-touching work

```
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-persona-you-own> \
  --owned=<an-asset-the-persona-owns> \
  --txGuard=<an-asset-id>
```

All checks must pass. If you've added new spine surface area, extend `verify-spine.mjs` rather than building parallel verification.

### Required reading before any code that touches identity/assets/gating/rewards

The full integration brief lives at:

```
codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md
```

It's written for the KNYT reputation/rewards/tasks workstream but applies to **every** workstream that consumes identity, asset correlation, or access decisions. Read it end-to-end before writing code in any of those areas.

Supporting docs (in order):
1. `types/access.ts` — full type contract
2. `services/identity/getActivePersona.ts` — the resolver, end-to-end
3. `services/access/evaluateAccess.ts` — the decision gate
4. `services/content/getContentDescriptor.ts` — descriptor builder
5. `codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md` — plan v8 + decision log
6. `codexes/packs/agentiq/updates/2026-05-08_phase-1-iam-spine-closure.md` — Phase 1 closure
7. `codexes/packs/agentiq/updates/2026-05-09_phase-2-encryption-decisions.md` — Phase 2 decisions

---

## DVN Pipeline Protection — CRITICAL INFRASTRUCTURE (PARAMOUNT)

**The DVN (Decentralised Verification Network) anchoring pipeline is critical infrastructure. Any DVN failure represents a break in the chain-of-provenance for operator actions. Failures MUST be escalated to the operator immediately — they are never silent or acceptable as "transient".**

### Files you MUST NOT modify without explicit operator approval

- `services/dvn/activityReceiptDvnPipeline.ts` — the core submission + finalizer logic
- `services/ops/icAgent.ts` — the IC actor factory (shared by DVN + other canister calls)
- `services/ops/idl/cross_chain_service.ts` — the Candid IDL binding

### The ONLY permitted unilateral change

Adding a new action type to `ANCHORABLE_ACTION_TYPES` in `activityReceiptDvnPipeline.ts`. This extends which receipt types get anchored on-chain. It does not modify the submission mechanism, state machine, or canister interaction.

### Everything else requires operator approval BEFORE coding

This includes but is not limited to:
- Changing the state machine (`local → dvn_pending → dvn_recorded / dvn_failed`)
- Modifying the payload shape sent to the canister
- Changing the `hashPersonaRef` hashing logic (privacy-critical)
- Modifying the canister call mechanism (actor, IDL, timeout)
- Changing error handling paths or when `dvn_failed` is written
- Modifying the finalizer (`finalizeReadyActivityReceipts`)
- Changing the `shouldAnchorActionType` gate logic (beyond adding types)
- Adding, removing, or reordering fields in the DVN JSON payload

### DVN failure escalation contract

When a DVN submission fails (canister returns an error, times out, or returns an unexpected shape):
1. The pipeline logs at `console.error` level with prefix `[DVN ESCALATION]` — this surfaces in CloudWatch/Amplify error-level monitoring.
2. The receipt row flips to `dvn_failed` so the operator can see it in the UI and trigger a retry.
3. The retry route (`/api/assistant/receipts/[receiptId]/retry-dvn`) allows the operator to re-attempt submission from the receipts view.
4. If failures are systemic (multiple receipts failing), the operator should check: canister health, DFX identity PEM validity, network reachability to ic0.app.

### Why this is paramount

Every `dvn_failed` receipt is a gap in the on-chain provenance trail. The DVN anchoring is what makes activity receipts auditable and tamper-evident — without it, receipts are local database rows with no cryptographic backing. A silent regression in this pipeline undermines the trust model of the entire metaMe system.

---

## Core Principle: Extend, Don't Duplicate

This is a mature, actively evolving codebase. Before writing any new code:

1. **Search for existing implementations** — functions, hooks, components, and utilities almost certainly already exist.
2. **Reuse and extend** what's there. If something needs a new capability, modify the existing unit rather than creating a parallel one.
3. **Move logic when refactoring** — don't copy it. The codebase should have one authoritative location for each concern.

---

## File and Component Discipline

- **Never create a new file** unless it represents a genuinely new, standalone concern with no existing home.
- **Never create new UI components** without first checking `components/ui/`, `components/composer/`, `components/registry/`, and `components/` root.
- Canonical shared primitives include: `ConfirmDialog`, `IQubeCard`, `FilterSection`, `ViewModeToggle` — use them.
- Prefer editing an existing file to creating a new one, even if the change is larger.

---

## Canonical Surface Styling — SLATE house style, NOT white hairlines (PARAMOUNT)

**The AgentiQ / metaMe house style for panels, cards, capsules, and glass surfaces is TRANSLUCENT SLATE with SLATE borders. White hairline borders are an OLDER RESIDUAL pattern — a bug, not the style guide. Do not introduce them, and do not "correct" a slate surface back to a white-hairline one.**

The operator has had to correct this repeatedly. It is now codified so no agent reintroduces it.

### The house style (use exactly this)

| Surface property | Canonical value | Tailwind equivalent |
|---|---|---|
| Panel fill | `rgba(15, 23, 42, 0.4)` (translucent slate-900) | `bg-slate-900/40` |
| Hairline / border | `#1E293B` (slate-800) | `border-slate-800` |
| Backdrop blur | soft — `blur(16px) saturate(140%)` | (glass surfaces only) |
| Elevation | plain drop shadow — `0 4px 24px rgba(0,0,0,0.3)` | `shadow-lg` / `shadow-black/30` |

**No white inset top-highlight.** `inset 0 1px 0 rgba(255,255,255,0.05)` is part of the deprecated residual — omit it.

### Forbidden — the residual white-hairline pattern

- `border-white/10`, `border-white/5`, `border-white/[0.08]` on panels/cards/capsules → use `border-slate-800`.
- `rgba(255,255,255,0.10)` (or any `rgba(255,255,255,...)`) as a **border/hairline** value.
- A white inset top-highlight in a `boxShadow`.
- `styles/drawer.css`'s legacy white glass tokens as a reference for NEW surfaces — those are the residual; the slate values above are ground truth.

(White text/ink and white as an *emphasis fill* are fine — this rule governs **borders/hairlines and panel chrome**, not typography.)

### Representation-system binding

The Constitutional Representation System encodes this house style as the default interpretation **AgentiQ Liquid Glass** (`services/representation/interpretations/agentiqLiquidGlass.ts`): `material.hairline: '#1E293B'`, `material.tint: 'rgba(15,23,42,0.4)'`, `material.elevation` with no white inset, `border.subtle: '#1E293B'`. Adopted surfaces consume it via `useSurfaceStyle()` / `var(--rep-border-subtle)` and inherit the correct slate look automatically — never hardcode a border colour on a representation-adopted surface. If you edit the glass interpretation, keep it slate; the `tests/representation-system.test.ts` contract laws (and the dashboard zero-literal canary) enforce the surface but not the white-vs-slate choice, so this rule is the guard.

---

## TypeScript Standards

- No `any` casts unless the existing code already uses them in that context.
- Use `typeof x === "string"` guards before casting (e.g. `as "openai" | "venice"`).
- Use `asRecord()` for safe unknown-to-object access (already exists in the codebase).
- Keep `useCallback` / `useMemo` dependency arrays accurate — add and remove deps as logic changes, never just append.

---

## State Management Boundaries

- **Server-first for critical state**: Registry data, visibility, and ownership live in Supabase via Next.js API routes.
- **`localStorage` for UX reactivity only**: e.g. `library_<id>`, `minted_<id>` flags for immediate client feedback.
- **No SSR/CSR mismatches**: compute client-only conditions (localStorage, window) inside `useEffect` and store in state — never directly in JSX render paths.

---

## Commit Discipline

- One concern per commit. Keep diffs focused and minimal.
- Commit messages are imperative, lowercase, no period: e.g. `Generate image article bundles on completion`
- Never bundle unrelated changes. A bug fix and a refactor are separate commits.
- Never skip hooks (`--no-verify`) or bypass signing.
- **Merge commits must be descriptive.** Never use `--no-edit` or the default `Merge remote-tracking branch 'origin/dev' into …` message. Always pass `-m` with a summary of what the session changed, e.g.:
  ```
  git merge origin/dev -m "merge dev: sync before pushing send script pagination + CAMPAIGN_ADMIN_EMAIL fix"
  ```
  The `-m` message must name the actual content being pushed — never generic phrases like "sync before push".

---

## Multi-Agent Coordination

Multiple Claude Code sessions may run concurrently on this codebase. Each session works on its own `claude/<session-id>` branch, but all merge to `dev`, creating collision risk.

### Rules for every session

1. **Declare your file scope at session start.** In your first commit message or QubeTalk packet, list the primary files you intend to touch (e.g. `services/campaign/`, `app/api/crm/`).

2. **Check what other agents changed before merging to dev.**
   ```bash
   git fetch origin dev
   git log origin/dev..HEAD --oneline   # your unpushed commits
   git diff origin/dev --name-only      # files you changed vs dev
   ```
   If another agent recently changed the same files, read their diff before merging:
   ```bash
   git show origin/dev --stat
   ```

3. **Merge with a descriptive message** (see Commit Discipline above). Never use `--no-edit`.

4. **Announce concurrent work via QubeTalk bridge.** If you are starting work that touches shared infrastructure (API routes, services/, components/ui/), write an outbox packet:
   ```bash
   python3 scripts/qubetalk_bridge/create_packet.py \
     --agent-id claude-code \
     --title "Starting work on <area>" \
     --body "Touching: <list of files/dirs>" \
     --thread dev-exec --type status --severity info
   git add docs/qubetalk-bridge/outbox/ && git commit -m "send qubetalk: announce <area> work" && git push
   ```

5. **High-collision files** — treat these as contested; always fetch and diff before editing:
   - `scripts/create-env-production.js` — env allowlist (every session that adds a new var touches this)
   - `app/api/crm/investors/route.ts` — central CRM read path
   - `services/campaign/adapters/mailjetAdapter.ts` — live email sending
   - `CLAUDE.md` — this file

6. **If a push to dev is rejected** (non-fast-forward), always rebase rather than force-push:
   ```bash
   git fetch origin dev
   git merge origin/dev -m "merge dev: sync before pushing <what-you-changed>"
   git push origin HEAD:dev
   ```

---

## Change Sizing

- **No over-engineering**: don't add abstractions, helpers, or utilities for one-off operations.
- **No speculative features**: only implement what is explicitly requested or clearly required.
- **No defensive code for impossible scenarios**: trust internal framework and TypeScript guarantees.
- Three similar lines of code is better than a premature abstraction.

---

## Security

- Never hardcode secrets, keys, or credentials.
- All sensitive config lives in `.env.local` (server-side) or environment variables.
- `NEXT_PUBLIC_` prefix is for browser-exposed values only — never use it for service role keys or private API keys.
- Follow existing zero-knowledge, encryption-first, minimum-disclosure patterns for any iQube data handling.

---

## Gated Content — Confidential Exposure Rules (PARAMOUNT)

Purchased/entitled content (PDFs, videos, and any other gated media) must be treated as **confidential information exposed only under controlled conditions**. The underlying file URL and bytes must never be handed to the OS or browser outside the application's own viewers.

### Hard rules — apply to all gated/locked content:

1. **No `target="_blank"`** on links or anchors pointing at gated PDF or video files. Opening a new tab hands the URL to the browser, which can download, share, or cache the file.

2. **No raw storage URLs in the browser** — Supabase Storage URLs (`https://[project].supabase.co/storage/...`), Autonomys CIDs, or any other direct file path for gated content must never be sent to the client as-is. They must be proxied through an authenticated server-side route that validates the persona's entitlement before streaming bytes.

3. **No `window.open()` on gated file URLs** — same exposure risk as `target="_blank"`.

4. **PDF viewer split** — there are two canonical PDF viewers, used for different sources:
   - **`PDFLiteReaderModal`** — fast browser-native iframe viewer. Use when a `pdf_lite_url` (direct Supabase Storage URL) is available. Works because the URL is loaded directly by the browser; no Lambda response buffering.
   - **`PDFPageViewer`** — page-by-page render via `/api/content/pdf-page/[cid]?page=N`. Use when only an Autonomys `pdf_cid` is available (no Supabase URL). **Required** for large Autonomys-hosted PDFs because the full-PDF proxy at `/api/content/pdf/[cid]` returns 413 (AWS Lambda 6MB response payload limit) for files like episode comics.
   - The render contract is: `if (pdf_lite_url) PDFLiteReaderModal else if (pdf_cid) PDFPageViewer`. Never use the full-PDF proxy as a viewer source for Autonomys CIDs — it works only for the 302-redirect Supabase case. Never use `<object>` for the PDF embed (Firefox throws `NS_ERROR_WONT_HANDLE_CONTENT`); use `<iframe>`.

5. **Videos must render only inside the app's `VideoPlayer` component** — never via a direct URL in a new tab or `<a>` link.

6. **This applies to every surface** — KnytTab, store tabs, Terra, Community, 21 Sats, runtime, embed routes, and any future surface. The rule travels with the content, not the surface.

### What is NOT gated (can follow the standard exposed process):

- Free/preview content with no entitlement requirement (e.g. GN episode 0)
- Marketing assets, cover thumbnails, promotional images
- Public KB documents and lore that are not access-restricted

### Phase note:

Phase 2 will enforce this via iQube encryption (assets stored as encrypted non-fungible files, decrypted only for verified holders). Until then, the enforcement mechanism is:
- Client-side ownership gate (prevents unauthorised viewers from opening the viewer)
- `/api/content/pdf/[cid]` proxy for Autonomys CIDs (no raw URL exposure to browser)
- Direct Supabase Storage URL only for free/public content

### Phase 2 Backlog — Secure PDF URL handling

**Status: deferred to Phase 2**

Currently, Supabase Storage URLs for owned/gated episodes are forwarded through the `/api/admin/codex/status` API response and used directly in `PDFLiteReaderModal`. This means a user inspecting the network tab can retrieve the storage URL for any episode visible in the catalog, even episodes they don't own.

**Phase 2 task:** Replace the direct URL in `PDFLiteReaderModal` with an authenticated server-side redirect route:

1. Add a route `GET /api/content/pdf-signed/[masterId]` that:
   - Validates `personaId` owns the episode (check `owned_issues` or equivalent)
   - Generates a short-lived Supabase Storage signed URL (e.g. 5-minute TTL)
   - Returns a 302 redirect to the signed URL
2. Update `PDFLiteReaderModal` to use `/api/content/pdf-signed/${masterId}` as its `pdfUrl` for gated content
3. Keep the direct URL path for free/public content (episode 0 GN, preview assets)

This eliminates the URL-leakage window without requiring `pdfjs-dist` or full-PDF downloads on the server.

---

## metaMe Client Protocol Primitive — R/T scoring dots + busy pulse

**Every copilot surface (server-rendered, thin-client, embed) MUST render reliability + trust scores using the same dot strip, colour ramp, and busy-pulse animation. Diverging on dot count, colour, or pulse semantics breaks the trust glance the strip exists to deliver, and the operator's mental model no longer travels intact between cartridges.**

Full spec: `codexes/packs/agentiq/updates/2026-05-29_metame-client-rt-dots-spec.md` — read end-to-end before implementing or refactoring.

### Quick rules

- **5 dots per strip**, lit count = `Math.ceil(value / 2)` where `value ∈ 0..10`. Unlit dots stay rendered in `bg-slate-600`.
- **Colour ramps** (lit dots only):
  - R (reliability): `≤3 red-500`, `3.01-6 yellow-500`, `>6 purple-500`
  - T (trust):       `≤3 red-500`, `3.01-6 yellow-500`, `>6 green-500`
- **Dot geometry**: `h-1.5 w-1.5 rounded-full`, strip is `flex items-center gap-0.5`.
- **Busy pulse** — Tailwind `animate-pulse` fires when the copilot is doing work the operator should wait on. Two independent signals share the same pulse:
  1. `isProcessing === true` (chat round-trip in flight via `/api/codex/chat`)
  2. `ttsState === 'loading'` (TTS audio being fetched via `/api/skills/tts`)
  Either ⇒ `isBusy = true`. Per-dot staggered `animation-delay: ${i * 0.15}s` produces a ripple, not a synchronous blink.
- **Idle state** uses `transition-all duration-300` instead of `animate-pulse` so colour changes (score updates) animate smoothly.

### Canonical implementation

Reference: `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx:renderDots`. Mirror the helper exactly; don't fork the colour logic or the pulse condition.

### Why this matters

The R/T strip is read at a flicker — the operator never reads the value, they read the colour + pulse posture. Forks that drop the staggered delay (synchronous blink) or omit the TTS-loading signal silently break the "is the copilot working" feedback loop. Thin-clients (Lovable, etc.) implementing the metaMe client protocol must replicate this primitive line-for-line.

---

## aigentMe Capsule ↔ Layout Contract — MUST READ (PARAMOUNT)

**The aigentMe right pane has two paired states (`activeCapsuleId` + `activeLayoutId`) that MUST stay in lockstep. Activating a Capsule without mounting its dedicated layout — or unmounting the layout while the Capsule is still engaged — drops the operator on the manual/stack fallback while parent state still claims a Capsule is in flight. This costs hours of debug time and surfaces as "capsule disappeared", "CTAs render in the wrong window", or "after Act the artifact lands on the wrong surface".**

### Canonical mapping (all four Capsule chips)

| Capsule chip | `activeCapsuleId` | `activeLayoutId` | Dedicated layout file |
|---|---|---|---|
| Brief me | `brief` | `brief` | `components/metame/welcome/layouts/BriefLayout.tsx` |
| Move forward | `move-forward` | `decision-board` | `components/metame/welcome/layouts/DecisionBoardLayout.tsx` |
| Venture progress | `venture-progress` | `venture-cockpit` | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |
| Ask specialists | `ask-specialists` | `specialists` | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |

Mapping is defined once at `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx:CAPSULE_LAYOUT`. Adding a fifth Capsule means extending that constant + the `CapsuleId` type union.

### Rules

1. **Every Capsule activator routes through `engageCapsuleAndMount(capsuleId)`.** That helper sets both states atomically. Call sites include the left-pane `handleCtaClick` chip strip AND the chat-copilot `quickPrompts.onSelect` handlers — both paths must use the helper. Never call `engageCapsule` without also setting the layout, and never `setActiveLayoutId('brief' | 'decision-board' | 'venture-cockpit' | 'specialists')` without also engaging the Capsule.

2. **ComposerLayout is an OVERLAY, not a foreground.** It mounts on top of whatever Capsule is engaged when `composerKind !== null`. Its dismiss/close/onCreate/cancel handlers MUST call `onComposerClose?.()` ONLY — never `onRequestLayout('stack')` and never any other layout swap. Calling a layout swap from ComposerLayout unmounts the underlying Capsule and the operator's work vanishes. The legacy `onRequestLayout('stack')` lines were vestigial from when ComposerLayout was a foreground surface; do not reintroduce them, even "as a fallback".

3. **Dedicated layouts must thread Pill-lifecycle props through to their cards.** BriefLayout, DecisionBoardLayout, VentureCockpitLayout, and SpecialistsLayout all need: `artifacts`, `actionPendingArtifactId`, `actionErrors`, `secondTierApproval`, `onSendArtifact`, `onDismissArtifact`, `onApproveSecondTier`, `onCancelSecondTier`, `onDismissQueued`, `onMarkPillComplete`. Queued NBAs MUST render as `ExpandedNBEPill` (with the drafted artifact + second-tier approval folded inline) — never as `NextBestActionCard queued={true}` (the legacy "Queued" badge that bombs without lifecycle props).

4. **Don't add an effect that resets `activeLayoutId` to `'stack'`.** If you need a "go home" affordance, route it through a Capsule dismiss handler (e.g. `onDismissBrief`) that clears the relevant capsule data AND only then swaps the layout — never a blanket reset that runs on every render or on every receipt of an artifact event.

### Failure history

- **2026-05-28 Capsule disappearance**: ComposerLayout's `handleDismiss` and `closeToStack` fired `onRequestLayout('stack')`. Every time an operator completed a compose modal (or hit X), the underlying Capsule layout unmounted. Data persisted in parent state, so clicking the quick-action chip resurfaced it — masking the real bug as "intermittent disappearance". Fix in `b226c88a`: drop the layout swap from ComposerLayout dismiss paths.
- **2026-05-28 Ask Specialists fallback**: the left-pane Ask Specialists chip called `engageCapsule('ask-specialists')` but skipped `setActiveLayoutId('specialists')`. Specialist responses and suggested-artifact chips rendered on the stack/manual fallback instead of inside the Specialists Capsule. Fix in `e7d79742`: add the missing layout mount.
- **2026-05-28 Move-forward + Venture legacy NBA cards**: DecisionBoardLayout + VentureCockpitLayout had been reverted to `NextBestActionCard queued={true}` without the Pill-lifecycle props wired. Queued items rendered with the legacy "Queued" badge and threw on second-tier approval. Fix in `b226c88a`: restore the `ExpandedNBEPill` pattern with full prop threading.

### Reference docs

- Architecture + repro recipe: `codexes/packs/agentiq/updates/2026-05-28_aigentme-capsule-layout-contract.md`
- Layout registry types: `components/metame/welcome/layouts/types.ts`
- Pill primitive: `components/metame/cards/ExpandedNBEPill.tsx`

---

## Content Capsule Containment — GOLDEN RULE (PARAMOUNT)

**Any derivative content generated from actions taken WITHIN a capsule MUST be rendered inside that same capsule. It must never spawn orphan pills, chips, or capsules outside of it.**

This is the cardinal rule for capsule-scoped execution. The capsule is the operator's work context — everything that flows from a CTA, specialist consultation, queued action, or approval within that capsule belongs inside it. Orphan output severs the causal chain and destroys the operator's ability to understand what produced what.

### What this means in practice

- **Approval actions** on an `intent_queued` chip must flip that chip's state in place (emerald/approved, rose/rejected) — they must not create a new standalone receipt card, pill, or capsule at the page level.
- **Specialist responses** triggered from within a capsule render inside that capsule's chain timeline — not as new top-level cards in myLedger or myWorkspace.
- **Artifacts created** from an approved child intent should surface as amber artifact rows inside the parent capsule's chain panel — not as new top-level activity cards.
- **Stage strip advancement** (queued → approved → acted → complete) happens by updating the existing capsule's strip — not by spawning a new capsule with a higher stage.

### When containment cannot be achieved

If a downstream action genuinely cannot be rendered inside the originating capsule (e.g. a cross-cartridge artifact that has no representation in the chain model), **stop and ask the operator before executing**. Do not silently create orphan output.

### Failure examples to avoid

- Clicking "Approve" on an `intent_queued` chip → a new standalone `approval_granted` capsule appears outside the current capsule. **Wrong.**
- Queuing a specialist recommendation → a second `specialist_consulted` card appears at the top level of myLedger. **Wrong.**
- Marking a child intent complete → a new standalone receipt card renders in the myWorkspace active intents list alongside the parent. **Wrong.**

### Canonical infraction pattern — and how it was fixed (2026-06-05)

**The infraction:** Per-chip Approve/Reject buttons were added to `intent_queued` rows in `IntentChainPanel`. Each button called `intent-advance(approve)` on the CHILD intentId. `intent-advance` creates an `approval_granted` activity receipt scoped to that child intentId. The `/api/assistant/receipts` endpoint returned ALL receipts for the persona, and `MyLedgerTab` grouped them by `intentId`. Since the new `approval_granted` receipt carried the CHILD intentId (not the parent's), it landed in its own group → a brand new capsule appeared at the top of myLedger while the parent capsule's chip stayed violet.

**What the operator saw:** They clicked Approve on a chip inside an open capsule. The chip stayed violet. A new emerald capsule labelled "Approved: Create visual aids..." appeared at the top of myLedger outside the originating capsule.

**The fix — three parts working together:**

1. **`/api/assistant/receipts`** — enriches every receipt with `parentIntentId` by batch-looking up each intent's `nbe_plans` rationale in one query (the `parentIntentId` is packed into the rationale JSON by `createIntentQube`).

2. **`MyLedgerTab` grouping** — groups receipts by `parentIntentId || intentId` instead of just `intentId`. Child receipt with `parentIntentId = "abc"` now folds into the `"abc"` capsule group, not a new group for the child's own id.

3. **`/api/assistant/workbench-ledger`** — filters `pillEntries` to root intents only (`!p.parentIntentId`) so child intents don't also appear as standalone Active Intents pills in myWorkspace. Child artifact receipts roll up to the parent pill via a `parentByChild` map.

**The pattern to follow for any future action that operates on a child intent:**

```
// ✅ CORRECT — child action folds into parent capsule
// 1. Action fires on child intentId (correct — targets the right DB row)
// 2. The receipt created by that action carries the child's intentId
// 3. /api/assistant/receipts enriches the receipt with parentIntentId
// 4. MyLedgerTab groups by parentIntentId → receipt renders inside parent capsule
// 5. Chip updates optimistically in-place via ChildIntentActionRow local state

// ❌ WRONG — the bug pattern
// 1. Action fires on child intentId ← same
// 2. Receipt carries child intentId ← same
// 3. No enrichment → no parentIntentId on the receipt
// 4. MyLedgerTab groups by intentId → new standalone capsule spawned
// 5. Parent capsule chip stays unchanged; operator sees orphan output
```

**Files that implement the fix:**
- `app/api/assistant/receipts/route.ts` — `enrichWithParentIntentIds()` helper
- `app/triad/components/codex/tabs/MyLedgerTab.tsx` — `groupKey = r.parentIntentId || r.intentId`
- `app/api/assistant/workbench-ledger/route.ts` — `rootIntents` filter + `parentByChild` artifact rollup
- `components/metame/workbench/IntentChainPanel.tsx` — `ChildIntentActionRow` optimistic in-place flip

---

## Grids of PDF Assets with Covers — MUST READ (PARAMOUNT)

**Whenever you build a grid of PDF assets (papers, magazines, episodes, scrolls, anything with a thumbnail card that opens a PDF), follow this pattern exactly. Do not invent variants. Do not try to render PDFs as image thumbnails server-side. Three sessions of work were lost trying to bolt a PDF rasteriser onto Lambda before this rule was written down.**

### The canonical pattern (KNYT)

The KNYT cartridge is the reference implementation. Mirror it.

1. **Cover = image. Body = PDF. Two separate uploads, two separate rows.**
   - Cover: `asset_kind = 'cover_image'`, `mime_type = image/*` (JPG / PNG / WebP). Stored as-is on Supabase; `cover_thumb_url` is set to the public storage URL.
   - PDF body: `asset_kind = 'episode_print'` / `'background_lore_doc'` / etc., `mime_type = 'application/pdf'`.
2. **The two are paired in software, not via FK.** Group by series scope / episode number / display position. The most recent image cover in the same scope is the thumbnail.
3. **The card thumbnail is `<img src={cover_thumb_url}>`.** No proxy. No iframe. No worker.
4. **The card click opens `PDFLiteReaderModal`** pointed at the PDF body's public Supabase URL (`pdf_lite_url` for KNYT episodes; `auto_drive_cid` for codex_media_assets rows). The modal uses `<object>` (desktop) or `<iframe>` (mobile) for native PDF rendering — no pdfjs, no canvas.

This works in every browser, has zero server dependencies, and is the path that has shipped to production.

### What does NOT work — do not try these again

- **`asset_kind = 'cover_pdf'`.** The enum exists for legacy reasons but no production cartridge renders it as a thumbnail. The upload modals' Cover content type must not list it as an option. (Removed 2026-05-27 from `app/(shell)/admin/codex/components/CodexUploadModal.tsx` for both KNYT and Qripto.)
- **Cross-origin `<iframe>` thumbnails of PDFs.** Browsers either paint blank or trigger a download — the iframe-load itself kicks off the browser's download flow even with `pointer-events-none`. Symptom: card click "downloads the PDF instead of opening the viewer".
- **Server-side rasterising a PDF first page to PNG/WebP on Lambda using `pdfjs-dist`.** Three failure modes stack:
  1. `Promise.withResolvers is not a function` — pdfjs-dist 4.x needs Node 22; Amplify runs Node 20. Polyfillable.
  2. `Setting up fake worker failed: Cannot find module pdf.worker.mjs` — pdfjs's fake-worker fallback does a relative `import("./pdf.worker.mjs")` that resolves to `/var/task/.next/server/chunks/pdf.worker.mjs`. The worker file isn't traced into the chunks dir even with `serverExternalPackages: ["pdfjs-dist"]` and `outputFileTracingIncludes` pinning it. Both fixes were attempted and both still fail in Lambda. The legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) and the `disableWorker: true` flag both still trigger the fake-worker code path.
  3. Even if you bundle it, `@napi-rs/canvas` adds ~30 MB to the Lambda deploy.

If anyone asks "can we just render PDF page 1 as the cover server-side?" — **the answer is no, upload an image cover instead**. The operator's editorial workflow is the source of the thumbnail; it's not derived from the PDF.

### Operator workflow for new cartridges

When a new cartridge needs a grid of PDF assets (e.g. the Qriptopian Papers tab):

1. Upload modal exposes two content types: **Cover** (image only — `.jpg .jpeg .png .webp`) and **<body type>** (PDF).
2. API route reads both `codex_media_assets` rows for the series scope and returns `{ pdfUrl, coverUrl }` per card. coverUrl is plain text — no proxy URL, no rasteriser URL.
3. Card component:
   ```tsx
   <button onClick={() => setActivePdf({ url: p.pdfUrl, title: p.title })}>
     <img src={p.coverUrl} alt={p.title} />
     {/* ... title overlay ... */}
   </button>
   <PDFLiteReaderModal open={activePdf !== null} pdfUrl={activePdf?.url ?? ''} title={activePdf?.title} onClose={() => setActivePdf(null)} />
   ```
4. Grid layout follows the KNYT shape: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`, `aspect-[3/4]` cards, full-bleed cover with bottom-up black gradient carrying the title, top-right backdrop-blur badge.

### Reference files

- Pattern source: `app/triad/components/codex/tabs/KnytTab.tsx` — the canonical KNYT episode grid (search for `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).
- Pattern copy: `app/triad/components/codex/tabs/QriptoPapersTab.tsx` — Qripto Papers grid using the same shape.
- Modal: `app/triad/components/content/PDFLiteReaderModal.tsx` — the canonical PDF viewer. Never replace with pdfjs in the renderer.
- Upload modal: `app/(shell)/admin/codex/components/CodexUploadModal.tsx` — Cover content type is image-only.
- Failure history: `codexes/packs/agentiq/updates/2026-05-27_qripto-cover-upload-and-wip-contentqube-backlog.md`.

---

## Architecture Layers (respect the boundaries)

| Layer | Responsibility | Technologies |
|-------|---------------|-------------|
| Context | Semantic intelligence, RAG, iQube content | LangChain, DB-GPT, blakQube |
| Service | API integration, wallet, CRUD | Next.js API routes, Supabase, AA-API |
| State | Blockchain-backed persistence, audit trail | ICP canisters, EVM, Supabase |

New work should land in the correct layer. Don't mix concerns across layers.

---

## Inter-Cartridge Navigation — Identity Propagation (CANONICAL RULE)

When navigating from one codex or cartridge to another, **personaId and access flags MUST travel with the link**. This is a first-class platform rule — not optional.

### The rule

> Every link that crosses a codex/cartridge boundary MUST carry `personaId` (and optionally `isAdmin`, `isPartner`) as URL query parameters. The receiving embed route reads and forwards these automatically. Never rely on localStorage alone — URL params are explicit, auditable, and work regardless of storage state.

### Implementation

Use `buildCodexUrl()` from `utils/codex-nav.ts` for all inter-cartridge links:

```ts
import { buildCodexUrl } from "@/utils/codex-nav";

// Back-link from KNYT Alpha → Venture Lab α Programme
href={buildCodexUrl("alpha-knyt", { tab: "alpha-programme", personaId, from: "knyt", fromTab: "knyt-alpha" })}

// Deep-link from Venture Lab α Programme → KNYT Wheel tab
link: buildCodexUrl("knyt-codex", { tab: "knyt-alpha", personaId, from: "alpha-knyt", fromTab: "alpha-programme" })
```

### How the receiving side works

`/triad/embed/codex/[codexSlug]/page.tsx` already reads:
- `?personaId=` → passed to `useCodexEmbedAuthBridge` and all tab components
- `?isAdmin=true` → used for optimistic gate rendering (server re-validates)
- `?isPartner=true` → same
- `?from=` and `?fromTab=` → available for breadcrumb construction

`useCodexEmbedAuthBridge` provides a secondary fallback via localStorage (`currentPersonaId`, `activePersonaId`) but the URL param is always preferred.

### Access rights enforcement

- Access gates (`adminOnly`, `partnerOnly`) are **always resolved server-side** from the persona at load time. URL params for `isAdmin`/`isPartner` are only for **optimistic client-side UI** — they never bypass server enforcement.
- Never pass `isAdmin=true` in a hardcoded link. Only propagate it dynamically when the current session has that right: `isAdmin={isAdmin}` in `buildCodexUrl`.

### Where this applies

- Any `<a href>` or `router.push()` that points to `/triad/embed/codex/...`
- Back-buttons on codex tabs that link to another cartridge
- Workstream cards in `AlphaProgrammeTab` that deep-link into KNYT codex
- Any future cross-cartridge CTAs (e.g. Qriptopian → AgentiQ)

### Files

| File | Role |
|------|------|
| `utils/codex-nav.ts` | Canonical `buildCodexUrl()` helper — use this everywhere |
| `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` | Reads and forwards all identity params |
| `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | Resolves personaId from URL or localStorage |

---

## Cartridge / Codex Registration — Dual-Source Pattern (READ BEFORE DELETING)

Cartridges in the codex registry come from **two sources** that can collide:

1. **Hand-curated** in `data/codex-configs.ts` (`CODEX_DEFINITIONS` array). These carry rich tab structures, interactive React components (`BoundedDelegationTab`, `DevPersonaTab`, etc.), and the slugs that other surfaces (e.g. `QuickLinksCard`) target.
2. **Auto-generated** from `codexes/packs/<name>/` directories by `app/api/codex/registry/_lib/packRegistry.ts::loadPackCodexes()`. These produce simple markdown-viewer cartridges with tabs derived from `collections.json`.

**If you see two cartridges with the same name in the picker, DO NOT remove the one in `CODEX_DEFINITIONS`.** That is almost always the canonical one. Suppress the auto-generated duplicate by adding the pack directory name to the skip list in `packRegistry.ts`:

```ts
// app/api/codex/registry/_lib/packRegistry.ts
if (lowered === "agentiq" || lowered === "aigentiq" || lowered === "aigency" || lowered === "agentiq-os") continue;
```

The hand-curated cartridge can still consume the pack's markdown content via `AgentiqCartridgeTab` props inside its tabs — pack docs are not lost, only the duplicate registration is. This pattern preserves:

- The hand-curated tab structure and interactive components
- The slug that `QuickLinksCard` / inter-cartridge nav targets
- The constant export (e.g. `AGENTIQ_OS_CARTRIDGE`) used by helpers like `aiqOsTabsByGroup()` to mirror tabs into other cartridges

How to tell which is which when both exist:
- Hand-curated id ends in `-cartridge` (e.g. `agentiq-os-cartridge`); pack-generated ends in `-codex` (e.g. `agentiq-os-codex`).
- Hand-curated has interactive tabs; pack-generated has only markdown.
- `QuickLinksCard` and metaMe's `aiqOsTabsByGroup()` target the hand-curated slug.

Historical example: commit `b907029f` (2026-05-26) archived the hand-curated `AGENTIQ_OS_CARTRIDGE` thinking it was the duplicate. The pack-driven version took over the picker, lost all interactivity, and broke the slug that metaMe targets. Reverted by `fb9f56bd` — restore + skip-list pattern.

---

## Local Development Path

The canonical local root for this project is:

```
/Users/hal1/CascadeProjects/AigentZBeta
```

This may change in the future — update this section if the local path moves.

---

## Canonical Repo vs the Operator's Local Clone — READ BEFORE ANY GIT/DEPLOY/LOCAL-SCRIPT WORK (PARAMOUNT)

**There are TWO GitHub repositories named `AigentZBeta`, and they are NOT the same repo. Confusing them has cost multiple sessions of debugging (stale ingests, "why aren't my changes showing").**

| | Repo | Role |
|---|---|---|
| **CANONICAL** | `iQube-Protocol/AigentZBeta` (`https://github.com/iQube-Protocol/AigentZBeta`) | The repo Amplify builds and every Claude Code session pushes to. **This is the source of truth for deploys.** |
| **STALE / DIVERGED** | `Kn0w-1/AigentZBeta` (the operator's laptop `origin`, via SSH alias `github-aigentz:Kn0w-1/AigentZBeta`) | The operator's local clone points here. It forked from canonical long ago and holds *different* commits. It does **NOT** receive session pushes. |

### What deploys (verified from the Amplify console, 2026-07-17)

- Amplify app **AigentZBeta** → Source repository **`iQube-Protocol/AigentZBeta`**; production branch `main`; branches `dev` / `main` / `staging` all auto-build **Enabled**.
- The live dev app (`dev-beta.aigentz.me`) builds from **`iQube-Protocol/dev`**. Session dev pushes → this branch → Amplify. The operator's local Kn0w-1 clone is irrelevant to the deployed app.

### The trap (why this keeps biting)

On the operator's laptop, `git pull origin dev` / `git checkout origin/dev -- <file>` pull from **Kn0w-1**, which lacks all session work. So local scripts (e.g. `node scripts/ingest-canonical-invariants.mjs`) silently run against **stale code/seed** and "succeed" on the wrong data. The failure is invisible — no error, just old data.

### The fix — add the canonical repo as a second remote (`iqp`) and source from it

The operator has added this remote. Any local operation that must reflect deployed/session state MUST use `iqp`, never `origin`:

```bash
# one-time (already done):
git remote add iqp https://github.com/iQube-Protocol/AigentZBeta.git

# every time you need canonical code/files locally:
git fetch iqp dev
git checkout iqp/dev -- <path/to/file>          # pull a specific canonical file
# or to work on canonical dev directly:
git checkout -B dev-iqp iqp/dev
```

**Rule for agents giving the operator local commands:** never tell the operator to `git pull origin dev` or `git checkout origin/...` for anything related to session/deployed work — it reads the stale Kn0w-1 repo. Always route local sync through `iqp` (canonical). When a local script depends on a repo file (seed JSON, config), first `git checkout iqp/dev -- <that file>`.

### Outstanding reconciliation (do NOT silently resolve)

Kn0w-1 holds commits that are **not** in canonical (observed: `Record Base mainnet deploy addresses (QCT, iQubeNFT, QCTReserve)`, marketa-activation work). If any of that is authoritative (**Base-mainnet contract addresses are money-critical**), it must be brought into `iQube-Protocol` deliberately, with operator sign-off on what's authoritative — never auto-merged. Flag it; don't guess.

---

## Key Directories

```
components/composer/   — ComposerStudio and experience authoring
components/registry/   — iQube registry UI
components/ui/         — Shared UI primitives
app/api/               — Next.js API routes (server-side only)
services/              — Backend services (aa-api, agentiq-wallet)
packages/              — Shared packages (smarttriad, smartwallet, avatar-host)
docs/                  — Architecture, operator manuals, progress reports
```

---

## Codebase Update Documentation — Canonical Location

**All session documentation that records codebase changes must go in one place:**

```
codexes/packs/agentiq/updates/
```

Naming convention: `YYYY-MM-DD_short-description.md`

Every file added here must also be registered in `codexes/packs/agentiq/collections.json` under the `col_updates` collection so it appears in the AgentiQ cartridge "Updates" tab.

This applies to:
- Deployment records (contract addresses, env vars, deploy steps)
- Architecture decisions made during a session
- Engineering session summaries and handoffs
- Any doc produced as a side-effect of coding work

**Never scatter update docs across other pack directories** (`alpha-knyt`, `knyt`, etc.) and expect the operator to find them. The `agentiq/updates/` folder is the single source of truth for what changed and when. If a doc also belongs in a workstream-specific pack (e.g. Venture Lab α), that is fine as a secondary copy — but `agentiq/updates/` must always be the primary.

---

## Deployment

Always deploy to **dev** unless explicitly told otherwise.

### Steps

1. Trigger the deploy by updating `.amplify-deploy` with a new timestamp:
   ```
   echo "Deploy trigger $(date)" > .amplify-deploy
   ```
2. Commit the trigger file:
   ```
   git add .amplify-deploy && git commit -m "trigger deploy to dev"
   ```
3. Push to the session branch:
   ```
   git push -u origin claude/<session-id>
   ```
   The branch **must** start with `claude/` and end with the session ID suffix (e.g. `claude/find-latest-commit-qQYRq`). Pushing to any other branch name fails with a 403.
4. **Auto-merge runs:** The `merge-claude-to-dev` GitHub Actions workflow detects the push to `claude/**` and automatically merges to `dev`.
5. **Amplify picks up dev:** Amplify watches the `dev` branch and triggers a build automatically.

### Prerequisites / Gotchas

- The `merge-claude-to-dev.yml` workflow **must exist on the `main` branch** for GitHub Actions to recognise `claude/**` push triggers. If auto-deploy stops working, check `main` has this file. Branch `fix/add-merge-workflow` contains the fix — merge it to `main` to restore.
- **If auto-merge is broken**: push directly to `dev` as a fallback. First merge `origin/dev` into your session branch to avoid non-fast-forward rejection, then push:
  ```
  git fetch origin dev
  git merge origin/dev -m "merge dev into <branch>: sync before pushing <what-this-session-changed>"
  git push origin HEAD:dev
  ```
  **Never use `--no-edit`** for merge commits — always write a descriptive `-m` message that summarises what the session changed (e.g. `"merge dev: sync before pushing seed fix + CRM individual card"`). This lets the commit history be human-readable.
- **Avoid doc-only deploys:** Pushing only `CLAUDE.md` or other documentation to a `claude/` branch triggers a full Amplify build. Batch doc updates with the next code change instead.
- The session branch name is critical — find the current branch with `git branch --show-current` before pushing.
- **Other environments** (staging, main) — only deploy there if the user explicitly requests it.

---

## QubeTalk — Agent Messaging

All Claude Code agents **must** use QubeTalk to announce activity and coordinate with other agents.

### CLI utility

```bash
# Send a status message
bash scripts/qubetalk-claude.sh send \
  --thread dev-exec \
  --title "Short title" \
  --body "Detailed message body" \
  --severity info        # info | warn | blocker

# Read recent channel history
bash scripts/qubetalk-claude.sh history --limit 20
```

The script loads keys automatically from `.env.local` / `.env.local.temp` — no manual setup needed.

### Required usage patterns

| When | Thread | Example title |
|------|--------|---------------|
| Session start | `dev-exec` | `Claude Code session started — <branch>` |
| Session end / task complete | `dev-exec` | `Claude Code session complete — <summary>` |
| Spec decision / architecture choice | `spec` | `Decision: <what and why>` |
| API wiring change | `api-wiring` | `Changed: <endpoint or contract>` |
| Blocker encountered | `dev-exec` | `Blocker: <description>` |

### Channel & rules

- **Channel:** `metame-runtime-thinclient`
- **Agent ID:** `claude-code` (consistent across all sessions)
- **DB `type` field:** `text | delegation | response | system | receipt`
- **Threads:** `spec | api-wiring | ui-shell | dev-exec | ops`
- **Metadata type:** `task | decision | question | status | patch | log`
- **Severity:** `info | warn | blocker`

Post at session start and end at minimum. Post blockers and key decisions in real time.

---

## System Model — Aigent Z / Aigent C / metaMe

The platform runs a dual-agent model with a sovereign guardian above:

| Role | Agent | Responsibility |
|------|-------|---------------|
| System orchestrator | **Aigent Z** | Routes interactions, enforces policy, selects NBE |
| Customer guide | **Aigent C** | Faces the user; executes NBE dispositions |
| Sovereign guardian | **metaMe** | Final override authority; identity + data sovereignty |
| Cartridge lead | per-cartridge | Domain logic within a cartridge boundary |

### Routing priority chain
1. metaMe guardian (policy veto)
2. Active cartridge lead agent
3. Aigent Z (system orchestrator)
4. Aigent C (default handler)

### Key contracts
- **NBEPlan** — `disposition: ask | act | wait | escalate | deny` + `nextExperience` depth step
- **StudioArtifact** — canonical handoff format for Studio → Codex → Runtime closed loop
- **OrchestrationEvent** — every routing decision is persisted and receipt-eligible
- **HandoffPayload** — typed interface for agent-to-agent handoffs (see `types/orchestration.ts`)

### Journey stages
`prospect → acolyte → keta → keji → first → zero` (+ investor / collector / creator variants)

### Experience depth ladder (one step at a time)
`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`

Full type definitions: `types/orchestration.ts`, `types/studioArtifact.ts`

---

## Project Workstreams — Three Distinct Programs

There are three parallel workstreams in this codebase. Do **not** conflate them with each other.

### 1. AgentiQ Alpha — Platform Build (current phase)

The in-progress platform hardening and first-ship phase. Established the base registry, runtime shell, SmartTriad, codex system, and core agent infrastructure.

- **Docs:** `codexes/packs/agentiq/items/ALPHA_*.md` — Overview, Build Plan, Asset Map, Architecture Memo
- **Codex tab:** AgentiQ Cartridge → "Alpha Program" tab (`slug: alpha-program`)
- **Status:** Active — this is the primary development context for most engineering tasks

### 2. Venture Lab α — AgentiQ Ventures Studio / AgentiQ Lab (next phase)

The next-stage program: builds the live **metaMe / AgentiQ / AgentiQ OS engine** on top of the Alpha foundation. Formally called the **AgentiQ Ventures Studio → AgentiQ Lab foundational capabilities workstream**. Operationalizes the platform into a coherent live system with the reference agent trio (Aigent Z, Marketa, Know1), the first cartridge pair (KNYT + Qriptopian), and the KNYT Alpha launch.

**Naming note:** The codebase pack is `alpha-knyt` (historical name) but the project is "Venture Lab α" / "AgentiQ Lab" / "alpha-lab" in product and planning terms. Use "Venture Lab α" or "AgentiQ Lab" when referring to this workstream — not "AgentiQ KNYT" (which is ambiguous with the KNYT cartridge itself).

- **Docs:** `docs/alpha/agentiq-knyt/` — 23 codex-grade planning docs (01–23)
- **Pack:** `codexes/packs/alpha-knyt/` (symlinks `items/` → `docs/alpha/agentiq-knyt/`)
- **Codex tab:** AgentiQ Cartridge → "Venture Lab α" tab (`slug: agentiq-knyt`, `adminOnly: true`)
- **Overview doc:** `codexes/packs/agentiq/items/AGENTIQ_KNYT.md`
- **Status:** Planning complete (23 docs); build starts after Alpha ships

When docs 24+ are added to `docs/alpha/agentiq-knyt/`, also add them to `codexes/packs/alpha-knyt/collections.json` (`col_venture_lab` items array).

### 3. KNYT Wheel — Activation Campaign (marketing / ops)

The KNYT product launch and activation campaign. This is a **marketing and operations workstream** — not a platform build workstream. It covers the launch plan, copy packs, CRM model, partner activation, and 30-day calendar for taking KNYT to market.

**Do not confuse** this with Venture Lab α (which builds the engine) or AgentiQ Alpha (which builds the platform).

- **Docs:** `codexes/packs/knyt/items/KNYT_CAMPAIGN_*.md` (15 operator docs) + experience pack and runtime surface specs
- **Codex:** `knyt-codex` — the live KNYT product codex (character cards, scrolls, shop, balance)
- **Status:** Campaign ops in progress — touches CRM routes, email sequences, Marketa activation

---

## metaProof Agent Harness

Canonical specs live in `docs/agent-harness/`. These are the single source of truth for all agents (Claude Code, Codex, Lovable):

| File | Contents |
|------|----------|
| `docs/agent-harness/metaproof-core.md` | Role hierarchy, NBE contract, DVN receipt taxonomy, QubeTalk conventions |
| `docs/agent-harness/aigent-z-aigent-c-contract.md` | Full role definitions, routing sequence, handoff rules |
| `docs/agent-harness/journey-state-schema.md` | JourneyState, ExperienceModel/Matrix, NBEPlan interfaces + SQL |
| `docs/agent-harness/studio-artifact-schema.md` | StudioArtifact schema, Codex↔Studio sync contract, rollback protocol |

When asked to work on orchestration, KNYT laddering, or experience progression, read these files first.

### DB migration for harness tables
`supabase/migrations/20260402000000_experience_model_journey_state.sql` — creates:
`experience_strategies`, `experience_models`, `experience_matrices`, `experience_goals`,
`journey_states`, `nbe_plans`, `analysis_cards`, `orchestration_events`, `studio_artifacts`

**This migration must be run in Supabase before the orchestration API is live.**

---

## Claude Code Sub-Agents

Specialist agents are defined in `.claude/agents/`:

| Agent file | When to invoke |
|-----------|---------------|
| `aigent-z-orchestrator.md` | Routing logic, NBE decisions, orchestration events |
| `metame-guardian.md` | Policy checks — APPROVED / FLAG / BLOCK output |
| `ui-parity-reviewer.md` | UI parity rules (4px grid, design tokens, radii) |
| `security-reviewer.md` | Secrets, auth, injection, prod misuse |

---

## QubeTalk — Sandbox Limitation

**Outbound HTTPS is blocked in the Claude Code sandbox.** The `qubetalk-claude.sh` script and all `curl` calls to external hosts fail with a 403 CONNECT tunnel error. This includes both sending and reading QubeTalk messages.

The session Stop hook (`session-summary.sh`) attempts posting silently and suppresses errors — this is intentional and non-fatal.

QubeTalk messages posted by other agents (Codex, Lovable) are visible through Supabase Studio or the deployed app UI, not from within this sandbox.

---

## QubeTalk Bridge — Fallback for Claude ↔ Codex Communication

Because outbound HTTPS is blocked, Claude agents communicate with Codex (and Lovable) via **file-based bridge packets** committed to the repo. Lovable acts as the relay — it reads the outbox files and posts them to the live QubeTalk channel, and snapshots incoming Codex messages into the inbox.

### Directory layout

```
docs/qubetalk-bridge/
  outbox/          ← Claude writes packets here (committed + pushed)
  inbox/
    latest.json    ← Lovable snapshots inbound messages here
```

### Sending a message to Codex (Claude → Codex)

Use `create_packet.py` to write an outbox packet, then commit and push. Lovable relays on its next pass.

```bash
python3 scripts/qubetalk_bridge/create_packet.py \
  --agent-id claude-code \
  --story DEV-XXXX \
  --title "Short title (≤80 chars)" \
  --body "Detailed message body" \
  --thread dev-exec \
  --type status \
  --status done \
  --severity info

# Embed file contents for Codex to read:
#   --paths path/to/file1.ts path/to/file2.ts
# Mark deploy-ready (Codex will apply embedded files + deploy):
#   --deploy-ready
```

Commit and push the packet:
```bash
git add docs/qubetalk-bridge/outbox/
git commit -m "send qubetalk bridge packet: <title>"
git push -u origin <current-branch>
git push origin HEAD:dev
```

Tell the user **"ask Lovable to relay the QubeTalk bridge"** if immediate delivery is needed.

### Reading messages from Codex (Codex → Claude)

Lovable snapshots inbound Codex/Lovable messages into `docs/qubetalk-bridge/inbox/latest.json`:

```bash
# List your own sent (outbox) packets
python3 scripts/qubetalk_bridge/list_pending.py

# Read what Codex/Lovable sent
cat docs/qubetalk-bridge/inbox/latest.json

# Apply file patches sent by Codex (if inbox contains file_payloads)
python3 scripts/qubetalk_bridge/apply_packets.py [--dry-run]
```

### When to use the bridge

| Situation | Action |
|-----------|--------|
| Hand off work or files to Codex | `create_packet.py` with `--paths` + `--deploy-ready` |
| Report session completion to Codex | `--thread dev-exec --type status --status done` |
| Share architecture decision | `--thread spec --type decision` |
| Check what Codex sent | Read `inbox/latest.json` |
| Apply file patches from Codex | `apply_packets.py` |

### Key rules

- Always pass `--agent-id claude-code` (the default is `openai-codex`)
- Always commit and push the outbox packet file — it is never delivered until it hits the remote
- The bridge is **fire-and-forget**: Lovable relays asynchronously; Claude cannot confirm delivery from within the sandbox

---

## Worldcoin keys — which one goes where (DON'T CONFUSE THESE)

Worldcoin uses three distinct credentials with overlapping names. Mixing them up causes silent verification failures.

| Variable | Scope | Public? | Used by | What it does |
|---|---|---|---|---|
| `WORLD_ID_APP_ID` | server env (Amplify) | **public** (`app_xxx...`) | `services/passport/personhoodProof.ts` → POST to `developer.worldcoin.org/api/v2/verify/${app_id}` | Server-side proof verification. **No auth header required** — the proof itself is the credential. |
| `NEXT_PUBLIC_WORLD_ID_APP_ID` | build-time env (Amplify) | **public** (same value as above) | `components/passport/WorldIdButton.tsx` IDKit modal | Browser-side — tells the IDKit modal which Worldcoin app to request a proof for. **Must be set to the same value as `WORLD_ID_APP_ID`** or the modal won't render. |
| `WORLD_ID_ACTION_ID` | server env | **public** (e.g. `polity-passport-verify`) | Server verifier (default fallback) | Action slug. Set in Developer Portal → app → **Incognito Actions** → Create action. Scopes the nullifier hash: one verified proof per (action, human). |
| `NEXT_PUBLIC_WORLD_ID_ACTION_ID` | build-time env | **public** (same value as above) | Browser-side IDKit modal | Same value, browser scope. |
| `WORLD_DEVELOPER_API_KEY` | MCP server config | **secret** (`Bearer dev_xxx...`) | Only the Developer Portal **management** MCP (`mcp_servers.worldcoin-developer-portal`) — used to programmatically create apps, list events, etc. | **NOT used by the verification flow.** Setting this alone does nothing for passport verification. Only relevant if you're driving the Worldcoin dev portal from chat via MCP. |

**TL;DR for the Polity Passport verification flow:** you need only the first four. Two values, four env vars (each value pasted both server-scope and `NEXT_PUBLIC_` scope). `WORLD_DEVELOPER_API_KEY` is a separate concern.

**Why the `NEXT_PUBLIC_` duplication is required:** Next.js bakes `NEXT_PUBLIC_*` env vars into the client bundle at **build time**. Non-`NEXT_PUBLIC_` vars are runtime-only (server). The IDKit modal mounts in the browser — it can't read server env. If you set only the server vars, the browser-side button silently falls back to dev-worldid mode.

**Provisioning steps:**
1. developer.worldcoin.org → log in → **Create an app** → grab `app_xxx...` → that's both `WORLD_ID_APP_ID` and `NEXT_PUBLIC_WORLD_ID_APP_ID`.
2. In the app → **Incognito Actions** → **Create action** → name it `polity-passport-verify` → that's both `WORLD_ID_ACTION_ID` and `NEXT_PUBLIC_WORLD_ID_ACTION_ID`.
3. Optional, **separate**: under **API Keys** → generate a key → that's `WORLD_DEVELOPER_API_KEY`, used only by the MCP management server.

After setting the four env vars in Amplify, **trigger a rebuild** — the `NEXT_PUBLIC_*` values won't reach the browser until the client bundle is rebuilt.

---

## Wallet-Over-Cartridge Overlay — CANONICAL PATTERN (must reuse)

**Goal:** open the SmartWalletDrawer (PersonaQube, PassportQube, AgentQubes sections) on top of a cartridge layer without losing the cartridge content underneath.**The only path that works**: mount `<SmartWalletDrawer variant="embedded" />` INSIDE a `<CodexCopilotLayer>` flex container. Do NOT render the SmartWalletDrawer as a standalone slide-over on top of a cartridge — z-index conflicts make it unusable. The comment at `app/components/codex/CodexCopilotLayer.tsx:113` explicitly names this: "the parallel SmartWalletDrawer (which has z-index conflicts)."

**Reference implementation:** `app/components/codex/CodexCopilotLayer.tsx:1700-1724` — the `walletPanelOpen` branch mounts `<SmartWalletDrawer variant="embedded" />` inside the copilot's flex layout. When the user clicks a wallet action chip in the copilot UI, `setWalletPanelOpen(true)` flips the panel on and the drawer slides in alongside (not on top of) the copilot. Both ride above the cartridge content via the copilot layer's overlay.

**Reproducible recipe (use this anywhere you need cartridge + wallet overlay):**

1. The host cartridge must already be wired in `CodexPanelDynamic.tsx` to render a `<CodexCopilotLayer />`. Today: `marketa-codex`, `knyt-codex`, `metame-codex`, and (as of 2026-06-13 Sprint 8) `polity-passport-bureau-cartridge`.
2. Inside the copilot, the wallet panel is opened with `setWalletPanelOpen(true)` — triggered by clicking a wallet/library/tasks/reputation/rewards/payments action chip. Don't surface a separate wallet button; let the copilot own the activation.
3. The SmartWalletDrawer renders with `variant="embedded"`, `embeddedAnchor`, `embeddedWidth`, and `codexMode={true}`. These four props are the difference between "wallet slides in alongside the copilot" and "wallet covers the cartridge with z-index fights."
4. Cartridge content stays visible behind the copilot+wallet flex stack — that's why operators can see the Apply tab beneath aigentMe + PersonaQube in the canonical screenshot (2026-06-13).

**Operator-confirmed working surfaces (the screenshot record):**
- metaMe Cartridge → AgentiQ OS → Polity Passport → Apply tab → aigentMe copilot active → wallet open showing PersonaQube + PassportQube (2026-06-13)
- AgentiQ OS → Registry → Persona → "Mint your persona as iQube" → wallet overlay above the cartridge (operator's original reference, 2026-06-13)

**Anti-pattern (do NOT use):** rendering `<SmartWalletDrawer open={true} />` directly inside a tab component — this creates a standalone slide-over that competes with the cartridge's stacking context. Symptoms: drawer renders behind the cartridge, drawer renders but clicks pass through, drawer covers the copilot. All are the same root cause: parallel-mounting instead of embedded-mode-inside-the-copilot.

**Rule for new cartridges that need wallet access:**
1. Add the cartridge to the hardcoded `codexId` list in `CodexPanelDynamic.tsx:1071-1121`.
2. Pick the copilot agent (the default agent for that cartridge's surface).
3. Let the copilot own the wallet activation — no parallel wallet triggers.

This is non-negotiable because it's the only path with a reproducible working precedent. Until a config-driven copilot+wallet system replaces the hardcoded `codexId` list (Phase B Sprint 8 follow-on), every new cartridge that needs in-place wallet access must follow this recipe.

---

## Artifact Production — AR/CPS + Observer Awareness (CANONICAL RULE)

**Every surface or system that produces artifacts (documents, media, compositions, business
artifacts, code packs) MUST (1) produce through the Artifact Runtime / CPS seams — never a
parallel production path — and (2) consume the current state of artifact production in its
space through the observer pattern (observed, never asserted).**

- Production: `runArtifact` / the AR pilots / `saveArtifactRecord` for persistence;
  CPS renderers for document profiles; receipts via the unified writer.
- Awareness: surfaces fold `artifactProduction` state (recent `artifact_records` + the
  Publication Register) into their ground/observation context — the pattern
  `/api/research/overview` + `IRLResearchCopilotTab` implement (2026-07-13). A copilot that
  narrates a space must know what that space has produced.
- Adoption is per-surface and tracked in the Chrysalis tracker; hand-wiring a parallel
  production path or narrating production state from static data is an infraction
  (the CS-001 / stale-handoff defect class).

## Hypothesis vs Canon — Epistemic Honesty Discipline (IRL corpus)

**Empirical hypotheses NEVER enter the invariant canon as `canonical`, regardless of how central or beloved they are. They enter and remain `proposed` until the experiments that test them produce supporting evidence.**

Operator-delegated standing instruction (2026-07-18): the operator relies on agents to keep the terminology honest here — including correcting the operator's own drafts when they drift.

- **`canonical`** is for definitions, methods, governance rules, and doctrine the operator ratifies as *how the Institute works* (e.g. `inv.reasoning.324` source independence, `330` transferable reasoning primitive, `332` division-of-labour-is-open).
- **`proposed`** is for claims about the world that experiments exist to test (e.g. `323` intelligence-is-a-property-of-fields, `329` the Hybrid Intelligence Thesis, `333` the Cumulative Intelligence Hypothesis). Ratifying a hypothesis before its evidence exists would undermine the falsifiability that makes the research programme credible.
- The same discipline applies to prose: reports and external documents must never state a `proposed` hypothesis as established fact, must report calibration metrics (e.g. IRV coverage) as proxies with their model config rather than pass/fail scores, and must not entangle discovery-calibration results with structural-thesis evidence (`inv.reasoning.326`/`328`).
- When an operator instruction would canonize a hypothesis, flag it and recommend `proposed` — the operator has confirmed this is the wanted behaviour, not obstruction.

---

## Adding to This File

When a new rule, pattern, or constraint is established during development, add it here immediately.
This is a living document — keep it current.
