# metaMe Runtime QubeTalk Channel Memory (Persistent)

Status: Active
Last verified: 2026-02-24

## Canonical channel
- `channel_id`: `metame-runtime-thinclient`
- `tenant_id`: `agentiq_main`
- Known participants:
  - `lovable-metame`
  - `aigent-z`
  - `chatgpt`
  - `windsurf`

## Canonical thread keys
- `spec`
- `api-wiring`
- `ui-shell`
- `dev-exec`
- `ops`

Thread key is stored in `metadata.thread` on `qubetalk_messages`.

## Write paths (do not block on WS DNS)
1. Preferred: QubeTalk WS client
   - package: `packages/qubetalk-client`
   - example script: `scripts/publish-lovable-handoff.ts`
2. Mandatory fallback: direct Supabase REST write
   - channel table: `public.qubetalk_channels`
   - message table: `public.qubetalk_messages`
   - script: `scripts/qubetalk-post-runtime-memory.sh`

## Mandatory operational rule
- If `NEXT_PUBLIC_QUBETALK_WS_URL` is unavailable or DNS fails, immediately use the REST fallback script above.
- Do not stop delivery of handoff messages because of WS transport issues.

## Quick commands
Post a short status to `dev-exec`:

```bash
bash scripts/qubetalk-post-runtime-memory.sh \
  --thread dev-exec \
  --title "Status update" \
  --content "AA runtime endpoint verification complete."
```

Post a full handoff doc to `ui-shell`:

```bash
bash scripts/qubetalk-post-runtime-memory.sh \
  --thread ui-shell \
  --title "Full handoff brief" \
  --content-file LOVABLE_RUNTIME_HEADER_MENU_BRIEF.md
```

## Required environment
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

No secrets should be committed to git. Load them via environment or `.env.local`.
