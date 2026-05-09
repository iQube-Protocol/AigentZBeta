# CLAUDE.md — Dev Rules for AigentZ / iQube Protocol

This file governs how AI agents (Claude Code and others) should work in this codebase.
Update it as new patterns and rules are established.

---

## Push Commit Messages — MANDATORY (top priority, do not override)

**Every push to GitHub / dev / any deploy-triggering branch MUST carry a commit message that names the actual content being pushed. Generic merge messages are forbidden.**

This rule is **non-negotiable** and must not be reduced, removed, or worked around by any agent. The operator should be able to read the commit history and immediately know which push corresponds to which change without opening GitHub.

### Forbidden — never produce these:

- `Merge remote-tracking branch 'origin/claude/<session>' into dev` (the default git-generated message)
- `Merge branch X` with no further detail
- `merge dev` with no follow-up describing what's being pushed
- `--no-edit` on any merge that hits dev / main / a deployable branch

### Required — every merge / push to dev must include:

1. The session branch being merged (so the operator can correlate)
2. A short summary of WHAT changed in this push (one phrase, like the imperative commit subject style elsewhere in this repo)

### Correct examples

```
merge dev: sync before pushing inline-remix refactor (fc82cb7)
merge dev: sync before pushing X-Frame-Options fix (f71efd8) + KB timeout bump
merge origin/dev -m "merge dev: sync before pushing thinking-dots Lovable spec (d76dbd1)"
```

### How to enforce this when pushing

When using `git merge origin/dev` before pushing to dev, **ALWAYS** pass `-m` with a descriptive message naming the commits being pushed:

```bash
git merge origin/dev -m "merge dev: sync before pushing <feature/fix> (<commit>)"
```

When using auto-merge via the `claude/**` branch flow, the auto-merge generates the generic message — to override, push the session branch with a final commit message that names the change, then direct-push to dev with a descriptive merge message.

This rule **applies to every agent** working on this repo (Claude Code, Codex, Lovable, any future agent). It applies regardless of the kind of change (code, doc, config). It applies to every push. There are no exceptions.

---

## No Guessing or Hallucinating — Zero Tolerance

**Never guess, invent, or assume any value that cannot be verified from the codebase or a source provided by the operator.**

This applies without exception to:

- **URLs and domains** — never construct or infer a production/staging/dev URL. If a URL is not found in `.env.example`, env files, config files, or code in this repo, say "I cannot find this URL in the codebase — please provide it."
- **Environment variable values** — only read from actual env files. Never assume a value.
- **API endpoints, route paths, slugs, IDs** — always verify from source files before stating. If uncertain, search first; if not found, say so.
- **Third-party service configuration** — do not guess account IDs, project IDs, bucket names, or region names.
- **Any other factual value** — if it is not in the codebase or explicitly provided by the operator, do not state it as fact.

**When a value cannot be found:** say exactly that — "I cannot find X in the codebase. Please provide it." Do not fill the gap with a plausible-sounding guess.

Guessing critical values (especially URLs) wastes the operator's time, breaks integrations, and erodes trust. This rule is non-negotiable.

---

## Q¢ (Q-cent) Pricing — Canonical Conversion

**$1 = 100 Q¢. One Q¢ is worth $0.01.**

This is the canonical conversion across every surface (wallet, store cart, content purchase, codex tabs, runtime, embed routes, API, ledger, anywhere a Q¢ value appears). It applies to AigentZ / iQube Protocol, the Venture Lab α / KNYT codex programmes, and every future cartridge that surfaces Q¢ pricing.

### Rules for any code that handles Q¢

1. **Storage** — store Q¢ as integer cents (no decimals). The DB column `amount_qc` (and equivalents like `amount_qcent`, `spent_qcents`) is a count of cents, not a USD value.
2. **Conversion helpers** — when you need to display USD next to a Q¢ count, use `usd = qc / 100`. When you need to convert a USD amount to Q¢, use `qc = Math.round(usd * 100)`.
3. **Display** — the user-facing primary price for any rail (KNYT, Q¢, USDC, PayPal) renders in **USD** for parity with the store's payment modal. If you also show the Q¢ count, render it as a secondary line: `$9.00` primary, `900 Q¢` secondary.
4. **Never assume `qcent === usd`** — older code in `app/services/token/pricingService.ts` (e.g. `convertFromKnyt`, `convertFromQcent`, `convertFromUsdc`, `calculatePaymentPricing`) returns `qcent` as a USD-equivalent value, not a cents count. Treat those return values as USD when consuming, and prefer the cart-quote / multi-rail helpers for new surfaces. Do not propagate the `qcent === usd` assumption further.
5. **Submit copy** — Q¢ rail buttons should say `Pay $X.XX with Q¢`, not `Pay X.XX Q¢`, to keep the principal display in USD. Show the Q¢ count separately if useful.

If you encounter a value labelled `qc` / `qcent` / `q_cent` / `qCents` and aren't sure whether it's a cents count or a USD value, **trace it back to its source before using it** — getting this wrong moves money by 100×.

---

## Operator Instructions — Always Provide Runnable Scripts

When the operator needs to take any action, always provide the exact command(s) to run — never describe steps in prose that require manual interpretation.

- **Shell commands**: provide a single copyable block the operator can paste directly into their terminal, including any `git pull` needed to get the latest code first.
- **SQL**: provide a single copyable block the operator can paste directly into the Supabase SQL editor. Never say "run this migration" without providing the exact SQL inline.
- **Never say** "add X to Amplify", "configure Y in the dashboard", or "run script Z" without providing the exact value or the exact command.
- If multiple commands are needed, chain them into one block with `&&` so a single paste runs everything.

---

## Security — Access Gates (PARAMOUNT)

**NEVER remove, weaken, or bypass any access control gate without explicit written consent from an admin.**

This includes but is not limited to:

- `adminOnly` flags on codex tabs, routes, or UI components
- Role checks (`isAdmin`, `isSuperAdmin`, RBAC guards)
- Supabase Row Level Security (RLS) policies
- API route authentication middleware
- Feature flags that gate sensitive functionality

**If a gate appears to be blocking legitimate access**, the correct response is to:
1. Report the access issue to the operator and ask for explicit authorisation to change it
2. Investigate the auth resolution path (how `isAdmin` is set, what role is required) and fix the upstream auth flow — not remove the gate
3. Never remove a gate as a debugging shortcut or workaround

Violating this rule is a critical security incident regardless of intent.

---

## Core Principle: Extend, Don't Duplicate

This is a mature, actively evolving codebase. Before writing any new code:

1. **Search for existing implementations** — functions, hooks, components, and utilities almost certainly already exist.
2. **Reuse and extend** what's there. If something needs a new capability, modify the existing unit rather than creating a parallel one.
3. **Move logic when refactoring** — don't copy it. The codebase should have one authoritative location for each concern.

---

## File and Component Discipline

- **Never create a new file** unless it represents a genuinely new, standalone concern with no existing home.
- **Never create new UI components** without first checking `components/ui/`, `components/composer/`, `components/registry/`, and `components/` root.
- Canonical shared primitives include: `ConfirmDialog`, `IQubeCard`, `FilterSection`, `ViewModeToggle` — use them.
- Prefer editing an existing file to creating a new one, even if the change is larger.

---

## TypeScript Standards

- No `any` casts unless the existing code already uses them in that context.
- Use `typeof x === "string"` guards before casting (e.g. `as "openai" | "venice"`).
- Use `asRecord()` for safe unknown-to-object access (already exists in the codebase).
- Keep `useCallback` / `useMemo` dependency arrays accurate — add and remove deps as logic changes, never just append.

---

## State Management Boundaries

- **Server-first for critical state**: Registry data, visibility, and ownership live in Supabase via Next.js API routes.
- **`localStorage` for UX reactivity only**: e.g. `library_<id>`, `minted_<id>` flags for immediate client feedback.
- **No SSR/CSR mismatches**: compute client-only conditions (localStorage, window) inside `useEffect` and store in state — never directly in JSX render paths.

---

## Commit Discipline

- One concern per commit. Keep diffs focused and minimal.
- Commit messages are imperative, lowercase, no period: e.g. `Generate image article bundles on completion`
- Never bundle unrelated changes. A bug fix and a refactor are separate commits.
- Never skip hooks (`--no-verify`) or bypass signing.
- **Merge commits must be descriptive.** Never use `--no-edit` or the default `Merge remote-tracking branch 'origin/dev' into …` message. Always pass `-m` with a summary of what the session changed, e.g.:
  ```
  git merge origin/dev -m "merge dev: sync before pushing send script pagination + CAMPAIGN_ADMIN_EMAIL fix"
  ```
  The `-m` message must name the actual content being pushed — never generic phrases like "sync before push".

---

## Multi-Agent Coordination

Multiple Claude Code sessions may run concurrently on this codebase. Each session works on its own `claude/<session-id>` branch, but all merge to `dev`, creating collision risk.

### Rules for every session

1. **Declare your file scope at session start.** In your first commit message or QubeTalk packet, list the primary files you intend to touch (e.g. `services/campaign/`, `app/api/crm/`).

2. **Check what other agents changed before merging to dev.**
   ```bash
   git fetch origin dev
   git log origin/dev..HEAD --oneline   # your unpushed commits
   git diff origin/dev --name-only      # files you changed vs dev
   ```
   If another agent recently changed the same files, read their diff before merging:
   ```bash
   git show origin/dev --stat
   ```

3. **Merge with a descriptive message** (see Commit Discipline above). Never use `--no-edit`.

4. **Announce concurrent work via QubeTalk bridge.** If you are starting work that touches shared infrastructure (API routes, services/, components/ui/), write an outbox packet:
   ```bash
   python3 scripts/qubetalk_bridge/create_packet.py \
     --agent-id claude-code \
     --title "Starting work on <area>" \
     --body "Touching: <list of files/dirs>" \
     --thread dev-exec --type status --severity info
   git add docs/qubetalk-bridge/outbox/ && git commit -m "send qubetalk: announce <area> work" && git push
   ```

5. **High-collision files** — treat these as contested; always fetch and diff before editing:
   - `scripts/create-env-production.js` — env allowlist (every session that adds a new var touches this)
   - `app/api/crm/investors/route.ts` — central CRM read path
   - `services/campaign/adapters/mailjetAdapter.ts` — live email sending
   - `CLAUDE.md` — this file

6. **If a push to dev is rejected** (non-fast-forward), always rebase rather than force-push:
   ```bash
   git fetch origin dev
   git merge origin/dev -m "merge dev: sync before pushing <what-you-changed>"
   git push origin HEAD:dev
   ```

---

## Change Sizing

- **No over-engineering**: don't add abstractions, helpers, or utilities for one-off operations.
- **No speculative features**: only implement what is explicitly requested or clearly required.
- **No defensive code for impossible scenarios**: trust internal framework and TypeScript guarantees.
- Three similar lines of code is better than a premature abstraction.

---

## Security

- Never hardcode secrets, keys, or credentials.
- All sensitive config lives in `.env.local` (server-side) or environment variables.
- `NEXT_PUBLIC_` prefix is for browser-exposed values only — never use it for service role keys or private API keys.
- Follow existing zero-knowledge, encryption-first, minimum-disclosure patterns for any iQube data handling.

---

## Gated Content — Confidential Exposure Rules (PARAMOUNT)

Purchased/entitled content (PDFs, videos, and any other gated media) must be treated as **confidential information exposed only under controlled conditions**. The underlying file URL and bytes must never be handed to the OS or browser outside the application's own viewers.

### Hard rules — apply to all gated/locked content:

1. **No `target="_blank"`** on links or anchors pointing at gated PDF or video files. Opening a new tab hands the URL to the browser, which can download, share, or cache the file.

2. **No raw storage URLs in the browser** — Supabase Storage URLs (`https://[project].supabase.co/storage/...`), Autonomys CIDs, or any other direct file path for gated content must never be sent to the client as-is. They must be proxied through an authenticated server-side route that validates the persona's entitlement before streaming bytes.

3. **No `window.open()` on gated file URLs** — same exposure risk as `target="_blank"`.

4. **PDF viewer split** — there are two canonical PDF viewers, used for different sources:
   - **`PDFLiteReaderModal`** — fast browser-native iframe viewer. Use when a `pdf_lite_url` (direct Supabase Storage URL) is available. Works because the URL is loaded directly by the browser; no Lambda response buffering.
   - **`PDFPageViewer`** — page-by-page render via `/api/content/pdf-page/[cid]?page=N`. Use when only an Autonomys `pdf_cid` is available (no Supabase URL). **Required** for large Autonomys-hosted PDFs because the full-PDF proxy at `/api/content/pdf/[cid]` returns 413 (AWS Lambda 6MB response payload limit) for files like episode comics.
   - The render contract is: `if (pdf_lite_url) PDFLiteReaderModal else if (pdf_cid) PDFPageViewer`. Never use the full-PDF proxy as a viewer source for Autonomys CIDs — it works only for the 302-redirect Supabase case. Never use `<object>` for the PDF embed (Firefox throws `NS_ERROR_WONT_HANDLE_CONTENT`); use `<iframe>`.

5. **Videos must render only inside the app's `VideoPlayer` component** — never via a direct URL in a new tab or `<a>` link.

6. **This applies to every surface** — KnytTab, store tabs, Terra, Community, 21 Sats, runtime, embed routes, and any future surface. The rule travels with the content, not the surface.

### What is NOT gated (can follow the standard exposed process):

- Free/preview content with no entitlement requirement (e.g. GN episode 0)
- Marketing assets, cover thumbnails, promotional images
- Public KB documents and lore that are not access-restricted

### Phase note:

Phase 2 will enforce this via iQube encryption (assets stored as encrypted non-fungible files, decrypted only for verified holders). Until then, the enforcement mechanism is:
- Client-side ownership gate (prevents unauthorised viewers from opening the viewer)
- `/api/content/pdf/[cid]` proxy for Autonomys CIDs (no raw URL exposure to browser)
- Direct Supabase Storage URL only for free/public content

### Phase 2 Backlog — Secure PDF URL handling

**Status: deferred to Phase 2**

Currently, Supabase Storage URLs for owned/gated episodes are forwarded through the `/api/admin/codex/status` API response and used directly in `PDFLiteReaderModal`. This means a user inspecting the network tab can retrieve the storage URL for any episode visible in the catalog, even episodes they don't own.

**Phase 2 task:** Replace the direct URL in `PDFLiteReaderModal` with an authenticated server-side redirect route:

1. Add a route `GET /api/content/pdf-signed/[masterId]` that:
   - Validates `personaId` owns the episode (check `owned_issues` or equivalent)
   - Generates a short-lived Supabase Storage signed URL (e.g. 5-minute TTL)
   - Returns a 302 redirect to the signed URL
2. Update `PDFLiteReaderModal` to use `/api/content/pdf-signed/${masterId}` as its `pdfUrl` for gated content
3. Keep the direct URL path for free/public content (episode 0 GN, preview assets)

This eliminates the URL-leakage window without requiring `pdfjs-dist` or full-PDF downloads on the server.

---

## Architecture Layers (respect the boundaries)

| Layer | Responsibility | Technologies |
|-------|---------------|-------------|
| Context | Semantic intelligence, RAG, iQube content | LangChain, DB-GPT, blakQube |
| Service | API integration, wallet, CRUD | Next.js API routes, Supabase, AA-API |
| State | Blockchain-backed persistence, audit trail | ICP canisters, EVM, Supabase |

New work should land in the correct layer. Don't mix concerns across layers.

---

## Inter-Cartridge Navigation — Identity Propagation (CANONICAL RULE)

When navigating from one codex or cartridge to another, **personaId and access flags MUST travel with the link**. This is a first-class platform rule — not optional.

### The rule

> Every link that crosses a codex/cartridge boundary MUST carry `personaId` (and optionally `isAdmin`, `isPartner`) as URL query parameters. The receiving embed route reads and forwards these automatically. Never rely on localStorage alone — URL params are explicit, auditable, and work regardless of storage state.

### Implementation

Use `buildCodexUrl()` from `utils/codex-nav.ts` for all inter-cartridge links:

```ts
import { buildCodexUrl } from "@/utils/codex-nav";

// Back-link from KNYT Alpha → Venture Lab α Programme
href={buildCodexUrl("alpha-knyt", { tab: "alpha-programme", personaId, from: "knyt", fromTab: "knyt-alpha" })}

// Deep-link from Venture Lab α Programme → KNYT Wheel tab
link: buildCodexUrl("knyt-codex", { tab: "knyt-alpha", personaId, from: "alpha-knyt", fromTab: "alpha-programme" })
```

### How the receiving side works

`/triad/embed/codex/[codexSlug]/page.tsx` already reads:
- `?personaId=` → passed to `useCodexEmbedAuthBridge` and all tab components
- `?isAdmin=true` → used for optimistic gate rendering (server re-validates)
- `?isPartner=true` → same
- `?from=` and `?fromTab=` → available for breadcrumb construction

`useCodexEmbedAuthBridge` provides a secondary fallback via localStorage (`currentPersonaId`, `activePersonaId`) but the URL param is always preferred.

### Access rights enforcement

- Access gates (`adminOnly`, `partnerOnly`) are **always resolved server-side** from the persona at load time. URL params for `isAdmin`/`isPartner` are only for **optimistic client-side UI** — they never bypass server enforcement.
- Never pass `isAdmin=true` in a hardcoded link. Only propagate it dynamically when the current session has that right: `isAdmin={isAdmin}` in `buildCodexUrl`.

### Where this applies

- Any `<a href>` or `router.push()` that points to `/triad/embed/codex/...`
- Back-buttons on codex tabs that link to another cartridge
- Workstream cards in `AlphaProgrammeTab` that deep-link into KNYT codex
- Any future cross-cartridge CTAs (e.g. Qriptopian → AgentiQ)

### Files

| File | Role |
|------|------|
| `utils/codex-nav.ts` | Canonical `buildCodexUrl()` helper — use this everywhere |
| `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` | Reads and forwards all identity params |
| `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | Resolves personaId from URL or localStorage |

---

## Local Development Path

The canonical local root for this project is:

```
/Users/hal1/CascadeProjects/AigentZBeta
```

This may change in the future — update this section if the local path moves.

---

## Key Directories

```
components/composer/   — ComposerStudio and experience authoring
components/registry/   — iQube registry UI
components/ui/         — Shared UI primitives
app/api/               — Next.js API routes (server-side only)
services/              — Backend services (aa-api, agentiq-wallet)
packages/              — Shared packages (smarttriad, smartwallet, avatar-host)
docs/                  — Architecture, operator manuals, progress reports
```

---

## Codebase Update Documentation — Canonical Location

**All session documentation that records codebase changes must go in one place:**

```
codexes/packs/agentiq/updates/
```

Naming convention: `YYYY-MM-DD_short-description.md`

Every file added here must also be registered in `codexes/packs/agentiq/collections.json` under the `col_updates` collection so it appears in the AgentiQ cartridge "Updates" tab.

This applies to:
- Deployment records (contract addresses, env vars, deploy steps)
- Architecture decisions made during a session
- Engineering session summaries and handoffs
- Any doc produced as a side-effect of coding work

**Never scatter update docs across other pack directories** (`alpha-knyt`, `knyt`, etc.) and expect the operator to find them. The `agentiq/updates/` folder is the single source of truth for what changed and when. If a doc also belongs in a workstream-specific pack (e.g. Venture Lab α), that is fine as a secondary copy — but `agentiq/updates/` must always be the primary.

---

## Deployment

Always deploy to **dev** unless explicitly told otherwise.

### Steps

1. Trigger the deploy by updating `.amplify-deploy` with a new timestamp:
   ```
   echo "Deploy trigger $(date)" > .amplify-deploy
   ```
2. Commit the trigger file:
   ```
   git add .amplify-deploy && git commit -m "trigger deploy to dev"
   ```
3. Push to the session branch:
   ```
   git push -u origin claude/<session-id>
   ```
   The branch **must** start with `claude/` and end with the session ID suffix (e.g. `claude/find-latest-commit-qQYRq`). Pushing to any other branch name fails with a 403.
4. **Auto-merge runs:** The `merge-claude-to-dev` GitHub Actions workflow detects the push to `claude/**` and automatically merges to `dev`.
5. **Amplify picks up dev:** Amplify watches the `dev` branch and triggers a build automatically.

### Prerequisites / Gotchas

- The `merge-claude-to-dev.yml` workflow **must exist on the `main` branch** for GitHub Actions to recognise `claude/**` push triggers. If auto-deploy stops working, check `main` has this file. Branch `fix/add-merge-workflow` contains the fix — merge it to `main` to restore.
- **If auto-merge is broken**: push directly to `dev` as a fallback. First merge `origin/dev` into your session branch to avoid non-fast-forward rejection, then push:
  ```
  git fetch origin dev
  git merge origin/dev -m "merge dev into <branch>: sync before pushing <what-this-session-changed>"
  git push origin HEAD:dev
  ```
  **Never use `--no-edit`** for merge commits — always write a descriptive `-m` message that summarises what the session changed (e.g. `"merge dev: sync before pushing seed fix + CRM individual card"`). This lets the commit history be human-readable.
- **Avoid doc-only deploys:** Pushing only `CLAUDE.md` or other documentation to a `claude/` branch triggers a full Amplify build. Batch doc updates with the next code change instead.
- The session branch name is critical — find the current branch with `git branch --show-current` before pushing.
- **Other environments** (staging, main) — only deploy there if the user explicitly requests it.

---

## QubeTalk — Agent Messaging

All Claude Code agents **must** use QubeTalk to announce activity and coordinate with other agents.

### CLI utility

```bash
# Send a status message
bash scripts/qubetalk-claude.sh send \
  --thread dev-exec \
  --title "Short title" \
  --body "Detailed message body" \
  --severity info        # info | warn | blocker

# Read recent channel history
bash scripts/qubetalk-claude.sh history --limit 20
```

The script loads keys automatically from `.env.local` / `.env.local.temp` — no manual setup needed.

### Required usage patterns

| When | Thread | Example title |
|------|--------|---------------|
| Session start | `dev-exec` | `Claude Code session started — <branch>` |
| Session end / task complete | `dev-exec` | `Claude Code session complete — <summary>` |
| Spec decision / architecture choice | `spec` | `Decision: <what and why>` |
| API wiring change | `api-wiring` | `Changed: <endpoint or contract>` |
| Blocker encountered | `dev-exec` | `Blocker: <description>` |

### Channel & rules

- **Channel:** `metame-runtime-thinclient`
- **Agent ID:** `claude-code` (consistent across all sessions)
- **DB `type` field:** `text | delegation | response | system | receipt`
- **Threads:** `spec | api-wiring | ui-shell | dev-exec | ops`
- **Metadata type:** `task | decision | question | status | patch | log`
- **Severity:** `info | warn | blocker`

Post at session start and end at minimum. Post blockers and key decisions in real time.

---

## System Model — Aigent Z / Aigent C / metaMe

The platform runs a dual-agent model with a sovereign guardian above:

| Role | Agent | Responsibility |
|------|-------|---------------|
| System orchestrator | **Aigent Z** | Routes interactions, enforces policy, selects NBE |
| Customer guide | **Aigent C** | Faces the user; executes NBE dispositions |
| Sovereign guardian | **metaMe** | Final override authority; identity + data sovereignty |
| Cartridge lead | per-cartridge | Domain logic within a cartridge boundary |

### Routing priority chain
1. metaMe guardian (policy veto)
2. Active cartridge lead agent
3. Aigent Z (system orchestrator)
4. Aigent C (default handler)

### Key contracts
- **NBEPlan** — `disposition: ask | act | wait | escalate | deny` + `nextExperience` depth step
- **StudioArtifact** — canonical handoff format for Studio → Codex → Runtime closed loop
- **OrchestrationEvent** — every routing decision is persisted and receipt-eligible
- **HandoffPayload** — typed interface for agent-to-agent handoffs (see `types/orchestration.ts`)

### Journey stages
`prospect → acolyte → keta → keji → first → zero` (+ investor / collector / creator variants)

### Experience depth ladder (one step at a time)
`L0 pill → L1 capsule → L2 mini_runtime → L3 codex`

Full type definitions: `types/orchestration.ts`, `types/studioArtifact.ts`

---

## Project Workstreams — Three Distinct Programs

There are three parallel workstreams in this codebase. Do **not** conflate them with each other.

### 1. AgentiQ Alpha — Platform Build (current phase)

The in-progress platform hardening and first-ship phase. Established the base registry, runtime shell, SmartTriad, codex system, and core agent infrastructure.

- **Docs:** `codexes/packs/agentiq/items/ALPHA_*.md` — Overview, Build Plan, Asset Map, Architecture Memo
- **Codex tab:** AgentiQ Cartridge → "Alpha Program" tab (`slug: alpha-program`)
- **Status:** Active — this is the primary development context for most engineering tasks

### 2. Venture Lab α — AgentiQ Ventures Studio / AgentiQ Lab (next phase)

The next-stage program: builds the live **metaMe / AgentiQ / AgentiQ OS engine** on top of the Alpha foundation. Formally called the **AgentiQ Ventures Studio → AgentiQ Lab foundational capabilities workstream**. Operationalizes the platform into a coherent live system with the reference agent trio (Aigent Z, Marketa, Know1), the first cartridge pair (KNYT + Qriptopian), and the KNYT Alpha launch.

**Naming note:** The codebase pack is `alpha-knyt` (historical name) but the project is "Venture Lab α" / "AgentiQ Lab" / "alpha-lab" in product and planning terms. Use "Venture Lab α" or "AgentiQ Lab" when referring to this workstream — not "AgentiQ KNYT" (which is ambiguous with the KNYT cartridge itself).

- **Docs:** `docs/alpha/agentiq-knyt/` — 23 codex-grade planning docs (01–23)
- **Pack:** `codexes/packs/alpha-knyt/` (symlinks `items/` → `docs/alpha/agentiq-knyt/`)
- **Codex tab:** AgentiQ Cartridge → "Venture Lab α" tab (`slug: agentiq-knyt`, `adminOnly: true`)
- **Overview doc:** `codexes/packs/agentiq/items/AGENTIQ_KNYT.md`
- **Status:** Planning complete (23 docs); build starts after Alpha ships

When docs 24+ are added to `docs/alpha/agentiq-knyt/`, also add them to `codexes/packs/alpha-knyt/collections.json` (`col_venture_lab` items array).

### 3. KNYT Wheel — Activation Campaign (marketing / ops)

The KNYT product launch and activation campaign. This is a **marketing and operations workstream** — not a platform build workstream. It covers the launch plan, copy packs, CRM model, partner activation, and 30-day calendar for taking KNYT to market.

**Do not confuse** this with Venture Lab α (which builds the engine) or AgentiQ Alpha (which builds the platform).

- **Docs:** `codexes/packs/knyt/items/KNYT_CAMPAIGN_*.md` (15 operator docs) + experience pack and runtime surface specs
- **Codex:** `knyt-codex` — the live KNYT product codex (character cards, scrolls, shop, balance)
- **Status:** Campaign ops in progress — touches CRM routes, email sequences, Marketa activation

---

## metaProof Agent Harness

Canonical specs live in `docs/agent-harness/`. These are the single source of truth for all agents (Claude Code, Codex, Lovable):

| File | Contents |
|------|----------|
| `docs/agent-harness/metaproof-core.md` | Role hierarchy, NBE contract, DVN receipt taxonomy, QubeTalk conventions |
| `docs/agent-harness/aigent-z-aigent-c-contract.md` | Full role definitions, routing sequence, handoff rules |
| `docs/agent-harness/journey-state-schema.md` | JourneyState, ExperienceModel/Matrix, NBEPlan interfaces + SQL |
| `docs/agent-harness/studio-artifact-schema.md` | StudioArtifact schema, Codex↔Studio sync contract, rollback protocol |

When asked to work on orchestration, KNYT laddering, or experience progression, read these files first.

### DB migration for harness tables
`supabase/migrations/20260402000000_experience_model_journey_state.sql` — creates:
`experience_strategies`, `experience_models`, `experience_matrices`, `experience_goals`,
`journey_states`, `nbe_plans`, `analysis_cards`, `orchestration_events`, `studio_artifacts`

**This migration must be run in Supabase before the orchestration API is live.**

---

## Claude Code Sub-Agents

Specialist agents are defined in `.claude/agents/`:

| Agent file | When to invoke |
|-----------|---------------|
| `aigent-z-orchestrator.md` | Routing logic, NBE decisions, orchestration events |
| `metame-guardian.md` | Policy checks — APPROVED / FLAG / BLOCK output |
| `ui-parity-reviewer.md` | UI parity rules (4px grid, design tokens, radii) |
| `security-reviewer.md` | Secrets, auth, injection, prod misuse |

---

## QubeTalk — Sandbox Limitation

**Outbound HTTPS is blocked in the Claude Code sandbox.** The `qubetalk-claude.sh` script and all `curl` calls to external hosts fail with a 403 CONNECT tunnel error. This includes both sending and reading QubeTalk messages.

The session Stop hook (`session-summary.sh`) attempts posting silently and suppresses errors — this is intentional and non-fatal.

QubeTalk messages posted by other agents (Codex, Lovable) are visible through Supabase Studio or the deployed app UI, not from within this sandbox.

---

## QubeTalk Bridge — Fallback for Claude ↔ Codex Communication

Because outbound HTTPS is blocked, Claude agents communicate with Codex (and Lovable) via **file-based bridge packets** committed to the repo. Lovable acts as the relay — it reads the outbox files and posts them to the live QubeTalk channel, and snapshots incoming Codex messages into the inbox.

### Directory layout

```
docs/qubetalk-bridge/
  outbox/          ← Claude writes packets here (committed + pushed)
  inbox/
    latest.json    ← Lovable snapshots inbound messages here
```

### Sending a message to Codex (Claude → Codex)

Use `create_packet.py` to write an outbox packet, then commit and push. Lovable relays on its next pass.

```bash
python3 scripts/qubetalk_bridge/create_packet.py \
  --agent-id claude-code \
  --story DEV-XXXX \
  --title "Short title (≤80 chars)" \
  --body "Detailed message body" \
  --thread dev-exec \
  --type status \
  --status done \
  --severity info

# Embed file contents for Codex to read:
#   --paths path/to/file1.ts path/to/file2.ts
# Mark deploy-ready (Codex will apply embedded files + deploy):
#   --deploy-ready
```

Commit and push the packet:
```bash
git add docs/qubetalk-bridge/outbox/
git commit -m "send qubetalk bridge packet: <title>"
git push -u origin <current-branch>
git push origin HEAD:dev
```

Tell the user **"ask Lovable to relay the QubeTalk bridge"** if immediate delivery is needed.

### Reading messages from Codex (Codex → Claude)

Lovable snapshots inbound Codex/Lovable messages into `docs/qubetalk-bridge/inbox/latest.json`:

```bash
# List your own sent (outbox) packets
python3 scripts/qubetalk_bridge/list_pending.py

# Read what Codex/Lovable sent
cat docs/qubetalk-bridge/inbox/latest.json

# Apply file patches sent by Codex (if inbox contains file_payloads)
python3 scripts/qubetalk_bridge/apply_packets.py [--dry-run]
```

### When to use the bridge

| Situation | Action |
|-----------|--------|
| Hand off work or files to Codex | `create_packet.py` with `--paths` + `--deploy-ready` |
| Report session completion to Codex | `--thread dev-exec --type status --status done` |
| Share architecture decision | `--thread spec --type decision` |
| Check what Codex sent | Read `inbox/latest.json` |
| Apply file patches from Codex | `apply_packets.py` |

### Key rules

- Always pass `--agent-id claude-code` (the default is `openai-codex`)
- Always commit and push the outbox packet file — it is never delivered until it hits the remote
- The bridge is **fire-and-forget**: Lovable relays asynchronously; Claude cannot confirm delivery from within the sandbox

---

## Adding to This File

When a new rule, pattern, or constraint is established during development, add it here immediately.
This is a living document — keep it current.
