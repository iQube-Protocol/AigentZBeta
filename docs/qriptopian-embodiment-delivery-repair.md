# Qriptopian Papers taxonomy and delivery repair

Status: partial; review branch only. No live data mutation or deployment performed by this change.
Canonical repository: iQube-Protocol/AigentZBeta, base dev 416a6b2e788fffa5f716f79e0513833287f24e8d.
Requested by operator: Embodiment is a sibling series under Papers; preserve original Polity four and Threshold 005.

## Root cause

The old Papers API derives taxonomy from a filename embedded in auto_drive_cid, ignoring series_scope.
Ten newer Embodiment asset records were changed to point auto_drive_cid at their own media/cover route
with a synthetic papers-polity filename query. This both misclassifies them and replaces the CID the
encrypted delivery routes require. Original Polity records instead contain genuine public Supabase
storage URLs from manual uploads. Do not rewrite those legacy URLs.

## Implementation

- Papers API prefers explicit series_scope; legacy filename inference remains for null scopes.
- Adds papers/embodiment label/order and existing admin upload selector option.
- Raw shareable CIDs project to existing /api/content/media/:id and /api/qriptopian/essay-cover/:id.
- Source fields are not changed by the projection; no new upload/delivery system.
- Explicit private scopes, false is_shareable records and canonical plates do not enter public listing.
- Existing title-stem cover matching is retained and tested across all five Embodiment covers.
- Targeted SQL restores the ten original upload-receipt CIDs and moves only those records to papers/embodiment.
  It checks all ten exact preimages (or already-correct postimages), locks rows, and fails on unexpected state.
  No dates, publication identities, titles, PDF bytes, encryption metadata or Threshold records change.

## Protected originals

Original Polity PDF IDs:
4030a684-1c42-44b8-bd23-8d31b4b33720
f737e898-bdaa-45b3-8cf5-8149ef9d3410
d598222f-bfd9-4ff3-87de-833411d7aa21
f7342afc-477d-447f-a68b-75df94b2a954

Threshold 005 content c25eb589-65f3-46af-b840-af544e8bf8ae and cover
15a87ead-894d-4c25-ba0e-f4fa03395098 remain untouched.
Threshold 006 is distinct content 00da0c1b-f518-4641-878c-a4f9432e93d2.

## Validation performed

Isolated dependency harness (Vitest 3.2.4, Next 15.5.0, Supabase JS 2.89.0):
npx vitest run tests/qriptopian-papers-delivery.test.ts -- 7 passed.
Against the old route, the first six tests yielded 5 failures and the legacy URL test passed.
The seventh covers five independent cover bindings. This is not a full repository test/typecheck claim.
Local harness package/config files are not part of this patch; keep repository dependency configuration.

Read-only live checks:
- Original Polity four retain manual public storage URL records.
- 005 and 006 smart-content APIs return complete article text.
- Native cartridge /triad/embed/codex/qripto?tab=essays renders 006 through its appendix/references after Read.
- 002-005 cover URLs returned valid WebP in direct HTTP checks.
- Browser grid still exhibited failed images for 002,004,005,006 despite some direct successes.
  Do not call that resolved; full browser-path reliability needs follow-up.
- 006 cover 93a97bbe-ace9-41b7-a807-d27b72b5e76b returns 502:
  cover-derivative-failed / suspicious-uniform-fill-band.
- 006 already uses the exact cover route used by 005. Do not substitute 005 artwork or relax validation globally.
- Recovered v0.3 ZIP contains a 2040-byte title-page cover PDF, no raster artwork.
  Visual review shows a plain white title page, large blank regions, and poor title spacing.
  This is not proof the live encrypted raster is identical; source byte/visual comparison remains required.
- Canonical editorial identity of the uploaded Embodiment PDFs is not established by restoring CIDs.

## Required deployment sequence

Assignee: Claude Code; relay via existing QubeTalk bridge.
1. Review branch/diff against current origin/dev; run repository tests and typecheck.
2. Deploy Papers projection/upload selector first; record successful deployed SHA.
3. Back up the ten targets' exact preimage fields in the deployment receipt.
4. In the authorized environment run scripts/repair-qriptopian-embodiment.sql.
   Do not execute the SQL while the old filename-only projection is live: raw CIDs would temporarily hide cards.
5. Verify Papers lists exactly four original Polity PDFs plus a separate five-item Embodiment series.
6. Fetch each projected cover and PDF; require successful actual image/PDF bytes, not a registry row or redirect alone.
7. Compare uploaded PDFs against the operator-approved sources before declaring them canonical.
8. Verify 005 unchanged and Read for 005/006 in browser. Resolve remaining cover failures separately.
9. Keep WiP private/admin gated; this patch does not publish or expand access to any draft.

Rollback: the ten exact previous_url values are recorded in the SQL. Restore ONLY the captured preimages
under matching postimage guards if operational rollback is required; do not alter legacy Polity or Thresholds.
Code rollback and data rollback must be coordinated.

## Candidate invariant (proposal only)

Keep canonical storage identity, taxonomy and delivery URLs separate. A publication check should verify
source-to-delivery bytes and actual browser rendering, not just database registration. Recommend prospective
invariant capture after operator approval; no roadmap registration has been made.

