# Direct deployment receipt — Qriptopian Embodiment

Operator instruction: deploy directly; do not use QubeTalk.

## Live deployment
- Deployed code commit: efdc7cc2b58ddc4ee761315c65f2f06e5a497f1a.
- /api/diag returned backendVersion dev-efdc7cc2b58ddc4ee761315c65f2f06e5a497f1a at 2026-09-01T12:15:36.409Z and 12:15:49.568Z.
- Later dev commits were confirmed descendants retaining the Qriptopian patch unchanged.
- Guarded SQL applied only AFTER the live version was confirmed.
- Ten assets now use papers/embodiment and their original upload-receipt CIDs.
- No relay, thin-client changes, re-upload, or PDF/content rewrite.

## Acceptance results
- Live Papers API: Polity 4, Embodiment 5; Experience Sovereignty 7 and COYN Thesis 5 retained.
- Native cartridge browser: separate The Polity and Embodiment section headings with the correct four/five cards.
- All five Embodiment cover images loaded and decoded in the browser.
- All five cover routes returned valid WebP, fully decoded by the live acceptance script.
- All five PDF routes delivered application/pdf with SHA-256 matching the previously uploaded editions.
- The first script pass encountered a transport-level fetch failure for Paper V; a follow-up request returned HTTP 200,
  1,333,752 bytes, hash 668e2a2907b48adffcd3a11562497d07ee4b1aa2cabb675096c0004d54028a57.
- PDF previews for Paper I and Paper V were visually verified in the native cartridge.
- Matching uploaded bytes establishes delivery, NOT editorial certification of canonical PDFs.

## Preservation
All eight original Polity assets (four PDFs and four covers) have the same full-row fingerprint before and after:
6b549c02cf1b0df52f1ea4aa082d29fc.

Threshold 005 content fingerprint unchanged: 7e70c08268deb3df50b39354b31df215.
Threshold 005 cover fingerprint unchanged: e6e41db59b44bfcc4247f2b80c3bbd9e.
Threshold 005 cover delivery confirmed HTTP 200, image/webp, 42,162 bytes.
All ten target rows match their prior hash excluding only series_scope, auto_drive_cid and updated_at.
Existing titles, created dates, encryption metadata and all other fields are unchanged.
Exact preimages: docs/qriptopian-embodiment-pre-repair-checkpoint.json.

## CI
- Local targeted tests: 7 passed.
- Deployment CI run 33505584948: 17 failed files / 75 failed tests, 522 passed files / 8,978 passed tests, 2 skipped.
- Prior baseline CI run 33503774116: 17 failed files / 75 failed tests, 521 passed files / 8,971 passed tests, 2 skipped.
- Compared normalized individual failure names: no new or removed failures.
- All seven new Papers tests pass in full CI; no new TypeScript error lines.

## Remaining separate issues
- Threshold 006 cover still returns cover-derivative-failed / suspicious-uniform-fill-band (502).
  Its cover record was not changed in this deployment; do not claim it fixed.
- Threshold 006 article had already been verified rendering through appendix/references in the native reader.
- Operator-approved editorial/canonical identity of the uploaded Embodiment PDFs remains a distinct check.
- This deployment does not change private WiP access or publish additional drafts.
