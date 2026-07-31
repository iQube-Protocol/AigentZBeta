# AigentZBeta Agent Contract (Codex-focused)

## Identity and hierarchy
- Use naming: **Aigent Z**, not "Agency".
- Runtime authority order: **metaMe guardian > Aigent Z orchestration > cartridge agents**.
- Treat missing policy gates, missing receipts, missing CRM ladder instrumentation, and UI drift as defects.

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
