/**
 * IRL OS → metaMe IRL containment canaries (2026-08-27 emergency security
 * pass). Full incident report: docs/security/2026-08-27_irl-os-containment-breach-audit.md
 *
 * THE BREACH: the public IRL OS cartridge shared its Workspace and Validation
 * Programme tabs' rendering machinery (`buildResearchWorkspaceTab` →
 * `PartnerProgrammesTab` → `DeepLinkCard`) with the PRIVATE metaMe IRL
 * cartridge. `services/research/researchWorkspace.ts` hardcodes
 * `codexSlug: 'irl-cartridge'` on the Protocols & Articles / EXP-P1
 * Readiness / Experiments / Reports / Records & Findings links every
 * research-programme workspace carries, and `DeepLinkCard` builds those into
 * live hrefs — `personaId`/`isAdmin` included as query params — straight
 * into the private cartridge. Separately, two document-serving routes
 * (`/api/codex/packs/[packId]/file` for the `irl` pack, and
 * `/api/public/irl/doc`) had NO access control at all for the `irl` pack's
 * confidential collections (`col_foundation`, `col_experiments`).
 *
 * THE HARD INVARIANT THIS FILE ENFORCES: IRL OS is a public and selectively
 * gated projection of the laboratory. It is never a navigation path,
 * rendering alias, or authority bridge into private metaMe IRL. No IRL OS
 * surface may link to, embed, mount, redirect to, or reconstruct a
 * destination in `irl-cartridge`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IRL_OS_CARTRIDGE } from '@/data/codex-configs';

function readSource(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), 'utf8');
}

// ── Recursively walk every tab + subTab, collecting anything that could be
//    a navigation destination (slug, config.props). ──────────────────────
function collectDestinationStrings(tabs: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (typeof obj.slug === 'string') out.push(obj.slug);
    if (obj.config && typeof obj.config === 'object') {
      out.push(JSON.stringify((obj.config as Record<string, unknown>).props ?? {}));
    }
    if (Array.isArray(obj.subTabs)) obj.subTabs.forEach(walk);
  };
  if (Array.isArray(tabs)) tabs.forEach(walk);
  return out;
}

describe('IRL OS cartridge — no irl-cartridge destination anywhere in its tab tree', () => {
  it('no tab slug, sub-tab slug, or component prop equals or embeds "irl-cartridge"', () => {
    const destinations = collectDestinationStrings(IRL_OS_CARTRIDGE.tabs);
    const offenders = destinations.filter((d) => d.includes('irl-cartridge'));
    expect(offenders, `Found irl-cartridge destination(s): ${JSON.stringify(offenders)}`).toHaveLength(0);
  });

  it('the FULL serialized cartridge definition contains no "irl-cartridge" substring', () => {
    // Belt-and-braces: catches anything the structural walk above might miss
    // (e.g. a destination string nested somewhere unexpected).
    const serialized = JSON.stringify(IRL_OS_CARTRIDGE);
    expect(serialized).not.toContain('irl-cartridge');
  });
});

describe('IRL OS cartridge — the confirmed breach vector stays disabled', () => {
  function findTab(id: string) {
    return IRL_OS_CARTRIDGE.tabs.find((t) => (t as { id?: string }).id === id) as
      | { enabled?: boolean }
      | undefined;
  }

  it('irl-os-workspace (buildResearchWorkspaceTab — the DeepLinkCard/irl-cartridge vector) is disabled', () => {
    const tab = findTab('irl-os-workspace');
    expect(tab, 'irl-os-workspace tab must still be present (disabled), not silently removed').toBeDefined();
    expect(tab?.enabled).toBe(false);
  });

  it('irl-os-validation-programme (mounts the same PartnerProgrammesTab family) is disabled', () => {
    const tab = findTab('irl-os-validation-programme');
    expect(tab).toBeDefined();
    expect(tab?.enabled).toBe(false);
  });

  it('confidential-IP tabs served via the (now-fixed) unauthenticated packs/file route stay disabled', () => {
    for (const id of [
      'irl-os-charter',
      'irl-os-layer-i',
      'irl-os-layer-ii',
      'irl-os-layer-iii',
      'irl-os-protocols',
      'irl-os-glossary',
      'irl-os-evaluation',
      'irl-os-programmes',
      'irl-os-experiment-lab',
    ]) {
      const tab = findTab(id);
      expect(tab, `${id} must still be present (disabled)`).toBeDefined();
      expect(tab?.enabled, `${id} must be disabled`).toBe(false);
    }
  });

  it('EXP-P1 Readiness and Corpus Scout remain admin-only', () => {
    for (const id of ['irl-os-exp-p1-readiness', 'irl-os-corpus-scout']) {
      const tab = findTab(id) as { adminOnly?: boolean; enabled?: boolean } | undefined;
      expect(tab).toBeDefined();
      expect(tab?.enabled).toBe(true);
      expect(tab?.adminOnly).toBe(true);
    }
  });

  it('verified-public tabs (own dedicated public API, not the irl pack route) remain enabled', () => {
    for (const id of [
      'irl-os-welcome',
      'irl-os-dashboard',
      'irl-os-invariant-field',
      'irl-os-invariant-registry',
      'irl-os-reports',
      'irl-os-participation-overview',
    ]) {
      const tab = findTab(id) as { enabled?: boolean } | undefined;
      expect(tab, `${id} must be present`).toBeDefined();
      expect(tab?.enabled, `${id} must remain enabled — verified public`).toBe(true);
    }
  });
});

describe('Source-level canary — no IRL OS-owned source file hardcodes irl-cartridge as a link destination', () => {
  // These are the concrete files audited and fixed in the 2026-08-27 pass —
  // pinned here so a future re-introduction of a hardcoded destination in
  // one of THEM is caught even if the config-level test above is weakened.
  const FILES_MUST_NOT_HARDCODE_IRL_CARTRIDGE_DESTINATION = [
    'components/metame/cards/QuickLinksCard.tsx',
  ];

  it.each(FILES_MUST_NOT_HARDCODE_IRL_CARTRIDGE_DESTINATION)(
    '%s does not construct a navigable irl-cartridge destination',
    (relPath) => {
      const code = readSource(relPath);
      // Match `slug: "irl-cartridge"` / `tab: "irl-cartridge"` / codexSlug
      // patterns, not incidental prose mentions in comments about the
      // private cartridge's NAME (which several files legitimately carry as
      // explanatory context for why they now avoid it).
      expect(code).not.toMatch(/(?:slug|codexSlug)\s*:\s*["']irl-cartridge["']/);
    },
  );

  it('BoundaryResearchProgressPanel "Explore IRL OS" link no longer targets the disabled irl-os-workspace tab', () => {
    const code = readSource('components/journey/BoundaryResearchProgressPanel.tsx');
    expect(code).not.toMatch(/tab:\s*['"]irl-os-workspace['"]/);
  });
});

describe('Query-derived authority — isAdmin/personalId are navigation hints only, never server authority', () => {
  it('the codex-packs file route never reads an isAdmin/personalId query parameter', () => {
    const code = readSource('app/api/codex/packs/[packId]/file/route.ts');
    expect(code).not.toMatch(/searchParams\.get\(\s*["'](?:isAdmin|personalId|personaId)["']\s*\)/);
  });

  it('the public irl/doc route never reads an isAdmin/personalId query parameter', () => {
    const code = readSource('app/api/public/irl/doc/route.ts');
    expect(code).not.toMatch(/searchParams\.get\(\s*["'](?:isAdmin|personalId|personaId)["']\s*\)/);
  });

  it('the experiments/access route resolves isAdmin ONLY from the server-side persona, never a query param', () => {
    const code = readSource('app/api/experiments/access/route.ts');
    expect(code).toContain('persona.cartridgeFlags?.isAdmin');
    expect(code).not.toMatch(/searchParams\.get\(\s*["']isAdmin["']\s*\)/);
  });
});

describe('irl pack — default-deny document routes (root-cause fix)', () => {
  it('the codex-packs file route gates the irl pack to an explicit allowlist unless admin', () => {
    const code = readSource('app/api/codex/packs/[packId]/file/route.ts');
    expect(code).toContain('IRL_PUBLIC_PACK_PATHS');
    expect(code).toMatch(/packId === ["']irl["']/);
  });

  it('the public irl/doc route gates to an explicit allowlist (no persona bypass — it 404s outright)', () => {
    const code = readSource('app/api/public/irl/doc/route.ts');
    expect(code).toContain('IRL_PUBLIC_DOC_PATHS');
  });

  it('the shared PARTICIPATION_overview.md path is allowlisted in both routes (the one deliberately-public irl doc)', () => {
    const packFileCode = readSource('app/api/codex/packs/[packId]/file/route.ts');
    const publicDocCode = readSource('app/api/public/irl/doc/route.ts');
    expect(packFileCode).toContain('foundation/PARTICIPATION_overview.md');
    expect(publicDocCode).toContain('foundation/PARTICIPATION_overview.md');
  });
});

describe('experiments/access — no full-catalogue existence-signal leak to unentitled callers', () => {
  it('an unauthenticated caller receives an empty assignable list, not the full registry', () => {
    const code = readSource('app/api/experiments/access/route.ts');
    // The unauthenticated early-return must not reference ASSIGNABLE_EXPERIMENTS.
    const earlyReturnMatch = code.match(
      /if \(!persona\?\.personaId\) \{[\s\S]*?return NextResponse\.json\(([\s\S]*?)\);\s*\}/,
    );
    expect(earlyReturnMatch, 'unauthenticated early-return branch not found').not.toBeNull();
    expect(earlyReturnMatch![1]).not.toContain('ASSIGNABLE_EXPERIMENTS');
    expect(earlyReturnMatch![1]).toMatch(/assignable:\s*\[\]/);
  });

  it('a scoped (non-admin, non-"all") caller receives assignable filtered to their own allowedExperiments', () => {
    const code = readSource('app/api/experiments/access/route.ts');
    expect(code).toMatch(/ASSIGNABLE_EXPERIMENTS\.filter/);
  });
});
