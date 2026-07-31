/**
 * Anchoring-readiness canaries (operator ruling 2026-07-27, item 5).
 *
 * > "A configured allowlist is not proof of a configured runtime. Add an
 * >  operational canary that fails deployment readiness when ratification
 * >  receipts remain local because the anchoring destination is absent. It
 * >  should not block local development, but it must make the degraded state
 * >  explicit."
 *
 * THE PROPERTY UNDER TEST is the three-valued verdict, and it is not
 * decoration. `activityReceiptDvnPipeline` documents its own no-op: with no
 * canister id it leaves every receipt at `local` and returns quietly. That is
 * correct for local development and INDISTINGUISHABLE, at a glance, from a
 * deployment where anchoring is configured and silently failing. Both read as
 * "receipts exist, none anchored".
 *
 * Collapse the verdict to a boolean and exactly one of two things happens:
 * every developer machine reports a failure and the signal is learned-ignored
 * within a day, or a broken production anchor reports success. The canaries
 * below fail on either collapse.
 *
 * A second property: readiness must be SAFE TO POLL. A check that submits to
 * the chain to prove the chain works is not a check — it is a writer wearing a
 * check's name, and a scheduled job running it would mint chain traffic twice
 * a day forever.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROUTE = 'app/api/ops/dvn/readiness/route.ts';
const WORKFLOW = '.github/workflows/anchoring-readiness.yml';
const PIPELINE = 'services/dvn/activityReceiptDvnPipeline.ts';

describe('the readiness verdict distinguishes unconfigured from degraded', () => {
  it('is three-valued, and never collapses to a boolean', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/AnchoringVerdict = 'ready' \| 'degraded' \| 'unconfigured'/);
    for (const verdict of ["'ready'", "'degraded'", "'unconfigured'"]) {
      expect(src, `the route never assigns ${verdict}`).toMatch(
        new RegExp(`verdict = ${verdict.replace(/'/g, "'")}`),
      );
    }
  });

  it('a missing destination is UNCONFIGURED, never degraded', () => {
    // The load-bearing branch. If a missing canister id ever produced
    // 'degraded', every local machine and every CI run would fail this check
    // and the signal would be worthless within a day.
    const src = stripComments(readSource(ROUTE));
    const noDestinationBranch = src.slice(src.indexOf('if (!canisterId)'), src.indexOf('} else {'));
    expect(noDestinationBranch.length, 'could not locate the no-destination branch').toBeGreaterThan(50);
    expect(noDestinationBranch).toMatch(/verdict = 'unconfigured'/);
    expect(
      /verdict = 'degraded'/.test(noDestinationBranch),
      'a missing anchoring destination is reported as degraded — local development would fail this check',
    ).toBe(false);
    // …and it must still SAY so. Silent tolerance is the state being fixed.
    expect(noDestinationBranch).toMatch(/reasons\.push\(/);
  });

  it('a configured destination with stuck or failed receipts IS degraded', () => {
    // The other half: configuration present, anchoring not happening. This is
    // the state the ruling exists to surface.
    const src = stripComments(readSource(ROUTE));
    // lastIndexOf: the 403 early-return also matches `return NextResponse.json`,
    // and slicing to the FIRST one produced an empty region that passed nothing.
    const configuredBranch = src.slice(src.indexOf('} else {'), src.lastIndexOf('return NextResponse.json'));
    expect(configuredBranch.length, 'could not locate the configured branch').toBeGreaterThan(200);
    // MUTATION-DRIVEN CORRECTION. This first counted `verdict = 'degraded'`
    // assignments and required >= 4. There are five, so DELETING ONE still
    // passed — a count is the wrong assertion when the property is "each of
    // these conditions, individually, degrades". Now checked per condition:
    // the block guarded by each test must itself set the verdict.
    const conditions: Array<[string, RegExp]> = [
      ['stuck local receipts', /\(stuckLocal \?\? 0\) > 0/],
      ['failed receipts', /\(failed \?\? 0\) > 0/],
      ['unparseable identity', /!identity\.parses/],
      ['absent identity', /!identity\.configured/],
      ['unreadable receipt state', /receiptReadError/],
    ];
    for (const [label, test] of conditions) {
      const at = configuredBranch.search(test);
      expect(at, `${label} is not checked at all`).toBeGreaterThan(-1);
      // The guarded block runs from the condition to the end of its braces.
      const after = configuredBranch.slice(at, at + 400);
      const block = after.slice(0, after.indexOf('\n    }') + 1);
      expect(
        block,
        `${label} records a reason without setting the verdict — it would report ready while degraded`,
      ).toMatch(/verdict = 'degraded'/);
    }
  });

  it('`ok` tracks the verdict rather than being asserted independently', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/ok: verdict !== 'degraded'/);
  });

  it('identity is PARSED, not merely present', () => {
    // `DFX_IDENTITY_PEM` being set proves nothing — a malformed PEM configures
    // an anchoring destination that refuses every submission.
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/parses: boolean/);
    expect(src).toMatch(/getPrincipal\(\)/);
    // MUTATION-DRIVEN CORRECTION — the SECOND time this exact defect appeared
    // today. Replacing the call with a literal (`const identity = { configured:
    // true, parses: true, principal: null }`) left `resolveIdentity` defined
    // but unused, and every "is the helper present" assertion above still
    // passed while nothing was actually parsed. Assert the CALL, not the
    // symbol.
    expect(src, 'resolveIdentity is defined but never called').toMatch(
      /const identity = await resolveIdentity\(\);/,
    );
    // Presence and validity are reported as SEPARATE facts, so a malformed
    // PEM cannot read as a working identity.
    expect(src).toMatch(/identityConfigured: identity\.configured/);
    expect(src).toMatch(/identityParses: identity\.parses/);
  });

  it('publication never degrades anchoring', () => {
    // The operator's rule made structural: "anchoring should not silently
    // depend on publication succeeding". A missing AUTONOMYS_API_KEY is
    // reported and must not enter the verdict.
    const src = stripComments(readSource(ROUTE));
    const verdictRegion = src.slice(src.indexOf('let verdict:'), src.lastIndexOf('return NextResponse.json'));
    expect(
      /autonomysConfigured/.test(verdictRegion),
      'Autodrive configuration is folded into the anchoring verdict',
    ).toBe(false);
    expect(src, 'publication state is not reported at all').toMatch(/publication: \{ autonomysConfigured \}/);
  });
});

describe('readiness is safe to poll', () => {
  it('never submits anything', () => {
    const src = stripComments(readSource(ROUTE));
    for (const writer of ['submit_dvn_message', 'submit_attestation', 'getActor']) {
      expect(src, `the readiness check calls ${writer} — a check that writes is not a check`).not.toContain(
        writer,
      );
    }
    // Counts only: no receipt bodies, no persona identifiers.
    expect(src).toMatch(/count: 'exact', head: true/);
  });

  it('is gated, unlike its ungated debug siblings', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toMatch(/getActivePersona\(req\)/);
    expect(src).toMatch(/cartridgeFlags\?\.isAdmin/);
    expect(src).toMatch(/ADMIN_OPS_TOKEN/);
  });
});

describe('the scheduled canary fails on the right state only', () => {
  it('fails on degraded, warns on unconfigured', () => {
    const wf = readSource(WORKFLOW);
    expect(wf).toMatch(/\/api\/ops\/dvn\/readiness/);
    // degraded → hard failure.
    const degradedCase = wf.slice(wf.indexOf('degraded)'), wf.indexOf('*)'));
    expect(degradedCase).toMatch(/::error::/);
    expect(degradedCase).toMatch(/exit 1/);
    // unconfigured → explicit, but not a failure.
    const unconfiguredCase = wf.slice(wf.indexOf('unconfigured)'), wf.indexOf('degraded)'));
    expect(unconfiguredCase).toMatch(/::warning::/);
    expect(
      /exit 1/.test(unconfiguredCase),
      'the workflow fails on unconfigured — that is the local-development posture',
    ).toBe(false);
    // An unrecognised verdict must fail loudly rather than pass silently.
    expect(wf.slice(wf.indexOf('*)'))).toMatch(/exit 1/);
  });
});

describe('the pipeline no-op it exists to surface is still real', () => {
  it('the documented silent-local path has not changed shape', () => {
    // If the pipeline stops no-opping on a missing canister id, this whole
    // readiness distinction is obsolete and should be revisited rather than
    // left asserting a condition that can no longer occur (MS-7).
    const src = stripComments(readSource(PIPELINE));
    expect(src).toMatch(/CROSS_CHAIN_SERVICE_CANISTER_ID/);
    expect(src).toMatch(/not configured/);
  });
});
