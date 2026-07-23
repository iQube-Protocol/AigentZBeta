/**
 * metaMe Companion — Observer extension shared constants
 * (PRD-MMC-IMPL-001 §7 Increment 6).
 *
 * Loaded by both the background service worker (via `importScripts`) and the
 * content script (listed ahead of `content.js` in manifest.json's
 * `content_scripts[0].js` array) and the popup (via a plain <script> tag) —
 * a single source for the values every context needs, since this extension
 * has no bundler and no shared-module system across these three execution
 * contexts.
 *
 * ── COMPANION_APP_ORIGIN ────────────────────────────────────────────────
 *
 * Set to the operator-confirmed dev deployment origin, 2026-07-23:
 * https://dev-beta.aigentz.me (the same dev host CLAUDE.md already names for
 * other surfaces; not found declared as a literal `NEXT_PUBLIC_APP_URL` in
 * any committed env file, so it was NOT assumed here until the operator
 * explicitly confirmed it — per CLAUDE.md's "No Guessing" rule).
 * `host_permissions` in `manifest.json` is updated to match. If this
 * extension is ever pointed at a different environment (staging/production/
 * another dev deployment), both this constant and that manifest entry must
 * be updated together — Chrome enforces that a background fetch target is
 * covered by a declared host permission.
 */
const COMPANION_APP_ORIGIN = 'https://dev-beta.aigentz.me';

const COMPANION_OBSERVER_API_BASE = `${COMPANION_APP_ORIGIN}/api/companion/observer`;
const COMPANION_EMBED_URL = `${COMPANION_APP_ORIGIN}/triad/embed/companion`;

// ─── Hand-synced mirror of types/companionObserver.ts ──────────────────────
// This extension is plain JS (no build step, per CLAUDE.md Increment 6 scope
// — a Manifest V3 extension needs zero bundling when written this way) and
// cannot `import` the TypeScript source directly. The values below are a
// DELIBERATE, HAND-MAINTAINED DUPLICATION of `types/companionObserver.ts`'s
// `OBSERVER_CAPABILITIES` / `SCOPE_SUPPORT` / `PAGE_DOCUMENT_EXCERPT_MAX_CHARS`.
// This is a KNOWN FOLLOW-UP RISK: the two files must be kept in sync by hand
// — there is no shared-source-of-truth enforcement across the TS/JS boundary
// today. A future pass should either generate this file from the TS source
// at build time, or add a parity canary (in the spirit of
// `tests/source-of-truth-parity.test.ts`) that fails CI on drift. Flagging
// this explicitly rather than duplicating silently, per CLAUDE.md's
// "Source-of-truth parity is canary-enforced" rule.
const OBSERVER_CAPABILITIES = [
  'current-tab',
  'selection',
  'page-document',
  'downloads',
  'clipboard',
  'notifications',
  'history',
];

const SCOPE_SUPPORT = {
  'current-tab': ['global', 'site'],
  'selection': ['global'],
  'page-document': ['global', 'site'],
  'downloads': ['global'],
  'clipboard': ['global'],
  'notifications': ['global'],
  'history': ['global'],
};

const PAGE_DOCUMENT_EXCERPT_MAX_CHARS = 2000;
