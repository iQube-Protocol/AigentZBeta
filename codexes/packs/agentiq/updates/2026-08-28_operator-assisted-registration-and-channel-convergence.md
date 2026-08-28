# Operator-assisted RAX registration + channel-independent constitutional acts

**Date:** 2026-08-28
**Merged commits:** `063471451` (operator-assisted registration), `c36c2824b` (channel convergence) — both merged to `dev` on top of `fee5c300b`.
**Branches:** `review/rax-operator-assisted-registration-2026-08-28`, `review/journey-spine-channel-convergence-2026-08-28`.

## The problem

Ian, the OCSGA-side principal on Reciprocal Artifact Exchange `0b4134a6-6246-48a8-98f6-e3a22fcd18b3`, held a real, verified `OCSGA_Constitutional_Master_v1.3.docx` and explicit authorization to register it, but could not reach `/bridge/ocsga` himself (a separate, still-open reload-loop defect — untouched by this work). The exchange's `depositArtifact()` is strictly principal-bound: it resolves the caller's own persona to a party slot and refuses otherwise, by design (no operator-impersonation path exists, nor should one). Registering Ian's artifact required a genuinely new capability, not a workaround.

## What was built

1. **`registerArtifactOperatorAssisted()`** (`services/research/reciprocalExchange.ts`) — a distinct primitive from `depositArtifact()`, never overlapping it (structurally enforced by a body-hash canary against the unmodified function). Records source/bound principal, registering operator, and authority basis as separate fields, with `pending_principal_attestation: true`. `declareFreeze()`/`signInstrument()` both refuse a pending artifact.
2. **`confirmOperatorAssistedArtifact()`** — clears the pending flag, callable only by the exact bound principal, hash untouched by confirmation.
3. **`ensureBoundaryResearchExchangeMembershipOperatorAssisted()`** (`services/journey/boundaryResearchExchangeAdmission.ts`) — an admin-gated wrapper around the existing, unmodified `ensureBoundaryResearchExchangeMembership()`, reusing `inviteCounterparty`/`joinExchange` unchanged.
4. **`confirm_operator_assisted_artifact` MCP tool** and richer `get_exchange_state` instrument-presentation text, closing the one real gap found when every constitutional-act stage (delegate, confirm, fingerprint, freeze, sign, readback) was audited against the Threshold MCP surface.
5. **`agentRef` on exchange receipts** — the delegated executing agent (e.g. a Copilot session alias) is now recorded distinctly from the principal and from the origin channel, closing a real gap: channel identity (`'mcp'`/`'native-ui'`/`'operator-assisted'`) already existed, agent identity did not.

## The architectural finding

The operator's framing, verbatim: *"There is only one constitutional state machine. Copilot, the bridge, IRL OS and future interfaces are projections and actuation channels around it."* This was tested as a literal acceptance criterion, not documentation: `tests/journey-spine-channel-convergence.test.ts` writes a constitutional act (freeze, sign, delegate) via one path and reads it back via a genuinely different path (the Journey Spine / bridge resolver), in both directions, with real (non-mocked) execution. The property already held structurally from an earlier 2026-08-26/27 fix (`ensureBoundaryResearchExchangeMembership` unifying the bridge's own state route and the MCP navigator on the same read chain) — this work is the first evidence that proves it, and closes the two places (artifact confirmation, agent identity) where it hadn't yet been extended.

## Verification

Full-suite regression: 21 failed files both before and after (byte-identical failing-file set, zero attributable regressions). TypeScript: 689/689, unchanged. Live post-merge: `/api/journey/ian/state`'s response is byte-identical before and after the merge (route untouched). `/bridge/ocsga`'s reload-loop symptom is client-side JavaScript behavior a plain HTTP GET cannot reproduce or falsify either way — **not verified live either direction**, deliberately left open rather than claimed.

Migration `supabase/migrations/20260930120000_exchange_operator_assisted_registration.sql` is written and reviewed but **not applied** — the operator must run it before `registerArtifactOperatorAssisted()` can execute against the live database.

## Candidate invariants derived

See `RES-2026-08-28-RAX-OPERATOR-ASSISTED-CHANNEL-CONVERGENCE-001` and its five candidates, `CI-2026-08-28-*`.
