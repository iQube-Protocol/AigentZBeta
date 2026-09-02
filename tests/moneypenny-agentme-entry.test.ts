/**
 * Agent Me entry point (2026-09-02, second continuation): "Add the
 * MoneyPenny entry through the established specialist/navigation
 * mechanism, preserving the protected Agent Me behavior. Do not repurpose
 * the disposition-recording capsule. Cover the specific historical
 * failure cases and verify the destination and return context."
 *
 * MoneyPenny is ALREADY a registered `SpecialistId`
 * (services/agents/specialistRouter.ts) with a full roster entry
 * (services/orchestration/specialistRecommender.ts) — the "established
 * specialist mechanism." data/codex-configs.ts ALSO already registers a
 * real MoneyPenny mirror tab inside metame-codex
 * (`metame-moneypenny-orchestration`, slug 'moneypenny-orchestration'),
 * explicitly documented there as reusing the SAME MoneyPennyPanelTab
 * component "never a bespoke FS-only card" — the "established navigation
 * mechanism." This pass connects them: SpecialistsLayout's FocusCard gets
 * an "Open MoneyPenny workspace" button, visible only for the moneypenny
 * roster entry, using tryOpenInMountedCartridge — the SAME same-codex
 * tab-switch seam this session's own MoneyPennyAreaNav already uses.
 *
 * CLAUDE.md's "aigentMe Capsule ↔ Layout Contract" documents three real,
 * dated regressions from careless edits to this surface. None of the
 * three apply to this addition, verified directly below:
 *   1. 2026-05-28 Capsule disappearance — ComposerLayout's dismiss paths
 *      called onRequestLayout('stack'), unmounting the engaged Capsule.
 *      This addition never calls onRequestLayout at all.
 *   2. 2026-05-28 Ask Specialists fallback — a chip called
 *      engageCapsule('ask-specialists') but skipped
 *      setActiveLayoutId('specialists'). This addition is INSIDE the
 *      already-engaged 'specialists' Capsule/layout; it never calls
 *      engageCapsule or setActiveLayoutId at all — the Capsule stays
 *      exactly as engaged as it was before the button exists.
 *   3. 2026-05-28 Move-forward + Venture legacy NBA cards — dedicated
 *      layouts reverted to NextBestActionCard queued={true} without
 *      Pill-lifecycle props. Not applicable: this addition adds no NBE/
 *      Pill rendering of any kind.
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

describe('MoneyPenny is already the established specialist — verified, not invented', () => {
  it('moneypenny is a registered SpecialistId', () => {
    const src = stripComments(readSource('services/agents/specialistRouter.ts'));
    const unionBlock = src.match(/export type SpecialistId =([\s\S]*?);/)?.[1] ?? '';
    expect(unionBlock).toMatch(/'moneypenny'/);
  });

  it('moneypenny has a full roster entry (label, description, always-available)', () => {
    const src = stripComments(readSource('services/orchestration/specialistRecommender.ts'));
    expect(src).toMatch(/moneypenny: 'MoneyPenny',/);
    expect(src).toMatch(/moneypenny: 'Q¢ economics, micro-transactions, payment ops',/);
    expect(src).toMatch(/moneypenny: null,/); // no activation gate — always-available
  });

  it('the real metame-codex mirror tab is already registered, reusing MoneyPennyPanelTab — not a bespoke card', () => {
    const src = stripComments(readSource('data/codex-configs.ts'));
    expect(src).toMatch(/id: 'metame-moneypenny-orchestration',/);
    expect(src).toMatch(/slug: 'moneypenny-orchestration',/);
    expect(src).toMatch(/config: \{ component: 'MoneyPennyPanelTab', props: \{ panel: 'service-orchestration' \} \},/);
  });
});

describe('SpecialistsLayout — Open MoneyPenny workspace button, added this pass', () => {
  const src = stripComments(readSource('components/metame/welcome/layouts/SpecialistsLayout.tsx'));

  it('renders only for the moneypenny roster entry, and only when not gated', () => {
    expect(src).toMatch(/entry\.id === "moneypenny" && availability\.status !== "needs-activation"/);
  });

  it('navigates via tryOpenInMountedCartridge to the REAL registered destination — metame-codex / moneypenny-orchestration', () => {
    expect(src).toMatch(/const METAME_CODEX_ID = "metame-codex";/);
    expect(src).toMatch(/const MONEYPENNY_ORCHESTRATION_TAB_SLUG = "moneypenny-orchestration";/);
    expect(src).toMatch(/tryOpenInMountedCartridge\(\{ cartridgeId: METAME_CODEX_ID, tab: MONEYPENNY_ORCHESTRATION_TAB_SLUG \}\)/);
  });

  it('imports tryOpenInMountedCartridge from the canonical registry — the same seam MoneyPennyAreaNav already uses, no parallel navigation system', () => {
    expect(src).toMatch(/import \{ tryOpenInMountedCartridge \} from "@\/services\/cartridge\/CartridgePresenceRegistry"/);
  });
});

describe('Historical failure case 1 (Capsule disappearance) does not apply — no onRequestLayout call anywhere near the new code', () => {
  it('openMoneyPennyFromAgentMe and its call site never reference onRequestLayout', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/SpecialistsLayout.tsx'));
    const fnBody = src.match(/function openMoneyPennyFromAgentMe\(\): void \{([\s\S]*?)\}/)?.[1] ?? '';
    expect(fnBody).not.toMatch(/onRequestLayout/);
    // The button's onClick handler is the function reference itself —
    // confirm it is not wrapped in anything that also fires onRequestLayout.
    expect(src).toMatch(/onClick=\{openMoneyPennyFromAgentMe\}/);
  });
});

describe('Historical failure case 2 (Ask Specialists fallback) does not apply — no engageCapsule/setActiveLayoutId call anywhere near the new code', () => {
  it('openMoneyPennyFromAgentMe never calls engageCapsule or setActiveLayoutId — the Capsule stays exactly as engaged as before', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/SpecialistsLayout.tsx'));
    const fnBody = src.match(/function openMoneyPennyFromAgentMe\(\): void \{([\s\S]*?)\}/)?.[1] ?? '';
    expect(fnBody).not.toMatch(/engageCapsule/);
    expect(fnBody).not.toMatch(/setActiveLayoutId/);
  });

  it('SpecialistsLayout.tsx as a whole gained no new engageCapsule/setActiveLayoutId call sites this pass (only the new function + button + import were added)', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/SpecialistsLayout.tsx'));
    expect(src).not.toMatch(/engageCapsule/);
    expect(src).not.toMatch(/setActiveLayoutId/);
  });
});

describe('Historical failure case 3 (legacy NBA queued cards) does not apply — no NBE/Pill rendering introduced', () => {
  it('the new code renders a plain button, not NextBestActionCard or ExpandedNBEPill', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/SpecialistsLayout.tsx'));
    const buttonBlock = src.match(/\{entry\.id === "moneypenny" && availability\.status !== "needs-activation" && \(([\s\S]*?)\)\}/)?.[1] ?? '';
    expect(buttonBlock).not.toMatch(/NextBestActionCard/);
    expect(buttonBlock).not.toMatch(/ExpandedNBEPill/);
    expect(buttonBlock).toMatch(/<button/);
  });
});

describe('Return context — verified against the real registered destinations, not fabricated', () => {
  const workspaceSrc = stripComments(readSource('app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx'));

  it('the aigentMe tab slug the return path targets matches its REAL registered slug in data/codex-configs.ts', () => {
    const configSrc = stripComments(readSource('data/codex-configs.ts'));
    expect(configSrc).toMatch(/id: 'aigent-me-welcome',[\s\S]{0,80}slug: 'aigent-me',/);
    expect(workspaceSrc).toMatch(/const AIGENTME_TAB_SLUG = 'aigent-me';/);
  });

  it('detects the mirror context via getCartridge(metame-codex) — reads real registry state, never assumes context', () => {
    expect(workspaceSrc).toMatch(/import \{ tryOpenInMountedCartridge, getCartridge \} from '@\/services\/cartridge\/CartridgePresenceRegistry'/);
    expect(workspaceSrc).toMatch(/getCartridge\(METAME_CODEX_ID\) !== null/);
  });

  it('the mirror-context return path takes priority over the generic ?from=/browser-history fallback', () => {
    const handlerBody = workspaceSrc.match(/const navigateBack = useCallback\(\(\) => \{([\s\S]*?)\}, \[fromSlug, fromTab, personaId\]\);/)?.[1] ?? '';
    const mirrorIdx = handlerBody.indexOf('getCartridge(METAME_CODEX_ID) !== null');
    const fromIdx = handlerBody.indexOf('if (fromSlug)');
    expect(mirrorIdx).toBeGreaterThan(-1);
    expect(fromIdx).toBeGreaterThan(mirrorIdx);
  });

  it('the return call targets the exact same codex+tab pair the destination call used — a real round trip, not a guessed one', () => {
    expect(workspaceSrc).toMatch(/tryOpenInMountedCartridge\(\{ cartridgeId: METAME_CODEX_ID, tab: AIGENTME_TAB_SLUG \}\)/);
  });

  it('the back-link label is honest about the mirror context ("Back to aigentMe"), not a generic fallback label', () => {
    expect(workspaceSrc).toMatch(/isMetameMirrorContext \? 'Back to aigentMe' : fromSlug \? `Back to \$\{fromSlug\}` : 'Back'/);
  });
});

describe('MoneyPennyFocusLayout.tsx (the disposition-recording capsule) is untouched — never repurposed for this navigation', () => {
  it('gained no buildCodexUrl/tryOpenInMountedCartridge/openMoneyPennyFromAgentMe reference', () => {
    const src = stripComments(readSource('components/metame/welcome/layouts/MoneyPennyFocusLayout.tsx'));
    expect(src).not.toMatch(/buildCodexUrl/);
    expect(src).not.toMatch(/tryOpenInMountedCartridge/);
    expect(src).not.toMatch(/openMoneyPennyFromAgentMe/);
  });
});
