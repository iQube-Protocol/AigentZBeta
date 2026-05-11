# Security Backlog — `personaId` hint carve-out in `metame:persona-changed`

**Date filed:** 2026-05-12
**Workstream:** metaMe client protocols (PersonaSpine + CartridgePresenceRegistry)
**Severity:** **Low (informational — explicit carve-out)** with **Medium escalation potential** depending on workstream-end security-review verdict
**Category:** Privacy contract / T0 handling
**Status:** **Deferred to end-of-workstream security review.** Pattern A shipped as-is; no behavior change pending the review.
**Filed by:** Claude Code session `claude/review-session-setup-V82mB` (commit `6a912c00`)

---

## Executive summary

The canonical `metame:persona-changed` event currently carries `personaId` as an optional top-level field. CLAUDE.md classifies `personaId` as **T0 (server-internal only)** and says it must **never** appear in browser-bound JSON. The parent metaMe client protocol contract simultaneously says the same thing *and* enumerates `personaId?` in the event payload as a "hint only; server is authoritative" — an internal contradiction. The behavior is locked in by `tests/persona-broadcast-handshake.test.ts` and consumed by Lovable's `ShellContext.tsx::personaSyncHandler`.

This is **not** a Pattern A regression — Pattern A added inline T1 fields to the same event and inherited the existing `personaId` hint carve-out unchanged. The carve-out predates Pattern A and has shipped on `dev` since 2026-05-08.

The end-of-workstream security review should decide whether to (a) keep the carve-out and resolve the documentation contradiction in its favor, (b) drop the carve-out and tighten to strict T0-never. Either decision is small to execute; the cost is mostly coordination across receivers.

---

## Concrete payload audit

### Pattern A payload as shipped (commit `6a912c00`)

```ts
{
  type: 'metame:persona-changed',
  schemaVersion: 1,

  // Top-level convenience fields (back-compat with legacy aa-persona-change-v1)
  personaId?: string,            // ⚠️ T0 — explicit "hint only" carve-out
  displayLabel?: string,         // ✓ T1
  ownFioHandle?: string,         // ✓ T1 — caller's OWN handle only

  // Typed nested object (preferred for structured consumers)
  surface?: {
    personaSessionToken: string, // ✓ T1 — opaque, signed, short-lived; rotates on switch
    identifiability: ...,        // ✓ T1 — enum value
    cartridgeFlags: {...},       // ✓ T1 — permission booleans
    cohortMemberships: string[], // ✓ T1 — group ids, not member ids
    sessionExpiresAt: string,    // ✓ T1 — ISO timestamp
    displayLabel?: string,       // ✓ T1
    ownFioHandle?: string,       // ✓ T1
  },
}
```

### Field tier classification (per `types/access.ts`)

| Field | Tier | Permitted in `metame:*` event? |
|---|---|---|
| `personaId` (top-level) | **T0** | ⚠️ Explicit "hint only" carve-out — see §"The carve-out" below |
| All `surface.*` fields | T1 | ✅ Strictly per CLAUDE.md identifier-exposure-tier table |
| `displayLabel` / `ownFioHandle` (top-level) | T1 | ✅ |

### Fields actively blocked (audited absent)

These are enforced by the broadcast-handshake test's privacy guard (`tests/persona-broadcast-handshake.test.ts:130-146`):

- `authProfileId` (T0)
- `rootDid` / `did:fio:` / `did:iq:` (T0)
- Cross-persona `fioHandle` (T0)

`kybeAttestation` is not on `ActivePersonaSurface` and would require explicit `discloseCredential()` to surface — also blocked.

---

## The carve-out

### Where it's documented

| File | Line | Verdict |
|---|---|---|
| `docs/architecture/persona-spine-client-protocol.md` | §"Identifier tiers" + line 69 | Explicit: `personaId` allowed in URL/postMessage/localStorage **as a hint** for `useCodexEmbedAuthBridge` and the persona-changed broadcast. "Advisory only — never authoritative." |
| `docs/architecture/metame-client-protocols.md` | Line 126 (reserved roster) | `metame:persona-changed` payload sketch: `{ personaId? }` *(hint only; server is authoritative)* |
| `tests/persona-broadcast-handshake.test.ts` | Lines 78, 96 | Asserts `msg.personaId === 'persona-uuid-1'` — locks the behavior |
| `app/contexts/PersonaContext.tsx` | Lines 244-250 | Emits `personaId` at top level of both canonical + legacy envelopes |
| `utils/personaSpine.tsx::broadcastPersonaChange` | Line 421 (now) | Signature accepts `personaId?` and inlines it |

### Where it's contradicted

| File | Line | Verdict |
|---|---|---|
| `docs/architecture/metame-client-protocols.md` | Line 102 | "No `personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, or cross-persona `fioHandle` may **ever** appear in a `metame:*` event payload." |
| `docs/architecture/metame-client-protocols.md` | Line 190 | "T0 never leaves the server. No `personaId` … in any event payload, window mirror, console log, or analytics event." |
| `CLAUDE.md` § "Identity & Access Spine" | "Five fields that MUST NEVER appear in browser-bound JSON" table | `personaId` listed as forbidden |

### The semantic gap

The parent contract intends `personaId` in events to be an **invalidation hint** — a re-fetch trigger, not a data carrier. The strict-mode rule treats it as a T0 leak regardless of how receivers use it. Both readings have merit:

- **Hint reading:** Defensible because the server is the only authority. Receivers that re-fetch from a Bearer-authenticated endpoint cannot escalate privilege using the hint. The browser already has the same `personaId` in localStorage via persona-context's session state, so the broadcast doesn't expose anything new on the iframe origin.
- **Strict reading:** `personaId` is server-internal in the canonical privacy contract. Once it crosses a `postMessage` to the parent frame, it leaves the AigentZ-origin trust boundary and lands on a third-party origin (Lovable). That third-party can now: log it, send it to analytics, persist it, or correlate sessions. Even if **we** treat it as advisory, **they** may not.

The strict reading is the safer architectural posture; the hint reading is the pragmatic shipping posture.

---

## Receivers that depend on the current behavior

If we drop the top-level `personaId` hint, these surfaces need to migrate:

| Receiver | Current consumption | Migration path |
|---|---|---|
| **Lovable thin-client `ShellContext.tsx::personaSyncHandler`** | Reads `msg.personaId` (top-level) for shell-state identifier | Switch to `msg.surface?.personaSessionToken` as the persona-version identifier (rotates on switch — equivalent semantic, but T1) |
| `tests/persona-broadcast-handshake.test.ts:78, 96` | Asserts presence of `msg.personaId` | Update assertions to require `surface.personaSessionToken` instead |
| `app/contexts/PersonaContext.tsx` | Emits `personaId` at top level | Drop the top-level field; keep emitting `surface` |
| `utils/personaSpine.tsx::broadcastPersonaChange` | Signature: `broadcastPersonaChange(personaId?, surface?)` | Signature: `broadcastPersonaChange(surface)` — drop the personaId arg |
| `docs/architecture/metame-client-protocols.md` | Line 126 roster + line 102 prohibition | Reconcile: drop personaId from the roster sketch; line 102 stands |
| `docs/architecture/persona-spine-client-protocol.md` | Line 69 "permitted exception" | Remove the exception clause |
| `codexes/.../2026-05-12_lovable-thin-client-metame-protocol-brief-addendum-v1.md` | §1 payload shape | Remove the top-level `personaId` field; document the migration |

Approximate scope: 7 files, ~30-line diff, plus coordination with Lovable to swap their listener over (their migration is one line — change the key they read from).

---

## Risk assessment

### Risk if we **leave the carve-out** (current state)

1. **Cross-origin id observability.** Lovable (and any future shell host) sees `personaId` in their inbound message stream. They can log it, retain it, correlate it across sessions, or send it to their own analytics. Mitigations:
   - Our origin allowlist (`configs/embed/policy.v1.json::authAllowedOrigins`) only allows trusted shells to receive the broadcast.
   - The privacy boundary is **shared trust**, not technical enforcement — we rely on the shell honoring the "advisory only" contract.
2. **Test enforcement weak.** The privacy guard test (`tests/persona-broadcast-handshake.test.ts:130-146`) blocks the other four T0 fields but explicitly permits `personaId`. Future regressions that add another "hint" field would have no test pressure to stop them — precedent creep.
3. **Documentation contradiction.** The parent contract literally contradicts itself (line 102 vs line 126). A future contributor reading the strict-mode line :102 might assume the contract is enforced and not check the test or the roster — leading to either false confidence or unnecessary review cycles.

### Risk if we **tighten** (drop the carve-out)

1. **Coordination cost.** Need to land changes in ~7 files in our repo + coordinate with Lovable to update their listener. Both PRs need to land in the same release window or Lovable's shell breaks for one release.
2. **`personaSessionToken` rotation behavior** must be confirmed: does the shell need to know that "the same persona is still active across token rotations" (a stable persona handle) vs. "a new token is a new persona-version signal"? The current API rotates the token on persona switch, sign-out, and TTL. TTL rotation would falsely signal a switch to a strict listener. Mitigation: include a `version: 'switch' | 'refresh' | 'initial'` field on the event so receivers can distinguish.
3. **Edge case: failed surface fetch.** Today's "fail-open" path (`tests/persona-broadcast-handshake.test.ts:93-100`) emits a bare envelope `{ type, personaId }` when the surface fetch fails. With personaId dropped, the bare envelope becomes `{ type }` — the shell has no signal of *which* persona changed. Mitigation: stop fail-open behavior and emit nothing on fetch failure; rely on the next refresh cycle.

### Combined posture

The carve-out is a small, contained, *documented* privacy compromise — not a leak in the colloquial sense. The risk is primarily that:
- It creates precedent for future "T0 hint" exceptions
- It leaves a documentation contradiction that confuses future contributors
- It relies on social-contract honor by third-party shells

None of those are urgent. The end-of-workstream security review is the right place to make the strict/pragmatic call with full context.

---

## Recommendation for the security review

1. **Decide direction:** keep the carve-out, tighten to strict-T0-never, or adopt a middle path (drop top-level `personaId`, keep it inside `surface` only — strange and not recommended).
2. **If keeping:** resolve the documentation contradiction by amending parent contract line 102 to acknowledge the explicit hint exception, and add a paragraph to `persona-spine-client-protocol.md` §"Identifier tiers" justifying why the hint is acceptable (server-authoritative, no privilege escalation, etc.). Strengthen the privacy guard test to whitelist *only* `personaId` and nothing else — prevent precedent creep.
3. **If tightening:** open coordinated PRs across the 7 files + Lovable's shell. Add a `version` field to the event payload to disambiguate switch vs refresh vs initial (so a token rotation isn't read as a persona switch). Update the broadcast-handshake test's bare-envelope assertion to remove the fail-open `personaId` allowance.
4. **Either way:** add a one-paragraph "Privacy decisions" section to `docs/architecture/metame-client-protocols.md` summarizing the final stance so future contributors land in the right mental model immediately.

---

## Pattern A summary (for reviewer convenience)

What Pattern A added on top of the prior persona-change envelope:
- **Canonical event name** `metame:persona-changed` (in addition to legacy `aa-persona-change-v1`)
- **Inline `surface` field** carrying full T1 `ActivePersonaSurface` so cross-origin shells (Lovable) don't need to call `/api/wallet/active-persona` — which they can't, because they don't have the Supabase Bearer token.
- **Schema version** `schemaVersion: 1`

What Pattern A did **not** change:
- The top-level `personaId` field — unchanged from the legacy event
- The fail-open behavior on surface-fetch failure
- The receivers (Lovable, in-app subscribers) keep working with both old and new envelope shapes

The Pattern A delta is purely **additive T1 surface**. The T0 hint carve-out predates it and rides through unchanged.

---

## References

- Parent contract: `docs/architecture/metame-client-protocols.md` (especially lines 102, 126, 190)
- PersonaSpine spec: `docs/architecture/persona-spine-client-protocol.md` (especially §"Identifier tiers", line 69)
- Pattern A implementation: `app/contexts/PersonaContext.tsx` lines 236-300, `utils/personaSpine.tsx::broadcastPersonaChange`
- Privacy guard test: `tests/persona-broadcast-handshake.test.ts`
- Privacy contract authority: `types/access.ts` + `CLAUDE.md` § "Identity & Access Spine"
- Lovable integration brief (forwarded to thin-client team): `codexes/packs/agentiq/updates/2026-05-12_lovable-thin-client-metame-protocol-brief.md` + addendum v1
- Shipping commits: `6a912c00` (Pattern A), `e84283a2` (cartridge-close ack), `b220a1b0` (PersonaSpine canonical event), `3f7eb36d` (parent contract)
