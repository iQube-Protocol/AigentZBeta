# Backlog — isDebugBypassEnabled hardcoded-ON test assertion mismatch

**Date:** 2026-06-02
**Status:** backlog · low priority · test-only · no production risk
**Discovered during:** Phase 4b spine extension validation (see `2026-06-02_mycartridge-phase-4b-spine-extension.md`)

## The mismatch

`tests/access-spine.test.ts` carries this assertion:

```ts
describe('debugBypass', () => {
  it('isDebugBypassEnabled is currently hardcoded ON (TEMPORARY DEBUG)', () => {
    // Plan §11.e tracks this as a backlog item to retire.
    expect(isDebugBypassEnabled()).toBe(true);
  });
  ...
});
```

But the current implementation at `services/access/debugBypass.ts:64` is **env-gated**, not hardcoded:

```ts
export function isDebugBypassEnabled(): boolean {
  return process.env.ACCESS_DEBUG_OPEN === '1';
}
```

The test therefore fails locally + in CI unless `ACCESS_DEBUG_OPEN=1` is set in the env. Pre-existing — not introduced by Phase 4b. Has been failing on every run for some time.

## Provenance — what happened

Tracing the file history:

1. **Original landing** — `isDebugBypassEnabled()` was hardcoded `return true` for the operator's spine verification window. The test was written then and pinned the hardcoded posture.
2. **Tightening pass** — somebody later converted the bypass to env-gated (the safer steady-state posture so production never accidentally runs with the bypass on). The function comment block at `debugBypass.ts:50-63` documents the env-gated semantics:
   > Env-gated bypass. OFF by default in every environment — set `ACCESS_DEBUG_OPEN=1` in Amplify env (or .env.local) to enable.
3. **Test left behind** — the assertion still expects the hardcoded posture. The mismatch slipped through because nobody ran `tests/access-spine.test.ts` cleanly in CI after the env-gating landed.

The two are inconsistent and the test is the wrong one — the env-gated posture is correct for production.

## Risk assessment

- **Production runtime:** zero risk. The implementation is correct; only the test is stale.
- **CI signal:** noise. The failure has been masking real regressions because anyone reading the test output learns to skip past this line.
- **Privacy:** unaffected — the bypass remains scoped to the three debug endpoints (`/api/access/inspect`, `/api/access/whoami`, `/api/access/list-assets`) and never touches content-delivery gates.

## Fix (when ready)

One of two paths, depending on the operator's preference:

### Option A — pin the env-gated posture (recommended)

Update the test to assert the documented behaviour:

```ts
describe('debugBypass', () => {
  it('isDebugBypassEnabled reflects ACCESS_DEBUG_OPEN env (default off in prod)', () => {
    const prior = process.env.ACCESS_DEBUG_OPEN;
    try {
      delete process.env.ACCESS_DEBUG_OPEN;
      expect(isDebugBypassEnabled()).toBe(false);
      process.env.ACCESS_DEBUG_OPEN = '1';
      expect(isDebugBypassEnabled()).toBe(true);
      process.env.ACCESS_DEBUG_OPEN = '0';
      expect(isDebugBypassEnabled()).toBe(false);
    } finally {
      if (prior === undefined) delete process.env.ACCESS_DEBUG_OPEN;
      else process.env.ACCESS_DEBUG_OPEN = prior;
    }
  });
  ...
});
```

This matches the documented behaviour, removes the noise, and adds a regression guard against anyone accidentally hardcoding the bypass back on.

### Option B — restore the hardcoded posture

If the operator wants the bypass hardcoded ON during an active spine-verification window, revert `isDebugBypassEnabled()` to `return true` and leave the test as-is. NOT recommended for steady-state; the env-gated posture is the right production default.

## Tracking

Apply the fix in the same PR that closes the next backlog sweep on `tests/access-spine.test.ts`. No dependency on any open phase work; can land independently.

## See also

- `services/access/debugBypass.ts` — the file under test
- `tests/access-spine.test.ts:446` — the failing assertion
- Plan §11.e (referenced in the test comment) — original tracking note for retiring the bypass entirely once `verify-spine.mjs` gets a proper JWT auth path
