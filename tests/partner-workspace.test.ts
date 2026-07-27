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
 *  4. The Partner Programmes tab stays adminOnly and registered.
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

describe('tab registration — adminOnly on the hand-curated Venture Lab cartridge', () => {
  it('partner-programmes is an enabled adminOnly tab mounting PartnerProgrammesTab', async () => {
    const { VENTURE_LAB_CODEX } = await import('../data/codex-configs');
    const tab = VENTURE_LAB_CODEX.tabs.find((t: { id: string }) => t.id === 'partner-programmes');
    expect(tab).toBeTruthy();
    expect(tab!.label).toBe('Partner Programmes');
    expect(tab!.adminOnly).toBe(true);
    expect(tab!.enabled).toBe(true);
    expect(tab!.config.component).toBe('PartnerProgrammesTab');
  });

  it('TabRenderer registers the component', () => {
    const src = stripComments(readSource('app/triad/components/codex/TabRenderer.tsx'));
    expect(src).toContain('PartnerProgrammesTab');
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

  it('the tab mounts the existing surfaces scoped to venture-lab (no forks)', () => {
    const src = stripComments(readSource(TAB_PATH));
    expect(src).toContain('initialDomain="venture-lab"');
    expect(src).toContain('domainFilter="venture-lab"');
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
