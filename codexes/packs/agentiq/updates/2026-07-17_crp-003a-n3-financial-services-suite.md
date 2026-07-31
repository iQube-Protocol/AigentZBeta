# CRP-003a Increment 3 (N3) — the Financial Services Capability Suite surface

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Spec:** `CRP-003a` §5 (the Suite surface), §7 Increment 3

The constitutional service loop now has an operator-visible surface: the first
**Founder Office Capability Suite**. An operator can run the canonical service
pattern (shadow) on a Domain-3 capability and see the 12-step trace, and can
form → accept → authorize a Constitutional Agreement so the delegated call is
allowed.

## What shipped

- **`app/triad/components/codex/tabs/FinancialServicesTab.tsx`** — a self-contained
  tab driving the live N1/N2 routes via `personaFetch` (spine Bearer token —
  raw fetch would 401, CLAUDE.md PARAMOUNT). Slate house style (no white
  hairlines). Three sections:
  1. **Three-experience framing** (Constitutional Preview / Founder Office /
     Advanced) — PRD §9.
  2. **Financial Intelligence request** — intent + capability + agent inputs;
     **Run (shadow)** and **Run (authoritative)** → `POST /api/constitutional/
     service-pipeline`; renders the 12-step trace with per-step status chips
     (ok / observed / shadow-block / refused / skipped) + the F-201/202/203
     verification line.
  3. **Constitutional Agreement (Founder Office)** — Form / Accept / Authorize →
     `POST /api/constitutional/agreement`; lists the caller's own agreements.
     Authorizing opens the 409 gate so an authoritative run executes.
- **Registration** — `FinancialServicesTab` added to `TabRenderer.tsx`'s
  `componentRegistry`; a `financial-services` tab added to the **Founder Office
  cartridge** (`VENTURE_LAB_CODEX`, slug `venture-lab`) right after Founder
  Office — literally "a Capability Suite inside the Founder Office" (PRD §6).

## Access control (honest)

- The **functional gate in this slice is the constitutional agreement (409)** —
  an authoritative run refuses without an authorized agreement. That is the
  x409 idiom, enforced.
- **Commercial tier-gating** (the Preview/FO/Advanced split bound to the existing
  subscription tiers via `activationPlanGate` / a preview banner, the
  FounderOfficeTab pattern) is **Increment 3b** — the framing is rendered; the
  tier enforcement is not yet wired. No parallel tiering was introduced.

## Verification

- The two pure services underneath (N1 executor logic, N2 pipeline branching)
  are drilled 23/23 + 16/16 (prior increments); this increment is the surface
  over them. `personaFetch` import path + tab slug uniqueness confirmed in code.
- **UI was not run in-sandbox** (no app runtime here) — the component mirrors the
  established tab pattern (registry + `personaFetch` + slate style) and is
  additive. Live visual verification against the deployed dev instance is the
  operator's step.

## Operator step

Deploy, open the **Venture Lab α** cartridge → **Financial Services** tab. Run
(shadow) shows the loop immediately (the agreement gate reads `shadow-block`
until you authorize). Then Form → Accept → Authorize an agreement for the shown
capability + agent, and Run (authoritative) — it should execute the delegated
call gated by the agreement.

## Next

- **Increment 3b** — bind the three experiences to the existing subscription
  tiers (preview-banner + `activationPlanGate` entry).
- **Increment 2b** — live executor (invariant-grounded intelligence) + live-wire
  the observed pipeline steps (standing/policy/accrual).
