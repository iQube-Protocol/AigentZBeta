# Self-hosted CCIP-Read ENS — operator runbook (2026-06-13)

Real ENS subname resolution on `polity.eth` (Sepolia) via EIP-3668 CCIP-Read. Bypasses Namestone, JustaName, and any third-party gatekeeper. Once set up, every name minted via `POST /api/identity/persona/[id]/ens` resolves on-chain through standard ENS tooling.

## Prerequisites

- ✅ `polity.eth` registered on Sepolia (you've done this — verified by your screenshot).
- ✅ The wallet that owns `polity.eth` has ~0.005 Sepolia ETH for the contract deploy + resolver-set transactions. Faucet: `https://www.alchemy.com/faucets/ethereum-sepolia`.
- ✅ Latest code pulled to your local checkout (`git pull --rebase origin dev`).
- ✅ Files present:
  ```
  app/api/ens/ccip-read/[sender]/[data]/route.ts
  app/api/ens/ccip-read/health/route.ts
  contracts/PolityOffchainResolver.sol
  scripts/deploy-polity-resolver.ts
  ```

## Step 1 — Generate the polity issuer key (if not already set)

This key signs every gateway response. The corresponding public address is what the deployed contract validates signatures against.

```bash
node -e "console.log(require('viem/accounts').generatePrivateKey())"
```

Output is a 0x-prefixed 64-hex private key. **Treat this as a production secret.** Set in Amplify (server env):

```
POLITY_ISSUER_PRIVATE_KEY=0x<from above>
```

Trigger an Amplify rebuild so the server picks it up.

## Step 2 — Verify the gateway signing roundtrip before spending gas

After Amplify rebuild completes:

```bash
curl -s 'https://dev-beta.aigentz.me/api/ens/ccip-read/health' | jq
```

Expected output:

```json
{
  "ok": true,
  "issuer_address": "0x...",
  "issuer_mode": "production",     ← if "dev" the env var isn't set
  "signing_roundtrip": {
    "sig_matches_issuer": true,    ← MUST be true
    ...
  }
}
```

**Do NOT proceed to step 3 unless `sig_matches_issuer: true`.** If it's `false`, the contract will reject every gateway response and you'll have wasted a deploy. Fix the env var first.

## Step 3 — Deploy the resolver contract to Sepolia

In your local checkout:

```bash
DEPLOYER_PRIVATE_KEY=0x<the wallet that owns polity.eth> \
POLITY_ISSUER_PRIVATE_KEY=0x<same value as Amplify> \
GATEWAY_URL='https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json' \
npx tsx scripts/deploy-polity-resolver.ts
```

The deployer key signs the deploy tx — use the same wallet that owns `polity.eth` for convenience (so the same key signs the resolver-set in step 4). Pull the private key from MetaMask: Settings → Security & Privacy → Show Private Key for the account.

Expected output:

```
Deployer: 0xA87361C4...
Issuer (signer): 0x...
Gateway URL: https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json
Deploying contract to Sepolia...
Deploy tx hash: 0x...
Waiting for confirmation...

✅ Resolver deployed at: 0x<RESOLVER_ADDRESS>
   Sepolia explorer: https://sepolia.etherscan.io/address/0x...

NEXT STEP — set this resolver on polity.eth:
1. Open https://sepolia.app.ens.domains/polity.eth
2. Click "Records" → scroll to "Resolver" → click Edit
3. Set resolver address to: 0x<RESOLVER_ADDRESS>
4. Sign the Sepolia tx (~0.001 ETH gas)
5. Done. first-citizen.polity.eth will now resolve via our gateway.
```

**Save the `<RESOLVER_ADDRESS>` somewhere — you'll need it.**

## Step 4 — Point polity.eth at the new resolver

1. Open `https://sepolia.app.ens.domains/polity.eth`
2. Click the **Records** tab
3. Scroll to the **Resolver** section → click **Edit resolver**
4. Paste the `<RESOLVER_ADDRESS>` from step 3
5. Click **Save** → MetaMask popup → sign the Sepolia tx
6. Wait for confirmation (~30 seconds)

The resolver tab in the ENS UI should now show your contract address.

## Step 5 — Mint a test subname and verify resolution

Mint `first-citizen.polity.eth` (or whatever label you want) via the existing API:

```bash
# Get your supabase token from the browser DevTools localStorage
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).access_token)" < <(pbpaste))

curl -s -X POST "https://dev-beta.aigentz.me/api/identity/persona/<YOUR_PERSONA_ID>/ens" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"label":"first-citizen"}' | jq
```

(Easier: do it from the wallet drawer's ENS section in the UI.)

Then verify on-chain resolution from any ENS-aware tool:

```bash
node -e "
const { createPublicClient, http } = require('viem');
const { sepolia } = require('viem/chains');
const c = createPublicClient({ chain: sepolia, transport: http() });
c.getEnsAddress({ name: 'first-citizen.polity.eth' }).then(a => console.log('Resolved:', a));
"
```

Or in browser at `https://sepolia.app.ens.domains/first-citizen.polity.eth` — the address record should be populated.

Or in the ENS app's UI itself — click around to see Records, Resolver, etc.

## What judges will see

- `sepolia.app.ens.domains/first-citizen.polity.eth` → resolves with address + text records via standard ENS protocol
- `viem.getEnsAddress({ name: 'first-citizen.polity.eth', chain: sepolia })` → returns the synthetic address
- `viem.getEnsText({ name: 'first-citizen.polity.eth', key: 'polity.public_ref', chain: sepolia })` → returns the commitment ref
- The CCIP-Read flow is visible in network traces: the ENS client gets an `OffchainLookup` revert, fetches our gateway, recovers the issuer signature on-chain.

## Public verifier endpoints (for judges)

| URL | Returns |
|---|---|
| `GET /api/polity-passport/issuer` | The polity issuer public EVM address |
| `GET /api/ens/ccip-read/health` | Signing roundtrip diagnostic + gateway readiness |
| `GET /api/identity/resolve-ens/<name>` | Polity-internal resolution (commitment ref, never persona_id) |
| `GET /api/polity-passport/registry` | Public passport registry projection |

## If anything fails

| Symptom | Likely cause | Fix |
|---|---|---|
| `sig_matches_issuer: false` in health | `POLITY_ISSUER_PRIVATE_KEY` env var not set or malformed | Set it server-side, rebuild Amplify, re-check |
| Deploy tx reverts | Deployer wallet has no Sepolia ETH | Top up from faucet |
| ENS app says "no resolver set" after step 4 | Wallet signed but tx didn't confirm | Wait 30s, refresh |
| Subname doesn't resolve in viem/ENS app | Subname not minted in DB OR resolver not set | Run health endpoint with `?name=<full.name>`, check `db_resolution.exists` |
| Gateway returns 5xx | Server can't reach Supabase OR encryption key missing | Check Amplify logs |

## Architecture notes for the submission write-up

This is **not** a Namestone wrapper or JustaName clone. It's a full self-hosted EIP-3668 implementation:

- The resolver contract (`PolityOffchainResolver.sol`) is owner-deployed on Sepolia.
- Every gateway response carries an EIP-191 signature from the polity issuer key.
- The contract verifies the signature on-chain in `resolveWithProof()` via `ecrecover`.
- Records are sourced from the `persona_ens_names` + `locker_ens_names` tables.
- Text records expose `polity.public_ref`, `polity.kind`, `polity.parent`, `polity.minted_at`, `avatar`, `description`.

The same polity issuer key signs:
- AgentKit delegation attestations (`/api/access/delegation/agentkit-attest`)
- ProveKit proof commitments (`/api/polity-passport/attest/<type>`)
- CCIP-Read ENS resolutions (this doc)

Three trust primitives, one cryptographic anchor. The polity issuer is the single root the polity accepts as authority.
