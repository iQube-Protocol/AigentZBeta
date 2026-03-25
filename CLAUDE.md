# CLAUDE.md — Dev Rules for AigentZ / iQube Protocol

This file governs how AI agents (Claude Code and others) should work in this codebase.
Update it as new patterns and rules are established.

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

## Architecture Layers (respect the boundaries)

| Layer | Responsibility | Technologies |
|-------|---------------|-------------|
| Context | Semantic intelligence, RAG, iQube content | LangChain, DB-GPT, blakQube |
| Service | API integration, wallet, CRUD | Next.js API routes, Supabase, AA-API |
| State | Blockchain-backed persistence, audit trail | ICP canisters, EVM, Supabase |

New work should land in the correct layer. Don't mix concerns across layers.

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
- **If auto-merge is broken**: push directly to `dev` as a fallback. First merge `origin/dev` into your session branch to avoid non-fast-forward rejection: `git merge origin/dev --no-edit`, resolve any conflicts, then `git push origin HEAD:dev`.
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

## Adding to This File

When a new rule, pattern, or constraint is established during development, add it here immediately.
This is a living document — keep it current.
