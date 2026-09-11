# Sponsorship-capacity remediation for Factor/Aegis (2026-09-05, follow-up)

Corrects a defect surfaced by the prior report in this same session
(`2026-09-05_factor-aegis-canonical-identity-and-wallet-provisioning.md`): "sponsorship capacity
already exhausted (base 3, used 6)" was reported as a blocker on Factor/Aegis's `agent_root_identity`
provisioning. **Per operator ruling, this was a corrected implementation defect, not a
constitutional or operator blocker** — a flat `sponsorship_capacity_base: 3` restriction was being
applied uniformly regardless of administrator status, platform-agent provisioning, or the sponsor's
actual tier entitlement (which already supports 10/28/35/50/unlimited at higher tiers).

## What changed

**New canonical resolver:** `services/access/personaCapacity.ts` — `resolveAgentSponsorshipCapacity()`.
Replaces THREE hand-copied instances of the same flat arithmetic (`services/agents/sponsorPolityAgent.ts`,
the Homecoming stand-up route's GET preflight, and the sponsored-agents display route) with one
authoritative function.

Policy enforced:
1. An authenticated administrator (`callerIsAdmin`, resolved server-side via
   `getActivePersona().cartridgeFlags.isAdmin` — never a request body/header/JWT claim) is
   **unbounded**, always — not merely "overridden past an exhausted cap."
2. A platform-authenticated caller (`isPlatformAuthority: true`, set only by a route that has
   already validated a platform-level credential such as `CRON_TRIGGER_TOKEN`, with no persona
   session at all) is **unbounded** too — the Factor/Aegis-style platform-agent path.
3. Otherwise, capacity resolves from the sponsor's real tier ladder
   (`services/billing/personaPlan.ts`'s `boundedDelegateLimit` — 3/10/28/35/50/unlimited) plus any
   admin-granted base or Standing-earned credit.
4. A tier at the `UNLIMITED` sentinel resolves to `bounded: false` — never reported as the literal
   `9999`.
5. `remaining` is never negative. A legacy over-capacity account (exactly the live
   MoneyPenny/Nakamoto/Kn0w1 sponsor's real state — base 3, used 6) reports `remaining: 0,
   overCapacity: true` — a fact, not an invalidation of the six agents already sponsored.
6. The resolver gates creating one more sponsored agent only; it has no opinion on reading,
   selecting, or operating agents/personas that already exist.

`services/billing/personaPlan.ts` now exports its `UNLIMITED` sentinel so the resolver can detect
and translate it, rather than re-deriving a second magic number.

## Where it's wired in

- `services/agents/sponsorPolityAgent.ts` — the genesis core Factor/Aegis's provisioning goes
  through. `capacityOverride.authority` gains a `'platform'` value alongside the existing
  `'administrator'` / `'migrated_agent_passport_issuance'`. `SponsorAgentInput` gains
  `isPlatformAuthority?: boolean`.
- `app/api/homecoming/agent/stand-up/route.ts` — GET preflight now calls the resolver instead of
  re-deriving the same arithmetic.
- `app/api/persona/sponsored-agents/route.ts` — the wallet drawer's capacity display now calls the
  resolver; an admin viewing their own capacity now honestly sees "unbounded," never a stale
  `remaining: 0` derived from the flat cap.
- `app/components/content/SmartWalletDrawer.tsx` and
  `app/triad/components/codex/tabs/PassportRegistryTab.tsx` — updated to render the bounded/
  unbounded discriminated union correctly (an unbounded admin previously would have rendered as
  "0 remaining — exhausted", which is exactly the false-blocker UI defect this ruling corrects).

## What did NOT change

- `app/api/wallet/persona/route.ts` (ordinary human persona creation, `personaLimit`) is **not**
  wired to admin-unbounded treatment this turn. Its auth model resolves only an `authProfileId`
  (`getCallerAuthProfileId`), not a persona with `cartridgeFlags.isAdmin`; the only admin-resolution
  helper for a bare `authProfileId` (`resolveAdminFlag`) is a private function inside
  `services/identity/getActivePersona.ts` — a file CLAUDE.md lists as requiring explicit operator
  approval before modification. Building a second, narrower admin check elsewhere would itself be
  the parallel-implementation defect this remediation exists to remove. **Flagged for explicit
  operator sign-off rather than done silently or worked around.**
- No raw SQL insertion and no one-off Factor/Aegis bypass was used, per the operator's explicit
  instruction. The fix lives entirely in the canonical resolver and its call sites.

## Tests

`tests/persona-capacity.test.ts` (new, 18 tests) covers all 12 operator-required scenarios:
admin-with-six-existing-personas may create Factor; admin stays unbounded after Factor+Aegis;
platform-agent provisioning bypasses the flat-three rule; a 50-capacity tier admits through the
50th and refuses the 51st; an unlimited tier follows its own entitlement; forgery immunity (source-
level canaries proving `callerIsAdmin`/`isPlatformAuthority` are never derived from a request body,
header, or JWT, at every real call site in this repo); a legacy over-capacity account reports zero
remaining plus `overCapacity: true`, never negative; the resolver gates creation only, never reads;
Factor/Aegis provisioning idempotency (slug-uniqueness gate unchanged, still runs after capacity);
tenant isolation (capacity is queried strictly per `sponsorPersonaId`, never merged across
sponsors).

`tests/sponsorship-admin-override.test.ts` (existing, 10 tests) — updated only to point its
source-level anchor at the new resolver call site; every invariant it originally pinned (refusal
for a non-admin at exhausted capacity, no client-suppliable admin flag, gates checked before any
override, the override recorded as its own auditable field) still holds, now anchored on the
correct authoritative location per Extend-Don't-Duplicate.

**Full regression**: `npx tsc --noEmit` — 680 errors before and after (baseline unchanged).
`npx vitest run` — same 15 pre-existing failing files as the prior report in this session
(confirmed via output, not re-diffed this turn since the file list is byte-identical to the
already-verified baseline); zero new failures.

## Still blocked — unrelated to capacity, unchanged from the prior report

Real wallet generation, FIO registration, and the actual `agent_root_identity`/`agent_persona`
writes for Factor and Aegis remain blocked from this local session for the SAME reason as before —
this session's `.env.local` has no `SUPABASE_SERVICE_ROLE_KEY`, `AGENT_KEY_ENCRYPTION_SECRET`, or
`CRON_TRIGGER_TOKEN`, and there is no live authenticated admin persona session to exercise
`sponsorPolityAgent`/`standUpDelegate` for real. **This is an environmental/execution-boundary
blocker, entirely separate from the capacity defect this remediation fixes.** The capacity fix
removes what would otherwise be a SECOND blocker once the environmental one is resolved (e.g. in
the deployed environment, or by the operator running the ops routes directly with real secrets).
No wallet address, FIO registration, or root-identity row was fabricated or inserted via raw SQL to
work around this.
