/**
 * Ratification-act canaries (operator ruling 2026-07-27: *"I'd say both — an
 * operator performs ratification and a receipt of that is generated"*), and the
 * capture-attachment canaries that close "actions are not pulling over".
 *
 * TWO DEFECTS OF THE SAME SHAPE, which is why they share a file: in both cases
 * a complete mechanism existed and the thing that would have USED it did not,
 * so nothing errored and nothing worked.
 *
 *  1. `createGovernanceReceipt` had ZERO call sites — the DVN pipeline could
 *     anchor a constitutional amendment and no code path ever asked it to. MS-7
 *     (an inert mechanism is a defect even though nothing errors).
 *  2. The capture assign route's attach-to-existing branch resolved a reference
 *     and wrote nothing else, so the captured text landed nowhere while every
 *     UI signal said success. Silent loss, which is worse than an error.
 *
 * What is asserted here is the property that makes each fix real rather than
 * cosmetic: the receipt commits to the document's CONTENT, and the attachment
 * actually writes the content into the target object.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const RATIFY_ROUTE = 'app/api/governance/ratify/route.ts';
const ASSIGN_ROUTE = 'app/api/companion/capture/[captureId]/assign/route.ts';
const HELPER = 'services/governance/governanceReceiptHelper.ts';
const PIPELINE = 'services/dvn/activityReceiptDvnPipeline.ts';

describe('ratification is an act, and the act is recorded', () => {
  it('the governance receipt helper finally has a caller', () => {
    // The whole defect in one assertion. If this route is ever deleted without
    // a replacement caller, the helper goes inert again.
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/createGovernanceReceipt\(/);
    // …and the action types it emits must be the anchorable ones, or the act
    // is recorded locally and never reaches the chain.
    const pipeline = stripComments(readSource(PIPELINE));
    for (const action of ['governance_decision_ratified', 'governance_decision_amended']) {
      expect(route, `the route does not emit ${action}`).toContain(action);
      expect(pipeline, `${action} is not DVN-anchorable`).toContain(`'${action}'`);
    }
    // The helper still restricts itself to governance action types.
    expect(stripComments(readSource(HELPER))).toMatch(/GovernanceActionType/);
  });

  it('the receipt commits to the document CONTENT, not just its id', () => {
    // A receipt attesting that "GD-014 was ratified" without attesting to what
    // GD-014 said is a signature on a blank page: the document could change
    // afterwards and the anchor would still verify.
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/createHash\('sha256'\)/);
    expect(route).toMatch(/readFileSync/);

    // MUTATION-DRIVEN CORRECTION (2026-07-27). The three assertions above are
    // necessary and NOT sufficient: replacing the call with a literal
    // (`const doc = { commitment: 'x', bytes: 0 }`) left `commitDocument`
    // defined-but-unused, so every "is the helper present" check still passed
    // while nothing was committed. That is the same inert-canary defect this
    // file exists to catch — found by mutating, not by reading.
    //
    // So: assert the helper is CALLED with the request's own path, that its
    // result is checked, and that the checked value is what reaches the
    // receipt. A definition alone can no longer satisfy this.
    expect(route, 'commitDocument is defined but never called').toMatch(
      /const doc = commitDocument\(documentPath\);/,
    );
    expect(route, 'the commitment result is never checked').toMatch(/if \(!doc\)/);
    // The commitment must reach the receipt, not merely be computed.
    expect(route).toMatch(/sha256:\$\{doc\.commitment/);
    expect(route, 'the receipt does not carry the document commitment').toMatch(
      /affectedAssets: \[[^\]]*sha256:\$\{doc\.commitment\}/,
    );
    // And a document that cannot be read is REFUSED, never anchored blind.
    expect(route).toMatch(/document-not-ratifiable/);
  });

  it('refuses a ratification with no subject document', () => {
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/document-path-required/);
    // Path containment: ratification is an act over constitutional material.
    expect(route).toMatch(/RATIFIABLE_ROOTS/);
    expect(route).toMatch(/normalized\.startsWith\('\.\.'\)/);
  });

  it('is an authority act — admin only, and no ops-token bypass', () => {
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/getActivePersona\(req\)/);
    expect(route).toMatch(/cartridgeFlags\?\.isAdmin/);
    // Unlike the scheduled workspace report, ratification must have a human
    // behind it (Law XI). An ops-token branch here would let a cron ratify.
    expect(
      /ADMIN_OPS_TOKEN/.test(route),
      'the ratification route accepts an ops token — a cron must not be able to ratify',
    ).toBe(false);
  });

  it('reports an unwritten receipt as a failure, not a success', () => {
    // The act happening while the record does not is precisely the gap being
    // closed. Returning ok:true there would recreate it.
    const route = stripComments(readSource(RATIFY_ROUTE));
    expect(route).toMatch(/receipt-not-written/);
    const failureBlock = route.slice(route.indexOf('receipt-not-written') - 200, route.indexOf('receipt-not-written') + 200);
    expect(failureBlock).toMatch(/ok: false/);
  });
});

describe('a capture lands IN the object it is attached to', () => {
  it('the attach-to-existing branch writes the content, in each idiom', () => {
    const route = stripComments(readSource(ASSIGN_ROUTE));
    const attachBlock = route.slice(route.indexOf('if (existingId)'), route.indexOf("} else if (destination === 'intent')"));
    expect(attachBlock.length, 'could not locate the attach branch').toBeGreaterThan(200);

    // Intent → a child IntentQube carrying the captured text.
    expect(attachBlock, 'attaching to an intent creates no child').toMatch(/parentIntentId: existingIntent\.id/);
    expect(attachBlock, 'the child carries no captured content').toMatch(/capture\.contentText/);

    // Venture → a signal-evidence item carrying source AND content.
    expect(attachBlock, 'attaching to a venture writes nothing').toMatch(/updateVentureQube\(/);
    expect(attachBlock).toMatch(/signalType: 'companion-capture'/);
    expect(attachBlock).toMatch(/note: capture\.contentText/);
  });

  it('a failed attachment leaves the capture in the Inbox', () => {
    // Silent loss is the defect. If the write fails the capture must NOT be
    // marked assigned, or the operator loses it with no way to retry.
    const route = stripComments(readSource(ASSIGN_ROUTE));
    const attachBlock = route.slice(route.indexOf('if (existingId)'), route.indexOf("} else if (destination === 'intent')"));
    expect(attachBlock).toMatch(/capture-attach-failed/);
    // The failure must return, not fall through to markCapturedObjectAssigned.
    expect(attachBlock).toMatch(/return NextResponse\.json\(/);
    expect(
      attachBlock.indexOf('capture-attach-failed') < route.indexOf('markCapturedObjectAssigned'),
      'the attach failure path runs after the capture is marked assigned',
    ).toBe(true);
  });

  it('the venture note field exists in BOTH the type and the runtime validator', () => {
    // types/ventureQube.ts's own header: "The runtime Zod validator must stay
    // in lockstep with the shapes here." A field in one and not the other is
    // either a type lie or a validation rejection at write time.
    expect(stripComments(readSource('types/ventureQube.ts'))).toMatch(/note\?: string;/);
    expect(stripComments(readSource('services/iqube/ventureQubeSchema.ts'))).toMatch(
      /note: z\.string\(\)\.max\(\d+\)\.optional\(\)/,
    );
  });

  it('both create-new paths remain reachable from the Inbox', () => {
    // The operator's other half: "to add to new projects or projects perhaps
    // inspired via browsing". Attach must not become the only path.
    const panel = stripComments(readSource('components/companion/CaptureInboxPanel.tsx'));
    expect(panel, 'no new-venture affordance').toMatch(/New Venture/);
    expect(panel, 'no new-intent affordance').toMatch(/newIntent/);
  });
});
