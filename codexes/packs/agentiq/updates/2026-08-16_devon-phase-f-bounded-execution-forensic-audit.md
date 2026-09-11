# DevOn / IDE 2.0 — Phase F: Bounded Execution Forensic Audit

**Status: read-only audit + design complete. No code changes in this pass — stop gate honored per operator instruction.**

**Live-ops note (surfaced mid-audit, addressed and disclosed here):** while pulling GitHub Actions history for evidence, this audit found workflow run `31929125651` (the "Claude Implement" dispatch) actively `in_progress` on its **4th manually-triggered attempt** (`actor`/`triggering_actor`: `Kn0w-1`), spending API credit a fourth time against the same already-failed pack. This was not something this session dispatched. The operator was asked, and instructed **cancellation** (stop spend only — never delete the run, branch, logs, or pack artifacts, preserved explicitly as forensic evidence). `cancel_workflow_run` was called; no deletion method was ever invoked. By the time the cancel API call completed, the run had in fact already self-terminated on its own `Credit balance is too low` error moments earlier (see §1.3) — the cancellation closed out GitHub's bookkeeping, not a live spend. This event is itself evidence for §7 (no automated guard exists today against a costly re-run; only a human clicking "Re-run" repeatedly stopped this one, and only because it was caught mid-flight).

---

## 0. What was inspected

| # | Artifact | Path |
|---|---|---|
| 1 | Dispatch-receiver workflow | `.github/workflows/claude-implement.yml` |
| 2 | `anthropics/claude-code-action@v1` config + defaults | live-fetched `action.yml`, `docs/configuration.md`, `docs/capabilities-and-limitations.md` from `github.com/anthropics/claude-code-action` |
| 3 | System/context prompt passed to Claude Code | inline in `claude-implement.yml`'s `prompt:` block (§1) |
| 4 | Dispatch route | `app/api/dev-command-center/implement/route.ts` |
| 5 | Implementation Pack generation + serialization | `services/constitutional/implementationPack.ts`, `components/composer/CapabilityPipelineTab.tsx::packMarkdown()` |
| 6 | Repo-wide instructions Claude Code must read | `CLAUDE.md` (1,778 lines) |
| 7 | Validation/test instructions in the CI prompt | step 4 of the workflow prompt; `templateFields()`'s fallback `validationPlan` |
| 8 | Real failed-run evidence | GitHub Actions job logs, two independent live runs (§1.3) |

---

## 1. Forensic findings

### 1.1 The workflow (`.github/workflows/claude-implement.yml`)

Full content read; the operative pieces:

```yaml
- name: Claude Code — implement the pack
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    show_full_output: true
    prompt: |
      You are implementing a Dev Command Center Implementation Pack inside CI.
      1. Read /tmp/dispatch-meta.json ... and /tmp/implementation-pack.md ...
      2. Read CLAUDE.md at the repo root FIRST and follow it exactly — especially
         the protected-files list ...
      3. Implement the pack on the CURRENT branch ...
      4. Validate what you build (at minimum, parse/build checks on every file
         you touch). Report validation honestly in the PR body.
      5. Commit ... and push ...
      6. If an open PR already exists ... add a PR comment ... Otherwise open a
         pull request ...
      7. NEVER push to dev or main directly. NEVER merge the PR. ...
    claude_args: |
      --allowedTools "Bash(git:*),Bash(gh pr create:*),Bash(gh pr view:*),Bash(npx:*),Bash(node:*),Bash(npm:*),Read,Write,Edit,Glob,Grep"
```

**No `--model` flag. No `--max-turns` (or any turn-limit) flag. No cost/token budget flag. No `settings:` input. Job-level `timeout-minutes: 60` is the only backstop, and it is a wall-clock ceiling, not an economic one.**

### 1.2 `anthropics/claude-code-action@v1` defaults (live-fetched, not assumed)

From `action.yml` and `docs/configuration.md`:

- **No `model`, `max_turns`, or `timeout` top-level inputs exist on the action itself.** These would have to be supplied via `claude_args` (CLI flags) or a `settings` JSON — neither is used here. The model therefore resolves to whatever the underlying Claude Code CLI/SDK defaults to at invocation time, **unpinned**.
- **The action's own default tool grant is narrow**: "By default, Claude only has access to: File operations ..., Comment management ..., Basic GitHub operations" and explicitly "Claude does **not** have access to execute arbitrary Bash commands by default." **This workflow is what widens that** — the `claude_args` allowlist is what grants `Bash` at all, and grants it with **unbounded wildcards** `Bash(npx:*)`, `Bash(node:*)`, `Bash(npm:*)` — any npm script, any node one-liner, any npx-installable tool.
- **No documented default max-turns.** The docs describe `claude_args` as the only way to bound turns and give no default value — i.e., unset means unbounded within the 60-minute job ceiling.
- **No prompt-caching documentation** at the action level (caching is evidently happening — see §1.3 — but it is inherited SDK/API behavior, not something the action configures or reports on).
- **No token/cost/cache telemetry surfaced by the action** — confirmed absent from both `action.yml` outputs and the configuration docs. The only visibility into spend is inside the Claude Code CLI's own terminal JSON result (see §1.3), which lands in raw job logs, not in any action output or GitHub Step Summary field.
- The docs did **not** resolve whether the action injects a baseline system prompt in addition to the user-supplied `prompt:` — this is genuinely undocumented, not just unread; flagged as an open question rather than asserted either way.

### 1.3 Real evidence from failed runs (not simulated)

Two independent live runs were read directly from GitHub Actions job logs (`get_job_logs`, `return_content: true`) — not reconstructed from memory or the operator's summary:

| | Run (job id) | Model | Turns | Wall-clock (Claude step) | `total_cost_usd` | `cache_read_input_tokens` | `cache_creation_input_tokens` | `output_tokens` | Terminal state |
|---|---|---|---|---|---|---|---|---|---|
| A | 2026-07-15, job `87280176214` | `claude-opus-4-8[1m]` | 45 | 6m48s (390.1s API) | **$2.699** | 2,573,254 | 123,473 | 25,634 | `api_error 400` — *Credit balance is too low* |
| B | 2026-08-16, job `95126044313` (attempt 4/4 of run `31929125651`) | `claude-opus-5[1m]` | (not captured in tail) | ~10m2s (601.8s) | **$5.835** | **8,021,982** | 148,240 | 35,881 | `api_error 400` — *Credit balance is too low* |

**Both runs used an Opus-tier model with the `[1m]` (1-million-token context) variant — never pinned, never chosen deliberately, and NOT the same Opus generation between the two runs** (4.8 in July, 5 in August) — direct proof the workflow just takes whatever "opus" resolves to on the day, rather than routing by task risk. `contextWindow: 1000000` / `maxOutputTokens: 64000` appear in both — the largest, most expensive context tier available.

**The dominant cost driver is cache-read volume, not output.** In run B, 8,021,982 cache-read tokens moved against 35,881 output tokens — a ~224:1 ratio. This is the direct fingerprint of a long, multi-turn agentic loop: prompt caching makes each turn's *repeat* of prior context cheap-per-token but not free, and a turn count with no ceiling means that non-zero per-token cost multiplies by however many turns it takes to reach a stopping point — and here, the stopping point was never "done," it was "ran out of money."

**Concrete evidence of exploration/friction, from the runs' own `permission_denials` arrays** (tool calls the model attempted that the `--allowedTools` list refused):

- Run A: denied `Bash(cat /tmp/dispatch-meta.json ...)`, denied `Bash(cat /tmp/implementation-pack.md)`, denied **five** different phrasings of `gh pr list ...` (only `gh pr view`/`gh pr create` are allowed, not `gh pr list` — yet workflow prompt step 6 requires checking "if an open PR already exists," which needs exactly the call that's blocked). Also present: `awk 'NR>=1200 && NR<=1745 ...' data/codex-configs.ts` and `grep -n "id: '.*-\(cartridge|codex\)'" data/codex-configs.ts` with the stated intent *"Identify owning cartridge of experiment-lab tab"* — a real instance of the hypothesis's "architectural re-derivation": the pack didn't declare which cartridge owned the surface being touched, so Claude went and rediscovered it by grepping an unrelated 1,700+ line config file.
- Run B: **six** different phrasings of blocked `gh pr list` variants, right up through `gh api "repos/:owner/:repo/pulls?..."` (working around the CLI block by hitting the REST API directly through the one allowed tool it could still reach) — the same PR-existence-check friction recurring, unresolved, a month later.
- Run B's last captured tool call before running out of credit: appending a large canary test block to `tests/source-of-truth-parity.test.ts` via heredoc, then `npx vitest run tests/source-of-truth-parity.test.ts` — **a single targeted test file, not a full-suite run.** This is an important, honest distinction: the terminal action in this specific run was NOT itself a full-suite validation call. The amplification is not "one giant test run" — it is **cumulative turn count against an ever-growing cached context**, most of which (per §1.4/§1.5) is constitutional/governance material the pack itself already had a compressed answer for.
- `"fast_mode_disabled_reason": "sdk_opt_in_required"` appears in run B — the underlying SDK exposes a cheaper/faster execution mode that this workflow has never opted into.

### 1.4 The Implementation Pack itself is NOT the amplifier — it is already well-compressed

`services/constitutional/implementationPack.ts`'s `ImplementationPack` shape already carries: `goal`, `invariantBindings` (governing invariants, bound not narrated), `resolvedTerms` (canonical vocabulary), `areasToTouch` (file/subsystem globs — **"empty when unknown, never invented"**), `implementationMechanism`, `constitutionalDecision` (mechanism + rationale + rejected alternatives, decided BEFORE the plan), `capabilityEvidence` (existing/missing/boundaries — a reuse map), `preflight` (risk/value/consequence scores), `validationPlan`, `receiptPlan`. `MAX_PACK_CHARS = 55,000` caps the transported markdown. **This is a genuinely compressed artifact — exactly the "DevOn/IDE owns reasoning and compression" half of the operator's governing hypothesis is already built and working.**

Two concrete gaps in what ships downstream, both evidenced directly in `packMarkdown()` (`components/composer/CapabilityPipelineTab.tsx:80-136`):

1. **`areasToTouch` empty → the markdown's own fallback text is an instruction to explore**: `"_not drafted (template pack — determine during implementation)_"`. When the LLM draft step fails (network, parse error, missing mechanism) and the pack falls back to `templateFields()`, `areasToTouch` starts empty and — unless `evidenceAreas()` backfills it from Capability Evidence — the shipped pack literally tells Claude Code to go find the files itself.
2. **The template fallback's own default `validationPlan`** (`services/constitutional/implementationPack.ts:210-214`) is:
   ```ts
   validationPlan: [
     'esbuild parse gates on touched files',
     'existing test suite',                    // ← unscoped
     'coherence/canary checks where applicable',
   ],
   ```
   `'existing test suite'` is not "the tests relevant to this pack" — read literally (and an implementation actor with no other signal WILL read it literally) it is an instruction to run the whole repo's test suite. This is the one line in the entire evidenced pipeline that most directly matches the operator's hypothesis, and it is a one-line fix (§7).

Compression is NOT failing at the pack layer. It is failing at the **consumption** layer: nothing downstream of the pack tells Claude Code "here is what you don't need to re-derive" as forcefully as `CLAUDE.md`'s prose tells it "read me first, follow me exactly."

### 1.5 `CLAUDE.md` — mandatory, full, repo-wide, on every single dispatch

`CLAUDE.md` is **1,778 lines**. Workflow prompt step 2 requires it be read **first**, in full, on **every** implementation regardless of pack scope — including its Identity & Access Spine section, DVN Pipeline Protection section, Companion Menu invariants, Gated Content rules, Q¢ pricing canon, Worldcoin key table, wallet-over-cartridge pattern, and multiple independent "files you MUST NOT modify" lists scattered across different sections (at least three distinct protected-file enumerations were found in this file alone, in the Identity & Access Spine section, the DVN Pipeline Protection section, and the Security/Access Gates section). None of this is filtered by the pack's own declared `areasToTouch` — a pack that only touches `services/campaign/` still requires ingesting the full document, including sections about identity spine internals, DVN receipt taxonomy, and Worldcoin key provisioning that the pack has nothing to do with.

**This is the single largest, most mechanical amplifier available for direct evidence**: it is a fixed ~1,778-line ingestion cost paid identically by every dispatch, independent of task size, and it duplicates exactly what the ALREADY-COMPRESSED pack's `invariantBindings`/`constitutionalDecision`/`capabilityEvidence.boundaries` fields exist to state narrowly. The protected-files enumeration specifically is the clearest case: CLAUDE.md states it in prose across three sections; the pack has no `forbiddenFiles` field to carry the SAME fact pre-extracted and scoped.

### 1.6 Cost-amplification map

```
pack input (≤55,000 chars; already compressed: invariants + decision + evidence + areas + validation + receipts)
  │
  ├─▶ mandatory context expansion
  │     • CLAUDE.md, 1,778 lines, read in FULL on every dispatch, unfiltered by pack scope
  │       (evidenced: workflow prompt step 2; not evidenced to be skippable — no code path reads it partially)
  │     • protected-files boundary re-derived from CLAUDE.md prose every time (no forbiddenFiles field to short-circuit it)
  │
  ├─▶ repo exploration
  │     • areasToTouch empty on a template-fallback pack → explicit "determine during implementation" text
  │     • EVIDENCED (run A): grep/awk into an unrelated 1,700-line config file to identify an owning cartridge
  │       the pack never named
  │     • Glob/Grep granted with no scope restriction to the pack's declared surface
  │
  ├─▶ tool calls
  │     • allowedTools grants Bash(npx:*)/Bash(node:*)/Bash(npm:*) — unbounded within those prefixes
  │     • EVIDENCED (runs A+B): repeated denied gh pr list attempts (5–6 phrasings) because the prompt
  │       REQUIRES an existing-PR check the allowlist doesn't grant — wasted turns on a self-inflicted
  │       permission gap, not a validation or exploration cost
  │
  ├─▶ validation
  │     • template fallback's own validationPlan says "existing test suite" — unscoped by construction
  │     • EVIDENCED (run B): the run's actual last action was a TARGETED single-file vitest run, not a
  │       full-suite call — so full-suite validation is a LATENT risk (present in the template text) more
  │       than a proven per-run cause in the two runs read; the turn-count/cache-read growth is the proven cause
  │
  ├─▶ retry/reasoning loops
  │     • no --max-turns; 45 turns observed in run A with no ceiling that would have stopped it earlier
  │     • repeated gh pr list retries (both runs) are a MICRO retry loop with a knowable, fixable cause
  │
  ├─▶ output/log volume
  │     • show_full_output: true — deliberately added (per the workflow's own comment) to surface API-level
  │       failures that would otherwise show only "is_error:true" with no cause; a real trade of auditability
  │       for volume, not an accident
  │     • EVIDENCED: full tool_use/tool_result JSON (including entire file diffs, e.g. a ~150-line file
  │       rewritten and echoed back in run A's log) is written verbatim into the log stream per turn
  │
  └─▶ API spend
        • EVIDENCED: $2.70 (45 turns, cache-read 2.57M) and $5.84 (cache-read 8.02M) — both runs terminated
          by the ACCOUNT's credit balance, not by any envelope this system enforces
```

### 1.7 Distinguishing already-resolved work from genuine work from redundant rediscovery

- **Already resolved by DevOn/IDE** (present in the pack, evidenced in `packMarkdown()`'s output): governing invariants, canonical terms, the constitutional decision (mechanism + why + rejected alternatives), a capability evidence inventory (existing/missing/never-touch boundaries), a validation plan, a receipt plan, a risk/value preflight score.
- **Work Claude Code genuinely needs to perform**: writing the actual diff for the declared mechanism; running the declared validation steps; committing and opening the PR; handling any genuine uncertainty the pack didn't anticipate.
- **Work being redundantly rediscovered** (evidenced): the full protected-files boundary (already implicit in `capabilityEvidence.boundaries` for some packs, but never surfaced as an explicit `forbiddenFiles` list); the owning-cartridge/subsystem identity for a touched surface when `areasToTouch` shipped empty; whether an open PR already exists for the branch (blocked by the tool allowlist, not solved by better instructions); and, systemically, the sheer act of holding 1,778 lines of governance prose in context on every single dispatch when the pack's own `invariantBindings` already named the specific, narrow subset that governs THIS goal.

---

## 2. Answers to the audit's specific questions

**A. Context** — Pack: ≤55,000 chars (hard ceiling, `MAX_PACK_CHARS`), and the pack is already narrow/structured. Additional injected context: the full 1,778-line `CLAUDE.md`, mandatorily and completely, per explicit prompt instruction — this IS broad constitutional/canonical material already partially represented (narrower) in the pack's own `invariantBindings`. `CLAUDE.md` does force full-repository-scope governance reading regardless of pack scope; nothing filters it.

**B. Exploration** — Claude is not explicitly instructed to inspect the whole repository, but nothing bounds it to the pack's declared surface either: `Glob`/`Grep` are granted without restriction, and when `areasToTouch` is empty the pack's own text says to "determine during implementation." Evidenced: yes, at least once, a broad grep/awk into an unrelated file to answer a question the pack didn't pre-answer.

**C. Validation** — Not proven, in the two evidenced runs, that every implementation triggers a full-suite run — run B's last action was a single targeted test file. But the template-fallback pack's own default validation step literally reads `'existing test suite'`, an unscoped instruction that is a latent, structural risk regardless of whether it fired in these two samples. No evidence either run investigated a pre-existing baseline failure (no baseline-failure list exists to have prompted that), so this specific cost driver is plausible but not directly evidenced in the two logs read. A staged ladder (targeted → affected suite → full regression once) is not implemented anywhere today.

**D. Model/runtime** — `claude-opus-4-8[1m]` (July) and `claude-opus-5[1m]` (August): Opus-tier, 1M-context variant, in both evidenced runs — never pinned by the workflow, resolved to whatever "opus" means that day. No `--max-turns` or high-effort/thinking flags are set explicitly (none appear in `claude_args`); run A reached 45 turns unassisted by any ceiling. Prompt caching is active and heavily used (2.57M–8.02M cache-read tokens) — this is SDK-default behavior, not something the workflow configures, and it is NOT preventing runaway spend, only reducing marginal per-token cost. `"fast_mode_disabled_reason": "sdk_opt_in_required"` confirms a cheaper mode exists and is not engaged. Nothing evidences the action continuing to reason PAST material completion — both observed runs stopped because of an external API-credit wall, not because Claude Code judged itself done, so whether it over-continues past completion under normal (non-credit-exhausted) conditions is untested by this evidence and should not be asserted either way.

**E. Logging** — `show_full_output: true` is a **deliberate, documented trade** (the workflow's own comment names the reason: an API-level failure would otherwise show only `is_error:true` with no cause). The log content itself is a mix of all three named possibilities: verbose model output, full tool-call/tool-result JSON (including entire file bodies on `Read`/`Edit` operations — evidenced: a ~150-line file's full old/new content echoed into the log for one single edit), and the action's own step-boundary logging (`##[group]`/`##[end-action]` framing, git/gh command echoes). Logging CAN be reduced without reducing the specific auditability `show_full_output` exists for (the terminal JSON result block, which carries `api_error_status`, `total_cost_usd`, `usage`, `permission_denials`) — those few, information-dense objects are the auditable signal; the bulk of the log volume is the turn-by-turn tool_use/tool_result stream, which is useful for a deep post-mortem but not for the specific "why did this fail" question the flag was added to answer.

---

## 3. Reuse / extend / create map

| Need | Existing structure | Disposition |
|---|---|---|
| Goal, invariant bindings, canonical terms | `ImplementationPack.goal/invariantBindings/resolvedTerms` | **Reuse as-is** |
| Allowed/expected surface | `ImplementationPack.areasToTouch` | **Extend**: stop shipping empty with a "go explore" fallback text; if truly unknown, say so without inviting unrestricted exploration |
| Forbidden/protected surface | *(none — lives only in CLAUDE.md prose, 3 separate sections)* | **Create**: `forbiddenFiles: string[]`, computed server-side from the SAME protected-file lists already in CLAUDE.md (single source, extracted once, not re-authored) |
| Implementation decisions already made | `ImplementationPack.constitutionalDecision` | **Reuse as-is** |
| Validation plan | `ImplementationPack.validationPlan` + `templateFields()` fallback | **Extend**: fix the unscoped `'existing test suite'` fallback string; layer in the validation ladder (§5) as an ordering convention over the SAME field, not a new field |
| Known baseline failures | *(none)* | **Create**: `knownBaselineFailures: string[]` — pre-computed server-side (this session already has the exact pattern: comparing a stashed-vs-current test run to distinguish pre-existing failures from regressions), attached to the pack once and reused, never rediscovered per-dispatch |
| Uncertainty boundaries / escalation | *(none)* | **Create**: extend `PackPreflight` (already carries `disposition: 'proceed' | 'escalate'`) with an explicit `uncertaintyNotes`/`escalationConditions` pair — this is the SAME preflight object, not a parallel one |
| Execution budget | *(none anywhere in the pipeline or the action)* | **Create**: new `ExecutionBudget` type (§4) — genuinely new, no existing structure to extend |
| Cost/token telemetry | *(none — action surfaces nothing; the ONLY place the numbers exist today is inside the raw Claude Code CLI result JSON in the job log)* | **Create**: a thin extraction step reading the SAME JSON result block that already prints to the log (`/tmp` execution-output file the action itself writes), never a new measurement mechanism |
| Protected-file enforcement | Workflow prompt step 2 (re-derived from CLAUDE.md every run) | **Extend**: keep CLAUDE.md as the human-facing source of truth; ALSO pass the already-known list as `forbiddenFiles` on the pack so the CI actor doesn't have to re-parse prose to reconstruct it |

**No duplicate source of truth is proposed anywhere in this map.** Every "Create" row is either genuinely absent today (execution budget; baseline-failure list) or a direct, single-source extraction of a fact that already lives in exactly one place (`forbiddenFiles` from CLAUDE.md's existing lists; cost telemetry from the CLI's own existing result JSON).

---

## 4. Bounded Execution Contract for Claude Code (design, not implemented)

> DevOn owns reasoning. IDE owns invariant/risk selection and compression. Claude Code owns implementation of the approved pack. Claude Code may expand beyond the pack only when an explicit uncertainty or inconsistency is encountered, and that expansion must be observable.

Concretely, the workflow prompt (`claude-implement.yml`) would be rewritten (in a later, operator-approved pass) to state this contract directly, replacing today's open-ended step 2/4:

- **Default surface**: pack-declared `areasToTouch` + direct import/dependency neighbors of those files. Nothing else, by default.
- **Expansion protocol**: reading outside that surface is allowed, but the actor must record, in the PR body under a fixed heading (`## Scope expansion`): *why* (the specific uncertainty/inconsistency), *what* was added, and whether the run is still inside its declared budget (§4 below). A pack-scoped PR body template already exists implicitly (step 6 of the current prompt already asks for a PR body); this is an additive section, not a new mechanism.
- **Protected surface**: `forbiddenFiles` from the pack is authoritative and non-negotiable — CLAUDE.md's prose remains the source of truth that GENERATES this list server-side, but the CI actor consumes the pre-computed list, not the prose.
- **Baseline failures**: `knownBaselineFailures` are supplied; the actor is instructed NOT to investigate or attempt to fix them unless the pack's goal explicitly names them, and not to burn turns confirming they are pre-existing (this session's own recent CLAUDE.md-workstream established the exact "stash and re-run to prove pre-existing" pattern — worth reusing as the SERVER-SIDE generation method for this list, never as a step the CI actor repeats itself).
- **Escalation, not autonomous continuation, on budget exhaustion**: covered in §4 below.

---

## 4. Execution Budget — schema/design

No dollar figure is hardcoded (no reliable, first-class cost API is confirmed available from the action itself — see §1.2/§1.3; the only cost signal observed is inside the CLI's own terminal JSON, which is retrospective, not a live governor). Bounded proxies instead:

```ts
// Proposed addition to services/constitutional/implementationPack.ts —
// extends ImplementationPack, does not fork it.
export interface ExecutionBudget {
  /** Wall-clock ceiling for the Claude Code step specifically — tighter than
   *  the job's own 60-minute timeout, which stays as the hard outer bound. */
  maxWallClockMinutes: number;
  /** Ceiling on conversational turns — maps directly to a real, already-
   *  supported Claude Code CLI flag (`--max-turns`), not a new mechanism. */
  maxTurns: number;
  /** Ceiling on tool calls that read/search OUTSIDE areasToTouch — the
   *  concrete proxy for "exploration," countable from tool_use entries. */
  maxExploratoryToolCalls: number;
  /** Distinct files opened (Read/Edit/Write) outside the declared surface —
   *  counted the same way, a stricter proxy than raw tool-call count. */
  maxFilesOutsideDeclaredSurface: number;
  /** How many DISTINCT validation invocations (any rung of the ladder, §5)
   *  are permitted before requiring escalation — guards against a retry loop
   *  re-running the same check hoping for a different result. */
  maxValidationPasses: number;
  /** How many times the actor may record a scope-expansion event (§3) before
   *  requiring escalation — a cumulative-uncertainty circuit breaker. */
  maxContextExpansionEvents: number;
}

export type ExecutionState = 'proceeding' | 'awaiting-escalation' | 'complete';
```

**If reliable token/cost telemetry is available** (it is, retrospectively — see §6), the SAME object gains optional post-hoc fields (`observedInputTokens`, `observedOutputTokens`, `observedCacheReadTokens`, `observedCacheCreationTokens`, `observedCostUsd`) populated AFTER the run from the CLI's own result JSON, for the receipt/report — never as a live governor, since nothing in the current action surface supports mid-run cost interruption.

**Budget exhaustion behavior**: the workflow's own step boundary (not Claude Code's own judgment) is the enforcement point. A wrapper step after "Claude Code — implement the pack" reads the CLI's result JSON (`duration_ms`, `num_turns` if present, `permission_denials` count as a **proxy for exploratory attempts already blocked**) against the pack's declared budget and, if exceeded, replaces the "open a PR" step with a distinct, clearly-labeled "budget exceeded — awaiting escalation" PR/comment path (never a silent stop, never autonomous continuation past the ceiling — this satisfies the hard constraint directly).

---

## 5. Validation ladder design

Replaces `templateFields()`'s unscoped `'existing test suite'` default and gives the LLM-drafted `validationPlan` an explicit ordering convention (same field, not a new one):

1. **Syntax/typecheck on the touched surface only** — `tsc --noEmit` scoped, or (this session's own established pattern) a targeted `vitest run <specific test files>` pass, never the whole suite as step 1.
2. **Targeted canaries named in the pack** — whatever `validationPlan`/`receiptPlan` already name for THIS capability.
3. **Affected-subsystem suite** — the test files that import/exercise the touched surface (discoverable the same way this session discovers them: grep for the touched module's import path across `tests/`).
4. **Full regression, exactly once, at the final gate** — only after 1–3 pass, and only once, never re-run speculatively mid-implementation.

`knownBaselineFailures` (§3) are supplied so step 1's typecheck/test output doesn't require the actor to re-derive "is this pre-existing" the way this session repeatedly had to (stash-diff comparison) — that comparison is done ONCE, server-side, when the pack is generated, and travels with the pack.

---

## 6. Cost/telemetry instrumentation plan

The data already exists and is already being computed — by the Claude Code CLI itself, inside the JSON result block it writes to `/home/runner/work/_temp/claude-execution-output.json` (confirmed present in both evidenced run logs: `"Log saved to /home/runner/work/_temp/claude-execution-output.json"`). Today that file's content only ever reaches a human via raw job logs (`show_full_output: true`). Proposed, minimal, additive step in `claude-implement.yml`, immediately after the Claude Code step:

- Read `/home/runner/work/_temp/claude-execution-output.json` (or wherever the action confirms it wrote the result to — verify path stability across action versions before relying on it).
- Extract `total_cost_usd`, `num_turns`, `usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}`, `permission_denials.length`, `modelUsage` (which model actually ran), `terminal_reason`.
- Emit these as a `implementation_dispatched`-adjacent receipt field (or a new, narrowly-scoped receipt type, following this repo's own wholesale-CHECK-constraint-rebuild convention for adding an `ActivityActionType`) so the DCC has durable, queryable cost history per pack — instead of the current state, where the ONLY record of a $2.70 or $5.84 spend is a raw log line an operator has to go find manually, as this audit just did.
- This is pure **observation**, never a live governor (§4's budget enforcement is the governor; this is the ledger).

---

## 7. Specific minimal code changes proposed (file by file — NOT applied in this pass)

| File | Proposed change | Why (evidence) |
|---|---|---|
| `services/constitutional/implementationPack.ts` | Fix `templateFields()`'s `validationPlan` default: replace `'existing test suite'` with a scoped equivalent (e.g. `'typecheck + targeted tests for the declared areasToTouch'`) | §1.4 — the one line most directly matching the operator's hypothesis |
| `services/constitutional/implementationPack.ts` | Add `forbiddenFiles`, `knownBaselineFailures`, `executionBudget` (§4) fields to the `ImplementationPack` interface and `generateImplementationPack()` | §3 reuse/extend map |
| `services/constitutional/implementationPack.ts` (`PackPreflight`) | Add `uncertaintyNotes`/`escalationConditions` alongside the existing `disposition`/`rationale` fields | §3 |
| `components/composer/CapabilityPipelineTab.tsx::packMarkdown()` | Serialize the new fields into their own markdown sections (`## Forbidden files`, `## Known baseline failures`, `## Execution budget`) — same function, additive sections | keeps ONE serializer, no parallel pack-to-text path |
| `.github/workflows/claude-implement.yml` | Add `--max-turns <N>` to `claude_args` (reads `executionBudget.maxTurns` — requires a templating step since `claude_args` is currently a static block; smallest version: parameterize via an env var read from the dispatch payload) | §4 — the one CLI flag proven to exist and unused |
| `.github/workflows/claude-implement.yml` | Add `gh pr list` (or the specific narrower form the prompt needs) to `--allowedTools` | §1.3 — proven, repeated, self-inflicted friction across two independent runs a month apart |
| `.github/workflows/claude-implement.yml` | Rewrite prompt steps 2/4 per the Bounded Execution Contract (§3) — pack-declared surface by default, explicit expansion protocol, reference `forbiddenFiles`/`knownBaselineFailures` fields instead of "read CLAUDE.md and follow it exactly" | §1.5 — the largest single mechanical amplifier |
| `.github/workflows/claude-implement.yml` | New step after "Claude Code — implement the pack": read the CLI result JSON, compare against `executionBudget`, branch to an "awaiting-escalation" PR/comment path on overrun | §4/§6 |
| `services/receipts/activityReceiptService.ts` + a new migration | New `ActivityActionType` (e.g. `implementation_cost_observed`) carrying the extracted telemetry (§6), following the existing wholesale-CHECK-constraint-rebuild convention this repo already uses for every prior addition | §6 |

None of these touch `resolveAuthUserForKybe`, the identity spine, the DVN pipeline, or any access gate — this whole workstream is orthogonal to the Aletheon/Passport work closed earlier this session.

---

## 8. Canary plan

| # | Canary | What it proves |
|---|---|---|
| 1 | A pack with a narrow `areasToTouch` + `forbiddenFiles` produces a CI run whose `permission_denials`/tool-call log shows zero reads outside `areasToTouch` ∪ its direct dependents, absent a recorded scope-expansion entry | Claude cannot silently inspect the whole repo |
| 2 | Given a pack's `validationPlan` following the ladder (§5), assert the FULL regression command (`npx vitest run` with no file argument, or `npm test` bare) appears **at most once** in the run's tool-call log, and only after at least one targeted-test tool call | Full regression cannot run repeatedly during implementation |
| 3 | Given `knownBaselineFailures` populated on the pack, assert no tool-call log shows a `git stash`/diff-comparison pattern (the exact investigative sequence this session used manually) — i.e. the actor never re-derives what the pack already told it | Known baseline failures are supplied rather than rediscovered |
| 4 | Simulate (or replay a captured) result JSON exceeding `executionBudget.maxTurns`/`maxWallClockMinutes`; assert the workflow's post-step opens/updates a PR or comment tagged `awaiting-escalation` and does **not** proceed to any further Claude Code invocation on the same dispatch | Budget exhaustion escalates rather than continues |
| 5 | Given `areasToTouch` non-empty, assert every file in that list is genuinely `Read`-able/`Edit`-able by the granted tool set (no accidental over-restriction from the new `forbiddenFiles` logic clipping a legitimately-declared file) | Pack-declared relevant files remain accessible |
| 6 | Given `forbiddenFiles` containing a known protected path (e.g. `services/identity/getActivePersona.ts`), assert no tool-call log shows an `Edit`/`Write` against it, across a battery of packs that don't name it explicitly | Protected-file boundaries remain intact |
| 7 | Across every canary above, assert the workflow's own prompt/steps still contain "NEVER push to dev or main directly. NEVER merge the PR." verbatim (or an equivalent, reviewed replacement) and that no proposed change here touches the PR-open/human-merge steps | Human merge authorization remains untouched |

---

## 9. Projected before/after execution profile

| | **Current (evidenced)** | **Bounded target (projected)** |
|---|---|---|
| Model | Opus-tier, `[1m]` context, unpinned (varies by day: 4.8 → 5 observed) | Explicit routing (see below); Opus only when the pack declares high uncertainty, touches protected architecture, or a targeted attempt already failed |
| Turns | 45 observed, no ceiling | Bounded by `executionBudget.maxTurns`; escalates rather than continuing past it |
| Context ingested per dispatch | Full `CLAUDE.md` (1,778 lines) + full pack, regardless of scope | Pack + `forbiddenFiles` (pre-extracted) + `knownBaselineFailures` (pre-extracted); `CLAUDE.md` read narrows to whatever the pack's OWN `invariantBindings` already scoped, not the whole document |
| Exploration | Unrestricted `Glob`/`Grep`; evidenced tangential grep into an unrelated file | Default surface = `areasToTouch` + direct dependents; expansion requires a recorded reason |
| Validation | Template fallback literally says `'existing test suite'`; no baseline-failure list; no ladder | 4-rung ladder (§5); full regression at most once, at the gate |
| Tool friction | 5–6 repeated denied `gh pr list` variants per run (two separate runs, a month apart) | `gh pr list` (or the narrow form needed) granted; the specific, evidenced friction eliminated |
| Cost visibility | Only inside raw job logs; this audit had to fetch and read them manually | Extracted into a receipt every dispatch; queryable cost history, no manual log-diving required |
| Budget exhaustion | Terminates on account-level `api_error 400`, PR never opens, spend already happened | Workflow's own budget check catches it BEFORE the account wall in the common case; `awaiting-escalation` PR/comment path either way |
| Observed cost (2 real samples) | $2.70 / 45 turns; $5.84 / (turns not captured, ~10 min) | Not projected as a dollar figure (no reliable live cost API) — projected as: fewer turns (bounded), less redundant context (forbidden-files/baseline-failures pre-supplied), fewer wasted retries (tool-allowlist gap closed) |

---

## Hard constraints — compliance check

- **Constitutional validation not weakened**: no proposed change touches `resolveAuthUserForKybe`, the identity spine, DVN pipeline, or any access gate; §7's changes are additive fields + one workflow prompt rewrite + one new receipt type.
- **Human merge gate untouched**: canary 7 explicitly re-asserts the "never merge" instruction survives any prompt rewrite; nothing in §3–§7 proposes automating the PR-merge step.
- **Auditability not sacrificed for log volume**: §1.7/§6 keep `show_full_output`'s specific value (surfacing API-level failure causes) while proposing to EXTRACT the dense signal (the terminal result JSON) into a durable receipt, rather than removing the verbose stream.
- **Claude Code is not made responsible for invariant discovery IDE already performed**: §3's contract explicitly states Claude Code implements the approved pack; `forbiddenFiles`/`knownBaselineFailures`/`invariantBindings` are all pre-computed and supplied, never re-derived by the CI actor.
- **No rerun of the expensive live pack during this audit**: both evidenced runs were read from already-completed (or already-terminated) job logs; the one live-running attempt found mid-audit was cancelled, not rerun, per explicit operator instruction, with no deletion of any artifact.
- **No speculative optimization implemented ahead of evidence**: every proposed change in §7 cites the specific finding in §1 that motivates it; nothing is proposed "just in case."

---

## Model-routing recommendation (evidence-based, not implemented)

Present configuration: **no routing exists at all** — the workflow always invokes whatever the action/CLI's current Opus-tier default is, for every pack regardless of size or risk. Recommended policy (for operator ratification, not applied here): route to a smaller/faster model by default, escalating to the current Opus-tier default only when the pack's `constitutionalDecision`/`preflight` marks high uncertainty (`disposition: 'escalate'` already exists on `PackPreflight` — reuse it as the routing signal, don't invent a second one), the pack's `forbiddenFiles`/`areasToTouch` overlaps protected architecture, a targeted attempt already failed once on this branch (detectable from the existing "remediation redispatch" branch-reuse convention the workflow already implements), or `executionBudget`'s risk-of-repair proxies are exceeded. This reuses `PackPreflight.disposition` as the trigger rather than adding a new classification.

---

*Forensic audit only. No code was written or modified in this pass. Deliverables 1–9 above are complete; §7's file-by-file changes are proposals awaiting operator review before any implementation begins.*
