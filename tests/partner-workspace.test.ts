/**
 * Partner Workspace canaries — the Venture Lab Partner Workspace pattern
 * (Horizen Pilot Series 001; operator + Aletheon, 2026-07-26).
 *
 * What these guard:
 *  1. `services/venture/partnerWorkspace.ts` is the SINGLE authoritative
 *     partner list (inv.engineering.036) — the tab derives from it and holds
 *     no hand-copied partner data (inv.engineering.037).
 *  2. Layer owners use only REAL agent ids from the codebase's canonical
 *     vocabulary (RUNTIME_AGENT_IDS + the AgentRoleId orchestration roles) —
 *     never an invented id.
 *  3. Canonical spellings (platform ontology): the non-canonical variants of
 *     Marketa / QubeTalk never appear in the new surfaces.
 *  4. The Partner group's TIER SPLIT holds (audit §B.3): Tier 2 views are
 *     participation-gated, Tier 0 views stay adminOnly.
 *  5. Command Center honesty: unwireable metrics render the explicit
 *     "Not yet wired" state — no fabricated health glyphs or counts.
 *  6. Transport + navigation discipline: personaFetch only (spine endpoint),
 *     buildCodexUrl only (no bespoke embed URLs), and every registry deep
 *     link targets a REAL enabled codex/tab (the companion-observer
 *     CAPABILITY_ROUTES parity idiom).
 *
 * Source-level assertions use tests/_lib/sourceAuthority helpers per that
 * module's ranking (behavioural first, importAuthority second, stripComments
 * third).
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority, forbiddenImportFindings } from './_lib/sourceAuthority';
import {
  PARTNER_WORKSPACES,
  PARTNER_WORKSPACE_LAYERS,
  listPartnerWorkspaces,
  getPartnerWorkspace,
  layerOwnerDisplayName,
} from '../services/venture/partnerWorkspace';
import { RUNTIME_AGENT_IDS } from '../services/metame/agentLlmOrchestra';
import { ACCESS_DOMAINS, DOMAIN_ROLES } from '../services/passport/participationAccess';

const REGISTRY_PATH = 'services/venture/partnerWorkspace.ts';
const TAB_PATH = 'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx';
const DOC_PATH = 'codexes/packs/agentiq/updates/2026-07-26_partner-workspace-horizen-pilot.md';

// The two orchestration/constitutional role ids that are legitimate layer
// owners despite having no RUNTIME_AGENT_IDS (LLM) binding. Their existence
// in the real AgentRoleId union is asserted below — never taken on faith.
const ROLE_ONLY_OWNER_IDS = ['aigent-c', 'metame-guardian'] as const;

describe('partner workspace registry — single source, Horizen seed', () => {
  it('seeds exactly one workspace: Horizen Pilot Series 001, phase integration, AgentiQ/metaMe partnership', () => {
    expect(PARTNER_WORKSPACES).toHaveLength(1);
    const [ws] = PARTNER_WORKSPACES;
    expect(ws.id).toBe('horizen-pilot-series-001');
    expect(ws.partnerName).toBe('Horizen');
    expect(ws.series).toBe('001');
    expect(ws.phase).toBe('integration');
    // Operator ruling 2026-07-26: the partnership is AgentiQ/metaMe.
    expect(ws.partnershipContext).toBe('agentiq-metame');
    expect(ws.objectives.length).toBeGreaterThan(0);
  });

  it('list/get derive from the one list', () => {
    expect(listPartnerWorkspaces()).toBe(PARTNER_WORKSPACES);
    expect(getPartnerWorkspace('horizen-pilot-series-001')).toBe(PARTNER_WORKSPACES[0]);
    expect(getPartnerWorkspace('nope')).toBeNull();
  });

  it('every workspace covers all six layers — no more, no fewer', () => {
    for (const ws of PARTNER_WORKSPACES) {
      expect(Object.keys(ws.layerOwners).sort()).toEqual([...PARTNER_WORKSPACE_LAYERS].sort());
    }
  });

  it('the tab holds no hand-copied partner data — partner facts come only from the registry', () => {
    const src = stripComments(readSource(TAB_PATH));
    expect(src).not.toContain('Horizen');
    const auth = importAuthority(readSource(TAB_PATH));
    expect(auth.boundNames.has('listPartnerWorkspaces')).toBe(true);
    expect(auth.boundNames.has('layerOwnerDisplayName')).toBe(true);
    expect(auth.records.some((r) => r.specifier.includes('services/venture/partnerWorkspace'))).toBe(true);
  });
});

describe('layer owners — canonical agent vocabulary only', () => {
  it('the role-only owner ids really exist in the AgentRoleId union (types/orchestration.ts)', () => {
    const src = stripComments(readSource('types/orchestration.ts'));
    for (const id of ROLE_ONLY_OWNER_IDS) {
      expect(src).toContain(`'${id}'`);
    }
  });

  it('every layer owner is a runtime aigent id or a verified orchestration role id', () => {
    const allowed = new Set<string>([...RUNTIME_AGENT_IDS, ...ROLE_ONLY_OWNER_IDS]);
    for (const ws of PARTNER_WORKSPACES) {
      for (const layer of PARTNER_WORKSPACE_LAYERS) {
        const owner = ws.layerOwners[layer];
        if (owner !== null) {
          expect(allowed.has(owner), `layer '${layer}' owner '${owner}' is not in the canonical agent vocabulary`).toBe(true);
        }
      }
    }
  });

  it('the workspace owner (Chief of Staff) is a RUNTIME agent — it must be executable', () => {
    for (const ws of PARTNER_WORKSPACES) {
      expect((RUNTIME_AGENT_IDS as readonly string[]).includes(ws.ownerAgentId)).toBe(true);
    }
  });

  it('display names resolve via the canonical profiles (Marketa spells canonically) and never invent', () => {
    expect(layerOwnerDisplayName('aigent-marketa')).toBe('Marketa');
    expect(layerOwnerDisplayName(null)).toBeNull();
    for (const ws of PARTNER_WORKSPACES) {
      for (const layer of PARTNER_WORKSPACE_LAYERS) {
        const owner = ws.layerOwners[layer];
        if (owner !== null) {
          const name = layerOwnerDisplayName(owner);
          expect(typeof name).toBe('string');
          expect((name as string).length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('canonical spellings (platform ontology)', () => {
  it('metaProof is spelled canonically wherever it is used as prose', () => {
    // Operator ruling 2026-07-27: metaProof is the ORGANISATION — lowercase m,
    // capital P, exactly like metaMe — and its products carry its name
    // (metaProof Commons / metaCommons, metaProof Agent Harness), staffed by
    // metaProof Operators. "MetaProof" is a non-canonical variant.
    //
    // Scoped to the docs and services this workstream owns. The two known
    // remaining occurrences quote an operator-supplied PRD's own title
    // ("PRD v1.0 (MetaProof Internal)") and are PROVENANCE — correcting a source
    // document's self-identification would falsify the record, the same
    // discipline applied to EXP-P1's countersigned §14.
    const banned = new RegExp('Meta' + 'Proof');
    for (const path of [
      'docs/platform-ontology.md',
      'services/venture/partnerWorkspace.ts',
      'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx',
    ]) {
      // RAW — spelling matters in comments too. But a canon document has to
      // NAME the variant it forbids, so its "Never …" declaration lines are
      // dropped before scanning: quoting a bug to outlaw it is not committing it.
      const raw = readSource(path)
        .split('\n')
        .filter((line) => !/\bnever\b/i.test(line))
        .join('\n');
      expect(banned.test(raw), `${path} uses the non-canonical MetaProof spelling`).toBe(false);
    }
    // …and the ontology must actually declare the variant forbidden, or the
    // filter above would be hiding a gap rather than exempting a declaration.
    expect(readSource('docs/platform-ontology.md')).toMatch(
      new RegExp('Never "' + 'Meta' + 'Proof"'),
    );
  });

  it('the ontology declares metaProof and the metaProof Commons as canonical terms', () => {
    // The pairing must live in the ontology, not only in a workstream doc —
    // every agent reads the ontology, and the canon parser harvests its
    // `## Term` sections.
    const ontology = readSource('docs/platform-ontology.md');
    expect(ontology).toMatch(/^## metaProof$/m);
    expect(ontology).toMatch(/^## metaProof Commons$/m);
    // Concept vs product name — the distinction the ruling turns on.
    expect(ontology).toMatch(/Canonical concept:\*\* \*\*metaProof Commons/);
    expect(ontology).toMatch(/Canonical product \/ UI name:\*\* \*\*metaCommons/);
  });

  it('the new surfaces never use the non-canonical Marketa/QubeTalk variants', () => {
    // Built by concatenation so this test file does not trip its own canary.
    const banned = [new RegExp('Marq' + 'ueta', 'i'), new RegExp('Cube' + 'Talk')];
    for (const path of [REGISTRY_PATH, TAB_PATH, DOC_PATH]) {
      const raw = readSource(path); // RAW source — spelling matters in comments too
      for (const re of banned) {
        expect(re.test(raw), `${path} contains a non-canonical spelling (${re})`).toBe(false);
      }
    }
  });
});

describe('tab registration — the Partner tier split on the hand-curated Venture Lab cartridge', () => {
  it('partner-programmes is the enabled Tier 2 Overview tab mounting PartnerProgrammesTab', async () => {
    // Retained id/slug: it is the Partner group's OVERVIEW tab since 2026-07-27,
    // kept under this id so links issued before the regroup still resolve.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-programmes');
    expect(tab).toBeTruthy();
    // LABEL RELABELLED 2026-07-28 (operator ruling on the Amendment G
    // representation gap): "Workspace" must have a real UI referent — the group
    // label 'Partner' may not substitute for the workspace surface itself. The
    // id and slug below are deliberately UNCHANGED: relabelling closes the
    // representation gap "without changing the underlying access model", and a
    // slug change would break every `?tab=` deep link already issued.
    expect(tab!.label).toBe('Partner Workspace');
    // TIER 2 since the split (audit §B.3; operator "Partner gate = split
    // agreed", 2026-07-27): a partner operator must be able to see the shared
    // record WITHOUT becoming a platform admin. adminOnly here would restore
    // the hard blocker the split resolved.
    expect(tab!.adminOnly).toBeUndefined();
    expect(tab!.participationDomain).toBe('venture-lab');
    expect(tab!.enabled).toBe(true);
    expect(tab!.config.component).toBe('PartnerProgrammesTab');
  });

  it('TabRenderer registers the component', () => {
    const src = stripComments(readSource('app/triad/components/codex/TabRenderer.tsx'));
    expect(src).toContain('PartnerProgrammesTab');
  });

  it('Partner is a first-class group between Grow and Administer, driving the content itself', async () => {
    // Operator, 2026-07-27, seeing it in situ: "Partner should be a first class
    // menu item between grow and administer and that sub menu should then drive
    // the content that is across the sub sections … we don't need the duplicate
    // sub menus." The first cut put the five areas in a tier-3 row while the
    // component ALSO drew its own row — two menus for one concept. They are now
    // the standard cartridge tabs of a Partner group.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const groups = VENTURE_LAB_CODEX.tabGroups ?? [];
    const partner = groups.find((g: { id: string }) => g.id === 'partner');
    const grow = groups.find((g: { id: string }) => g.id === 'grow');
    const administer = groups.find((g: { id: string }) => g.id === 'administer');
    expect(partner, 'no Partner group').toBeTruthy();
    expect(partner!.label).toBe('Partner');
    // Position is the operator's instruction, not decoration.
    expect(partner!.order).toBeGreaterThan(grow!.order);
    expect(partner!.order).toBeLessThan(administer!.order);
    // NO group-level gate since the tier split — the group now carries both
    // tiers, so membership decides per tab. The "pill that filters to nothing"
    // concern it used to serve is handled structurally instead: a group with
    // no visible tabs does not render (MS-9), asserted below.
    expect(partner!.adminOnly).toBeUndefined();

    const tabs = VENTURE_LAB_CODEX.tabs
      .filter((t: { group?: string }) => t.group === 'partner')
      .sort((a: { order: number }, b: { order: number }) => a.order - b.order);
    expect(tabs.map((t: { label: string }) => t.label)).toEqual([
      'Partner Workspace',
      'Collaborate',
      'Operate',
      'Evidence',
      'Communicate',
      'Administration',
    ]);
    // The ratified split: four Tier 2 views, two Tier 0 views.
    const TIER2 = new Set(['partner-programmes', 'partner-collaborate', 'partner-operate', 'partner-evidence']);
    const TIER0 = new Set(['partner-communicate', 'partner-administration']);
    for (const t of tabs) {
      if (TIER2.has(t.id)) {
        expect(t.adminOnly, `${t.id} is Tier 2 but adminOnly`).toBeUndefined();
        expect(t.participationDomain, `${t.id} is Tier 2 but ungated`).toBe('venture-lab');
      } else {
        expect(TIER0.has(t.id), `${t.id} is in neither tier`).toBe(true);
        expect(t.adminOnly, `${t.id} is Tier 0 but not adminOnly`).toBe(true);
      }
      expect(t.enabled).toBe(true);
      // ONE component, six entrances.
      expect(t.config.component).toBe('PartnerProgrammesTab');
      expect(typeof t.config.props?.initialSurface).toBe('string');
      // No second menu: the area tabs must not carry their own subTabs.
      expect(t.subTabs, `${t.id} reintroduces a nested menu`).toBeUndefined();
    }
    // The pre-regroup deep-link target still resolves.
    expect(tabs[0].slug).toBe('partner-programmes');
    // Slugs unique across the cartridge.
    const slugs = VENTURE_LAB_CODEX.tabs.map((t: { slug: string }) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('the component never draws a second surface menu when the cartridge menu drives it', () => {
    // Two navigations for one concept is what the operator saw in situ: with
    // `initialSurface` supplied — which every Partner tab now supplies — the
    // in-component row must not render at all.
    const src = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(src).toMatch(/initialSurface/);
    expect(src, 'the in-component surface row is not gated on the menu').toMatch(
      /menuSurface === null &&/,
    );
    // …and the prop must drive state on change, or the surface sticks on
    // whichever sub-tab was opened first (the component stays mounted).
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(menuSurface\) setSurface\(menuSurface\);/);
  });
});

describe('command center honesty', () => {
  it('renders the explicit "Not yet wired" state for underived metrics', () => {
    const src = stripComments(readSource(TAB_PATH));
    expect(src).toContain('Not yet wired');
    expect(src).toContain('NotYetWired');
    // The live derivation must have an honest failure branch, not a fake value.
    expect(src).toContain('"unwired"');
  });

  it('contains no fabricated pilot-state literals', () => {
    const src = stripComments(readSource(TAB_PATH));
    for (const fake of ['🟢', '🟡', '🔴', 'Healthy', 'On track', 'All systems']) {
      expect(src.includes(fake), `fabricated state literal '${fake}' found in the tab`).toBe(false);
    }
  });
});

describe('transport + navigation discipline', () => {
  it('the tab uses personaFetch and never binds authedFetchHeaders or calls raw fetch', () => {
    const raw = readSource(TAB_PATH);
    const findings = forbiddenImportFindings(raw, ['authedFetchHeaders'], ['utils/supabaseBrowser']);
    expect(findings).toEqual([]);
    const auth = importAuthority(raw);
    expect(auth.boundNames.has('personaFetch')).toBe(true);
    // Bare fetch( — the lookbehind spares personaFetch( and similar bindings.
    expect(/(?<![A-Za-z])fetch\(/.test(stripComments(raw))).toBe(false);
  });

  it('cross-surface links go through buildCodexUrl — no bespoke embed URLs', () => {
    const raw = readSource(TAB_PATH);
    expect(importAuthority(raw).boundNames.has('buildCodexUrl')).toBe(true);
    expect(stripComments(raw)).not.toContain('/triad/embed/codex');
  });

  it('every registry deep link targets a real, enabled codex tab', async () => {
    const { getCodexById, getCodexBySlug } = await import('../data/codex-configs');
    for (const ws of PARTNER_WORKSPACES) {
      for (const link of ws.links) {
        // Mirror the embed route's suffix rule (see [codexSlug]/page.tsx).
        const hasKnownSuffix = link.codexSlug.endsWith('-codex') || link.codexSlug.endsWith('-cartridge');
        const suffixed = hasKnownSuffix ? link.codexSlug : `${link.codexSlug}-codex`;
        const codex = getCodexById(suffixed) ?? getCodexBySlug(link.codexSlug);
        expect(codex, `link '${link.id}' targets unknown codex '${link.codexSlug}'`).toBeTruthy();
        if (link.tab) {
          const tab = codex!.tabs.find((t: { slug: string; enabled: boolean }) => t.slug === link.tab && t.enabled);
          expect(tab, `link '${link.id}' targets unknown/disabled tab '${link.tab}' in '${codex!.id}'`).toBeTruthy();
        }
      }
    }
  });
});

describe('collaborate — venture-lab domain scoping over the ONE invitation/exchange system', () => {
  it("'venture-lab' is a real access domain with roles (participationAccess)", () => {
    expect((ACCESS_DOMAINS as readonly string[]).includes('venture-lab')).toBe(true);
    expect(DOMAIN_ROLES['venture-lab'].length).toBeGreaterThan(0);
  });

  it('the tab mounts the existing surfaces scoped to the entrance\u2019s domain (no forks)', () => {
    // DOMAIN-PARAMETERISED since 2026-07-28: the same component is now the
    // Research Lab's workspace entrance too, so the literal 'venture-lab' moved
    // from the JSX to the KIND_COPY/ACCESS_DOMAIN map. Both halves are pinned —
    // the mounts read the entrance's domain, AND 'venture' still resolves to
    // 'venture-lab'. Pinning only the first would let the venture entrance be
    // silently repointed at another domain with this canary green.
    const src = stripComments(readSource(TAB_PATH));
    expect(src).toContain('initialDomain={accessDomain}');
    expect(src).toContain('domainFilter={accessDomain}');
    expect(src).toMatch(/venture:\s*"venture-lab"/);
    expect(src).toMatch(/research:\s*"research-lab"/);
    expect(src).toContain('<StewardParticipationTab');
    expect(src).toContain('<QubeTalkInboxTab');
    expect(src).toContain('<LockerTab');
  });

  it('the upstream extensions keep their canonical defaults', () => {
    const steward = stripComments(readSource('app/triad/components/codex/tabs/StewardParticipationTab.tsx'));
    expect(steward).toContain("initialDomain ?? 'passport'");
    const inbox = stripComments(readSource('components/composer/QubeTalkInboxTab.tsx'));
    expect(inbox).toContain('researchOnly ? "research-lab" : domainFilter ?? null');
  });
});

describe('Phase 1 — Venture Lab Participation is a composition, not a copy', () => {
  it('Participate is its own cross-programme group between Partner and Administer', async () => {
    // Operator decision 2026-07-27: participation spans every venture programme,
    // so it is not a Partner sub-item.
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const groups = VENTURE_LAB_CODEX.tabGroups ?? [];
    const participate = groups.find((g: { id: string }) => g.id === 'participate');
    const partner = groups.find((g: { id: string }) => g.id === 'partner');
    const administer = groups.find((g: { id: string }) => g.id === 'administer');
    expect(participate, 'no Participate group').toBeTruthy();
    expect(participate!.label).toBe('Participate');
    expect(participate!.order).toBeGreaterThan(partner!.order);
    expect(participate!.order).toBeLessThan(administer!.order);
    // Participant-facing: the GROUP must NOT be adminOnly, or no participant
    // could ever reach it — the whole point of Phase 1.
    expect(participate!.adminOnly).toBeUndefined();
  });

  it('every Participate tab mounts a component that already exists elsewhere — reuse, not a fork', async () => {
    // THE RULING: "Do not copy Research Lab Participation into Venture Lab."
    // The property that proves compliance is REUSE: every component the venture
    // Participate group mounts must already be mounted by some other cartridge.
    // A venture-specific fork — a `VentureParticipationApplyTab` — would be the
    // only component appearing nowhere else, and would fail here.
    //
    // Compared across ALL cartridges rather than only the IRL participation
    // group: `StewardParticipationTab` is the shared five-domain Access &
    // Invitations workspace and is mounted from the Passport surface, not from
    // IRL's participation group. Narrowing to one group made this canary
    // mis-fire on correct reuse (caught on first run, 2026-07-27).
    const { VENTURE_LAB_CODEX, CODEX_DEFINITIONS } = await import('../data/codex-configs');

    const ventureParticipate = VENTURE_LAB_CODEX.tabs.filter(
      (t: { group?: string }) => t.group === 'participate',
    );
    expect(ventureParticipate.length).toBe(6);

    // metaMe MIRRORS the Venture Lab's tabs into its own `vl` group
    // (`ventureLabTabsForMetameVl`, ids prefixed `vl-`). Excluding only the
    // venture-lab codex therefore made "exists elsewhere" vacuously true for
    // every VL tab — the mirror re-exposed the fork. Caught by mutation-testing
    // this canary, 2026-07-27. Mirrored clones are excluded too.
    const elsewhere = new Set<string>(
      CODEX_DEFINITIONS
        .filter((c: { slug: string }) => c.slug !== VENTURE_LAB_CODEX.slug)
        .flatMap((c: { tabs?: { id: string; config: { component?: string } }[] }) => c.tabs ?? [])
        .filter((t: { id: string }) => !t.id.startsWith('vl-'))
        .map((t: { config: { component?: string } }) => t.config.component)
        .filter(Boolean),
    );
    expect(elsewhere.size, 'no components found to compare against').toBeGreaterThan(10);

    for (const tab of ventureParticipate) {
      expect(
        elsewhere.has(tab.config.component as string),
        `${tab.id} mounts ${tab.config.component}, which no other cartridge mounts — that is a fork, not a composition`,
      ).toBe(true);
    }

    // The steward surface is the only adminOnly one, and it opens on the
    // venture domain — the single configuration difference between the Labs.
    const steward = ventureParticipate.find((t: { id: string }) => t.id.endsWith('-steward'))!;
    expect(steward.adminOnly).toBe(true);
    expect(steward.config.props?.initialDomain).toBe('venture-lab');
    for (const tab of ventureParticipate) {
      if (tab.id !== steward.id) {
        expect(tab.adminOnly, `${tab.id} is adminOnly — participants cannot reach it`).toBeUndefined();
      }
    }
  });

  it('the venture-lab domain carries the workspace roles, and the venture roles survive', async () => {
    // Extended, never forked — one participation mechanism across five domains.
    const roles = DOMAIN_ROLES['venture-lab'];
    for (const original of ['founder-operator', 'venture-participant', 'mentor', 'venture-steward', 'portfolio-reviewer']) {
      expect(roles, `venture role '${original}' was dropped`).toContain(original);
    }
    for (const added of ['workspace-steward', 'partner-operator', 'technical-contributor', 'communications-contributor', 'observer', 'agent-participant']) {
      expect(roles, `workspace role '${added}' missing`).toContain(added);
    }
    // The domain list itself is untouched — no sixth access domain was invented.
    expect(ACCESS_DOMAINS).toContain('venture-lab');
    expect(ACCESS_DOMAINS.length).toBe(5);
  });
});
