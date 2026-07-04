# Next.js 14 → 15 Upgrade Plan (no-breakage staging)

**Date:** 2026-07-04
**Status:** Plan approved-pending; Stage A ready to execute on operator greenlight
**Scope:** Root app (`next@14.2.35`) + `apps/metame-runtime-shell` (`next@^14`) → `next@^15.5` + `react@^19`

## Target version

**Next 15.5.x + React 19 stable**, not Next 16.

- Amplify Hosting compute officially supports Next.js 12→15 (SSR/ISR/middleware/image optimization) — Next 16 support is not yet documented.
- 15.5 is the final 15.x line: React 19 stable, stable Node middleware, and it emits Next-16 deprecation warnings that give us a guided path for the *next* jump.
- Next 16 removes `next lint`, defaults to Turbopack builds, and drops more legacy surface — a second, separate migration.

## Why this is smaller than it looks (measured inventory)

| Surface | Count | Notes |
|---|---|---|
| `route.ts` files total | 720 | |
| Sync-style `params` (need migration) | **32 files** (31 routes + 1 client page) | The other **69** dynamic files already use the Next-15 `params: Promise<…>` + `await params` style — written that way in prior sessions and running in production on 14 today |
| `cookies()` / `headers()` from `next/headers` | **0** | Biggest async-API risk class: absent |
| Server pages with `searchParams` prop | ~2 (embed codex pages use `useSearchParams()` client hooks — unaffected) | |
| `generateMetadata` with params | 2 files — **both already Promise-typed** | |
| `request.ip` (removed in Next 15) | **3 sites** — `middleware.ts:106` (rate-limit key), `app/api/analytics/share/route.ts:57`, `app/api/marketa/proxy/[...path]/route.ts:73` | Replace with `x-forwarded-for` header read |
| Edge runtime routes | 0 | |
| React 19 removals in our code (`defaultProps`, `propTypes`, `useFormState`, `findDOMNode`, `ReactDOM.render`, string refs) | **0 occurrences** | |
| GET handlers with no explicit `dynamic`/`no-store` marker | 86 | Next 15 flips them from cached-by-default → uncached-by-default. Direction is *fresher data* — a correctness-safe change; watch compute cost only |

Key insight that de-risks everything: `await` on a plain object resolves to the object itself, so **the Next-15 async style already runs correctly on Next 14** — proven by the 69 files doing exactly that in production. We can therefore migrate all call sites *before* touching the framework version.

## Stage A — pre-migration on Next 14 (zero-risk, ships first)

1. Run the official codemod scoped to the 32 remaining files: `npx @next/codemod@latest next-async-request-api app/` (it converts route handlers to `await params`, and the one client page `app/(shell)/aigents/[agentKey]/page.tsx` to `React.use(params)` — `use()` exists in React 18.3, so this too runs on 14).
2. Replace the 3 `request.ip` reads with `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"` — works identically on 14 and 15. The middleware rate-limit key must keep functioning.
3. Deploy via normal flow, verify production unchanged (params-bearing admin/CRM/marketa/content routes + the aigents page).

After Stage A, the app is 100 % Next-15-source-compatible while still running 14. Any regression here is isolated and trivially bisectable, completely decoupled from the framework flip.

## Stage B — the flip (one commit, gated on a local build)

**Hard gate:** every push to `claude/**` auto-merges to dev and triggers Amplify. There is no staging branch. Therefore Stage B is pushed **only after `npm run build` (next build) succeeds in the work sandbox** plus `npm test` (vitest suite) passes.

1. Version bumps (root `package.json` **and** `apps/metame-runtime-shell/package.json` — npm workspaces hoist react, so both Next apps move in lockstep):
   - `next` `^14.0.0` → `^15.5.0`; `eslint-config-next` → `^15.5.0`
   - `react` / `react-dom` `^18.2.0` → `^19.0.0`; `@types/react` / `@types/react-dom` → `^19`
   - `apps/theqriptopian-web` (Vite) pins its own `react ^18.3.1` → npm nests a local React 18 copy; unaffected, but verify its install resolves.
2. `next.config.js` (root):
   - remove `swcMinify: true` (removed in 15)
   - move `experimental.outputFileTracingIncludes` → top-level `outputFileTracingIncludes` (renamed in 15) — this carries the codex-pack Lambda bundling entries; a silent miss here breaks `/api/codex/chat` pack search and the docs tab, so verify these keys land top-level
   - `serverExternalPackages` is *already* the Next-15 top-level key (Next 14 ignored it; the webpack `externals` block did the real work — keep both)
   - `experimental.cpus` stays experimental (valid in 15)
   - shell app config is trivial (transpilePackages only) — no changes
3. Regenerate `package-lock.json` with `npm install --legacy-peer-deps` (same flag amplify.yml already uses — React-19 peer-range stragglers won't break install).
4. Local verification in sandbox, in order:
   - `npm run build` with `NODE_OPTIONS=--max-old-space-size=4096` — the go/no-go gate
   - confirm `.next/standalone/server.js` exists and `node scripts/patch-standalone-dotenv.js` still patches it (Amplify runtime-env dependency; Next 15 keeps the same standalone layout)
   - `npm test` (vitest) — spine canaries, access tests must stay green
   - `npm run type-check` — **measure-only**: `typescript.ignoreBuildErrors: true` means @types/react-19 churn can't break the build; record the error count as backlog, don't gate
5. Push → auto-merge → Amplify build. Watch the build log end-to-end.

## Stage C — post-deploy verification on dev-beta

- Embed codex pages (`/triad/embed/codex/[codexSlug]` — KNYT, Qripto, AgentiQ cartridges): identity params still propagate, tabs render
- SmartWallet drawer (auth, persona switch, deep-link tabs) — Supabase session flows
- Composer Studio end-to-end: create video experience, packet route, SkillVideoPlayer
- Admin routes (spine `isAdmin` gates), CRM investors, marketa campaign detail (params-bearing routes migrated in Stage A)
- PDF viewers (PDFLiteReaderModal / PDFPageViewer) and video proxy routes
- Middleware: X-Frame-Options handling + rate limiting (the `request.ip` replacement)
- Watch for hydration warnings in console (React 19 hydration diffs are noisier — this is diagnostic-only)

## Behavioral deltas accepted (not bugs)

- **Caching flips to uncached-by-default** for fetch()/GET handlers/client router cache. For this app (dashboards, admin, dynamic content, most routes already `force-dynamic`/`no-store`) the direction is *more* correct. If Amplify compute cost rises, add explicit `export const revalidate`/`force-static` to the hot read-only routes from the 86-file list — as a follow-up, driven by observation.
- React 19 type churn appears in `type-check` output but not in builds.

## Rollback

Single revert commit of the Stage B merge on dev → Amplify rebuilds the previous state. Stage A does not need rollback (14-compatible by construction).

## Explicit non-goals

- Next 16 / Turbopack builds (separate future migration; 15.5's deprecation warnings become its worklist)
- Fixing the pre-existing `type-check` debt unmasked by @types/react 19
- `services/aa-api`, `services/agentiq-wallet` (non-Next node services), `apps/theqriptopian-web` (Vite, self-pinned React 18)

## References

- Next 15 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-15
- Next 15.5 release notes: https://nextjs.org/blog/next-15-5
- Amplify Next.js support matrix: https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html
