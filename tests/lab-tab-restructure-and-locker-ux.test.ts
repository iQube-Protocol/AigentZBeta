/**
 * Lab tab restructure + Locker UX canaries — operator ruling, 2026-07-28.
 *
 * Companion file to `tests/venture-lab-cohort-isolation.test.ts` (which holds
 * the two gate-shaped halves of the same ruling: canary 10, Partner invisible;
 * canary 11, the Public Workspace reachable-but-isolated). What lives HERE is
 * everything the ruling changed that is NOT a cohort gate:
 *
 *   A. Administer's admin check is PLATFORM admin, not a per-cartridge flag.
 *   B. AgentiQ OS α left Administer for Grow, and dropped its adminOnly.
 *   C. The Passport Registry tab is gone from both Labs — and no inbound deep
 *      link still points at it.
 *   D. Steward — INVESTIGATED, NOT WIDENED. Verifies the gate already behaves
 *      as the operator asked, from both sides.
 *   E. Venture Lab "Service" (verb) / "Financial Services" (the suite).
 *   F. The public-posture CLAMP in PartnerProgrammesTab.
 *   G. The Locker lands on credentials, collapsed, with Location last.
 *
 * Every block below carries denial AND reachability where a gate is involved
 * (Composed Liveness corollary 6): a denial-only suite passes at its maximum
 * when the surface is unreachable by everyone. Expected tab sets are written
 * out as literal slug lists rather than re-derived from the same predicate the
 * code under test uses — a re-derived expectation is tautological and passes
 * whatever the gate does.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { getEnabledTabs } from '../app/hooks/useCodexConfig';
import type { ParticipationAccessState } from '../services/passport/participationTabGate';
import {
  VENTURE_LAB_CODEX,
  IRL_CARTRIDGE,
  IRL_OS_CARTRIDGE,
  CODEX_DEFINITIONS,
} from '../data/codex-configs';
import type { CodexConfig } from '../data/codex-configs';
import { execSync } from 'node:child_process';

const NO_ACCESS: ParticipationAccessState = { loaded: true, grants: [] };
const LOCKER_PATH = 'app/triad/components/codex/tabs/LockerTab.tsx';
const WORKSPACE_TAB_PATH = 'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx';
const HORIZEN = 'horizen-pilot-series-001';

/** The real tab filter, driven exactly as CodexPanelDynamic drives it. */
function enabled(
  codex: CodexConfig,
  opts: { isAdmin?: boolean; cartridgeSlugs?: string[]; access?: ParticipationAccessState } = {},
) {
  const isAdmin = opts.isAdmin === true;
  return getEnabledTabs(
    codex,
    isAdmin,
    false,
    false,
    new Set(),
    { isGlobalAdmin: isAdmin, cartridgeSlugs: new Set(opts.cartridgeSlugs ?? []) },
    opts.access ?? NO_ACCESS,
  );
}

const slugsInGroup = (
  codex: CodexConfig,
  group: string,
  opts?: Parameters<typeof enabled>[1],
): string[] => enabled(codex, opts).filter((t) => t.group === group).map((t) => t.slug).sort();

// ─── A. Administer is gated on PLATFORM admin ───────────────────────────────

describe('A — the Administer group answers to platform admin, never a cartridge admin flag', () => {
  it('the group declares the gate, and every tab inside it carries it too', () => {
    const administer = (VENTURE_LAB_CODEX.tabGroups ?? []).find((g) => g.id === 'administer');
    expect(administer, 'the Administer group was removed').toBeTruthy();
    expect(administer!.adminOnly).toBe(true);
    const tabs = VENTURE_LAB_CODEX.tabs.filter((t) => t.group === 'administer');
    expect(tabs.length, 'the Administer group is empty — the gate guards nothing').toBeGreaterThan(0);
    for (const t of tabs) {
      // Group-level adminOnly is enforced only in `visibleGroups`; a tab inside
      // an adminOnly group that is not itself adminOnly is still reachable by a
      // direct `?tab=` deep link, which bypasses the chip entirely.
      expect(t.adminOnly, `${t.id} relies on the GROUP gate — a ?tab= deep link reaches it`).toBe(true);
    }
  });

  it('a per-cartridge venture-lab admin grant opens NOTHING in Administer', () => {
    // The operator's actual question: could a partner administrator satisfy it?
    // `cartridgeAdminGrants` is a separate argument that getEnabledTabs consults
    // only for `adminOfCartridge` — never for `adminOnly`. Driven, not asserted.
    expect(
      slugsInGroup(VENTURE_LAB_CODEX, 'administer', { isAdmin: false, cartridgeSlugs: ['venture-lab'] }),
      'a cartridge-admin grant opened the internal Administer group',
    ).toEqual([]);
  });

  it('a platform admin opens exactly Plan Pricing and α Docs — the gate admits somebody', () => {
    expect(slugsInGroup(VENTURE_LAB_CODEX, 'administer', { isAdmin: true })).toEqual([
      'alpha-docs',
      'plan-pricing',
    ]);
  });

  it('the two admin notions stay separate in the filter source', () => {
    // The structural property behind the behavioural assertions above: the
    // adminOnly branch must not consult the cartridge grant set, and the group
    // gate must read the platform flag.
    const hook = stripComments(readSource('app/hooks/useCodexConfig.ts'));
    expect(hook).toMatch(/if \(tab\.adminOnly && !isAdmin\) return false;/);
    expect(hook).toMatch(/if \(tab\.adminOfCartridge\)/);
    const panel = stripComments(readSource('app/triad/components/CodexPanelDynamic.tsx'));
    expect(panel).toMatch(/if \(g\.adminOnly && !isAdmin\) return false;/);
    // The ASSIGNMENT, not the prop declaration: `isAdmin?: boolean` in the
    // props interface would satisfy a looser match while the value came from
    // anywhere at all.
    expect(panel).toMatch(/const isAdmin = isAdminProp === true;/);
  });
});

// ─── B. AgentiQ OS α moved to Grow and became public ────────────────────────

describe('B — AgentiQ OS α is a public Grow surface, not an internal one', () => {
  it('it sits in Grow with no admin gate', () => {
    const tab = VENTURE_LAB_CODEX.tabs.find((t) => t.id === 'agentiq-os-vl');
    expect(tab, 'agentiq-os-vl was removed').toBeTruthy();
    expect(tab!.group).toBe('grow');
    expect(tab!.adminOnly).toBeFalsy();
    expect(tab!.slug, 'the slug moved — the partner registry deep link that targets it would dangle').toBe(
      'agentiq-os-vl',
    );
  });

  it('a caller with nothing at all actually reaches it — through the real filter', () => {
    // EXACT set: Grow's public members. α Programme stays adminOnly, so a
    // `toContain` alone would stay green if it silently opened alongside.
    expect(slugsInGroup(VENTURE_LAB_CODEX, 'grow')).toEqual(['agentiq-os-vl', 'growth-matrix']);
  });

  it('and an admin sees α Programme too — the Grow gate still separates the two', () => {
    expect(slugsInGroup(VENTURE_LAB_CODEX, 'grow', { isAdmin: true })).toEqual([
      'agentiq-os-vl',
      'alpha-programme',
      'growth-matrix',
    ]);
  });
});

// ─── C. The Passport Registry tab is gone from both Labs ────────────────────

describe('C — the Passport Registry left both Labs, and left no dangling link', () => {
  const REMOVED = ['irl-passport-registry', 'irl-os-passport-registry'] as const;

  it('neither Lab cartridge declares it any more', () => {
    for (const codex of [IRL_CARTRIDGE, IRL_OS_CARTRIDGE]) {
      for (const removed of REMOVED) {
        expect(codex.tabs.find((t) => t.id === removed), `${codex.slug} still declares ${removed}`).toBeUndefined();
        expect(
          codex.tabs.find((t) => t.slug === removed),
          `${codex.slug} still declares the slug ${removed}`,
        ).toBeUndefined();
      }
      // The component itself is not mounted anywhere in either Lab.
      expect(codex.tabs.filter((t) => t.config.component === 'PassportRegistryTab')).toEqual([]);
    }
  });

  it('the public record still HAS a home — the removal did not delete the surface', () => {
    // Liveness. Removing the last entrance to the public passport record would
    // pass every assertion above while destroying the thing.
    const homes = CODEX_DEFINITIONS.flatMap((c) =>
      c.tabs.filter((t) => t.enabled && t.config.component === 'PassportRegistryTab').map((t) => `${c.slug}:${t.slug}`),
    );
    expect(homes.length, 'the Passport Registry has no entrance left anywhere').toBeGreaterThan(0);
    expect(homes, 'the AgentiQ OS entrance the deep link now targets is gone').toContain(
      'agentiq-os:os-passport-registry',
    );
  });

  it('every guided-onboarding deep link resolves to a real, enabled tab', async () => {
    // The defect this catches is silent: an unknown `?tab=` does not 404, it
    // lands the principal on the cartridge default. Resolve each link the way
    // the embed route does rather than pinning the string.
    const { passportDeepLinks } = await import('../services/constitutional/guidedOnboarding');
    const links = passportDeepLinks({ from: 'canary' });
    expect(Object.keys(links).sort()).toEqual(['apply', 'delegation', 'locker', 'registry']);
    for (const [name, url] of Object.entries(links)) {
      const parsed = new URL(url, 'https://example.invalid');
      const slug = parsed.pathname.split('/').filter(Boolean).pop()!;
      const tabSlug = parsed.searchParams.get('tab');
      const codex = CODEX_DEFINITIONS.find((c) => c.slug === slug);
      expect(codex, `passportDeepLinks().${name} targets unknown codex '${slug}'`).toBeTruthy();
      const tab = codex!.tabs.find((t) => t.slug === tabSlug && t.enabled);
      expect(tab, `passportDeepLinks().${name} targets unknown/disabled tab '${tabSlug}' in '${slug}'`).toBeTruthy();
    }
  });

  it('no source file still POINTS a link at either removed slug', () => {
    // Repo-level, not file-level: a second inbound link added later in another
    // module is exactly the case a single-file assertion would miss. Comments
    // are stripped before matching — a removal note that names the slug it
    // removed is documentation, not a link (the grep-vs-comment defect class
    // tests/_lib/sourceAuthority.ts exists for).
    const candidates = execSync('git grep -l -E "irl-(os-)?passport-registry" -- "*.ts" "*.tsx" || true', {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      // This canary must be allowed to name the slugs it forbids.
      .filter((f) => f !== 'tests/lab-tab-restructure-and-locker-ux.test.ts');
    const offenders = candidates.filter((f) => /irl-(os-)?passport-registry/.test(stripComments(readSource(f))));
    expect(offenders, 'a source file still references a removed Passport Registry tab in CODE').toEqual([]);
  });
});

// ─── D. Steward — investigated, NOT widened ─────────────────────────────────

describe('D — the Steward surfaces are already invisible to non-admins (verified, not changed)', () => {
  // The operator asked that Steward "only be visible/rendered to parties who
  // have authorized access. Those without should not see it at all." Both tabs
  // were ALREADY adminOnly, held there by two ratified canaries. Widening a
  // ratified admin gate would need explicit consent that does not exist, so
  // this block VERIFIES the behaviour the operator described and changes
  // nothing. If a non-admin could see either tab, that would be a bug to fix
  // (a tightening); these assertions are what would have caught it.

  const STEWARDS: Array<{ codex: CodexConfig; group: string; id: string; openSlugs: string[] }> = [
    {
      codex: VENTURE_LAB_CODEX,
      group: 'participate',
      id: 'venture-participate-steward',
      // Written out, not derived: the set an ordinary venture-lab participant
      // reaches in the Participate group. Includes the moved-in Public
      // Workspace; excludes the admin-gated Steward.
      openSlugs: [
        'partner-programmes',
        'venture-participate-apply',
        'venture-participate-delegation',
        'venture-participate-locker',
        'venture-participate-overview',
        'venture-participate-standing',
      ],
    },
    {
      codex: IRL_CARTRIDGE,
      group: 'participation',
      id: 'irl-passport-steward',
      // 'irl-workspace' briefly lived in THIS group (2026-07-29, first
      // ruling); the SAME-DAY correction elevated it to its own top-level
      // `workspace` group instead (see the long comment on
      // `IRL_CARTRIDGE.tabGroups` in data/codex-configs.ts) — it is no
      // longer a member of `participation`, so it does not appear here.
      openSlugs: [
        'irl-participation-overview',
        'irl-participation-standing',
        'irl-passport-apply',
        'irl-passport-delegation',
        'irl-passport-locker',
      ],
    },
    {
      codex: IRL_OS_CARTRIDGE,
      group: 'participation',
      id: 'irl-os-passport-steward',
      openSlugs: [
        'irl-os-participation-overview',
        'irl-os-participation-standing',
        'irl-os-passport-apply',
        'irl-os-passport-delegation',
        'irl-os-passport-locker',
      ],
    },
  ];

  /** The strongest NON-admin caller available: a workspace-steward with a real
   *  pilot scope in both Lab domains. If any grant could open the tab, this
   *  one would. */
  const delegatedSteward: ParticipationAccessState = {
    loaded: true,
    grants: [
      { accessDomain: 'venture-lab', role: 'workspace-steward', allowedScopes: [HORIZEN] },
      { accessDomain: 'research-lab', role: 'workspace-steward', allowedScopes: [HORIZEN] },
    ],
  };

  it('no non-admin caller — including a delegated steward grant-holder — sees a Steward tab', () => {
    for (const s of STEWARDS) {
      const declared = s.codex.tabs.find((t) => t.id === s.id);
      expect(declared, `${s.codex.slug} lost its Steward tab`).toBeTruthy();
      expect(declared!.adminOnly, `${s.id} is no longer admin-gated`).toBe(true);
      const seen = enabled(s.codex, { isAdmin: false, access: delegatedSteward }).map((t) => t.id);
      expect(seen, `${s.id} is visible to a non-admin`).not.toContain(s.id);
    }
  });

  it('the group they live in STILL renders for that caller — hiding one tab must not hide the group', () => {
    // MS-9 hides a group whose every tab is gated away. The operator's
    // requirement is that Steward disappears, not that Participation does — and
    // a suite that only asserted the denial would pass if the whole group went
    // dark. Exact, literal sets per cartridge.
    for (const s of STEWARDS) {
      expect(
        slugsInGroup(s.codex, s.group, { isAdmin: false, access: delegatedSteward }),
        `${s.codex.slug}'s ${s.group} group is not what a participant should see`,
      ).toEqual([...s.openSlugs].sort());
    }
  });

  it('an admin DOES see every Steward tab — the gate admits its intended holder', () => {
    for (const s of STEWARDS) {
      const seen = enabled(s.codex, { isAdmin: true }).map((t) => t.id);
      expect(seen, `${s.id} is unreachable even by an admin`).toContain(s.id);
    }
  });

  it('the delegated-steward authority is served by a DIFFERENT surface, server-derived', () => {
    // Why the tab stays admin-gated even though delegated stewards exist: the
    // second tier is the Partner group's Collaborate view, which mounts the
    // SAME component on the venture domain, and the issuing authority is
    // derived server-side from the caller's own grants.
    const route = readSource('app/api/steward/participation/route.ts');
    expect(route).toMatch(/participationAccess/);
    const partnerTab = stripComments(readSource(WORKSPACE_TAB_PATH));
    expect(partnerTab).toContain('<StewardParticipationTab');
    expect(partnerTab).toContain('initialDomain={accessDomain}');
    const collaborate = VENTURE_LAB_CODEX.tabs.find((t) => t.id === 'partner-collaborate');
    expect(collaborate!.adminOnly, 'the Tier-2 issuing surface became admin-only — the two tiers collapsed').toBeUndefined();
    expect(collaborate!.participationRoles).toEqual(
      expect.arrayContaining(['partner-operator', 'workspace-steward']),
    );
  });
});

// ─── E. Service (verb) / Financial Services (the suite) ─────────────────────

describe('E — Venture Lab tab-group labels are verbs; the suite names itself', () => {
  it('the group is "Service", and the sub menu member is "Financial Services"', () => {
    const group = (VENTURE_LAB_CODEX.tabGroups ?? []).find((g) => g.id === 'service');
    expect(group, 'the Service group was removed').toBeTruthy();
    expect(group!.label).toBe('Service');
    expect(group!.label, 'the superseded plural came back').not.toBe('Services');

    const parent = VENTURE_LAB_CODEX.tabs.find((t) => t.id === 'financial-services');
    const sub = (parent!.subTabs ?? []).find((s) => s.id === 'vl-services-financial');
    expect(sub, 'the Service sub menu lost its Financial Services member').toBeTruthy();
    expect(sub!.label).toBe('Financial Services');
  });

  it('every Venture Lab tab-group label is one of the seven ratified verbs', () => {
    // The RULE the operator gave, not just the one label it corrected. Pinning
    // only 'Service' would let the next group ship as 'Programmes'.
    const labels = (VENTURE_LAB_CODEX.tabGroups ?? []).map((g) => g.label).sort();
    expect(labels).toEqual(['Administer', 'Connect', 'Grow', 'Operate', 'Participate', 'Partner', 'Service']);
  });

  it('the superseded 2026-07-28 comment was rewritten, not left contradicting the code', () => {
    // A stale comment that still says "Services (plural)" next to `label:
    // 'Service'` teaches the next agent to "fix" the code back.
    const src = readSource('data/codex-configs.ts');
    const start = src.indexOf('tabGroups: [', src.indexOf('VENTURE_LAB_CODEX'));
    const groupBlock = src.slice(start, src.indexOf("{ id: 'grow',", start));
    expect(groupBlock).toMatch(/"Service" \(singular\)/);
    expect(groupBlock).toMatch(/SUPERSEDES/);
    expect(groupBlock, 'the superseded plural ruling is still stated as current').not.toMatch(
      /"Services" \(plural\) — the domain holds/,
    );
  });
});

// ─── F. The public-posture clamp ────────────────────────────────────────────

describe('F — the public workspace posture cannot open a private area', () => {
  it('the allowlist excludes every private surface', () => {
    const src = stripComments(readSource(WORKSPACE_TAB_PATH));
    const decl = src.match(/const PUBLIC_SURFACES: readonly SubSurface\[\] = \[([^\]]*)\]/);
    expect(decl, 'PUBLIC_SURFACES was removed or renamed — the clamp is gone').toBeTruthy();
    const allowed = decl![1]
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    expect(allowed).toEqual(['overview']);
    // RE-POINTED 2026-07-29: the private-surface list grew with the Research
    // Lab's six added views (SPEC-IRL-WORKSPACE-001 §7). Every one of them must
    // stay out of the public allowlist, so the check widened with the surface
    // rather than continuing to guard only the six it was written against.
    for (const priv of [
      'collaborate', 'operate', 'evidence', 'communicate', 'administration',
      'pipeline', 'review', 'working-materials', 'locker', 'qubetalk', 'participants',
    ]) {
      expect(allowed, `'${priv}' entered the public allowlist`).not.toContain(priv);
    }
  });

  it('the clamp is APPLIED — both to the opened surface and to the surface row', () => {
    // An allowlist that nothing reads is an inert mechanism (MS-7): a defect
    // even though nothing errors.
    //
    // RE-POINTED, and STRICTLY STRONGER. `surfaceAllowed` now takes the Lab
    // (`kind`) as well as the posture, and enforces BOTH: a venture entrance
    // can never reach a research view and vice versa, on top of the public
    // clamp. The assertions below pin both conditions, so removing either the
    // Lab check or the posture check fails here.
    const src = stripComments(readSource(WORKSPACE_TAB_PATH));
    expect(src, 'the opened surface is not clamped').toMatch(
      /surfaceAllowed\(requestedSurface, visibility, kind\)/,
    );
    expect(src, 'the in-component surface row is not clamped').toMatch(
      /*
       * Whitespace-tolerant since 2026-08-03: the admin-only Steward filter was
       * chained onto this call, so it now spans lines. The CLAMP is what is
       * pinned — that the row is filtered through `surfaceAllowed` — not its
       * formatting. A canary that fails on a line break tests the layout, not
       * the gate.
       */
      /KIND_SURFACES\[kind\]\s*\.filter\(\(s\) => s !== "administration" && surfaceAllowed\(s, visibility, kind\)\)/,
    );
    // …and `surfaceAllowed` must actually consult BOTH gates, not be a stub.
    expect(src, 'the Lab gate is missing from surfaceAllowed').toMatch(
      /if \(!KIND_SURFACES\[kind\]\.includes\(surface\)\) return false;/,
    );
    expect(src).toMatch(/return visibility === "private" \|\| PUBLIC_SURFACES\.includes\(surface\)/);
    // The header must read the visibility-keyed name, or the public entrance
    // renders under the private one's title.
    expect(src).toMatch(/\{copy\.surfaceName\[visibility\]\}/);
  });

  it('the Lab clamp is real: neither Lab offers the other’s surfaces', () => {
    // Driven from the shipped constant rather than grepped, so a KIND_SURFACES
    // edit that merged the two lists fails here even though every grep above
    // still matches.
    const src = stripComments(readSource(WORKSPACE_TAB_PATH));
    const venture = src.match(/venture: \[([^\]]*)\]/)![1];
    for (const research of ['pipeline', 'review', 'working-materials', 'locker', 'qubetalk', 'participants']) {
      expect(venture, `the venture entrance offers '${research}'`).not.toContain(`"${research}"`);
    }
    // The venture list was pinned member-for-member here for
    // SPEC-IRL-WORKSPACE-001 acceptance criterion 3 ("existing Venture Lab
    // workspaces remain unchanged") — that criterion guarded against the
    // Research Lab's views bleeding into Venture's list during THAT
    // migration, not against a later, deliberate Venture Lab addition. On
    // 2026-07-31, operator-directed, PRD-GJR-001 (Guided Journey Runtime)
    // added ONE new venture-only surface, "journey" — the first change to
    // this list since the freeze, with the same "no research view crosses
    // over" clamp verified above still holding.
    expect(
      venture.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean),
    /*
     * `steward` added 2026-08-03, operator-directed: the Polity Passport
     * Bureau's Review Queue mirrored into the Venture Lab so a Delegate
     * Passport application raised by the Journey can be decided without
     * leaving the cartridge. Same reasoning as `journey`'s addition above —
     * this list guarded against the Research Lab's views BLEEDING IN during
     * that migration; it was never a permanent bar on a deliberate Venture
     * Lab surface. The mirror mounts the Bureau's own component and carries
     * its adminOnly gate (ADMIN_ONLY_SURFACES).
     */
    ).toEqual(['overview', 'collaborate', 'journey', 'operate', 'evidence', 'communicate', 'steward', 'administration']);
  });

  it('every mount declares its posture consistently with its group', () => {
    const mounts = [...VENTURE_LAB_CODEX.tabs, ...IRL_CARTRIDGE.tabs].filter(
      (t) => t.config.component === 'PartnerProgrammesTab',
    );
    expect(mounts.length).toBeGreaterThan(5);
    const publicMounts = mounts.filter(
      (m) => (m.config.props as Record<string, unknown> | undefined)?.workspaceVisibility === 'public',
    );
    // Exactly one public entrance today, and it is the Participate one.
    expect(publicMounts.map((m) => m.id)).toEqual(['partner-programmes']);
    expect(publicMounts[0].group).toBe('participate');
    for (const m of publicMounts) {
      expect(
        (m.config.props as Record<string, unknown>).initialSurface,
        `${m.id} is public but opens a private area`,
      ).toBe('overview');
    }
  });
});

// ─── G. The Locker ──────────────────────────────────────────────────────────

describe('G — the Locker lands on credentials, collapsed, with Location last', () => {
  const HEADINGS = [
    '>My Credentials & Relationships<',
    '>Agent Channels<',
    '>Peer Exchange<',
    'Upload to locker',
    '>Invitation<',
    '>Location Tracking<',
  ] as const;

  const sectionIndex = (src: string, marker: string) => {
    const i = src.indexOf(marker);
    expect(i, `the Locker section marker '${marker}' is gone — this canary can no longer see the order`).toBeGreaterThan(
      -1,
    );
    return i;
  };

  it('My Credentials & Relationships renders first and Location Tracking renders last', () => {
    // Pinned to the RENDERED HEADING, not to a comment: a comment can be
    // reordered without moving the section, and a section can be moved without
    // touching its comment. The full ORDER is asserted, so neither "a section
    // above credentials" nor "a section below location" can slip through a
    // pairwise comparison.
    const src = readSource(LOCKER_PATH);
    const ordered = HEADINGS.map((m) => ({ m, i: sectionIndex(src, m) }))
      .sort((a, b) => a.i - b.i)
      .map((x) => x.m);
    expect(ordered[0], 'a section now renders above My Credentials & Relationships').toBe(
      '>My Credentials & Relationships<',
    );
    expect(ordered[ordered.length - 1], 'Location Tracking is not the last section').toBe('>Location Tracking<');
    // And explicitly the reversal the operator asked for.
    expect(sectionIndex(src, '>My Credentials & Relationships<')).toBeLessThan(
      sectionIndex(src, '>Location Tracking<'),
    );
  });

  it('every collapsible section defaults to COLLAPSED', () => {
    const src = stripComments(readSource(LOCKER_PATH));
    const states = [
      'passportCardCollapsed',
      'qubeTalkCollapsed',
      'peerExchangeCollapsed',
      'uploadCollapsed',
      'invitationCollapsed',
      'locationCollapsed',
    ];
    for (const s of states) {
      // The ASSIGNMENT, matched per-state: a bare `useState(true)` somewhere
      // else in the file must not satisfy the check for a different panel.
      const re = new RegExp(`const \\[${s}, set[A-Za-z]+\\] = useState\\(true\\)`);
      expect(re.test(src), `${s} does not default to collapsed`).toBe(true);
    }
  });

  it('a code-bearing deep link still lands the invitee on a VISIBLE input', () => {
    // Collapsing Invitation by default is only SAFE because of this. Behaviour
    // is source-level here (the effect reads window.location), so the assertion
    // is the exact expand call inside the code branch — not merely that the
    // setter appears somewhere in the file.
    const src = stripComments(readSource(LOCKER_PATH));
    expect(src).toMatch(/const code = params\.get\('x409'\) \|\| params\.get\('invite'\)/);
    expect(src, 'the deep link no longer expands the invitation panel').toMatch(
      /if \(code\) \{[^}]*setInvitationCollapsed\(false\)/,
    );
  });

  it('work in flight forces its panel open — a collapsed panel may never hide a running action', () => {
    // Terminal Outcome Observability: "Encrypting + publishing…" that the
    // holder cannot see is indistinguishable from nothing happening.
    const src = stripComments(readSource(LOCKER_PATH));
    expect(src).toMatch(/const uploadOpen = !uploadCollapsed \|\| uploadBusy;/);
    expect(src).toMatch(/const invitationOpen = !invitationCollapsed \|\| x409ClaimBusy;/);
    expect(src, 'the newly-collapsible Location panel can hide an in-flight checkpoint').toMatch(
      /const locationOpen = !locationCollapsed \|\| locationBusy;/,
    );
    // …and each derived flag must actually drive its render, or it is an inert
    // mechanism (MS-7).
    for (const flag of ['uploadOpen', 'invitationOpen', 'locationOpen']) {
      expect(new RegExp(`\\{${flag} && \\(`).test(src), `${flag} is computed but never rendered on`).toBe(true);
    }
  });

  it('the Locker keeps the slate house style on its collapse chrome', () => {
    const src = readSource(LOCKER_PATH);
    expect(src, 'a white hairline entered the Locker').not.toMatch(/border-white\/\d/);
    expect(src).not.toMatch(/rgba\(255,\s*255,\s*255/);
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MIRRORED STEWARD QUEUE CARRIES THE ORIGINAL'S GATE (2026-08-03)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Operator-directed: the Polity Passport Bureau's Review Queue is mirrored into
 * the Venture Lab so a Delegate Passport application raised by the Journey can
 * be decided without leaving the cartridge.
 *
 * Two things must hold, and neither is obvious from the feature request:
 *
 *   1. The SAME component is mounted, never a second queue. Two review
 *      surfaces that could disagree about which applications are open is the
 *      defect class inv.engineering.036/037 names.
 *   2. Mirroring must not become a route around an access gate. The Bureau's
 *      tab is `adminOnly: true`; the mirror is gated in the nav AND at the
 *      render, so a deep link or a restored surface cannot reach it either.
 *      CLAUDE.md's Security rule: never weaken a gate.
 */
describe('the Venture Lab Steward mirror reuses the Bureau queue and its gate', () => {
  const partnerSrc = readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx');
  const configSrc = readSource('data/codex-configs.ts');

  it('mounts the Bureau’s OWN component, not a second queue implementation', () => {
    expect(partnerSrc).toMatch(/import \{ PassportBureauStewardTab \} from "\.\/PassportBureauStewardTab"/);
    expect(partnerSrc).toMatch(/surface === "steward" && isAdmin/);
  });

  it('the source tab it mirrors is adminOnly — so the mirror inherits a real gate', () => {
    // If the Bureau tab ever stopped being adminOnly, the mirror's gate would
    // be guarding something no longer restricted; that is worth knowing.
    const bureauTab = configSrc.slice(configSrc.indexOf("id: 'passport-bureau-steward'"));
    expect(bureauTab.slice(0, 400)).toMatch(/adminOnly: true/);
  });

  it('the tab is not OFFERED to a non-admin', () => {
    expect(partnerSrc).toMatch(/\.filter\(\(s\) => !ADMIN_ONLY_SURFACES\.includes\(s\) \|\| isAdmin\)/);
    expect(partnerSrc).toMatch(/const ADMIN_ONLY_SURFACES: readonly SubSurface\[\] = \["steward"\]/);
  });

  it('the tab is not RENDERED for a non-admin either — a deep link cannot reach it', () => {
    /*
     * THE ASSERTION THAT FAILS ON THE DEFECT. Hiding a tab is presentation;
     * `initialSurface`, a restored view or a deep link can all set `surface`
     * directly, so the render must gate independently of the nav.
     */
    const render = partnerSrc.slice(partnerSrc.indexOf('surface === "steward"'));
    expect(render.slice(0, 120), 'the steward render is not admin-gated').toContain('isAdmin');
  });
});
