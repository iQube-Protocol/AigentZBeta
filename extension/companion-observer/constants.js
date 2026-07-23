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
 * ── COMPANION_APP_ORIGIN — PLACEHOLDER, MUST BE SET BY THE DEPLOYER ────────
 *
 * No fixed production/staging origin for the Companion app exists in this
 * repo's source. `utils/publicOrigin.ts` (read in full before writing this
 * file) resolves the app's public origin from `NEXT_PUBLIC_APP_URL` /
 * `NEXT_PUBLIC_BASE_URL` at request time — it is an environment value, never
 * a literal baked into a source file, and CLAUDE.md's "No Guessing or
 * Hallucinating" rule forbids inventing one here. `dev-beta.aigentz.me` is
 * named in CLAUDE.md prose as the dev host for OTHER surfaces, but was not
 * found declared as this app's `NEXT_PUBLIC_APP_URL` value in `.env.example`
 * or any committed env file — so it is NOT used here as a guessed constant.
 *
 * The value below is a local-dev placeholder ONLY. A deployer shipping this
 * extension for real MUST:
 *   1. Replace `COMPANION_APP_ORIGIN` below with the real Companion app
 *      origin (whatever `NEXT_PUBLIC_APP_URL` resolves to for the target
 *      environment).
 *   2. Update `host_permissions` in `manifest.json` to match that same
 *      origin (Chrome enforces that a background fetch target is covered by
 *      a declared host permission — the placeholder `*://localhost/*` only
 *      covers local dev).
 */
const COMPANION_APP_ORIGIN = 'http://localhost:3000';

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
