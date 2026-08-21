/**
 * KNYTS Bridge — post-Passport delegate affordance (operator ruling,
 * 2026-08-21).
 *
 * `KnytsBridgePassportRoom`'s Passport-established state gets two peer
 * actions instead of one full-width continuation: "Create a delegate"
 * (confirm-gated entry into the CANONICAL Agent/Participant Passport flow,
 * `PassportBureauApplyTab` with `routeTo="delegate"` — never a KNYTS-specific
 * wizard) and "Tell your own story" (unchanged `selectStage('remix')`).
 *
 * Structural/source-authority canaries — same convention as
 * tests/passport-connection-challenge.test.ts and
 * tests/passport-session-grant-sequential.test.ts. This room has no render
 * harness in this suite (no @testing-library/react usage anywhere in
 * tests/), so behavior is proven from source shape: which handler each
 * button/action actually calls, and in what order.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ROOM = 'components/journey/KnytsBridgePassportRoom.tsx';

/** Brace-balanced extraction, mirroring the convention already established
 *  in tests/passport-signin-otp-type.test.ts and
 *  tests/passport-session-grant-sequential.test.ts. */
function extractBraceBlock(src: string, fromIndex: number): string {
  const braceAt = src.indexOf('{', fromIndex);
  expect(braceAt, `no '{' found from index ${fromIndex}`).toBeGreaterThan(-1);
  let depth = 1;
  for (let i = braceAt + 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(braceAt, i + 1);
    }
  }
  throw new Error(`unbalanced braces from index ${fromIndex}`);
}

describe('KnytsBridgePassportRoom — post-Passport delegate affordance', () => {
  it('1. the Passport-established branch renders both actions', () => {
    const code = stripComments(readSource(ROOM));
    // Locate the "no usable Passport yet" early-return block and take
    // everything AFTER it — that is the established-state branch.
    const claimGateAt = code.indexOf('if (!citizenPassportUsable)');
    expect(claimGateAt, 'expected the claim-gate early return').toBeGreaterThan(-1);
    const claimBlock = extractBraceBlock(code, claimGateAt);
    const established = code.slice(claimGateAt + claimBlock.length);
    expect(established).toContain('Create a delegate');
    expect(established).toContain('Tell your own story');
    // And neither label leaks into the claim-gate (no usable Passport) branch.
    expect(claimBlock).not.toContain('Create a delegate');
    expect(claimBlock).not.toContain('Tell your own story');
  });

  it('2. "Tell your own story" still calls selectStage(\'remix\')', () => {
    const code = stripComments(readSource(ROOM));
    const labelAt = code.indexOf('Tell your own story');
    expect(labelAt, 'expected the "Tell your own story" label').toBeGreaterThan(-1);
    // The button's own onClick is the nearest one before the label in source.
    const onClickAt = code.lastIndexOf('onClick={() => selectStage(', labelAt);
    expect(onClickAt, 'expected an onClick={() => selectStage(...)} immediately before the label').toBeGreaterThan(
      -1,
    );
    expect(labelAt - onClickAt).toBeLessThan(400);
    const call = code.slice(onClickAt, labelAt);
    expect(call).toContain("selectStage('remix')");
  });

  it('3. "Create a delegate" opens the canonical existing Agent/Participant Passport flow, confirm-gated', () => {
    const code = stripComments(readSource(ROOM));
    // Imports the canonical component — never a new KNYTS-specific wizard.
    expect(code).toContain(
      "import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';",
    );
    // The row button only opens the confirm modal — it does NOT set
    // delegateFlowOpen directly.
    const rowButtonAt = code.indexOf('Create a delegate');
    const rowOnClickAt = code.lastIndexOf('onClick={() => setDelegateModalOpen(true)}', rowButtonAt);
    expect(rowOnClickAt, 'the row button must only open the confirm modal').toBeGreaterThan(-1);
    expect(rowButtonAt - rowOnClickAt).toBeLessThan(400);
    // The modal's OWN confirm action is what proceeds to the flow.
    const confirmAt = code.indexOf('onConfirm={() => {');
    expect(confirmAt, 'expected the ConfirmDialog onConfirm handler').toBeGreaterThan(-1);
    const confirmBody = code.slice(confirmAt, code.indexOf('onCancel=', confirmAt));
    expect(confirmBody).toContain('setDelegateFlowOpen(true)');
    // The canonical flow mounts ONLY once delegateFlowOpen is true, routed
    // to the existing agent-delegation entry.
    const flowGateAt = code.indexOf('delegateFlowOpen &&');
    expect(flowGateAt, 'expected a delegateFlowOpen && ( ... ) gate').toBeGreaterThan(-1);
    const flowBlock = code.slice(flowGateAt, code.indexOf('{fullscreenImage &&', flowGateAt));
    expect(flowBlock).toContain('<PassportBureauApplyTab personaId={personaId} routeTo="delegate" />');
  });

  it('4. "Maybe later" dismisses with no journey-state change', () => {
    const code = stripComments(readSource(ROOM));
    const cancelAt = code.indexOf('onCancel={() => setDelegateModalOpen(false)}');
    expect(cancelAt, 'expected onCancel to be exactly setDelegateModalOpen(false)').toBeGreaterThan(-1);
    // "Maybe later" is the cancelText wired to that same onCancel — a single
    // ConfirmDialog element, so proximity to the same JSX tag is sufficient.
    const dialogAt = code.lastIndexOf('<ConfirmDialog', cancelAt);
    expect(dialogAt).toBeGreaterThan(-1);
    const dialogBlock = code.slice(dialogAt, cancelAt + 'onCancel={() => setDelegateModalOpen(false)}'.length + 5);
    expect(dialogBlock).toContain('cancelText="Maybe later"');
    // No stage selection, no delegate-flow mount, and no journey-state
    // refresh anywhere in the cancel handler itself.
    const cancelHandler = 'onCancel={() => setDelegateModalOpen(false)}';
    expect(cancelHandler).not.toContain('selectStage');
    expect(cancelHandler).not.toContain('setDelegateFlowOpen');
    expect(cancelHandler).not.toContain('requestStateRefresh');
  });

  it('5. no duplicate/second delegate flow is introduced', () => {
    const code = stripComments(readSource(ROOM));
    // Exactly two mounts of the canonical component: the existing Citizen
    // path (unchanged) and the new delegate path — never a third, parallel
    // implementation.
    expect((code.match(/<PassportBureauApplyTab/g) ?? []).length).toBe(2);
    expect((code.match(/routeTo="citizen"/g) ?? []).length).toBe(1);
    expect((code.match(/routeTo="delegate"/g) ?? []).length).toBe(1);
    // Only one ConfirmDialog import/usage — the canonical shared primitive,
    // not a hand-rolled modal.
    expect(code).toContain("import { ConfirmDialog } from '@/components/ui/ConfirmDialog';");
    expect((code.match(/<ConfirmDialog/g) ?? []).length).toBe(1);
  });
});
