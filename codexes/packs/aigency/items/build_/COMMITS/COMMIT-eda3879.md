# Commit Brief: `eda3879` — interactive ccip-read deploy script — one command, prompts for missing keys

| Field | Value |
|-------|-------|
| SHA | [`eda3879`](https://github.com/iQube-Protocol/AigentZBeta/commit/eda3879551eeead0fd80f103f40257e740f656d5) |
| Author | Claude |
| Date | 2026-06-14T02:20:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
interactive ccip-read deploy script — one command, prompts for missing keys

operator hit the same env-var-not-set wall multiple times. add an
interactive wrapper that handles all the failure modes:

scripts/deploy.mjs — one-shot interactive deployer:
  - reads ~/.polity-ccip-read.env if it exists (saves keys between runs
    so re-runs skip prompts; mode 600 so only the user can read it)
  - prompts for POLITY_ISSUER_PRIVATE_KEY if missing — offers to
    generate one via viem.generatePrivateKey() and prints the public
    address + the value to paste into amplify
  - prompts for DEPLOYER_PRIVATE_KEY with hidden input (terminal raw
    mode, no echo)
  - validates length BEFORE spending gas:
      66 chars = 0x + 64 hex = 32-byte private key ✓
      42 chars = 0x + 40 hex = address — explicit error message
        tells operator to get the private key from MetaMask
  - spawns the existing tsx deploy script with proper env
  - on success, prints exact next steps for setting the resolver on
    polity.eth via sepolia.app.ens.domains + the test command

scripts/deploy-polity-resolver.ts — better error messages on the
validation path. checks length explicitly, distinguishes 'this looks
like an address (40 chars)' from 'this is malformed', mentions
'export' vs 'one-shot assignment'.

operator usage now:
  node scripts/deploy.mjs

that's it. one command. no env-var stringing required after the first
run.
```

## Body

operator hit the same env-var-not-set wall multiple times. add an
interactive wrapper that handles all the failure modes:

scripts/deploy.mjs — one-shot interactive deployer:
  - reads ~/.polity-ccip-read.env if it exists (saves keys between runs
    so re-runs skip prompts; mode 600 so only the user can read it)
  - prompts for POLITY_ISSUER_PRIVATE_KEY if missing — offers to
    generate one via viem.generatePrivateKey() and prints the public
    address + the value to paste into amplify
  - prompts for DEPLOYER_PRIVATE_KEY with hidden input (terminal raw
    mode, no echo)
  - validates length BEFORE spending gas:
      66 chars = 0x + 64 hex = 32-byte private key ✓
      42 chars = 0x + 40 hex = address — explicit error message
        tells operator to get the private key from MetaMask
  - spawns the existing tsx deploy script with proper env
  - on success, prints exact next steps for setting the resolver on
    polity.eth via sepolia.app.ens.domains + the test command

scripts/deploy-polity-resolver.ts — better error messages on the
validation path. checks length explicitly, distinguishes 'this looks
like an address (40 chars)' from 'this is malformed', mentions
'export' vs 'one-shot assignment'.

operator usage now:
  node scripts/deploy.mjs

that's it. one command. no env-var stringing required after the first
run.

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/deploy-polity-resolver.ts` |
| Added | `scripts/deploy.mjs` |

## Stats

 2 files changed, 191 insertions(+), 7 deletions(-)
