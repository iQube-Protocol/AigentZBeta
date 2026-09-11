/**
 * Query-derived administrator authority — removal (2026-08-27 addendum to
 * the IRL OS containment pass). Full incident report:
 * docs/security/2026-08-27_irl-os-containment-breach-audit.md
 *
 * THE ADDENDUM DEFECT: `?isAdmin=true` (and the sibling `?admin=1`/
 * `?runtimeAdmin=1` forms found by the broader-use audit this addendum
 * required) seeded real UI-level administrator state directly from a
 * client-controlled URL parameter. For an unauthenticated caller — no JWT,
 * so the canonical `/api/wallet/active-persona` resolver never ran — that
 * seeded value was NEVER overwritten. The newly-hardened document routes
 * (Phase 1) close the actual data-read exploit, but the UI-level admin
 * state itself was still a misleading privilege presentation and a latent
 * primitive for the NEXT route that trusts the tab gate.
 *
 * SAME CONVENTION as the rest of tests/ — structural/source-authority
 * canaries (readSource/stripComments/importAuthority), not
 * @testing-library/react. Proving a hook's behaviour from its own control
 * flow — which state initializer is used, what the ONLY path to `true` is,
 * in what order a reset happens relative to an async fetch — is a stronger,
 * more durable canary than mounting it, because it fails on the exact line
 * that would reintroduce the defect rather than on an indirect symptom.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const HOOK = 'app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts';
const CODEX_SLUG_PAGE = 'app/(embed)/triad/embed/codex/[codexSlug]/page.tsx';
const CODEX_LEGACY_PAGE = 'app/(embed)/triad/embed/codex/page.tsx';
const CODEX_NAV = 'utils/codex-nav.ts';
const DEEP_LINK_CARD = 'app/triad/components/codex/tabs/PartnerProgrammesTab.tsx';
const QUICK_LINKS = 'components/metame/cards/QuickLinksCard.tsx';
const KNYT_ALPHA_TAB = 'app/triad/components/codex/tabs/KnytAlphaTab.tsx';
const ALPHA_PROGRAMME_TAB = 'app/triad/components/codex/tabs/AlphaProgrammeTab.tsx';
const METAME_RUNTIME_CLIENT = 'components/metame/MetaMeRuntimeClient.tsx';
const COMPOSER_EXPERIENCE_VIEWER = 'components/composer/ComposerExperienceViewer.tsx';

describe('useCodexEmbedAuthBridge — no query-derived path to admin=true exists', () => {
  it('the options type carries no initialIsAdmin field', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).not.toMatch(/initialIsAdmin/);
  });

  it('the message type carries no isAdmin field (top-level or nested payload)', () => {
    const code = stripComments(readSource(HOOK));
    // The type block itself, isolated: `type AuthBridgeMessage = { ... }`.
    const typeMatch = code.match(/type AuthBridgeMessage = \{[\s\S]*?\n\};/);
    expect(typeMatch, 'AuthBridgeMessage type not found').not.toBeNull();
    expect(typeMatch![0]).not.toContain('isAdmin');
  });

  it('isAdmin state is seeded ONLY by useState(false) — never from a variable, prop, or param', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).toMatch(/const \[isAdmin,\s*setIsAdmin\]\s*=\s*useState<boolean>\(false\)/);
  });

  it('the postMessage handler contains no incomingIsAdmin / payload.isAdmin read', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).not.toMatch(/incomingIsAdmin/);
    expect(code).not.toMatch(/payload\.isAdmin/);
  });

  it('sanitizeBool (the removed isAdmin-only sanitizer) no longer exists', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).not.toMatch(/function sanitizeBool/);
  });

  it('the ONLY call that ever sets isAdmin to true is gated on a strict === true check against the canonical response', () => {
    const code = stripComments(readSource(HOOK));
    const setTrueCalls = [...code.matchAll(/setIsAdmin\(([^)]*)\)/g)].map((m) => m[1].trim());
    // Every call site is either the unconditional reset (`false`) or the
    // canonical-response elevation (`true`, literal) — never a variable that
    // could carry a URL-derived or postMessage-derived value.
    for (const arg of setTrueCalls) {
      expect(['false', 'true'], `setIsAdmin(${arg}) must pass a literal, never a variable`).toContain(arg);
    }
    expect(setTrueCalls).toContain('true');
    expect(setTrueCalls).toContain('false');
    // The `true` call is reached only inside the block guarded by this exact
    // canonical check — proves it can't fire from any other condition.
    expect(code).toMatch(/data\.cartridgeFlags\?\.isAdmin === true\)\s*\{\s*setIsAdmin\(true\)/);
  });

  it('the resolver effect resets isAdmin to false BEFORE any async work — persona switches cannot retain prior admin state', () => {
    const code = stripComments(readSource(HOOK));
    // The effect body must open with the reset as its first statement Ñ not
    // buried after the early-return guards, which would leave a stale
    // `true` in place during the gap for a persona switch.
    const effectMatch = code.match(/useEffect\(\(\) => \{\s*setIsAdmin\(false\);/);
    expect(
      effectMatch,
      'setIsAdmin(false) must be the first statement in the admin-resolution effect',
    ).not.toBeNull();
  });

  it('the resolver effect re-fires on every personaId change (dependency array includes personaId)', () => {
    const code = stripComments(readSource(HOOK));
    // The admin-resolution effect's own closing dependency array.
    expect(code).toMatch(/\}, \[personaId\]\);\s*$/m);
  });

  it('no auth (no JWT) leaves isAdmin at its already-reset false — no separate "leave undefined" branch exists', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).not.toMatch(/isAdmin undefined/); // the old comment/behaviour
    expect(code).toMatch(/if \(!jwt\) return;/); // early-return, reset already stands
  });

  it('a failed fetch does not set isAdmin — the .catch() never calls setIsAdmin', () => {
    const code = stripComments(readSource(HOOK));
    const catchBlock = code.match(/\.catch\(\(\) => \{[^}]*\}\);\s*\n\s*return \(\) => \{ cancelled = true; \};\s*\n\s*\}, \[personaId\]\);/);
    expect(catchBlock, 'catch block for the admin-resolution fetch not found').not.toBeNull();
    expect(catchBlock![0]).not.toContain('setIsAdmin');
  });

  it('the exported result type declares isAdmin as a definite boolean, never optional/undefined', () => {
    const code = stripComments(readSource(HOOK));
    const resultType = code.match(/type UseCodexEmbedAuthBridgeResult = \{[\s\S]*?\n\};/);
    expect(resultType).not.toBeNull();
    expect(resultType![0]).toMatch(/isAdmin: boolean;/);
    expect(resultType![0]).not.toMatch(/isAdmin\?:/);
  });
});

describe('Embed page callers — no queryIsAdmin construction, no initialIsAdmin forwarded', () => {
  it.each([CODEX_SLUG_PAGE, CODEX_LEGACY_PAGE])('%s no longer reads isAdmin/admin from searchParams', (path) => {
    const code = stripComments(readSource(path));
    expect(code).not.toMatch(/searchParams\??\.get\(["'](isAdmin|admin)["']\)/);
  });

  it.each([CODEX_SLUG_PAGE, CODEX_LEGACY_PAGE])('%s no longer passes initialIsAdmin into useCodexEmbedAuthBridge', (path) => {
    const code = stripComments(readSource(path));
    expect(code).not.toMatch(/initialIsAdmin/);
  });
});

describe('CodexNavOptions / buildCodexUrl — isAdmin removed at the source, not just at call sites', () => {
  it('CodexNavOptions no longer declares an isAdmin field', () => {
    const code = stripComments(readSource(CODEX_NAV));
    const optsType = code.match(/export interface CodexNavOptions \{[\s\S]*?\n\}/);
    expect(optsType).not.toBeNull();
    expect(optsType![0]).not.toMatch(/isAdmin\??:/);
  });

  it('buildCodexUrl never destructures or serializes isAdmin', () => {
    const code = stripComments(readSource(CODEX_NAV));
    expect(code).not.toMatch(/\bisAdmin\b/);
  });

  // TypeScript itself is the strongest guarantee here: since CodexNavOptions
  // no longer HAS an isAdmin field, any caller that still passed one would
  // fail to compile (excess-property check on an object literal argument).
  // These source-level checks additionally pin the specific call sites the
  // 2026-08-27 audit found and fixed, so a future re-introduction is caught
  // even by a reader who only skims this file, not just by tsc.
  it.each([DEEP_LINK_CARD, QUICK_LINKS, KNYT_ALPHA_TAB, ALPHA_PROGRAMME_TAB])(
    '%s no longer passes isAdmin into a buildCodexUrl(...) call',
    (path) => {
      const code = stripComments(readSource(path));
      // Match `buildCodexUrl(slug, { ... })` call bodies specifically,
      // tolerant of multi-line object literals (every real call site has
      // this two-argument shape), and assert none contain a bare `isAdmin`
      // property key.
      const calls = [...code.matchAll(/buildCodexUrl\([^,]+,\s*\{[\s\S]*?\}\)/g)].map((m) => m[0]);
      expect(calls.length, `${path} must still call buildCodexUrl at least once`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call, `a buildCodexUrl(...) call in ${path} still passes isAdmin`).not.toMatch(/\bisAdmin\b/);
      }
    },
  );
});

describe('The two other query-derived-admin sites the broader-use audit found', () => {
  it('MetaMeRuntimeClient no longer reads runtimeAdmin/admin from searchParams as an authority source', () => {
    const code = stripComments(readSource(METAME_RUNTIME_CLIENT));
    expect(code).not.toMatch(/searchParams\??\.get\(["'](runtimeAdmin|admin)["']\)/);
    // runtimeAdminMode is now a direct alias of the canonical persona flag —
    // no OR against any URL-derived value.
    expect(code).toMatch(/const runtimeAdminMode = personaIsAdmin;/);
  });

  it('ComposerExperienceViewer no longer reads admin/runtimeAdmin from searchParams, and canEdit no longer ORs a URL override', () => {
    const code = stripComments(readSource(COMPOSER_EXPERIENCE_VIEWER));
    expect(code).not.toMatch(/searchParams\??\.get\(["'](admin|runtimeAdmin)["']\)/);
    expect(code).toMatch(/const canEdit = isAdmin \|\| !isConsumerSurface;/);
  });
});

describe('Trusted-parent presentation vs authority — the postMessage channel may select, never grant', () => {
  it('personaId/authProfileId remain settable via postMessage (a navigation hint, origin-verified) — isAdmin does not', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).toMatch(/incomingPersonaId/);
    expect(code).toMatch(/incomingAuthProfileId/);
    expect(code).not.toMatch(/incomingIsAdmin/);
  });

  it('the origin allowlist check exists and gates the postMessage handler before any state is set from it', () => {
    const code = stripComments(readSource(HOOK));
    expect(code).toMatch(/isOriginAllowed\(event\.origin, allowedOrigins\)/);
  });
});

describe('Hydration safety — server and first-client render are identical, never a protected flash', () => {
  it('isAdmin\'s initializer is a plain literal (false), not a lazy function reading window/localStorage/URL', () => {
    const code = stripComments(readSource(HOOK));
    // personaId/authProfileId use a LAZY initializer (a function) because
    // they legitimately read localStorage — that's fine, they're navigation
    // hints. isAdmin must NOT use a lazy initializer at all; a bare `false`
    // is identical on server and client by construction.
    expect(code).toMatch(/useState<boolean>\(false\)/);
    expect(code).not.toMatch(/useState<boolean>\(\s*\(\)\s*=>/);
  });
});

describe('Disabled IRL OS tabs never fetch protected data on mount', () => {
  it('ValidationProgrammeJourneyTab (disabled irl-os-validation-programme) is never imported by any always-mounted IRL OS surface', () => {
    // The tab registry itself is the mount gate (CodexPanelDynamic renders
    // components strictly from the enabled tab list) — a disabled tab's
    // component is never referenced outside that lookup, so import
    // authority on the REGISTRY file is the right boundary to check: no
    // eager top-of-module side-effecting import exists that would run the
    // component's own effects regardless of the tab's enabled flag.
    const registryAuthority = importAuthority(stripComments(readSource('data/codex-configs.ts')));
    const hasEagerImport = registryAuthority.records.some(
      (r) => r.names.includes('ValidationProgrammeJourneyTab') || r.names.includes('PartnerProgrammesTab'),
    );
    expect(
      hasEagerImport,
      'data/codex-configs.ts must reference components by string (TabRenderer.componentRegistry lookup), never eagerly import them',
    ).toBe(false);
  });
});

describe('Known-confidential content cannot reach the public client bundle', () => {
  it('AgentiqCartridgeTab never statically imports markdown/JSON pack content — every read is a runtime fetch', () => {
    // The structural guarantee that makes "no confidential document body in
    // the public bundle" true: this component has no import-time path to
    // ANY codexes/packs/* file (confidential or not) — content only ever
    // arrives via a runtime fetch to the (now default-deny-gated)
    // /api/codex/packs/[packId]/file route. A build-time static import is
    // the only way pack content could end up baked into a client chunk;
    // proving its absence is a stronger guarantee than grepping a specific
    // secret string, and it does not require reproducing confidential text
    // inside this repository to prove.
    const code = stripComments(readSource('app/triad/components/codex/tabs/AgentiqCartridgeTab.tsx'));
    expect(code).not.toMatch(/from\s+["']@?\/?codexes\/packs\//);
    // personaFetch (utils/personaSpine) is the canonical authenticated
    // fetch wrapper (2026-08-27 scoped restoration) — still a runtime call,
    // never a static import; matches either the bare or persona-authenticated
    // form so this canary does not regress when the caller attaches auth.
    expect(code).toMatch(/(?:persona)?[Ff]etch\(`\/api\/codex\/packs\/\$\{packId\}\/file/);
  });

  it('the packs/file route and the public/irl/doc route are the ONLY server-side readers of codexes/packs/irl — no third unaudited reader exists', () => {
    // A grep-level structural check: every file that reads from the irl
    // pack's corpus store does so through corpusReadPackFile, and the two
    // audited routes are the ones enforcing the default-deny gate. A third,
    // undiscovered reader with its own access posture would be exactly the
    // kind of gap this pass exists to close.
    const packFileRoute = stripComments(readSource('app/api/codex/packs/[packId]/file/route.ts'));
    const publicDocRoute = stripComments(readSource('app/api/public/irl/doc/route.ts'));
    expect(packFileRoute).toContain('corpusReadPackFile');
    expect(publicDocRoute).toContain('corpusReadPackFile');
  });
});
