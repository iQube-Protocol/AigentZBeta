# AigentZBeta Agent Contract (Codex-focused)

## Identity and hierarchy
- Use naming: **Aigent Z**, not "Agency".
- Runtime authority order: **metaMe guardian > Aigent Z orchestration > cartridge agents**.
- Treat missing policy gates, missing receipts, missing CRM ladder instrumentation, and UI drift as defects.

## Codebase as implementation invariant
- For any task involving code, architecture, PRDs, specifications, implementation plans, technical reviews, debugging, or proposed platform changes, **inspect the relevant repository code before forming conclusions or recommendations**.
- Treat the live codebase as the shared **implementation invariant**: it is the ground truth for what the system actually does today. Distinguish that from constitutional/canonical intent, product requirements, and future-state design when they differ.
- Prefer evidence from the current working branch and relevant source files, schemas, migrations, tests, routes, call sites, and configuration over recollection, summaries, or architectural assumptions.
- Trace important claims end-to-end where practical (writer → storage/state → processor/reconciler → external/canister/chain boundary → reader/projection/UI) rather than relying on a single file or surface.
- When drafting a PRD or specification, explicitly identify what already exists in code, what can be reused, what must be extended, and what is genuinely new. Do not design around capabilities that already exist under another name or surface.
- When code and documented/canonical intent diverge, report the discrepancy explicitly. Do not silently rewrite one to match the other.
- When a claimed capability or bridge is not found, search broadly enough to rule out alternate call paths, legacy implementations, generated bindings/IDLs, migrations, background jobs, and branch-specific implementations before declaring it absent.
- Use repository evidence as a common reference point across agents so implementation work and future-state design can be reviewed against the same factual substrate.

## Foundational invariants must be executable
- When a platform capability is foundational to downstream constitutional correctness, do not protect it only with documentation or dashboards. Encode the invariant in tests, canaries, reconciliation checks, and/or schema/state constraints that fail when the architecture silently diverges.
- For paired or multi-leg protocols, validate **identity linkage**, not counter equality. The same deterministic event/commitment must be traceable across every required leg; synthetic filler must never be used to make unrelated counters agree.
- Every foundational pipeline should have an end-to-end canary that proves the critical path remains connected across its real boundaries (for example: event → durable local record → canister/service leg(s) → external anchor/verification → local reconciliation/projection).
- Observability surfaces must not provide liveness. Closing an Ops/admin page must never stop background reconciliation, anchoring, settlement, or constitutional-state progression.
- Health indicators must derive from the same population and evidence they claim to summarize. A green aggregate must never be produced by comparing unrelated queues or by hiding stranded/failed records.
- For foundational architecture changes, require a regression test that would have failed against the broken pre-fix implementation. Preserve that test as a permanent architecture canary.
- When an invariant breach is discovered, capture both the immediate repair and the class of failure that allowed the breach so future PRDs/specifications include a prevention mechanism, not only the restored behavior.

## Delivery rules
- **Golden Rule: Do not recreate what already exists.** Reuse first, extend existing platform/cartridge functionality second, and create new systems only when there is no suitable existing surface, service, schema, connector, or workflow to extend.
- Make clear in initial implementation plans what will be reused, what will be extended, and what is genuinely new.
- No destructive actions without checkpoints/tests.
- Never use production credentials, wallets, or live DBs.

## MCP tool access — Threshold / metaMe (no auth required)

A metaMe/Threshold MCP server is available at `https://dev-beta.aigentz.me/api/threshold/mcp`
(no API key or OAuth needed). It's registered in the repo root `.mcp.json` under the key
`threshold` — any MCP-capable agent session opening this repo should read the endpoint from
there rather than being told it out of band. If your harness doesn't auto-read `.mcp.json`, add
the same endpoint manually using this URL. See `CLAUDE.md` for the full note.

## QubeTalk bridge delivery pattern (required)
When Codex completes a sprint/epic slice:

1. Commit implementation artifacts.
2. Create outbox packet with:
   - `python3 scripts/qubetalk_bridge/create_packet.py --deploy-ready --paths <files> ...`
3. Ask Lovable to run: **"Relay QubeTalk bridge"**.
4. Claude runs: `python3 scripts/qubetalk_bridge/apply_packets.py`.
5. Claude validates go/no-go and deploys from `origin/dev`.

## Packet minimum contract
- Include story key, status, assignee, tests, changed paths.
- Include embedded file payloads for no-PR handoff.
- Mark `deploy_ready=true` only when acceptance criteria are complete.

## Output contract
Always leave:
1. Files changed
2. Validation run
3. Remaining risks
4. Suggested next tasks

---

## Repository boundaries are not epistemic boundaries (PARAMOUNT, 2026-08-08)

**The codebase is the implementation invariant — but the codebase SPANS canonical
repositories. "I searched this repo and could not find it" is never a sufficient
basis for declaring behaviour, source, or a mechanism absent.**

### The failure that established this

An investigation into the DVN/PoS constitutional spine concluded that
`cross_chain_service`'s implementation was unavailable because `AigentZBeta`
contains only its IDL. That conclusion was wrong, and it very nearly settled two
questions as unknowable:

- DVN readiness is literally `attestation_count >= 2`, and `submit_attestation`
  performs **no validator authorization and no signature verification** — so
  fabricated attestations promote messages to "ready";
- `proof_of_state` builds its batch root from **receipt IDs, not `data_hash`**,
  leaves `merkle_proof` empty, and synthesises `btc_anchor_txid` on both
  branches — so nothing was ever anchored to Bitcoin.

Both were plainly readable in `iQube-Protocol/iQubeBeta-Program`, whose
`dfx.json` owns those canisters. A repo boundary had become an epistemic one.

### The ownership model (do NOT collapse it)

| Repository | Owns |
|---|---|
| `iQube-Protocol/iQubeBeta-Program` | **Canonical canister implementation** — `cross_chain_service`, `proof_of_state`, `btc_signer_psbt` Rust; candid; deployment config |
| `iQube-Protocol/AigentZBeta` | **Canonical platform implementation** — generated/local IDLs, receipt + commitment spine, reconciler/cron, constitutional state, UI/Ops projections |

**Do not copy canister sources into AigentZBeta.** Two sources of truth would
recreate exactly the drift being debugged (`inv.engineering.036/037`). The
boundary is useful; what was missing was *discoverability and enforced
provenance across it*.

### Required of every agent

1. **Before declaring any canister behaviour or source absent**, consult
   `services/ops/canisterSourceManifest.ts` and read the canonical repo.
   Clone it read-only if needed — it is public.
2. **An observation of a deployed canister outranks a reading of its source.**
   Naming a source repo asserts "this is where the code is maintained", never
   "the live canister runs exactly this". Until a deployed module hash is
   compared against a build of the recorded commit, `deployedModuleHash` stays
   `null` — an honest gap, never a plausible-looking fill.
3. **A read failure is not an empty result.** `get_ready_messages()` exceeding
   the IC query cap returned an error that was caught and rendered as `0`; that
   single mistranslation hid a total finalization outage for the system's entire
   history. Report `UNREADABLE` with the error.
4. **Record new observed caveats in the manifest** when live behaviour
   contradicts, or goes beyond, what the source suggests.

`tests/canister-source-manifest.test.ts` enforces the manifest's structure and
its coverage of every canister this repo holds an IDL for.

---

## Production canister principals are never hard-coded in dependent canister source (PARAMOUNT, 2026-08-08)

**A canister must not embed another canister's production principal as a literal
in its own source. Cross-canister callees are supplied through governed
configuration, with the principal's provenance recorded.**

### The failure that established this

`proof_of_state::anchor()` contained:

```rust
let btc_canister_id = "uxrrr-q7777-77774-qaaaq-cai";
```

That principal is the **local dfx id** from `.dfx/local/canister_ids.json`. It
resolves `canister_not_found` on IC mainnet, so the inter-canister call could
never succeed — and control landed on the fallback every time:

```rust
Err(_) => Ok(format!("mock_btc_txid_{}", &batch.root[..8]))
```

All 76 "anchored" batches recorded a synthesised txid. The system reported
Bitcoin anchoring it had never performed, for its entire deployed life, because
a literal in one canister named a canister that did not exist in the environment
it was deployed to.

A hard-coded principal cannot be environment-aware, cannot be audited against a
deployment record, and cannot fail loudly when wrong — it fails at call time, in
whatever way the caller's error branch happens to be written.

### Required

1. **No production principal as a literal in canister source.** Take it from
   an init argument, a stable governed setting, or an explicit configuration
   record — never `let x = "abcd-..."`.
2. **A missing or unset callee is a refusal, not a fallback.** If the signer is
   not configured, `anchor()` must return `Err`. Substituting synthesised output
   for an unreachable dependency is the defect above, restated.
3. **The principal's provenance is recorded** in
   `services/ops/canisterSourceManifest.ts` (network, module hash, and whether
   it has been verified against a reproducible build) before any dependent
   canister is pointed at it.
4. **Phase P applies this to the new signer.** `proof_of_state` must consume
   Constitutional Anchor v2's principal through governed configuration; the
   repaired canister may not inherit the literal it is replacing.

`tests/no-promoted-local-canister-ids.test.ts` enforces the AigentZBeta half:
no active config or doc may present a local-shaped principal as mainnet truth.

## A failed dev merge must be visible, never silent (PARAMOUNT, 2026-08-09)

**`.github/workflows/merge-claude-to-dev.yml` auto-merges every `claude/**` push into `dev`. A real
content conflict there must never fail the job with no further trace — the failure has to be a
durable, discoverable artifact, not a line in an Actions log nobody is tailing.**

### The failure that established this

A session branch pushed real work — a manuscript, a partner-integration fix, a feature — across
several pushes over two days. Every push conflicted against `dev` (which had independently evolved
the exact mechanism one of the branch's own fixes touched) and every merge job failed silently: no
issue, no notification, nothing beyond a log entry. `dev`/Amplify never received the work. The gap
surfaced only when a brand-new page the branch shipped 404'd on the live site — an incident report
from a human, not from the platform's own tooling. Full account:
`codexes/packs/agentiq/updates/2026-08-09_dev-merge-conflict-resolution-path.md`.

### Required

1. **`.amplify-deploy` conflicts auto-resolve.** It is a single-line deploy-trigger timestamp with
   no semantic content — if it is the ONLY conflicting file, regenerate it and continue. This is
   the only conflict ever auto-resolved in CI; it is mechanical, never a judgment call.
2. **Any other conflicting file aborts the merge and files a GitHub issue.** `dev` is left
   untouched (never a partial or guessed-side commit); the issue names the conflicting files and
   the exact manual resolution command sequence. The job still exits 1 — the issue is additive to
   that signal, not a replacement for it.
3. **A human or agent resolving a filed conflict reads BOTH sides before choosing** — never
   `--ours`/`--theirs` by default. If one side is actively superseding work on the same mechanism,
   say so explicitly in the merge commit rather than forcing a hybrid.
4. **This applies to every agent** working this repo, for the same reason the dev-merge-message
   rule does: a silent failure here is indistinguishable from success until someone notices a live
   page is missing.
