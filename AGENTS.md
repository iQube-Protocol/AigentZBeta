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
