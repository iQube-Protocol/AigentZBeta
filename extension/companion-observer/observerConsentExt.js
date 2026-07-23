/**
 * metaMe Companion — Observer extension consent-enforcement mirror
 * (PRD-MMC-IMPL-001 §7 Increment 6).
 *
 * DELIBERATE, HAND-SYNCED DUPLICATION — flagged, not silent.
 *
 * This file re-implements, in plain JS for the extension's background
 * service worker ONLY, the exact runtime checks that
 * `services/companion/observerConsent.ts` (`isCapabilityGranted`) and
 * `services/companion/observerContext.ts` (`assertObservationRespectsGrants`)
 * already implement in TypeScript for the Next.js app. A browser extension
 * background service worker cannot `import` those `.ts` modules directly —
 * there is no build step in this extension (per CLAUDE.md's Increment 6
 * scope: a Manifest V3 extension written in plain JS needs zero bundling).
 *
 * The background service worker is the SINGLE SOURCE OF TRUTH for grant
 * state inside the extension (loaded from `chrome.storage.local`, refreshed
 * from `GET /api/companion/observer/grants` when authenticated). The content
 * script (`content.js`) NEVER maintains its own notion of "granted" — it
 * always asks the background worker via a `CHECK_GRANT` message. This file
 * is the enforcement logic the background worker runs before it forwards or
 * persists any populated observation field.
 *
 * KNOWN FOLLOW-UP RISK: this is two places (this file, and
 * `services/companion/observerContext.ts` / `services/companion/observerConsent.ts`)
 * that must be kept logically identical by hand. Any future change to the
 * TS enforcement logic must be mirrored here, and vice versa. No automated
 * parity canary exists across the TS/extension boundary today — flagged
 * explicitly per CLAUDE.md's "Source-of-truth parity is canary-enforced"
 * rule (`inv.engineering.037`: an unacknowledged parallel implementation is
 * a defect; this one is acknowledged, tracked, and the best available
 * option given the plain-JS/no-bundler constraint Increment 6 was scoped
 * under).
 */

/** Mirrors `types/companionObserver.ts`'s `emptyObserverGrantState()`. */
function emptyGrantState() {
  const state = {};
  for (const capability of OBSERVER_CAPABILITIES) {
    state[capability] = [];
  }
  return state;
}

function grantMatches(grant, scope, siteDomain) {
  if (grant.scope !== scope) return false;
  if (scope === 'site') return grant.siteDomain === siteDomain;
  return true;
}

/** Mirrors `services/companion/observerConsent.ts`'s `isCapabilityGranted`. */
function isCapabilityGranted(state, capability, siteDomain) {
  const grants = state[capability] || [];
  return grants.some((g) => {
    if (g.revokedAt) return false;
    if (g.scope === 'global') return true;
    return g.siteDomain === siteDomain;
  });
}

/** Mirrors `services/companion/observerConsent.ts`'s `scopeIsSupported`. */
function scopeIsSupported(capability, scope) {
  return (SCOPE_SUPPORT[capability] || []).includes(scope);
}

/**
 * Mirrors `services/companion/observerContext.ts`'s
 * `assertObservationRespectsGrants`. Throws if any POPULATED field on
 * `observation` corresponds to a capability that is not currently granted.
 * This is the extension-side consent-enforcement choke point — every
 * message handler in `background.js` that receives an observation MUST call
 * this before using it for anything (forwarding to the Companion API,
 * caching, logging beyond a redacted summary).
 */
function assertObservationRespectsGrants(observation, state) {
  const siteDomain = observation.currentTabDomain;

  const checks = [
    {
      populated: observation.currentTabDomain !== undefined,
      capability: 'current-tab',
      field: 'currentTabDomain',
    },
    {
      populated: observation.currentTabTitle !== undefined,
      capability: 'current-tab',
      field: 'currentTabTitle',
    },
    {
      populated: observation.selectionText !== undefined,
      capability: 'selection',
      field: 'selectionText',
    },
    {
      populated: observation.pageDocumentExcerpt !== undefined,
      capability: 'page-document',
      field: 'pageDocumentExcerpt',
    },
  ];

  for (const check of checks) {
    if (!check.populated) continue;
    if (!isCapabilityGranted(state, check.capability, siteDomain)) {
      throw new Error(
        `assertObservationRespectsGrants: observation field '${check.field}' is populated but ` +
          `capability '${check.capability}' is not currently granted` +
          (siteDomain ? ` for site '${siteDomain}'` : '') +
          '. Observed, never asserted — refusing to use this observation.',
      );
    }
  }
}
