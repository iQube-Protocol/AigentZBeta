/**
 * "Freeze Crystal vP2 for internal EXP-P1 run" MUST NOT depend on Track 2
 * choosing Freeze as `currentStage`, and MUST NOT require
 * `loadTrack2ProgrammeState()` to complete successfully before deciding
 * whether the governed act exists (operator ruling, 2026-09-07: "Track 2 is
 * allowed to say science still has limitations. It is not allowed to hide a
 * separately authorized lifecycle act.").
 *
 * Source-text canaries (this repo's convention for these exact files — see
 * tests/track2-copilot-deep-link.test.ts) proving the WIRING: both host
 * surfaces mount `FreezeVP2InternalPilotAction` OUTSIDE their own
 * `{programme && (...)}` gate, and pass it nothing derived from that slow
 * composition (no `readiness`/`programme` prop). The component's OWN
 * behavior — deriving eligibility and failing checks from the fast,
 * independent freeze/freeze-preview routes — is proven behaviorally in
 * tests/freeze-vp2-internal-pilot-action.test.tsx.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const PANEL = 'components/research/Track2ProgrammePanel.tsx';
const COPILOT = 'components/composer/IRLResearchCopilotTab.tsx';

describe('Track2ProgrammePanel — the freeze action renders unconditionally, never gated on `programme`', () => {
  it('the <FreezeVP2InternalPilotAction> render call sits BEFORE the `{programme && (` gate, never inside it', () => {
    const src = stripComments(readSource(PANEL));
    const freezeCallIdx = src.indexOf('<FreezeVP2InternalPilotAction experimentId={experimentId} onFrozen=');
    const gateIdx = src.indexOf('{programme && (');
    expect(freezeCallIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(freezeCallIdx).toBeLessThan(gateIdx);
  });

  it('passes only experimentId + onFrozen — never a readiness or programme prop that would reintroduce the dependency', () => {
    const src = stripComments(readSource(PANEL));
    const callStart = src.indexOf('<FreezeVP2InternalPilotAction experimentId={experimentId} onFrozen=');
    const callEnd = src.indexOf('/>', callStart);
    const call = src.slice(callStart, callEnd);
    expect(call).not.toMatch(/readiness=/);
    expect(call).not.toMatch(/\bprogramme=/);
  });

  it('the OLD FrozenSummary next-act text is suppressed for EXP-P1 — never contradicts the new component\'s own next-governed-action text', () => {
    const src = stripComments(readSource(PANEL));
    const completeBranch = src.indexOf('if (s.status === "complete") {');
    expect(completeBranch).toBeGreaterThan(-1);
    const branchEnd = src.indexOf('const readinessStage', completeBranch);
    const branch = src.slice(completeBranch, branchEnd);
    expect(branch).toMatch(/if \(experimentId === "EXP-P1"\) return null;/);
  });

  it('imports FreezeVP2InternalPilotAction from its own standalone file — never re-implemented inline (inv.engineering.036/037)', () => {
    const src = stripComments(readSource(PANEL));
    expect(src).toMatch(/import \{ FreezeVP2InternalPilotAction \} from "@\/components\/research\/FreezeVP2InternalPilotAction";/);
    // The old inline definition is gone.
    expect(src).not.toMatch(/^function FreezeVP2InternalPilotAction\(/m);
  });
});

describe('IRLResearchCopilotTab (Research Copilot) — the freeze action renders unconditionally, never gated on `programme`', () => {
  it('the <FreezeVP2InternalPilotAction> render call sits BEFORE the `{programme && (` gate, never inside it', () => {
    const src = stripComments(readSource(COPILOT));
    const freezeCallIdx = src.indexOf('<FreezeVP2InternalPilotAction experimentId={objective.experimentId} />');
    const gateIdx = src.indexOf('{programme && (');
    expect(freezeCallIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(freezeCallIdx).toBeLessThan(gateIdx);
  });

  it('is gated only on objective.experimentId — never on `programme`, `run`, or `pendingDecisionPreview`', () => {
    const src = stripComments(readSource(COPILOT));
    const idx = src.indexOf('objective.experimentId === "EXP-P1" && <FreezeVP2InternalPilotAction');
    expect(idx).toBeGreaterThan(-1);
  });

  it('imports FreezeVP2InternalPilotAction from the SAME standalone file Track2ProgrammePanel uses — one implementation, never a second', () => {
    const src = stripComments(readSource(COPILOT));
    expect(src).toMatch(/import \{ FreezeVP2InternalPilotAction \} from "@\/components\/research\/FreezeVP2InternalPilotAction";/);
  });
});
