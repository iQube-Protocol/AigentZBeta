/**
 * IRL OS scoped restoration (2026-08-27, post-emergency-rollback).
 *
 * Full incident report: docs/security/2026-08-27_irl-os-containment-breach-audit.md
 *
 * CONTEXT: the 2026-08-27 emergency containment pass (Phase 1 + addendum)
 * was merged, caused an estate-wide production regression, and was fully
 * reverted (`git revert -m 1`). This is the NARROWLY SCOPED replacement —
 * touching only AgentiqCartridgeTab.tsx, PartnerProgrammesTab.tsx, and the
 * IRL_OS_CARTRIDGE/IRL_CARTRIDGE tab registry in data/codex-configs.ts.
 *
 * TWO ROOT CAUSES FIXED HERE:
 *
 * 1. AgentiqCartridgeTab used a plain, unauthenticated `fetch()` against
 *    `/api/codex/packs/[packId]/file` — a route that (for the `irl` pack)
 *    requires canonical server-resolved admin via `getActivePersona`, which
 *    itself requires an `Authorization: Bearer` header or `x-auth-profile-id`
 *    (services/wallet/personaRepo.ts's `getCallerIdentityContext` — cookies
 *    are never read). A caller with a genuinely authenticated admin session
 *    but no Bearer header attached to THIS specific fetch therefore always
 *    resolved to "no persona" -> 403, regardless of their real session. This
 *    is the confirmed root cause of "Failed to load collections for irl"
 *    across metaMe IRL for admins, not a gating defect in the route itself.
 *    Fix: `personaFetch` (utils/personaSpine) attaches the caller's Bearer
 *    token when one exists and is a no-op passthrough otherwise.
 *
 * 2. AgentiqCartridgeTab always fetched the FULL collections.json listing
 *    before ever attempting to load a `defaultPath` document, and a failed
 *    collections.json fetch hard-blocked rendering — even when the specific
 *    document was itself independently allowlisted. Fix: on a collections
 *    fetch failure with `defaultPath` set, synthesize a single-item
 *    collection from the CALLER-DECLARED prop (not from server data) so the
 *    content-loading effect can still attempt the one document read it would
 *    have attempted anyway.
 *
 * THIRD FIX: PartnerProgrammesTab's DeepLinkCard/AreaLinks gained a
 * render-boundary guard (`forbiddenCodexSlugs`) so the IRL OS mount of
 * `buildResearchWorkspaceTab` can never resolve a DeepLinkCard into the
 * private `irl-cartridge`, regardless of which workspace a research-lab
 * grant scopes the caller to. This restores `irl-os-workspace` without
 * reactivating the original DeepLinkCard/irl-cartridge vector.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import { IRL_CARTRIDGE, IRL_OS_CARTRIDGE } from '@/data/codex-configs';

const CARTRIDGE_TAB = 'app/triad/components/codex/tabs/AgentiqCartridgeTab.tsx';
const PARTNER_TAB = 'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx';

describe('AgentiqCartridgeTab — authenticated reads (root cause 1)', () => {
  it('imports personaFetch from utils/personaSpine', () => {
    const src = readSource(CARTRIDGE_TAB);
    const auth = importAuthority(src);
    const record = auth.records.find((r) => r.specifier === '@/utils/personaSpine');
    expect(record, 'must import from @/utils/personaSpine').toBeTruthy();
    expect(record?.names).toContain('personaFetch');
  });

  it('both the collections fetch and the content fetch use personaFetch, not a raw fetch', () => {
    const code = stripComments(readSource(CARTRIDGE_TAB));
    expect(code).toMatch(/personaFetch\(`\/api\/codex\/packs\/\$\{packId\}\/file\?path=collections\.json`\)/);
    expect(code).toMatch(/personaFetch\(`\/api\/codex\/packs\/\$\{packId\}\/file\?path=\$\{encoded\}`\)/);
    // No remaining bare `fetch(` call against this route (the pre-fix defect).
    expect(code).not.toMatch(/[^.a-zA-Z]fetch\(`\/api\/codex\/packs\/\$\{packId\}\/file/);
  });
});

describe('AgentiqCartridgeTab — graceful degradation to a caller-declared defaultPath (root cause 2)', () => {
  function loadCollectionEffectBody(): string {
    const code = stripComments(readSource(CARTRIDGE_TAB));
    const at = code.indexOf('async function loadCollection()');
    expect(at, 'loadCollection effect not found').toBeGreaterThan(-1);
    const end = code.indexOf('\n    loadCollection();', at);
    expect(end, 'end of loadCollection effect not found').toBeGreaterThan(-1);
    return code.slice(at, end);
  }

  it('on a collections-fetch failure WITH defaultPath set, synthesizes a single-item collection instead of erroring', () => {
    const body = loadCollectionEffectBody();
    expect(body).toMatch(/if\s*\(isMounted\s*&&\s*defaultPath\)\s*\{/);
    expect(body).toMatch(/setCollection\(\{\s*id:\s*collectionId,\s*title:\s*titleCase\(collectionId\),\s*items:\s*\[defaultPath\]\s*\}\)/);
    expect(body).toMatch(/setActivePath\(defaultPath\)/);
  });

  it('on a collections-fetch failure WITHOUT defaultPath, still sets a visible error — never a silent fallback', () => {
    const body = loadCollectionEffectBody();
    expect(body).toMatch(/\}\s*else if\s*\(isMounted\)\s*\{\s*setError\(/);
  });

  it('the synthesized collection is built from the caller-declared prop, not from server response data', () => {
    // The catch block must not reference the (denied) `collections`/`payload`
    // variables from the try block when constructing the fallback.
    const body = loadCollectionEffectBody();
    const catchAt = body.indexOf('} catch (err) {');
    expect(catchAt).toBeGreaterThan(-1);
    const catchBody = body.slice(catchAt);
    expect(catchBody).not.toMatch(/\bcollections\b/);
    expect(catchBody).not.toMatch(/\bpayload\b/);
  });
});

describe('PartnerProgrammesTab — render-boundary codexSlug guard (root cause 3)', () => {
  it('declares forbiddenCodexSlugs on PartnerProgrammesTabProps', () => {
    const code = stripComments(readSource(PARTNER_TAB));
    expect(code).toMatch(/forbiddenCodexSlugs\?:\s*string\[\]/);
  });

  it('AreaLinks filters out any link whose codexSlug is on forbiddenCodexSlugs', () => {
    const code = stripComments(readSource(PARTNER_TAB));
    const at = code.indexOf('function AreaLinks(');
    expect(at).toBeGreaterThan(-1);
    const end = code.indexOf('\n// ─── Research programme left-nav', at);
    const body = code.slice(at, end === -1 ? at + 2000 : end);
    expect(body).toMatch(/!forbiddenCodexSlugs\?\.includes\(l\.codexSlug\)/);
  });

  it('every AreaLinks call site forwards forbiddenCodexSlugs — no area silently exempt from the guard', () => {
    const code = stripComments(readSource(PARTNER_TAB));
    const calls = code.match(/<AreaLinks ws=\{ws\} area="[a-z]+"[^/]*\/>/g) ?? [];
    expect(calls.length, 'expected at least one AreaLinks call site').toBeGreaterThan(0);
    for (const call of calls) {
      expect(call, `AreaLinks call site missing forbiddenCodexSlugs: ${call}`).toContain(
        'forbiddenCodexSlugs={forbiddenCodexSlugs}',
      );
    }
  });

  it('PartnerProgrammesTab destructures forbiddenCodexSlugs from its props and forwards it', () => {
    const code = stripComments(readSource(PARTNER_TAB));
    expect(code).toMatch(/export function PartnerProgrammesTab\(\{[^}]*forbiddenCodexSlugs[^}]*\}: PartnerProgrammesTabProps\)/);
  });
});

describe('data/codex-configs.ts — buildResearchWorkspaceTab wires the guard by host, not by caller', () => {
  it('forbiddenCodexSlugs is derived from idPrefix, scoped to irl-os- mounts only', () => {
    const code = stripComments(readSource('data/codex-configs.ts'));
    const at = code.indexOf('function buildResearchWorkspaceTab(idPrefix: string) {');
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at, at + 600);
    expect(body).toMatch(/forbiddenCodexSlugs\s*=\s*idPrefix\.startsWith\('irl-os-'\)\s*\?\s*\['irl-cartridge'\]\s*:\s*undefined/);
  });

  it('every config.props object inside buildResearchWorkspaceTab passes forbiddenCodexSlugs through', () => {
    const code = stripComments(readSource('data/codex-configs.ts'));
    const at = code.indexOf('function buildResearchWorkspaceTab(idPrefix: string) {');
    const end = code.indexOf('\n// =', at);
    const body = code.slice(at, end === -1 ? at + 4000 : end);
    const propsBlocks = body.match(/props:\s*\{[^}]*\}/g) ?? [];
    expect(propsBlocks.length, 'expected 3 props blocks (top tab, per-view subTabs, TIER 0 subTab)').toBe(3);
    for (const block of propsBlocks) {
      expect(block, `props block missing forbiddenCodexSlugs: ${block}`).toContain('forbiddenCodexSlugs');
    }
  });

  it('IRL_CARTRIDGE (private) irl-workspace mount does NOT forbid irl-cartridge — its self-links are legitimate', () => {
    const tab = IRL_CARTRIDGE.tabs.find((t) => (t as { id?: string }).id === 'irl-workspace') as
      | { config?: { props?: { forbiddenCodexSlugs?: string[] } } }
      | undefined;
    expect(tab).toBeTruthy();
    expect(tab?.config?.props?.forbiddenCodexSlugs).toBeUndefined();
  });

  it('IRL_OS_CARTRIDGE (public) irl-os-workspace mount forbids irl-cartridge', () => {
    const tab = IRL_OS_CARTRIDGE.tabs.find((t) => (t as { id?: string }).id === 'irl-os-workspace') as
      | { config?: { props?: { forbiddenCodexSlugs?: string[] } }; enabled?: boolean }
      | undefined;
    expect(tab).toBeTruthy();
    expect(tab?.enabled).toBe(true);
    expect(tab?.config?.props?.forbiddenCodexSlugs).toEqual(['irl-cartridge']);
  });
});

describe('Participation Overview — the allowlisted single-document path degrades gracefully for both cartridges', () => {
  it('both irl-participation-overview (private) and irl-os-participation-overview (public) declare the same defaultPath', () => {
    const privateTab = IRL_CARTRIDGE.tabs.find((t) => (t as { id?: string }).id === 'irl-participation-overview') as
      | { config?: { props?: { defaultPath?: string; packId?: string; collectionId?: string } } }
      | undefined;
    const publicTab = IRL_OS_CARTRIDGE.tabs.find((t) => (t as { id?: string }).id === 'irl-os-participation-overview') as
      | { config?: { props?: { defaultPath?: string; packId?: string; collectionId?: string } } }
      | undefined;
    expect(privateTab?.config?.props?.defaultPath).toBe('foundation/PARTICIPATION_overview.md');
    expect(publicTab?.config?.props?.defaultPath).toBe('foundation/PARTICIPATION_overview.md');
    expect(privateTab?.config?.props?.packId).toBe('irl');
    expect(publicTab?.config?.props?.packId).toBe('irl');
  });
});
