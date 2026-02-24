# Lovable Handoff: QubeTalk Seed Utility Ready

The QubeTalk seed-message utility for `metame-runtime-thinclient` is implemented and integrated.

## What is ready

- `@metame/qubetalk-client` now includes canonical seed messages and publish helpers.
- `/dev` in `apps/metame-runtime-shell` now has a one-click **Publish Canonical Seed Messages** action.
- Publish behavior is authority-aware, so Lovable posts only allowed thread seeds and reports skipped threads.

## Key files

- `packages/qubetalk-client/src/seeds.ts`
- `packages/qubetalk-client/src/policy.ts`
- `packages/qubetalk-client/src/client.ts`
- `packages/qubetalk-client/src/react.tsx`
- `apps/metame-runtime-shell/app/dev/page.tsx`

## Lovable steps

1. Set env vars in the shell app:
   - `NEXT_PUBLIC_QUBETALK_WS_URL`
   - `QUBETALK_AUTH_TOKEN` (or `NEXT_PUBLIC_QUBETALK_AUTH_TOKEN`)
   - `NEXT_PUBLIC_QUBETALK_AUTHORITY=lovable`
2. Run the shell app and open `/dev`.
3. Click **Publish Canonical Seed Messages**.
4. Verify publish summary:
   - `published` should include Lovable-permitted threads.
   - `skipped` should include non-permitted threads (for example `api-wiring` when authority is `lovable`).
5. Use per-thread panels to confirm seeds landed in channel history.

## Expected behavior for `lovable` authority

- Allowed publish threads: `spec`, `ui-shell`, `dev-exec`, `ops`
- Blocked publish thread: `api-wiring`

