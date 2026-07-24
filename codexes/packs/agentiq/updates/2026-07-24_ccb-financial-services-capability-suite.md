# Constitutional Capability Brief — Financial Services Capability Suite

**Per CFS-049.** Source: CRP-003 (Financial Services Constitutional Capability Domain, chartered), CRP-003a (Constitutional Financial Services Programme, Increments N1–N3 + follow-ons). Status: BUILT, live on dev. Owner: Aigent Z workstream.

---

## 1. Executive Summary

The Financial Services Capability Suite is the platform's first Constitutional Capability Domain made real: a live, runnable surface where an operator (or a delegated agent, within bounded authority) can drive a 12-step constitutional service pipeline — intent, discovery, agreement, execution — for financial-services reasoning and, once explicitly authorized, real settlement-intent generation.

## 2. What Was Built

- **N1 — the Constitutional Agreement primitive**: `form → accept → authorize → requireAuthorizedAgreement`, the single "409 gate" every delegated, consequential action in this domain passes through.
- **N2 — the canonical service pipeline**: a 12-step constitutional trace (Intent → Discovery → Agreement → ... → Execution) runnable in `shadow` (preview, no gate) or `authoritative` (gated, real) mode, first proven on Domain 3 (Financial Intelligence).
- **N3 — the Financial Services Capability Suite surface**: a live tab (`Financial Services`) mounted in the Venture Lab α cartridge, right after Founder Office, driving N1/N2 directly from the UI.
- **Tier-gating + spend cap**: `ventureLabAccess`/`ventureTier` in-component checks gate the authoritative run and the advanced experience; a spend cap enforces `valueCeiling` on any money-moving execution.
- **Money-moving executors (Domain 1/2 — Investment, Market)**: LLM-assisted analysis feeding into a settlement-intent binding (never a live transfer) via `settlementExecutor.ts`.

## 3. Why It Exists

Financial reasoning and financial action are consequential in a way most platform actions aren't — they need a durable record of who authorized what, under what bounds, before anything executes. Rather than build a one-off "finance feature," this Suite is the first proof that the platform's general constitutional pipeline (agreement → gated execution → receipt) generalizes to a real, high-stakes domain.

## 4. Where To Find It

```
metaMe → Venture Lab α cartridge → Financial Services tab (right after Founder Office)
```

Requires the `venture-lab` activation to be enabled for the persona (Activations tab, if not already on).

## 5. How To Use It

1. Open **Venture Lab α → Financial Services**.
2. Click **Run (shadow)** — the 12-step trace runs immediately, no agreement needed; this is always available.
3. To run for real: **Form** a Constitutional Agreement for the shown capability + agent, **Accept** it, then have the operator **Authorize** it (this step is human-only — no agent can authorize its own delegation).
4. Click **Run (authoritative)** — the pipeline now executes the delegated call, gated at step 3 by the agreement you just authorized.

## 6. Screens

See the published Artifact version for the Financial Services tab screenshot captured during this workstream's live testing (showing the trace: Intent → Discovery → Constitutional Agreement `refused: 409`, and the Form/Accept/Authorize panel).

## 7. User Journey

```
Open Financial Services tab → Run (shadow) → see the full trace, blocked at the agreement step
  → Form the agreement → Accept → Authorize (human)
    → Run (authoritative) → the delegated call actually executes, gated + receipted
```

## 8. Constitutional Behaviour

- **The 409 gate** (`requireAuthorizedAgreement`) is the single choke point for every consequential action in this domain — no parallel authorization path exists.
- **Principal–delegate separation**: the agent may `form` and `accept` its own side of an agreement; only the human `authorize`s it.
- **Money-moving grade**: Investment/Market domains require the agreement's `verificationRequirements` to include a World-ID-verified Polity Passport before `authorizeAgreement` will open the gate (added 2026-07-24, shared primitive — see the MoneyPenny Runtime Brief for the specific enforcement path).
- **Settlement is intent-only**: `settlementExecutor.ts` builds a deterministic, hash-committed settlement intent; it never signs or broadcasts a real transfer. Actual fund movement stays a separate, human-supervised wallet step.
- **DVN receipts**: authoritative executions write a DVN-anchorable receipt for audit.

## 9. Technical Summary

- `services/constitutional/constitutionalAgreement.ts` — the agreement lifecycle + the 409 gate.
- `services/constitutional/constitutionalServicePipeline.ts` — the 12-step shadow/authoritative pipeline.
- `services/constitutional/settlementExecutor.ts` — settlement-intent construction (no transfer).
- `services/constitutional/financialIntelligenceExecutor.ts` — the Domain 3 (read-only) executor.
- `app/api/constitutional/agreement/route.ts`, `app/api/constitutional/service-pipeline/route.ts` — the API surface.
- `app/triad/components/codex/tabs/FinancialServicesTab.tsx` — the UI, registered in `TabRenderer.tsx`'s `componentRegistry`.
- Mounted at `data/codex-configs.ts` in `VENTURE_LAB_CODEX` as a standalone tab (no dedicated `tabGroup`/`activationId` of its own — it inherits the cartridge's `venture-lab` activation gate).

## 10. Dependencies

Passport (for World-ID verification on money-moving domains), the Identity & Access Spine, the Venture Lab α cartridge and its `venture-lab` activation, `ventureLabAccess`/`ventureTier` on the persona's billing plan.

## 11. New Registry Objects

Constitutional Agreement rows (via N1), pipeline execution traces (N2), DVN-anchorable authoritative-execution receipts. No new Qube type introduced.

## 12. Related Capabilities

MoneyPenny Constitutional Runtime (a domain-specialized driving agent over this same pipeline, with its own capability refs); the Identity & Access Spine; Founder Office (the cartridge this Suite is mounted inside).

## 13. Permissions

Not Observer-capability-gated (this is a server-side constitutional gate, not a browser permission). Money-moving domains require a World-ID-verified Polity Passport on the authorizing persona.

## 14. Example Use Cases

- **Founder**: run a shadow trace to see what a treasury-settlement question resolves to before committing to a real agreement.
- **Operator**: authorize a specific capability + agent pairing for a bounded window, then revoke/let it expire.

## 15. Limitations

- Tier-gating (§3b) is currently enforced **in-component** (`plan.ventureLabAccess`/`ventureTier` checks inside `FinancialServicesTab.tsx`), not yet at the codex/activation level as the original CRP-003a design called for (a dedicated tab-group + `activationId: 'financial-services'`) — this is an open follow-on, not a regression.
- The generic Suite surface has no dedicated automated test file of its own yet (`*financial-services*`/`*capability-suite*`); the underlying N1/N2 services are covered by their own service-level tests.
- Settlement amount/ceiling are operator-declared at Form time, not independently risk-vetted against any external model.

## 16. Future Roadmap

Codex/activation-level tier-gating (Increment 3b's original target design); a dedicated test suite for the generic Suite surface; broader Domain 1/2 (Investment/Market) executor maturity beyond the current LLM-analysis + settlement-intent binding.

## 17. Registry Metadata

- Capability ID: `financial-services-capability-suite`
- Source: CRP-003, CRP-003a (N1, N2, N3, 3b/2b/P3, money-moving Domain 1/2)
- Version: live on `dev`
- Date: 2026-07-24
- Owner: Aigent Z workstream
- Ratification: RATIFIED (CRP-003 chartered 2026-07-15; CRP-003a increments BUILT 2026-07-17 onward)
- Deployment: DEPLOYED (dev)

## 18. Completion Receipt

```
Capability: Financial Services Capability Suite
[x] Ratified
[x] Implemented
[x] Validated       (live operator run this session — shadow trace + agreement-gate refusal confirmed)
[x] Deployed
[x] Documented       (this Brief)
[ ] Registered       (Registry entry linking to this Brief — pending)
```

## 19. Capability Tour

1. Open **Venture Lab α → Financial Services** (enable the `venture-lab` activation first if you don't see the cartridge).
2. Click **Run (shadow)** — watch the 12-step trace run live, ending in a `refused: 409` at the Constitutional Agreement step.
3. Click **Form** to draft an agreement for the capability + agent shown in the trace.
4. Click **Accept** (the agent's side).
5. Click **Authorize** (yours — this is the one step only a human can do).
6. Click **Run (authoritative)** — the same 12 steps run again, this time actually executing the gated call.
7. Note the DVN-anchorable receipt this produces — that's your audit trail for the action.
