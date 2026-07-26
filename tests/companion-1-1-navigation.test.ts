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
  COMPANION_NAV_ICON,
  COMPANION_NAV_DENSITY,
  COMPANION_NAV_DENSITY_CLASS,
  COMPANION_NAV_ITEM_TO_SURFACE,
  COMPANION_PRIMARY_NAV_ITEM,
  COMPANION_CAPABILITY_INVENTORY,
  COPILOT_NATIVE_NAV_ITEMS,
  migratedNavItems,
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
      'workspace',
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

describe('D-10 — icon presentation, with the label as tooltip and accessible name', () => {
  it('names an icon for every nav item', () => {
    for (const id of COMPANION_NAV_ITEMS) {
      expect(COMPANION_NAV_ICON[id], `no icon for '${id}'`).toBeTruthy();
    }
    expect(Object.keys(COMPANION_NAV_ICON).sort()).toEqual([...COMPANION_NAV_ITEMS].sort());
  });

  it('keeps labels — an icon-only nav still needs an accessible name', () => {
    // The regression this guards is an accessibility one that looks fine in a
    // screenshot: icons render, and the control is unusable with a screen
    // reader because nothing carries the word.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('title={label}');
    expect(code).toContain('aria-label={label}');
    expect(code).toContain('aria-hidden="true"');
  });

  it('D-10: the vocabulary says Workspace, never Workbench', () => {
    expect(COMPANION_NAV_LABEL.workspace).toBe('Workspace');
    expect(JSON.stringify(COMPANION_NAV_ITEMS)).not.toContain('workbench');
    expect(stripComments(readSource(COMPANION_PAGE)).toLowerCase()).not.toContain('workbench');
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

// ─── §3.2 — one navigation system: migration into the copilot menu ──────────

describe('§3.2 — surface switches migrate INTO the copilot menu', () => {
  it('splits the vocabulary by what the copilot already owns, derived not listed', () => {
    expect([...COPILOT_NATIVE_NAV_ITEMS]).toEqual(['avatar', 'wallet', 'agent-me']);
    expect(migratedNavItems()).toEqual(['search', 'workspace', 'overlay']);
    // Together they are exactly the vocabulary — no item is in both, none lost.
    expect([...COPILOT_NATIVE_NAV_ITEMS, ...migratedNavItems()].sort()).toEqual(
      [...COMPANION_NAV_ITEMS].sort(),
    );
  });

  it('the page derives the migrated set rather than re-listing it', () => {
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('migratedNavItems()');
    expect(code).toContain('navExtras={copilotNavExtras}');
  });

  it('the copilot renders host nav extras additively, never via footerContent', () => {
    // `footerContent` REPLACES the copilot's own menu row. Using it here would
    // have migrated three items in and knocked the avatar/chat toggle and the
    // wallet launcher out — a net loss disguised as a migration.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toContain('navExtras?:');
    expect(copilot).toMatch(/\n\s+navExtras,\n/);
    expect(copilot).toContain('{navExtras}');
    expect(stripComments(readSource(COMPANION_PAGE))).not.toContain('footerContent');
  });

  it('the copilot NEVER unmounts — every surface renders into its body slot', () => {
    // The regression (operator, 2026-07-26): surfaces were branches of a
    // ternary whose fallback was the copilot, so activating Search / Workspace
    // / Overlay unmounted the copilot and took the migrated navigation with it
    // — "we are not able to navigate back and forward between tabs once one has
    // been activated". A migrated nav that disappears the moment you use it is
    // worse than no migration.
    //
    // It also tore down the conversation on every switch, so returning to Agent
    // Me returned to a fresh session — a silent D-8 breach.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('bodySlot={');
    // Exactly one mount, and it is not inside a surface branch.
    expect((code.match(/<CodexCopilotLayer/g) ?? []).length).toBe(1);
    // Each surface panel must appear INSIDE the body slot, i.e. after it.
    const slotAt = code.indexOf('bodySlot={');
    for (const panel of ['CompanionSearchPanel', 'CaptureInboxPanel', 'CompanionOverlayPanel']) {
      expect(code.indexOf(`<${panel}`), `${panel} renders outside the body slot`).toBeGreaterThan(
        slotAt,
      );
    }
  });

  it('the copilot keeps its chrome around a body slot, never replaces it', () => {
    // If bodySlot rendered in place of the whole panel, the menu row would go
    // with it and we would be back to the same defect by another route.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toContain('bodySlot?:');
    expect(copilot).toContain(': bodySlot}');
    // The message list hides rather than the shell unmounting.
    expect(copilot).toMatch(/bodySlot \|\| walletFillsSurface \? ["']hidden["'] : ["']{2}/);
    // The fill-mode wallet is a BODY, not a replacement for the panel. The
    // first attempt hid the panel and took the nav with it.
    // Specifically: the PANEL wrapper must not hide. (Asserted against the
    // panel's own class string — a blanket "no walletFillsSurface ? hidden"
    // would also match the message-list hide, which is correct and required.)
    expect(copilot).not.toMatch(/walletFillsSurface \? ["']hidden["'] : ["']{2}\} transition-all/);
    expect(copilot).toContain('walletFillsSurface ? walletDrawerNode : bodySlot');
    // One wallet definition serving both placements.
    expect((copilot.match(/<SmartWalletDrawer/g) ?? []).length).toBe(1);
  });

  it('assistant replies render through the inference renderer, not as raw text', () => {
    // `enableInferenceRendering` is opt-in and defaults to false, so a mount
    // that forgets it silently loses markdown, code blocks and Mermaid — the
    // reply arrives as one undifferentiated block. It reads as "the copilot's
    // styling is broken" rather than "this surface never opted in", which is
    // why it survived: nothing errors, and every OTHER mount looks fine.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('enableInferenceRendering');
  });

  it('the composer is confined to Agent Me and Search — one input, never two', () => {
    // Two defects in one property. The composer appeared on every surface,
    // inviting the citizen to type into Workspace and Overlay where nothing
    // answers; and on Search it appeared ALONGSIDE the panel's own search bar,
    // so there were two input boxes doing one job.
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page).toContain('hideComposer={activeSurface !== "agent-me" && activeSurface !== "search"}');
    expect(page).toContain('composerMode={activeSurface === "search" ? "search" : "chat"}');
    // The search panel must no longer own an input of its own (D-12 closed).
    const panel = stripComments(readSource('components/companion/CompanionSearchPanel.tsx'));
    expect(panel, 'the search panel grew a second input back').not.toContain('<input');
    expect(panel).toContain('query: string');
  });

  it('search submits to the host, never to the model', () => {
    // A search typed into the shared composer must not become a chat turn:
    // the citizen would be billed an inference and get prose instead of hits.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/if \(composerMode === ["']search["']\)/);
    expect(copilot).toContain('onComposerSubmit?.(value)');
  });

  it('the bottom row is KEPT while the migration is under test', () => {
    // Operator: "you can keep them in both rows if you want until we test they
    // are working in the copilot menu before retiring the bottom row." Retiring
    // it early would strip the only way back from Search/Workspace/Overlay,
    // where the copilot — and therefore its menu — is not mounted at all.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('aria-label="Companion navigation"');
    expect(code).toContain('COMPANION_NAV_ITEMS.map');
  });
});

// ─── One capability, one width, whichever route reaches it ──────────────────

describe('the wallet renders at Companion pane width from BOTH routes', () => {
  it('the copilot mount asks for the same fill-width wallet as the nav item', () => {
    // The defect (operator, 2026-07-26): the Companion's own Wallet nav item
    // mounted SmartWalletDrawer with embeddedWidth="fill", but the wallet
    // reached THROUGH the copilot used a hardcoded "fixed" cartridge-sized
    // column. Same capability, two widths, decided by which route the citizen
    // happened to take — precisely what §4.3's "one navigation" forbids.
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('embeddedWidth="fill"');
    expect(code).toContain('walletEmbeddedWidth="fill"');
    expect(code).toContain('allowWideLayout={false}');
    expect(code).toContain('walletAllowWideLayout={false}');
  });

  it('the copilot takes its wallet width from a prop, never a constant', () => {
    // `const walletEmbeddedWidth = "fixed"` is what made the copilot's wallet
    // unfixable from outside. If it returns, the Companion mount above goes on
    // compiling and silently stops having any effect.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).not.toMatch(/const walletEmbeddedWidth = ["']fixed["']/);
    expect(copilot).toContain('walletEmbeddedWidth?:');
  });

  it('fill mode drops the rem cap, or the prop would have no visible effect', () => {
    // A width prop that is threaded through but overridden by a `md:w-[22.25rem]`
    // wrapper class is the subtlest version of this same bug: every grep passes
    // and the pane still renders at cartridge width.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/walletEmbeddedWidth === ["']fill["']\s*\?\s*["']w-full["']/);
  });

  it('defaults to fixed — every pre-existing cartridge mount is unchanged', () => {
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/walletEmbeddedWidth: walletEmbeddedWidthProp = ["']fixed["']/);
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
