/**
 * Companion 1.1 C3/C5 canaries — Quick Link gating + avatar knowledge source.
 *
 * The operator's requirement for C3 is not "Quick Links work", it is:
 *
 *   "ensure that admin and access gating is retained as need be. Ideally
 *    observer should be state and context aware and not enable unauthorised
 *    surfaces to be surfaced as quicklinks"
 *
 * So the assertions below are weighted toward the ways a gate silently opens:
 * an unresolved persona, a gate the code does not recognise, a query that
 * reaches past the filter, and a hand-copied list that drifts out of step with
 * a tab that later became `adminOnly`.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

const COMPANION_PAGE = 'app/(embed)/triad/embed/companion/page.tsx';
import {
  quickLinkVisibility,
  resolveQuickLinks,
  quickLinkHref,
  quickLinkTarget,
  quickLinkContextNeedle,
  quickLinkSurfaceNeedle,
  quickLinkDomainNeedle,
  quickLinkJourneyNeedle,
  quickLinkTitleNeedle,
  QUICK_LINK_DOMAIN_NEEDLES,
  type QuickLinkAccessContext,
} from '@/services/companion/quickLinks';
import {
  AVATAR_KNOWLEDGE_SOURCE,
  AVATAR_KNOWLEDGE_TARGET,
  isServicedByAigentMeKb,
  avatarKnowledgeStatus,
} from '@/services/companion/avatarKnowledgeSource';

const NOBODY: QuickLinkAccessContext = { isAdmin: false, isPartner: false, adminCartridges: [] };
const ADMIN: QuickLinkAccessContext = { isAdmin: true, isPartner: false, adminCartridges: [] };
const PARTNER: QuickLinkAccessContext = { isAdmin: false, isPartner: true, adminCartridges: [] };
const KNYT_ADMIN: QuickLinkAccessContext = {
  isAdmin: false,
  isPartner: false,
  adminCartridges: ['knyt-codex'],
};

// ─── Fail-closed gating ─────────────────────────────────────────────────────

describe('Quick Link gating — fails closed', () => {
  it('offers an ungated tab to anyone, including an unresolved persona', () => {
    expect(quickLinkVisibility({}, null, 'any')).toBe('ungated');
    expect(quickLinkVisibility({}, NOBODY, 'any')).toBe('ungated');
  });

  it('NEVER offers a gated tab to an unresolved persona', () => {
    // The branch that makes fail-closed real. A Companion still resolving
    // identity must not advertise an admin surface, however briefly — a Quick
    // Link is an offer, and an offer is an intervention.
    expect(quickLinkVisibility({ adminOnly: true }, null, 'any')).toBeNull();
    expect(quickLinkVisibility({ partnerOnly: true }, null, 'any')).toBeNull();
  });

  it('never offers an adminOnly tab to a non-admin', () => {
    expect(quickLinkVisibility({ adminOnly: true }, NOBODY, 'any')).toBeNull();
    expect(quickLinkVisibility({ adminOnly: true }, PARTNER, 'any')).toBeNull();
  });

  it('a partner does not inherit admin surfaces', () => {
    expect(quickLinkVisibility({ adminOnly: true, partnerOnly: true }, PARTNER, 'any')).toBeNull();
  });

  it('a global admin sees gated surfaces; a partner sees partnerOnly ones', () => {
    expect(quickLinkVisibility({ adminOnly: true }, ADMIN, 'any')).toBe('global-admin');
    expect(quickLinkVisibility({ partnerOnly: true }, ADMIN, 'any')).toBe('global-admin');
    expect(quickLinkVisibility({ partnerOnly: true }, PARTNER, 'any')).toBe('partner');
  });

  it('a per-cartridge admin grant applies to THAT cartridge only', () => {
    expect(quickLinkVisibility({ adminOnly: true }, KNYT_ADMIN, 'knyt-codex')).toBe('cartridge-admin');
    expect(quickLinkVisibility({ adminOnly: true }, KNYT_ADMIN, 'agentiq')).toBeNull();
  });
});

// ─── The registry sweep — the property that actually protects citizens ──────

describe('resolveQuickLinks — no unauthorised surface reaches an unprivileged citizen', () => {
  it('yields links for an ordinary citizen, and every one of them is ungated', () => {
    const links = resolveQuickLinks({ access: NOBODY });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.allowedBecause, `'${link.id}' reached a non-admin`).toBe('ungated');
    }
  });

  it('an unresolved persona gets ungated links only', () => {
    for (const link of resolveQuickLinks({ access: null })) {
      expect(link.allowedBecause).toBe('ungated');
    }
  });

  it('an admin sees strictly more than a citizen — proving the gate does something', () => {
    // Without this, a filter that excluded everything would pass every test
    // above while being useless, and a filter that excluded nothing would be
    // caught only if the registry happens to contain a gated tab. It does.
    const asCitizen = resolveQuickLinks({ access: NOBODY }).map((l) => l.id);
    const asAdmin = resolveQuickLinks({ access: ADMIN }).map((l) => l.id);
    expect(asAdmin.length).toBeGreaterThan(asCitizen.length);
    for (const id of asCitizen) expect(asAdmin).toContain(id);
  });

  it('a copilot query cannot surface a gated link the persona lacks', () => {
    // Narrowing happens AFTER gating. If it ever happened instead of gating,
    // a well-chosen query would be a privilege-escalation channel.
    const adminOnlyIds = new Set(
      resolveQuickLinks({ access: ADMIN })
        .filter((l) => l.allowedBecause !== 'ungated')
        .map((l) => l.id),
    );
    expect(adminOnlyIds.size).toBeGreaterThan(0);
    for (const needle of ['admin', 'docs', 'a', '']) {
      for (const link of resolveQuickLinks({ access: NOBODY, matching: needle })) {
        expect(adminOnlyIds.has(link.id), `query '${needle}' surfaced gated '${link.id}'`).toBe(false);
      }
    }
  });

  it('respects a limit without reordering privilege', () => {
    const limited = resolveQuickLinks({ access: NOBODY, limit: 3 });
    expect(limited.length).toBeLessThanOrEqual(3);
    for (const link of limited) expect(link.allowedBecause).toBe('ungated');
  });
});

describe('Quick Links are derived and reuse the shipped navigation', () => {
  it('derives candidates from the cartridge registry, never a local list', () => {
    const code = stripComments(readSource('services/companion/quickLinks.ts'));
    expect(code).toContain('CODEX_DEFINITIONS');
    expect(code).toContain('buildCodexUrl');
  });

  it('builds the same deep link shape the shipped search results already use', () => {
    const [link] = resolveQuickLinks({ access: NOBODY, limit: 1 });
    const href = quickLinkHref(link, 'persona-under-test');
    expect(href).toContain(link.codexSlug);
    expect(href).toContain('persona-under-test');
  });

  it('never puts privilege flags on the URL', () => {
    // isAdmin/isPartner on a link the Companion generated would be this module
    // asserting privilege rather than observing it (CLAUDE.md: never hardcode
    // isAdmin=true in a link).
    const [link] = resolveQuickLinks({ access: ADMIN, limit: 1 });
    const href = quickLinkHref(link, 'p');
    expect(href).not.toContain('isAdmin');
    expect(href).not.toContain('isPartner');
  });

  it('§3.2.5 — drives the BROWSER, never the Companion pane', () => {
    // The correction C3 got wrong twice: first navigating the Companion's own
    // pane, then opening the browser from a bespoke chrome strip. A Quick Link
    // launches into the left-hand workspace and leaves the Companion on the
    // right. If it ever navigated the Companion, the assistant would be
    // replacing itself with the thing it was asked to open.
    expect(quickLinkTarget()).toBe('_blank');
    const code = stripComments(readSource(COMPANION_PAGE));
    expect(code).toContain('window.open(quickLinkHref(link, personaId), quickLinkTarget()');
  });

  it('the carousel prop is LIVE — declared, destructured and rendered', () => {
    // History, because this is the exact failure the canary suite exists to
    // catch: `quickPrompts` was declared on CodexCopilotLayer and never
    // destructured or rendered. The Companion passed it, the earlier canary
    // grepped for the pass-site and went green, and the citizen saw no
    // carousel at all (operator, 2026-07-26). A prop that is only DECLARED is
    // indistinguishable from a working one at every grep-shaped assertion, so
    // this checks the whole chain instead of the pass-site.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot, 'quickPrompts must still be part of the contract').toContain('quickPrompts?:');
    // Destructured out of props — the step that was missing.
    expect(copilot, 'quickPrompts is declared but never destructured').toMatch(
      /\n\s+quickPrompts,\n/,
    );
    // ...and actually mapped to chips.
    expect(copilot, 'quickPrompts is destructured but never rendered').toMatch(
      /\(quickPrompts \?\? \[\]\)\.map/,
    );
  });

  it('§3.2.5a — Quick Links ride the ONE row above the composer, not a second strip', () => {
    // The operator's standard: "a single row carousel as is already the
    // standard in the copilot". Rendering them in their own strip would be a
    // parallel affordance for the same job (inv.engineering.037) and would
    // push the composer further from the citizen on every surface.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    const carousels = copilot.match(/flex flex-nowrap items-center gap-1 overflow-x-auto/g) ?? [];
    expect(carousels.length, 'more than one chip carousel exists in the copilot').toBe(1);
  });

  it('a skipInference Quick Link never enters the model path', () => {
    // Selecting a Quick Link is a NAVIGATION act. If it were sent as a message
    // the citizen would get an answer about the destination instead of the
    // destination — and would be billed an inference for a click.
    const copilot = stripComments(readSource('app/components/codex/CodexCopilotLayer.tsx'));
    expect(copilot).toMatch(/if \(item\.skipInference\) \{\s*onPrompt\?\.\(prompt\);\s*return;/);
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page).toContain('skipInference: true');
  });

  it('is a presentation filter, and says so — the server gate still governs', () => {
    const src = readSource('services/companion/quickLinks.ts');
    expect(src).toContain('never become one');
    expect(src.toLowerCase()).toContain('server-side');
  });
});

// ─── C5 — avatar knowledge source ───────────────────────────────────────────

describe('C5 — the avatar knowledge source is declared honestly', () => {
  it('reports the LIVE source, which is still the D-ID-hosted corpus', () => {
    expect(AVATAR_KNOWLEDGE_SOURCE).toBe('did-hosted');
    expect(isServicedByAigentMeKb()).toBe(false);
  });

  it('declares aigentMe KB as the target and flags the gap as a stub', () => {
    expect(AVATAR_KNOWLEDGE_TARGET).toBe('aigentme-kb');
    const status = avatarKnowledgeStatus();
    expect(status.isStub).toBe(true);
    expect(status.note).toMatch(/not yet wired/i);
  });

  it('the status note does not describe the target as though it were the state', () => {
    // The failure this guards is a doc-shaped one: a note that reads "the
    // avatar answers from the aigentMe KB" while it does not would make every
    // reader trust answers from a corpus nobody governs.
    const note = avatarKnowledgeStatus().note.toLowerCase();
    expect(note).toContain('d-id');
    expect(note).not.toMatch(/^the avatar answers from the aigentme knowledge base/);
  });

  it('D-ID ships unchanged — Companion 1.1 does not touch the SDK mount', () => {
    const code = stripComments(readSource('app/components/metaVatar/MetaAvatar.tsx'));
    expect(code).toContain('agent.d-id.com');
    expect(code).toContain('data-agent-id');
  });
});

// ─── Observed context RANKS, never gates (operator, 2026-07-26) ─────────────

describe('quick links are observer-driven without becoming observer-gated', () => {
  it('maps only the shapes the overlay actually recognises, and abstains otherwise', () => {
    // Same discipline overlayMapping applies: no fabricated association for an
    // unrecognised page.
    expect(quickLinkContextNeedle('github-repo')).toBe('software');
    expect(quickLinkContextNeedle('financial-context')).toBe('wallet');
    expect(quickLinkContextNeedle('example.com')).toBeNull();
    expect(quickLinkContextNeedle(null)).toBeNull();
    expect(quickLinkContextNeedle(undefined)).toBeNull();
  });

  it('an observation NEVER subtracts links — the count is unchanged', () => {
    // THE load-bearing one. If context filtered instead of ranked, landing on
    // an unrecognised page would empty a surface that works fine with no
    // observation at all — an observation making the citizen worse off.
    const without = resolveQuickLinks({ access: NOBODY, limit: 6 });
    for (const shape of ['github-repo', 'financial-context', 'nothing-we-know']) {
      const with_ = resolveQuickLinks({
        access: NOBODY,
        context: quickLinkContextNeedle(shape),
        limit: 6,
      });
      expect(with_.length, `context '${shape}' changed how many links are offered`).toBe(
        without.length,
      );
    }
  });

  it('an observation NEVER widens the set beyond what the persona may see', () => {
    // Ranking runs after the gate, so context cannot promote a gated surface.
    const citizen = new Set(
      resolveQuickLinks({ access: NOBODY, context: 'wallet' }).map((l) => l.id),
    );
    const ungated = new Set(resolveQuickLinks({ access: NOBODY }).map((l) => l.id));
    for (const id of citizen) {
      expect(ungated.has(id), `context surfaced '${id}', which the gate excluded`).toBe(true);
    }
  });

  it('matching links are offered first when a context is observed', () => {
    const all = resolveQuickLinks({ access: ADMIN });
    const needle = 'wallet';
    const anyMatch = all.some((l) => l.label.toLowerCase().includes(needle));
    if (!anyMatch) return; // nothing to rank in this registry — not a failure
    const ranked = resolveQuickLinks({ access: ADMIN, context: needle });
    expect(ranked[0].label.toLowerCase()).toContain(needle);
  });
});

describe('the ranking signal is one that is actually present', () => {
  it('the active surface always yields a needle where a topic exists', () => {
    // The shape-only version abstained on nearly every page, so nothing ever
    // reordered and the strip looked static (operator, 2026-07-26).
    // Operator-specified associations (2026-07-26): wallet offers the
    // money-shaped destinations, workspace offers myCluster.
    expect(quickLinkSurfaceNeedle('wallet')).toEqual(['moneypenny', 'financial']);
    expect(quickLinkSurfaceNeedle('workspace')).toEqual(['mycluster', 'cluster']);
    expect(quickLinkSurfaceNeedle('permissions')).toEqual(['passport']);
  });

  it('the conversation surface claims no topic of its own', () => {
    // Inventing one would be the fabricated association overlayMapping refuses.
    expect(quickLinkSurfaceNeedle('agent-me')).toBeNull();
    expect(quickLinkSurfaceNeedle(null)).toBeNull();
    expect(quickLinkSurfaceNeedle('not-a-surface')).toBeNull();
  });

  it('MS-5 — the chosen surface outranks the observed page', () => {
    // THE DEFECT (operator, 2026-07-27: "the quicklinks carousel is getting
    // stuck and not changing with the tabs"). The first cut read
    // shape ?? domain ?? surface. `dev-beta.aigentz.me` carries a VERIFIED
    // Domain Profile, so the shape always resolved while testing and pinned the
    // strip to one needle on every surface — switching tabs changed nothing.
    //
    // Selecting a surface is a deliberate act; the page underneath is ambient.
    // Surface first, observation as the fallback — which is exactly right for
    // `overlay` (about the page) and `agent-me` (no topic), the two surfaces
    // that deliberately have no needle of their own.
    const page = stripComments(readSource(COMPANION_PAGE));
    expect(page, 'the observation still overrides the chosen surface').toMatch(
      /quickLinkSurfaceNeedle\(activeSurface\)\s*\?\?\s*quickLinkJourneyNeedle\(journeyActive\)\s*\?\?\s*quickLinkTitleNeedle\(observedTitle\)\s*\?\?\s*quickLinkContextNeedle\(observedShape\)\s*\?\?\s*quickLinkDomainNeedle\(observedDomain\)/,
    );
    // …and re-ranks when any of the five changes, or it is static again.
    expect(page).toMatch(/\[access, observedShape, observedDomain, observedTitle, activeSurface, journeyActive\]/);
  });

  it('a journey session ranks real Venture Lab / MoneyPenny destinations when no surface needle exists', () => {
    // Found 2026-07-31: `agent-me` chat mode showed KNYT-first order while a
    // Guided Journey Runtime session was active, because nothing told this
    // strip a journey was underway. quickLinkJourneyNeedle fills that gap.
    expect(quickLinkJourneyNeedle(true)).toEqual(['venture lab', 'moneypenny']);
    expect(quickLinkJourneyNeedle(false)).toBeNull();
  });

  it('the journey needle never fires ahead of a chosen surface needle', () => {
    const page = stripComments(readSource(COMPANION_PAGE));
    // wallet/workspace/permissions/etc. still resolve via quickLinkSurfaceNeedle
    // FIRST in the ?? chain asserted above — quickLinkJourneyNeedle only ever
    // reaches surfaces (agent-me, overlay) that already yield null there.
    expect(quickLinkSurfaceNeedle('wallet')).not.toBeNull();
    expect(page).toMatch(/quickLinkSurfaceNeedle\(activeSurface\)\s*\?\?\s*quickLinkJourneyNeedle/);
  });

  it('the observed TAB TITLE ranks real destinations when no surface or journey-event signal exists', () => {
    // THE ACTUAL FIX for the reported symptom (2026-07-31): the Companion
    // embed (`page.tsx`) is loaded ONLY by the browser extension, in its own
    // window (verified against `extension/companion-observer/constants.js` +
    // `popup.js`) — it does not share a document with `PilotJourneyTab.tsx`,
    // so `journey:select-stage` never reaches it in that deployment. The
    // observed tab TITLE does, via the extension's existing 'current-tab'
    // observation (`GET /api/companion/overlay`'s new `title` field) — no new
    // capability, no new grant.
    expect(quickLinkTitleNeedle('metaMe × Horizen — Constitutional Admission Journey')).toEqual([
      'journey',
      'venture lab',
      'moneypenny',
    ]);
    expect(quickLinkTitleNeedle('Some Unrelated Page Title')).toBeNull();
    expect(quickLinkTitleNeedle(null)).toBeNull();
    expect(quickLinkTitleNeedle('')).toBeNull();
  });

  it('the title needle values are real rank-key words, never a guessed one', () => {
    // `data/codex-configs.ts`, read directly: 'journey' and 'venture lab' are
    // real substrings of the Journey tab's own rankKey ('venture lab α
    // journey partner-pilot-journey partner'); 'moneypenny' is a real
    // substring of MONEYPENNY_CARTRIDGE.name ('Aigent MoneyPenny'). 'horizen'
    // is deliberately absent from the VALUES (only ever a table KEY / title
    // substring to detect) because it appears in no codex name, tab label,
    // tab slug, or tab group — including it as a rank word would match
    // nothing.
    const needle = quickLinkTitleNeedle('horizen');
    expect(needle).not.toBeNull();
    expect(needle).not.toContain('horizen');
  });

  it('MS-5/MS-7 — every needled surface visibly changes the strip', () => {
    // A precedence that is correct on paper is still inert if the surfaces it
    // prefers all rank to the same six links. This asserts the OBSERVABLE
    // outcome the operator is looking at: switching to a needled surface
    // reorders the visible strip away from the unranked baseline.
    const baseline = resolveQuickLinks({ access: NOBODY, limit: 6 }).map((l) => l.id);
    for (const surface of ['wallet', 'search', 'workspace', 'activity', 'permissions']) {
      const ranked = resolveQuickLinks({
        access: NOBODY,
        context: quickLinkSurfaceNeedle(surface),
        limit: 6,
      }).map((l) => l.id);
      expect(
        ranked.join('|'),
        `surface '${surface}' produces the same six links as no ranking at all — the strip cannot appear to change`,
      ).not.toBe(baseline.join('|'));
    }
  });

  it('the declared host destinations reach a real, offerable link', () => {
    // Operator mapping (2026-07-27): claude.ai → the AgentiQ OS cartridge, home
    // of the aigent-z development command-centre agent. A declared destination
    // that matches nothing would be the same inert mechanism as the label-only
    // ranking it replaces.
    const offered = resolveQuickLinks({ access: NOBODY });
    for (const [host, needles] of Object.entries(QUICK_LINK_DOMAIN_NEEDLES)) {
      const reached = offered.filter((l) =>
        needles.some((n) => (l.rankKey ?? l.label.toLowerCase()).includes(n)),
      );
      expect(
        reached.length,
        `host '${host}' needle ${JSON.stringify(needles)} matches no offered link`,
      ).toBeGreaterThan(0);
    }
  });

  it('an unlisted host still yields nothing — the table asserts, it does not guess', () => {
    expect(quickLinkDomainNeedle('example.com')).toBeNull();
    expect(quickLinkDomainNeedle(null)).toBeNull();
    expect(quickLinkDomainNeedle('')).toBeNull();
    // Host normalisation, not host invention.
    expect(quickLinkDomainNeedle('WWW.Claude.ai')).toEqual(['agentiq os']);
  });

  it('every surface needle actually reaches a real destination', () => {
    // THE DEFECT THIS PINS (operator, 2026-07-27: "still not seeing quick link
    // changes for workspace"). A needle that matches nothing is a mechanism
    // that cannot fire — the strip stays frozen on whatever the registry order
    // happens to be, which is exactly what "still showing KNYT" was. Ranking
    // matched only the DISPLAY LABEL, so `mycluster` could never hit: myCluster
    // is a tab GROUP whose members are labelled myCanvas / myWorkspace /
    // myCartridge / myLedger. Matching now includes the group id.
    //
    // Asserted against the real registry with the LEAST-privileged access, so
    // the destination has to be one an ordinary citizen can actually be
    // offered — a needle that only resolves for an admin is still inert for
    // everyone else.
    const offered = resolveQuickLinks({ access: NOBODY });
    for (const surface of ['wallet', 'workspace', 'permissions', 'activity', 'search']) {
      const needles = quickLinkSurfaceNeedle(surface);
      expect(needles, `surface '${surface}' has no needle`).not.toBeNull();
      const reached = offered.filter((l) =>
        (needles ?? []).some((n) => (l.rankKey ?? l.label.toLowerCase()).includes(n)),
      );
      expect(
        reached.length,
        `surface '${surface}' needle ${JSON.stringify(needles)} matches no offered link — the strip cannot respond`,
      ).toBeGreaterThan(0);
    }
  });

  it('ranking matches the tab group, not only the visible label', () => {
    // The specific repair: the Workspace surface's operator-named association
    // is myCluster, which appears nowhere in any link's text.
    const ranked = resolveQuickLinks({
      access: NOBODY,
      context: quickLinkSurfaceNeedle('workspace'),
      limit: 6,
    });
    expect(
      ranked.some((l) => (l.rankKey ?? '').includes('mycluster')),
      'no myCluster-group link reached the visible strip on the Workspace surface',
    ).toBe(true);
  });

  it('a surface needle still cannot subtract or widen', () => {
    const base = resolveQuickLinks({ access: NOBODY, limit: 6 });
    const permitted = new Set(resolveQuickLinks({ access: NOBODY }).map((l) => l.id));
    for (const surface of ['wallet', 'workspace', 'permissions', 'agent-me']) {
      const ranked = resolveQuickLinks({
        access: NOBODY,
        context: quickLinkSurfaceNeedle(surface),
        limit: 6,
      });
      expect(ranked.length, `surface '${surface}' changed the offer count`).toBe(base.length);
      // Ranking reorders BEFORE the limit, so a different — still permitted —
      // six can surface. That is the feature. What must hold is that every
      // link came from the gated set, so compare against the UNLIMITED offer,
      // not against the first six of it.
      for (const l of ranked) expect(permitted.has(l.id)).toBe(true);
    }
  });
});
