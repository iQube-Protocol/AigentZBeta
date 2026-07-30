# Security Incident — Agent Key Encryption Secret + Supabase Service Role Key Exposure

**Status: CONTAINED — ROTATION PENDING.** This is not FIXED or RESOLVED. Redaction stops
propagation via future clones; it does not invalidate copies already present in git history,
existing clones, or (for one credential) client bundles already shipped to browsers.

---

## What was found

Discovered while fixing an unrelated hardcoded testnet Bitcoin key (R-11/G-3). Checking whether
`.env.local.temp` was tracked in git before writing a new value into it surfaced that it was —
and that surfaced two materially more severe, unrelated exposures.

### 1. `SUPABASE_SERVICE_ROLE_KEY` — tracked in git

`.env.local.temp` was tracked in this repo's history (back through at least commit `8652b0377`)
with a real Supabase `service_role` key committed in it. The same literal value was also found
hardcoded in two tracked markdown docs (`AMPLIFY_ENV_VARS.md`, `FIX_MISSING_AGENT_KEYS.md`).

**Separately, and more urgently:** ten files carried a fallback pattern reading
`process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
Next.js inlines any `NEXT_PUBLIC_*` value into the client-side JavaScript bundle at build time.
The operator confirmed `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` was set in Amplify **with the old
key value** — meaning that key had been shipped to every visitor's browser for as long as it was
configured, a live public exposure, not merely a git-history one.

### 2. `AGENT_KEY_ENCRYPTION_SECRET` — tracked in git, alongside the ciphertext it decrypts

The AES key used to decrypt **agent private keys** (`aigent-z`, `aigent-moneypenny`,
`aigent-nakamoto`, `aigent-kn0w1` — real blockchain wallet custody, not database access) was
found hardcoded in plaintext across seven tracked files (`FIX_MISSING_AGENT_KEYS.md`,
`PRODUCTION_CHECKLIST.md`, `MIGRATION_COMPLETE.md`, `SECURE_KEYS_SETUP.md`,
`AMPLIFY_ENV_VARS.md`, `scripts/migrate-agent-keys.ts`, and `encrypted-keys-correct.sql`). That
last file also contained the actual AES-encrypted private-key ciphertext for all four agents —
meaning both halves needed to decrypt real agent wallets were sitting in the same git history.

The same `NEXT_PUBLIC_*`-fallback anti-pattern existed for this secret in five more files, plus
one instance for `NEXT_PUBLIC_CORE_SUPABASE_SERVICE_ROLE_KEY` in a Nakamoto Core Hub client.

**Confirmed by the operator (2026-07-30): `NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET` was actually
set in Amplify with a real value.** This is the most severe single fact in this incident — it
means the key that decrypts real agent private keys had been inlined into the client-side
JavaScript bundle and shipped to every visitor's browser, a live public exposure, not a git-history
one. Every reference to this variable name (including the two remaining presence-only boolean
checks initially left in place, since a boolean read doesn't leak a value on its own) was removed
per the operator's explicit instruction to eliminate the name from the codebase entirely, not only
its value-reading uses.

### 3. Debug endpoints returning secret fragments, unauthenticated

- `app/api/debug/env-check/route.ts` — printed 16–30 character prefixes of six different
  secrets (including literal hardcoded prefixes of the two secrets above, in an `expected` block)
  in a plain JSON response, with no authentication. Its own header comment said "DELETE THIS FILE
  after debugging!" — never done.
- `app/api/admin/debug/check-env/route.ts` — printed a 50-character preview of `DFX_IDENTITY_PEM`
  (an Internet Computer identity private key), unauthenticated.
- `app/api/a2a/signer/transfer/route.ts` — the live agent-to-agent transfer endpoint — logged a
  20-character prefix of the service role key to server logs (CloudWatch/Amplify) on every
  request.

---

## Containment applied (this change)

- Removed every plaintext occurrence of both secret values from the tracked tree (replaced with
  an explicit `<REDACTED-...>` placeholder in docs; removed the hardcoded hint from the script).
- Deleted `encrypted-keys-correct.sql` entirely (no code/doc references it; a hollowed-out
  placeholder version would have served no purpose).
- Deleted `app/api/debug/env-check/route.ts` entirely (no references anywhere; superseded by the
  already-existing, safer `app/api/admin/debug/check-env/route.ts`).
- Removed the `NEXT_PUBLIC_*` fallback for `SUPABASE_SERVICE_ROLE_KEY`, `AGENT_KEY_ENCRYPTION_SECRET`,
  and `CORE_SUPABASE_SERVICE_ROLE_KEY` from every file that read it as a value (14 files). Left
  untouched: fallbacks to `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key is designed to be public)
  and presence-only boolean checks (`!!process.env...`), neither of which leaks a value.
- `app/api/admin/debug/check-env/route.ts`: reduced to boolean presence only — removed the DFX
  PEM length/preview fields.
- `app/api/a2a/signer/transfer/route.ts`: removed the secret-prefix logging line. Did not modify
  the transfer logic itself.
- `app/api/admin/debug/check-eth-balance/route.ts`: fixed the `NEXT_PUBLIC_*` fallback only — this
  route is load-bearing (`components/ops/FundingStatusCard.tsx` calls it) and its response does
  not leak secret values, so it was not deleted.
- `.env.local.temp` untracked from git (separate commit, `8f16e7295`/`9f135a363`); `.env.*` in
  `.gitignore` now actually takes effect for it.
- Every remaining reference to `NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET` removed, including the
  two presence-only boolean checks initially left in place (`app/api/admin/debug/env-check/route.ts`,
  `app/api/admin/debug/supabase-conflict/route.ts`) — per the operator's instruction to eliminate
  the name entirely once its live exposure was confirmed, not merely its value-reading uses.
- **New canary added:** `tests/security-no-next-public-secrets.test.ts`. Structurally scans every
  file under `app/`, `services/`, `components/`, `scripts/`, `packages/`, `apps/` (500+ files) for
  any non-boolean reference to the three confirmed-dangerous `NEXT_PUBLIC_*` names, and checks the
  debug endpoints for secret-fragment slicing (`.substring`/`.slice` on a secret-named variable)
  and literal high-entropy prefix patterns (the `expected: { ENCRYPTION_KEY_starts: '...' }` shape
  that caused the worst leak). Verified to actually fail against an injected regression before being
  trusted (reverted after confirming). This is a static-source-scan proof, not a build-output
  inspection: if zero files ever reference `process.env.NEXT_PUBLIC_<secret>`, Next.js's
  build-time inlining has nothing to place into any bundle, client or server — a stronger and
  cheaper guarantee than checking one particular build's output after the fact.

Full suite: 186 files / 3344 tests, green throughout.

## Explicitly NOT done in this slice (operator-directed)

- No git history rewrite. Redaction stops future exposure; it does not un-expose history already
  cloned or already public. A coordinated history purge is deferred to a controlled exercise.
- No wallet rotation, no re-encryption of the four agents' stored private keys, no fund movement.
- No revocation of the old Supabase key — the operator is running a coexistence migration (new
  secret API key installed in Amplify + local dev, old key revoked only after smoke tests pass).
- No authentication was added to `/api/admin/*` — a repo-wide check found **no middleware or
  per-route auth gate protecting this entire path prefix**, which is a separate, much larger
  finding than what was in scope here. Flagged, not fixed: retrofitting auth without understanding
  the intended access model risks breaking legitimate ops workflows.
- `app/api/a2a/signer/transfer/route.ts` (the live fund-transfer endpoint) has **no visible
  authentication check of any kind** — a bare `POST` with an `agentId` decrypts that agent's real
  private key and can move funds. This predates today's changes and was not introduced here; it
  is flagged as a separate, serious finding rather than fixed, since altering live money-movement
  logic is explicitly out of scope for this containment pass.

## Remaining remediation (tracked, not yet done)

- Identify affected wallets and current balances (`aigent-z`, `aigent-moneypenny`,
  `aigent-nakamoto`, `aigent-kn0w1`).
- Decide: generate replacement wallets and migrate authority/assets, or accept residual risk with
  a documented rationale.
- Re-encrypt retained key records under a freshly rotated `AGENT_KEY_ENCRYPTION_SECRET`.
- Revoke old wallet operational authority once replacements are live.
- Revoke the old Supabase `service_role` key once Amplify/local-dev smoke tests confirm the new
  one works end to end (compatibility probe, privileged read/write, activity-receipt insertion).
- Decide on authentication for `/api/admin/*` broadly and for the transfer endpoint specifically.
- Consider a coordinated git-history purge as part of a later, explicitly scheduled
  launch-security exercise — not before.

## Verification

```bash
# no plaintext secret values remain in the tracked tree
grep -rln "e35c7d79651daadd8723ff952c90fe55c567143065e1159d5e683ff3c9703fda" . 2>/dev/null | grep -v node_modules
grep -rln "Ex0TywZI7QD7i3KcGkwK" . 2>/dev/null | grep -v node_modules
# both return nothing

# no remaining NEXT_PUBLIC_ fallback reads (as opposed to safe presence-only checks) for the
# three dangerous variable names
grep -rn "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\|NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET\|NEXT_PUBLIC_CORE_SUPABASE_SERVICE_ROLE_KEY" \
  --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null \
  | grep -v node_modules | grep -v "\.next/" | grep -v "!!" | grep -v "present:"
# returns only a boolean-negation check in a diagnostic route (safe)
```
