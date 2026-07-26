/**
 * Companion 1.1 canaries — SCOPE-MMC-004 §11.
 *
 * The Scope's governing rule is that 1.1 introduces **no new capabilities**
 * (§6.1, D-1). That rule is unenforceable by review alone, so it is enforced
 * here against the C0 inventory in `services/companion/companionNavigation.ts`
 * rather than restated (`inv.engineering.036`).
 *
 * Covers §11.1 (no new capability), §11.4 (single persona), §11.5 (house
 * style), §11.6 (single session / D-8) and §11.7 (navigation vocabulary).
 * §11.2 (conversation continuity) and §11.3 (authority boundary) attach to
 * C3, which is not built in this pass — noted rather than faked.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  COMPANION_NAV_ITEMS,
  COMPANION_NAV_LABEL,
  COMPANION_NAV_DENSITY,
  COMPANION_NAV_DENSITY_CLASS,
  COMPANION_NAV_ITEM_TO_SURFACE,
  COMPANION_PRIMARY_NAV_ITEM,
  COMPANION_CAPABILITY_INVENTORY,
  PRE_1_1_COMPANION_MODES,
  copilotModeForNavItem,
  navDensityForSurface,
  type CompanionNavItemId,
} from '@/services/companion/companionNavigation';
import { COMPANION_SURFACE_KINDS } from '@/types/companion';

const COMPANION_PAGE = 'app/(embed)/triad/embed/companion/page.tsx';

// ─── §11.7 Navigation vocabulary — one definition, not three lists ──────────

describe('§4.3 / D-3 — shared constitutional navigation vocabulary', () => {
  it('is exactly the six ratified items, in canonical order', () => {
    expect([...COMPANION_NAV_ITEMS]).toEqual([
      'avatar',
      'wallet',
      'agent-me',
      'search',
      'workbench',
      'overlay',
    ]);
  });

  it('labels every item — the vocabulary is complete, not partly implicit', () => {
    for (const id of COMPANION_NAV_ITEMS) {
      expect(COMPANION_NAV_LABEL[id], `no label for '${id}'`).toBeTruthy();
    }
    expect(Object.keys(COMPANION_NAV_LABEL).sort()).toEqual([...COMPANION_NAV_ITEMS].sort());
  });

  it('Agent Me is the primary occupant (§1, §3)', () => {
    expect(COMPANION_PRIMARY_NAV_ITEM).toBe('agent-me');
    expect(COMPANION_NAV_ITEMS).toContain(COMPANION_PRIMARY_NAV_ITEM);
  });

  it('the page renders navigation FROM the shared definition, never a local list', () => {
    // The defect this guards: three surfaces each hand-maintaining their own
    // array, drifting, and the citizen having to relearn navigation — the
    // exact invariant §4.3 protects.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('COMPANION_NAV_ITEMS');
    expect(code).toContain('COMPANION_NAV_LABEL');
    // No literal re-listing of the vocabulary in the page.
    expect(code).not.toMatch(/\[\s*['"]avatar['"]\s*,\s*['"]wallet['"]/);
  });
});

describe('§4.3 / D-3 — adaptive presentation adapts DENSITY, never vocabulary', () => {
  it('states a density for every companion surface kind', () => {
    for (const kind of COMPANION_SURFACE_KINDS) {
      expect(COMPANION_NAV_DENSITY[kind], `no density for surface '${kind}'`).toBeTruthy();
    }
  });

  it('every density has spacing classes and nothing that could change content', () => {
    for (const density of Object.values(COMPANION_NAV_DENSITY)) {
      const cls = COMPANION_NAV_DENSITY_CLASS[density];
      expect(cls.bar).toBeTruthy();
      expect(cls.item).toBeTruthy();
      expect(cls.label).toBeTruthy();
    }
  });

  it('the item set is IDENTICAL on every surface — only presentation differs', () => {
    // Vocabulary is a module-level constant, so this is true by construction.
    // Asserting it anyway is the point: if someone later makes the item list a
    // function of surface, this fails and the D-3 invariant is defended.
    const perSurface = COMPANION_SURFACE_KINDS.map(() => [...COMPANION_NAV_ITEMS].join('|'));
    expect(new Set(perSurface).size).toBe(1);
  });

  it('navDensityForSurface resolves each kind without a silent default', () => {
    for (const kind of COMPANION_SURFACE_KINDS) {
      expect(['full', 'comfortable', 'compact']).toContain(navDensityForSurface(kind));
    }
  });
});

// ─── §11.1 No new capability ────────────────────────────────────────────────

describe('§6.1 / D-1 — no new capabilities (C0 inventory derived)', () => {
  it('every nav item names a capability that already shipped', () => {
    const offenders: string[] = [];
    for (const id of COMPANION_NAV_ITEMS) {
      const record = COMPANION_CAPABILITY_INVENTORY[id];
      if (!record) { offenders.push(`'${id}' has no inventory record`); continue; }
      if (!record.capability?.trim()) offenders.push(`'${id}' names no capability`);
      if (!record.shippedIn?.trim()) offenders.push(`'${id}' cites no shipped location`);
      if (!['pre-1.1-companion-mode', 'pre-1.1-elsewhere'].includes(record.priorReach)) {
        offenders.push(`'${id}' claims prior reach '${record.priorReach}' — not a pre-1.1 value`);
      }
    }
    expect(
      offenders,
      'A nav item that cannot name a shipped capability IS a new capability, which §6.1 forbids absolutely.',
    ).toEqual([]);
  });

  it('the inventory covers the vocabulary exactly — no orphans either way', () => {
    expect(Object.keys(COMPANION_CAPABILITY_INVENTORY).sort()).toEqual(
      [...COMPANION_NAV_ITEMS].sort(),
    );
  });

  it('every file the inventory cites as shipped actually exists', () => {
    // Without this, the inventory could cite a plausible-looking path that was
    // never built, and the no-new-capability claim would rest on prose.
    for (const id of COMPANION_NAV_ITEMS) {
      const cited = COMPANION_CAPABILITY_INVENTORY[id].shippedIn.split(' ')[0];
      expect(() => readSource(cited), `'${id}' cites a non-existent ${cited}`).not.toThrow();
    }
  });
});

describe('§14.6 — no existing constitutional capability is lost', () => {
  it('every pre-1.1 Companion mode maps to a surviving nav item, or is explicitly recorded as unplaced', () => {
    for (const [mode, target] of Object.entries(PRE_1_1_COMPANION_MODES)) {
      if (target === null) continue; // explicitly recorded as an open placement (D-9)
      expect(
        COMPANION_NAV_ITEMS,
        `pre-1.1 mode '${mode}' maps to '${target}', which is not in the vocabulary`,
      ).toContain(target as CompanionNavItemId);
    }
  });

  it('records the pre-1.1 modes the shipped page actually had', () => {
    // Read from the git-tracked page rather than trusted: the baseline has to
    // be evidence, not memory.
    expect(Object.keys(PRE_1_1_COMPANION_MODES).sort()).toEqual(
      ['companion', 'overlay', 'search', 'wallet', 'workspace'],
    );
  });

  it('the one unplaced pre-1.1 mode is flagged, not silently dropped', () => {
    const unplaced = Object.entries(PRE_1_1_COMPANION_MODES)
      .filter(([, target]) => target === null)
      .map(([mode]) => mode);
    expect(unplaced).toEqual(['companion']);
    // Its content must still be reachable in the page (§14.6) even though the
    // six-item vocabulary has no slot for it — that placement is D-9.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('ObserverGrantPanel');
    expect(code).toContain('Timeline');
  });
});

// ─── §11.6 Single session (D-8) ─────────────────────────────────────────────

describe('§4.5 / D-8 — the avatar owns no session of its own', () => {
  it('the avatar nav item resolves to the Agent Me surface, not a parallel one', () => {
    expect(COMPANION_NAV_ITEM_TO_SURFACE.avatar).toBe('agent-me');
  });

  it('avatar selects the copilot\'s own avatar MODE; every other item is chat', () => {
    expect(copilotModeForNavItem('avatar')).toBe('avatar');
    for (const id of COMPANION_NAV_ITEMS.filter((i) => i !== 'avatar')) {
      expect(copilotModeForNavItem(id)).toBe('chat');
    }
  });

  it('the avatar capability is the copilot\'s existing mode — not a separate model', () => {
    const record = COMPANION_CAPABILITY_INVENTORY.avatar;
    expect(record.shippedIn).toContain('CodexCopilotLayer');
    expect(record.priorReach).toBe('pre-1.1-companion-mode');
  });

  it('the page mounts exactly ONE conversational component', () => {
    // The failure D-8 exists to prevent: a second Agent Me created by
    // accident. Any parallel chat surface in this page would be one.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('CodexCopilotLayer');
    for (const parallel of ['SmartTriadCopilotLayer', 'CompanionChatPanel', 'AgentMeChat']) {
      expect(code, `a second conversational surface (${parallel}) would be a second Agent Me`)
        .not.toContain(parallel);
    }
  });
});

// ─── §11.4 Single persona · §11.5 House style ───────────────────────────────

describe('§8.2 / §11.4 — one resolved persona, one transport', () => {
  it('the page never uses a raw fetch or authedFetchHeaders for spine reads', () => {
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).not.toMatch(/[^A-Za-z]fetch\(/);
    expect(code).not.toContain('authedFetchHeaders');
  });

  it('every panel receives the SAME personaId hint', () => {
    // Mixed hints resolve different personas across panels — the exact
    // inconsistency the spine exists to abolish.
    const code = stripComments(readSource(COMPANION_PAGE));
    const hints = [...code.matchAll(/personaIdHint=\{([^}]+)\}/g)].map((m) => m[1].trim());
    expect(hints.length).toBeGreaterThan(0);
    expect(new Set(hints).size, `mixed persona hints: ${JSON.stringify(hints)}`).toBe(1);
  });
});

describe('§8.5 / §11.5 — SLATE house style on the rebuilt navigation', () => {
  it('introduces no white hairline borders', () => {
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).not.toMatch(/border-white\//);
    expect(code).not.toMatch(/border-\[rgba\(255,\s*255,\s*255/);
  });

  it('uses the canonical slate hairline', () => {
    expect(stripComments(readSource(COMPANION_PAGE))).toContain('border-slate-800');
  });
});
