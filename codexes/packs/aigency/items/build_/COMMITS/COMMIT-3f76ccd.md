# Commit Brief: `3f76ccd` — Implement CFS-055 coherence pass: canonical Ratify projections + drawer

| Field | Value |
|-------|-------|
| SHA | [`3f76ccd`](https://github.com/iQube-Protocol/AigentZBeta/commit/3f76ccd53d31680c03d76f84db9ded974cec3bbe) |
| Author | Claude |
| Date | 2026-08-10T05:22:13Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Implement CFS-055 coherence pass: canonical Ratify projections + drawer

Observer -> POSIT -> AR alignment across the Horizen journey, per the
Nakamoto coherence matrix's four findings. No presentation strings
patched individually — the fix is generic and lands at the seam:

1. State route: extend the per-stage projection to sub-predicate level
   for Ratify (agreementAuthorized, pulseAuthorized,
   pnlDisclosureAuthorized, pnlServiceRegistered, pnlEvidenceVerified),
   each independently sourced (receiptBackedSubPredicate /
   agreementAuthorized's own agreement-row read) — never inferred from
   another. Exposed as ratifySubPredicates.

2. StageReceiptsDrawer: primary evidence source is now the canonical
   receiptRefs/evidencePresent the state route already resolved
   (hydrated by exact id via /api/assistant/receipts?ids=), fixing the
   Passport/Register/Orient/Stand canary (COMPLETE stage, "No receipts
   recorded" drawer). The old type-only search survives only as an
   explicitly-labeled, non-authoritative "Historical / supplementary"
   section that can never contradict the primary block.

3. AgreementRatifyPanel + PulseTransparencyToggle: thread the canonical
   sub-predicates through resolveSurfaceProps as primary, OR'd with
   each component's own live read (corroboration only, never sole
   authority, never able to regress an established fact) — replacing
   the panel's hand-duplicated AGREEMENT_STATUS_RANK check and the
   toggle's own Agent Card-derived pulse/disclosure booleans.

4. Verified via 15 new generic coherence canaries
   (tests/cfs-055-coherence-canaries.test.ts) covering all 7 required
   proofs, plus the full existing regression suite (764 tests) and
   tsc (zero new error categories vs. baseline).

Also: relocated the Journey stepper's Evidence trigger into the top
row (between Refresh state and Full screen) so its popover opens onto
the stage-description row instead of congesting that row's own
corner; renamed the journey header to "metaMe x Horizen Constitutional
Threshold Guide".
```

## Body

Observer -> POSIT -> AR alignment across the Horizen journey, per the
Nakamoto coherence matrix's four findings. No presentation strings
patched individually — the fix is generic and lands at the seam:

1. State route: extend the per-stage projection to sub-predicate level
   for Ratify (agreementAuthorized, pulseAuthorized,
   pnlDisclosureAuthorized, pnlServiceRegistered, pnlEvidenceVerified),
   each independently sourced (receiptBackedSubPredicate /
   agreementAuthorized's own agreement-row read) — never inferred from
   another. Exposed as ratifySubPredicates.

2. StageReceiptsDrawer: primary evidence source is now the canonical
   receiptRefs/evidencePresent the state route already resolved
   (hydrated by exact id via /api/assistant/receipts?ids=), fixing the
   Passport/Register/Orient/Stand canary (COMPLETE stage, "No receipts
   recorded" drawer). The old type-only search survives only as an
   explicitly-labeled, non-authoritative "Historical / supplementary"
   section that can never contradict the primary block.

3. AgreementRatifyPanel + PulseTransparencyToggle: thread the canonical
   sub-predicates through resolveSurfaceProps as primary, OR'd with
   each component's own live read (corroboration only, never sole
   authority, never able to regress an established fact) — replacing
   the panel's hand-duplicated AGREEMENT_STATUS_RANK check and the
   toggle's own Agent Card-derived pulse/disclosure booleans.

4. Verified via 15 new generic coherence canaries
   (tests/cfs-055-coherence-canaries.test.ts) covering all 7 required
   proofs, plus the full existing regression suite (764 tests) and
   tsc (zero new error categories vs. baseline).

Also: relocated the Journey stepper's Evidence trigger into the top
row (between Refresh state and Full screen) so its popover opens onto
the stage-description row instead of congesting that row's own
corner; renamed the journey header to "metaMe x Horizen Constitutional
Threshold Guide".

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/receipts/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/AgreementRatifyPanel.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/PulseTransparencyToggle.tsx` |
| Modified | `components/journey/StageReceiptsDrawer.tsx` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Added | `tests/cfs-055-coherence-canaries.test.ts` |
| Modified | `tests/journey-orient-stage.test.ts` |
| Modified | `tests/pnl-evidence-wiring.test.ts` |
| Modified | `tests/register-ceremony.test.ts` |
| Modified | `tests/register-stage-receipt-agent-isolation.test.ts` |

## Stats

 13 files changed, 692 insertions(+), 123 deletions(-)
