/**
 * Emergency regression hotfix (2026-08-27) — the IRL OS containment merge's
 * `packId === 'irl'` default-deny gate on `/api/codex/packs/[packId]/file`
 * broke `collections.json` for EVERY caller, including canonically
 * authorized metaMe IRL admins reading Layer I/II/III and Protocols &
 * Articles. Live-observed on dev-beta.aigentz.me as "Failed to load
 * collections for irl" in BOTH the public IRL OS cartridge (expected/
 * intended to still work for its one allowlisted document) AND the private
 * metaMe IRL cartridge (a genuine regression — metaMe IRL was never meant
 * to be touched by IRL OS containment work).
 *
 * ROOT CAUSE: the route conflated PACK-LEVEL default-deny with
 * PROJECTION-LEVEL denial. The `irl` pack is legitimate PRIVATE SOURCE
 * MATERIAL for metaMe IRL's own canonically-authorized users — it should
 * never have been blocked for them. The actual containment boundary is
 * "does this specific CALLER hold canonical admin authority", which the
 * pre-existing `cartridgeFlags.isAdmin` check already encodes correctly:
 * every substantive metaMe IRL tab (Charter, Layers I-III, Protocols,
 * Programmes, Glossary, Records, Reports, Corpus Scout, EXP-P1 Readiness,
 * Experiment Registry) is confirmed `adminOnly: true` in IRL_CARTRIDGE
 * (multiple "Access-boundary correction (2026-08-26)" comments), so isAdmin
 * IS the exact pre-incident predicate for these tabs — never narrowed here.
 *
 * THE FIX (already in place from the immediately-prior commit on this same
 * branch): `servePublicRedactedIrlCollections()` means a non-admin caller
 * NEVER gets a hard 403 on collections.json — they get a version filtered to
 * the public allowlist. An ADMIN caller's request short-circuits past the
 * redaction branch entirely and reaches the normal `corpusReadPackFile`
 * path below, serving the REAL, complete, unmodified content — exactly as
 * before this whole incident, for every irl-pack path, not just
 * collections.json. This file adds the tests proving that fall-through
 * explicitly, plus the operator's registry-preservation and cache-isolation
 * requirements.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { IRL_CARTRIDGE, IRL_OS_CARTRIDGE } from '@/data/codex-configs';

const PACKS_FILE_ROUTE = 'app/api/codex/packs/[packId]/file/route.ts';
const REGISTRY_ROUTE = 'app/api/codex/registry/[codexId]/route.ts';

// ── Baseline snapshot of IRL_CARTRIDGE's tab registry, taken from the live
//    deployed commit e7021cfb2 (immediately after the approved Phase 1 +
//    addendum merge, immediately before this hotfix) — the exact point the
//    operator named as "the parent of the containment merge" for comparison
//    purposes. Every one of these was already `enabled: true` before ANY
//    IRL OS containment work began, and none of the containment work (Phase
//    1, the addendum, or this hotfix) may ever remove or disable one. ──
const IRL_CARTRIDGE_BASELINE_TAB_IDS = [
  'irl-welcome',
  'irl-exchange',
  'irl-dashboard',
  'irl-research-copilot',
  'irl-charter',
  'layer-i',
  'layer-ii',
  'layer-iii',
  'irl-experiment-lab',
  'irl-protocols',
  'irl-invariant-field',
  'irl-corpus-scout',
  'irl-exp-p1-readiness',
  'irl-experiment-registry',
  'irl-invariant-registry',
  'irl-glossary',
  'irl-records',
  'irl-reports',
  'irl-programmes',
  'irl-participation-overview',
  'irl-passport-apply',
  'irl-passport-delegation',
  'irl-passport-locker',
  'irl-participation-standing',
  'irl-passport-steward',
  'workspace', // buildResearchWorkspaceTab('irl-workspace') itself carries id 'irl-workspace'; the
               // TOP-LEVEL tabGroups entry uses 'workspace' — both are asserted below explicitly.
] as const;

describe('CANARY — IRL OS containment work can never modify or disable IRL_CARTRIDGE', () => {
  it('every baseline tab is present and still enabled: true', () => {
    const idsPresent = new Set(IRL_CARTRIDGE.tabs.map((t) => t.id));
    // 'workspace' above is the tabGroup id, not a tab id — the actual tab
    // built by buildResearchWorkspaceTab carries id 'irl-workspace'.
    const expectedTabIds = IRL_CARTRIDGE_BASELINE_TAB_IDS.filter((id) => id !== 'workspace').concat('irl-workspace');
    for (const id of expectedTabIds) {
      const tab = IRL_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab, `IRL_CARTRIDGE must still declare tab '${id}'`).toBeTruthy();
      expect(tab?.enabled, `IRL_CARTRIDGE tab '${id}' must remain enabled`).toBe(true);
    }
    expect(idsPresent.size).toBeGreaterThanOrEqual(expectedTabIds.length);
  });

  it('tab COUNT has not shrunk below the pre-hotfix baseline (catches a silent removal, not just a disable)', () => {
    expect(IRL_CARTRIDGE.tabs.length).toBeGreaterThanOrEqual(IRL_CARTRIDGE_BASELINE_TAB_IDS.length);
  });

  it('the only change permitted to IRL_CARTRIDGE by containment work is the ADDED permissions.view restriction, never a tab edit', () => {
    // Structural proxy for "no tab was silently touched": every tab this
    // audit's own confirmed-adminOnly list names is still exactly
    // adminOnly: true (not loosened) and still enabled (not disabled).
    const mustStayAdminOnly = [
      'irl-charter', 'layer-i', 'layer-ii', 'layer-iii', 'irl-protocols',
      'irl-programmes', 'irl-glossary', 'irl-records', 'irl-reports',
      'irl-corpus-scout', 'irl-exp-p1-readiness', 'irl-experiment-registry',
      'irl-invariant-registry', 'irl-passport-steward', 'irl-welcome',
      'irl-dashboard', 'irl-research-copilot', 'irl-experiment-lab',
      'irl-invariant-field',
    ];
    for (const id of mustStayAdminOnly) {
      const tab = IRL_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab?.enabled, `${id} must remain enabled`).toBe(true);
    }
  });
});

describe('Root cause — the irl pack is source material for metaMe IRL, never a public-denial rule by itself', () => {
  it('an authenticated admin caller falls through the collections.json redaction branch entirely (real content, not redacted)', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    // The admin check gates the ENTRY to the redaction/403 branch — an
    // admin (persona.cartridgeFlags.isAdmin === true) never enters
    // `if (!persona?.cartridgeFlags?.isAdmin) { ... }` at all, so control
    // falls straight through to the normal corpusReadPackFile read below,
    // which serves the real file unconditionally.
    const gateBlock = code.match(/if \(requiresAdmin\) \{[\s\S]*?\n  \}\n\n  try \{/);
    expect(gateBlock).not.toBeNull();
    // The redaction/403 logic must be nested INSIDE the `!isAdmin` check,
    // never outside it — proving an admin genuinely bypasses both.
    const notAdminIdx = gateBlock![0].indexOf('if (!persona?.cartridgeFlags?.isAdmin)');
    const redactionIdx = gateBlock![0].indexOf('servePublicRedactedIrlCollections');
    const denyIdx = gateBlock![0].indexOf('"Admin required."');
    expect(notAdminIdx).toBeGreaterThan(-1);
    expect(redactionIdx).toBeGreaterThan(notAdminIdx);
    expect(denyIdx).toBeGreaterThan(notAdminIdx);
  });

  it('every irl-pack document read (not just collections.json) falls through to the real file for an admin caller', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    // The try block that performs corpusReadPackFile is reached for BOTH
    // (a) non-gated paths and (b) gated paths where the admin check already
    // passed — there is no separate, narrower admin-only document reader.
    expect(code).toMatch(/const raw = await corpusReadPackFile\(packId, safePath\);/);
    // Confirm there is exactly ONE corpusReadPackFile(packId, safePath) call
    // site for arbitrary documents (the collections.json redaction path
    // uses its own explicit "irl" call, kept separate deliberately).
    const genericReadCalls = [...code.matchAll(/corpusReadPackFile\(packId, safePath\)/g)];
    expect(genericReadCalls.length).toBe(1);
  });
});

describe('Public IRL OS is denied the same way it always was — this hotfix does not loosen containment', () => {
  it('IRL_PUBLIC_PACK_PATHS is unchanged — still exactly the one allowlisted path', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    const allowlist = code.match(/const IRL_PUBLIC_PACK_PATHS: string\[\] = \[([\s\S]*?)\];/);
    expect(allowlist).not.toBeNull();
    expect(allowlist![1].trim()).toBe('"foundation/PARTICIPATION_overview.md",');
  });

  it('a non-admin caller requesting a non-allowlisted irl-pack document still gets a hard 403, never content', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    expect(code).toContain('"Admin required."');
  });

  it('IRL_OS_CARTRIDGE tabs disabled by the earlier containment pass remain disabled — this hotfix does not restore them', () => {
    for (const id of [
      'irl-os-workspace', 'irl-os-validation-programme', 'irl-os-charter',
      'irl-os-layer-i', 'irl-os-layer-ii', 'irl-os-layer-iii',
      'irl-os-protocols', 'irl-os-glossary', 'irl-os-evaluation',
      'irl-os-programmes', 'irl-os-experiment-lab',
    ]) {
      const tab = IRL_OS_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab, `${id} must still be present (disabled)`).toBeTruthy();
      expect(tab?.enabled, `${id} must remain disabled`).toBe(false);
    }
  });

  it('no IRL OS destination in IRL_OS_CARTRIDGE resolves into irl-cartridge (still true after this hotfix)', () => {
    const serialized = JSON.stringify(IRL_OS_CARTRIDGE);
    expect(serialized).not.toContain('irl-cartridge');
  });
});

describe('Query-derived authority removal is untouched by this hotfix', () => {
  it('useCodexEmbedAuthBridge still carries no initialIsAdmin field', () => {
    const code = stripComments(readSource('app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts'));
    expect(code).not.toMatch(/initialIsAdmin/);
  });

  it('the packs/file route still never reads isAdmin/personalId/personaId from a query string', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    expect(code).not.toMatch(/searchParams\.get\(\s*["'](?:isAdmin|personalId|personaId)["']\s*\)/);
  });

  it('the registry route still never reads isAdmin from a query string — admin is resolved exclusively via getActivePersona', () => {
    const code = stripComments(readSource(REGISTRY_ROUTE));
    expect(code).not.toMatch(/searchParams[?.]*\.get\(\s*["']isAdmin["']\s*\)/);
    expect(code).toContain('getActivePersona(request)');
  });
});

describe('Cache isolation — caller-dependent responses are never cacheable by URL alone', () => {
  it('both routes declare force-dynamic (stops the Next.js Full Route/Data Cache)', () => {
    expect(stripComments(readSource(PACKS_FILE_ROUTE))).toContain('export const dynamic = "force-dynamic";');
    expect(stripComments(readSource(REGISTRY_ROUTE))).toContain("export const dynamic = 'force-dynamic';");
  });

  it('packs/file route sets Cache-Control: no-store on every irl-pack response (redacted collections, gated 403, and admin content alike)', () => {
    const code = stripComments(readSource(PACKS_FILE_ROUTE));
    expect(code).toContain('NO_STORE_HEADERS');
    expect(code).toMatch(/const NO_STORE_HEADERS = \{ "Cache-Control": "no-store" \}/);
    // Applied to the redaction success path, the 403 denial, and the
    // general content read — not just one of the three.
    const noStoreUsages = [...code.matchAll(/NO_STORE_HEADERS/g)];
    expect(noStoreUsages.length).toBeGreaterThanOrEqual(4); // 1 definition + at least 3 usages
  });

  it('registry route sets Cache-Control: no-store on gated static-cartridge responses', () => {
    const code = stripComments(readSource(REGISTRY_ROUTE));
    expect(code).toContain('NO_STORE_HEADERS');
    const noStoreUsages = [...code.matchAll(/NO_STORE_HEADERS/g)];
    expect(noStoreUsages.length).toBeGreaterThanOrEqual(3); // 1 definition + at least 2 usages
  });
});

describe('Austin/Autonomi reviewer restoration remains explicitly deferred (not silently bundled into this hotfix)', () => {
  it('the audit doc still names the reviewer-flow tradeoff as a residual Phase 2 item, not resolved here', () => {
    const doc = readSource('docs/security/2026-08-27_irl-os-containment-breach-audit.md');
    expect(doc).toMatch(/agent-package.*route.*hands.*reviewer/is);
  });
});
