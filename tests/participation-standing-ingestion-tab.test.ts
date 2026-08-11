/**
 * ParticipationStandingTab — Ingestion Factory pairing canary (2026-08-01,
 * corrected same day per operator feedback).
 *
 * NOT a 4-way split (Standing/Reach/Receipts/Ingestion). The Ingestion
 * Factory renders full width and untouched — exactly as it appears
 * elsewhere in the iQube Registry — with Standing as ONE additional tab
 * beside it, reusing the SAME IngestionFactoryPanel component
 * IQubeRegistryIntakeTab already mounts (composition, not a fork —
 * inv.engineering.036/037). Source-scan style, matching this repo's
 * existing canary convention — no React rendering harness.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('ParticipationStandingTab — Ingestion Factory beside a single Standing tab, not a 4-way split', () => {
  const source = read('app/triad/components/codex/tabs/ParticipationStandingTab.tsx');

  it('imports the canonical IngestionFactoryPanel — never a duplicate implementation', () => {
    expect(source).toContain("import { IngestionFactoryPanel } from '@/components/registry/IngestionFactoryPanel';");
  });

  it('declares exactly 2 views: registry and standing — never a split of Standing into Standing/Reach/Receipts tabs', () => {
    expect(source).toMatch(/type StandingView = 'registry' \| 'standing';/);
    expect(source).not.toMatch(/'reach'\s*\|\s*'receipts'/);
  });

  it('defaults an UNPINNED mount to registry, and lets a PINNED mount override on every render', () => {
    /*
     * This canary previously asserted `useState<StandingView>(only ?? 'registry')`
     * — and in doing so locked in the defect it was meant to prevent.
     *
     * Seeding state from `only` binds the view to the FIRST mount. React
     * reuses a component that keeps its type and position, so the Journey's
     * Deploy and Standing stages — which mount this same component pinned to
     * different views — shared one instance: whichever the operator opened
     * first won, and the other stage rendered its content (operator report,
     * twice: 2026-08-02).
     *
     * The correct property is that `only`, when set, is authoritative on
     * EVERY render. An unpinned mount still defaults to the Ingestion Factory
     * and still owns its own choice.
     */
    const seeded = source.match(/useState<StandingView>\(([^)]*)\)/);
    expect(seeded).not.toBeNull();
    expect(
      seeded![1],
      'seeding the view from `only` binds it to the first mount — the exact Deploy/Standing coupling defect',
    ).not.toContain('only');
    expect(seeded![1]).toBe("'registry'");

    // …and `only` overrides the remembered choice on every render.
    expect(source).toMatch(/const view: StandingView = only \?\? \w+/);
  });

  it('renders IngestionFactoryPanel full width with no wrapping title/description chrome pushed above it', () => {
    const match = source.match(/if \(view === 'registry'\) \{([\s\S]*?)\n {2}\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/<IngestionFactoryPanel[^>]*\/>/);
    // No h2/title text competing with the panel's own header when this view is active.
    expect(match![1]).not.toMatch(/<h2/);
  });

  /*
   * RE-POINTED 2026-08-03. This asserted `<IngestionFactoryPanel />` with NO
   * props, standing for a real requirement: the panel is self-contained and
   * reads its own canonical APIs — nobody hands it data.
   *
   * The Deploy stage now passes `initialSection` so the journey lands on
   * INGESTED ASSETS rather than the ingest form (operator, 2026-08-03). That is
   * a PRESENTATION pin — which of the panel's own sections opens first — not
   * data, and the requirement is untouched.
   *
   * So the assertion moves from "no props" to the thing that actually mattered:
   * nothing is passed that the panel would otherwise fetch for itself.
   */
  it('passes IngestionFactoryPanel no DATA — it still reads its own canonical APIs', () => {
    const mount = source.match(/<IngestionFactoryPanel([^>]*)\/>/)?.[1] ?? '';
    const propNames = Array.from(mount.matchAll(/(\w+)=/g)).map((m) => m[1]);
    expect(propNames.every((p) => p === 'initialSection'), `unexpected props: ${propNames}`).toBe(true);
    for (const dataProp of ['assets', 'intakes', 'records', 'data', 'items']) {
      expect(propNames).not.toContain(dataProp);
    }
  });

  it('the Standing view keeps its original combined lanes+reach+receipts content in one tab, not three', () => {
    const match = source.match(/if \(view === 'registry'\)[\s\S]*?return \(\s*<div className="w-full">\s*\{tabStrip\}\s*<div className="mx-auto max-w-3xl([\s\S]*)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Standing lanes');
    expect(match![1]).toContain('<h3 className="mb-2 text-sm font-semibold text-slate-200">Reach</h3>');
    expect(match![1]).toContain('Contribution history');
  });

  it('the tab strip offers exactly Ingestion Factory and Standing, both togglable from one row', () => {
    // `const tabStrip = only ? null : (...)` — pinned mounts render no strip
    // at all (a control with one reachable destination cannot act, MS-9).
    expect(source).toContain('const tabStrip = only ? null : (');
    const match = source.match(/const tabStrip = only \? null : \(([\s\S]*?)\n {2}\);/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("setView('registry')");
    expect(match![1]).toContain("setView('standing')");
    expect(match![1]).toContain('Ingestion Factory');
    expect(match![1]).toMatch(/<Award className="h-3\.5 w-3\.5" \/>\s*Standing/);
  });
});

describe('Journey wiring — Deploy and Standing are separate stages, not a paired tab strip', () => {
  it('journeySurfaceRegistry notes the pairing without claiming a 4-tab split', () => {
    const source = read('services/journey/journeySurfaceRegistry.ts');
    const match = source.match(/'venture-participate-standing':\s*\{([\s\S]*?)\n {2}\},/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Ingestion Factory');
  });

  it("the Ingestion Factory now renders under Activate, not the legacy Deploy stage", () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const deploy = source.match(/id: 'deploy',[\s\S]*?nextStageId: 'standing',/);
    expect(deploy, "the renamed Deploy stage must exist").not.toBeNull();
    // Re-homed (Activate Consolidation, 2026-08-11) — Deploy itself no
    // longer mentions the Ingestion Factory; its own surfaces array is empty.
    expect(deploy![0]).not.toContain('Ingestion Factory');
    expect(deploy![0]).toMatch(/surfaces: \[\]/);
    // The Deploy stage's OWN id must be 'deploy', never a leftover 'activate'
    // from before the 2026-08-02 Deploy/Standing split.
    expect(deploy![0]).not.toContain("id: 'activate',");
    /*
     * A GENUINELY NEW, UNRELATED stage now legitimately owns the id
     * 'activate' (Constitutional State Model Correction, 2026-08-11) — the
     * derived registry-activation transition between Passport and Delegate,
     * a completely different constitutional fact from Deploy/Factory
     * ingestion. This is not the 2026-08-02 leftover-stage defect
     * recurring: that stage read `factoryIngested`/wrote
     * `capability_registered`; this one reads `registryActivated`/writes
     * `agent_registry_activated`, and sits nowhere near Deploy in the
     * journey graph.
     */
    const activate = source.match(/id: 'activate',[\s\S]*?nextStageId: 'delegate',/);
    expect(activate, 'the new Activate stage must exist').not.toBeNull();
    // Structural fields only — the stage's own explanatory prose legitimately
    // NAMES capability_registered/factoryIngested in a negation ("NO
    // involvement of...") to state what Activate deliberately excludes.
    expect(activate![0]).toMatch(/completionEvidence: \['registryActivated'\]/);
    expect(activate![0]).toMatch(/receiptTypes: \['agent_registry_activated'\]/);
  });

  it('Standing is its own eighth stage, standalone after Deploy', () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const standing = source.match(/id: 'standing',[\s\S]*?receiptTypes: \['standing_accrued'\],/);
    expect(standing).not.toBeNull();
    expect(standing![0]).toContain("prerequisites: ['deploy']");
    expect(standing![0]).toContain('venture-participate-standing-only');
  });

  it('BOTH stages pin the view in their OWN surface props, so the tab strip cannot render', () => {
    // REGRESSION GUARD (operator report, 2026-08-02): `only` was first wired
    // through PilotJourneyTab's resolveSurfaceProps and silently never
    // applied — both stages kept showing the two-tab strip. Surface props
    // declared on the stage are applied LAST in JourneyRunSurface's merge, so
    // asserting them here pins the thing that actually reaches the component.
    const source = read('services/journey/horizenMoneyPennyJourney.ts');

    // Re-homed onto `activate` (Activate Consolidation, 2026-08-11) — the
    // registry-pin surface no longer lives on the legacy `deploy` stage.
    const activate = source.match(/id: 'activate',[\s\S]*?nextStageId: 'delegate',/);
    expect(activate).not.toBeNull();
    /*
     * Matched on the PIN, not on the whole props literal. Activate now also
     * carries `registrySection: 'assets'` (the Ingested-Assets deep link,
     * operator 2026-08-03); an exact-literal match would have failed on an
     * addition that leaves this requirement — the view is pinned, so the tab
     * strip cannot render — completely intact.
     */
    expect(activate![0]).toMatch(/props: \{[^}]*only: 'registry'/);

    const standing = source.match(/id: 'standing',[\s\S]*?receiptTypes: \['standing_accrued'\],/);
    expect(standing).not.toBeNull();
    expect(standing![0]).toMatch(/props: \{[^}]*only: 'standing'/);
  });

  it('a pinned mount renders no tab strip at all — every view branch uses the same nulled strip', () => {
    const source = read('app/triad/components/codex/tabs/ParticipationStandingTab.tsx');
    expect(source).toContain('const tabStrip = only ? null : (');
    // Every render branch must go through `tabStrip`; a hand-inlined strip in
    // one branch would survive the pin.
    const inlineStrips = source.match(/Ingestion Factory\s*<\/button>/g) ?? [];
    expect(inlineStrips.length, 'exactly one place builds the strip').toBeLessThanOrEqual(1);
  });

  it('aigentMe now precedes Deploy — the two were swapped', () => {
    const source = read('services/journey/horizenMoneyPennyJourney.ts');
    const aigentmeAt = source.indexOf("id: 'aigentme',");
    const deployAt = source.indexOf("id: 'deploy',");
    expect(aigentmeAt).toBeGreaterThan(-1);
    expect(deployAt).toBeGreaterThan(-1);
    expect(aigentmeAt).toBeLessThan(deployAt);
    expect(source).toContain("prerequisites: ['aigentme']");
  });
});
