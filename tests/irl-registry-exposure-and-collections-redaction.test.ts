/**
 * IRL registry exposure + collections.json redaction (2026-08-27, found
 * during live deployment verification of the IRL OS containment merge).
 * Full incident report: docs/security/2026-08-27_irl-os-containment-breach-audit.md
 *
 * TWO independent findings from testing the deployed commit against the
 * real dev-beta host:
 *
 * 1. `/api/codex/registry/irl-cartridge` served the PRIVATE metaMe IRL
 *    cartridge's full 26-tab structure — every admin-only tab's id, label,
 *    description, and document path (Charter, Protocols, EXP-P1 Readiness,
 *    Corpus Scout, Experiment Registry, Records) — to an unauthenticated
 *    caller. `CodexConfig.permissions.view` existed on the type but was
 *    never enforced by this route for any cartridge.
 *
 * 2. Closing the `irl` pack's default-deny gate (the prior Phase 1 fix)
 *    broke `collections.json` for EVERY caller, including the one surface
 *    explicitly meant to stay public (Participation Overview) —
 *    AgentiqCartridgeTab always fetches collections.json first, even when
 *    it already has an allowlisted defaultPath. Live-observed on
 *    dev-beta.aigentz.me as "Failed to load collections for irl" in the
 *    Participation → Overview tab. Widening the allowlist to include the
 *    REAL collections.json is not an option: it names
 *    `IRL-015_partner-cover-letter.md` and
 *    `IRL-012_austin-feedback-integration.md` by filename.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { IRL_CARTRIDGE, IRL_OS_CARTRIDGE } from '@/data/codex-configs';

describe('IRL_CARTRIDGE — explicit permissions.view, no longer decorative', () => {
  it('declares permissions.view WITHOUT the public wildcard', () => {
    expect(IRL_CARTRIDGE.permissions).toBeDefined();
    expect(IRL_CARTRIDGE.permissions.view).not.toContain('*');
  });

  it('IRL_OS_CARTRIDGE (the intended public edition) is unaffected — still publicly viewable', () => {
    expect(IRL_OS_CARTRIDGE.permissions?.view).toContain('*');
  });
});

describe('Registry detail route — static-cartridge visibility is enforced, not decorative', () => {
  const SOURCE = 'app/api/codex/registry/[codexId]/route.ts';

  it('defines staticCodexVisibleToCaller and calls it before returning a static-fallback codex', () => {
    const code = stripComments(readSource(SOURCE));
    expect(code).toContain('async function staticCodexVisibleToCaller(');
    // Both unguarded resolveCodex() return points found live (useDefaults
    // static-fallback, and the direct-path DB-miss fallback) must now be
    // gated — not just the function existing somewhere unused.
    const callSites = [...code.matchAll(/staticCodexVisibleToCaller\(/g)];
    // 1 definition-site match (the `async function` line above already
    // matched separately) + at least 2 call sites.
    expect(callSites.length).toBeGreaterThanOrEqual(3);
  });

  it('a non-wildcard-view codex without canonical admin gets a 404 (existence not confirmed), never the real tab data', () => {
    const code = stripComments(readSource(SOURCE));
    // The gate must return the SAME "Codex not found" / 404 shape the
    // pre-existing personalConfigVisibleToCaller pattern uses — proving
    // this fix follows the file's own established no-leak convention
    // rather than inventing a new (potentially metadata-revealing) denial
    // shape.
    const fnBody = code.match(/async function staticCodexVisibleToCaller[\s\S]*?\n\}/);
    expect(fnBody).not.toBeNull();
    expect(fnBody![0]).toContain('cartridgeFlags?.isAdmin');
    // The catch branch (any resolution error) must resolve `false`
    // (denied), not `true` — behavioural fail-closed, not just a comment
    // saying so.
    expect(fnBody![0]).toMatch(/catch\s*\{\s*return false;/);
  });

  it('never trusts a client-supplied isAdmin — resolves exclusively via getActivePersona', () => {
    const code = stripComments(readSource(SOURCE));
    const fnBody = code.match(/async function staticCodexVisibleToCaller[\s\S]*?\n\}/);
    expect(fnBody![0]).not.toMatch(/searchParams/);
    expect(fnBody![0]).toContain('getActivePersona(request)');
  });
});

describe('collections.json — redacted for non-admin, never blocked outright, never served verbatim', () => {
  const SOURCE = 'app/api/codex/packs/[packId]/file/route.ts';

  it('defines servePublicRedactedIrlCollections and routes non-admin collections.json reads through it', () => {
    const code = stripComments(readSource(SOURCE));
    expect(code).toContain('async function servePublicRedactedIrlCollections(');
    expect(code).toMatch(/if \(packId === "irl" && safePath === IRL_COLLECTIONS_PATH\)/);
  });

  it('the redaction filters items to IRL_PUBLIC_PACK_PATHS and drops description text', () => {
    const code = stripComments(readSource(SOURCE));
    const fnBody = code.match(/async function servePublicRedactedIrlCollections[\s\S]*?\n\}/);
    expect(fnBody).not.toBeNull();
    expect(fnBody![0]).toContain('IRL_PUBLIC_PACK_PATHS.includes(item)');
    // The redacted object literal must not forward the real `description`
    // field through — only id/title/items survive.
    expect(fnBody![0]).not.toMatch(/description:\s*col\.description/);
  });

  it('an authenticated admin still gets the REAL, unredacted collections.json (falls through past the redaction branch)', () => {
    const code = stripComments(readSource(SOURCE));
    // The redaction call sits strictly inside the `if (!persona?.cartridgeFlags?.isAdmin)`
    // branch, so an admin never reaches it — confirmed structurally by the
    // branch nesting rather than by string proximity alone.
    const gateBlock = code.match(/if \(requiresAdmin\) \{[\s\S]*?\n  \}\n\n  try \{/);
    expect(gateBlock).not.toBeNull();
    const adminCheckIdx = gateBlock![0].indexOf('!persona?.cartridgeFlags?.isAdmin');
    const redactionIdx = gateBlock![0].indexOf('servePublicRedactedIrlCollections');
    expect(adminCheckIdx).toBeGreaterThan(-1);
    expect(redactionIdx).toBeGreaterThan(adminCheckIdx);
  });
});

describe('Regression coverage — the exact live-observed break is now provably closed at the source', () => {
  it('IRL_PUBLIC_PACK_PATHS (the shared allowlist) still contains exactly the one intended-public path', () => {
    const code = stripComments(readSource('app/api/codex/packs/[packId]/file/route.ts'));
    const allowlist = code.match(/const IRL_PUBLIC_PACK_PATHS: string\[\] = \[([\s\S]*?)\];/);
    expect(allowlist).not.toBeNull();
    expect(allowlist![1]).toContain('foundation/PARTICIPATION_overview.md');
  });
});
