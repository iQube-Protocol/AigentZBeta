# Knowledge — Operators Manual

Source: `docs/OPERATORS_MANUAL.md`

Registry operations, minting flows, and cross-chain infrastructure monitoring.

---

## Registry Operations

### Key Concepts

- **Library (Private)** — Client-side state saved in browser `localStorage`. Displayed as `Library (Private)` badge. Takes precedence over Registry badges.
- **Registry (Public)** — Server-side state in Supabase via Next.js API routes. Globally visible and discoverable by all users.
- **Registry (Private)** — Server-side, visible only to the owner. Can be promoted to Public later.

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `library_<templateId>` | Item saved to private library |
| `minted_<templateId>` | Local mint hint (legacy) |
| `owner_minted_<templateId>` | Local ownership hint |
| `active_private_<templateId>` | Local activation hint |
| `active_registry_<templateId>` | Local activation hint |

### Minting Flow

1. User clicks `Mint to Registry` in `IQubeDetailModal`
2. `ConfirmDialog` opens — choose `Public` or `Private`
3. UI issues `PATCH /api/registry/templates/:id` with `visibility` + `userId`
4. On success:
   - Clears `library_<id>` from localStorage
   - Dispatches `registryTemplateUpdated` to refresh grid
   - Closes modal

### Badge Logic

```
if library_<id> in localStorage → "Library (Private)"
else if visibility === 'public'  → "Registry (Public)"
else if visibility === 'private' → "Registry (Private)"
else if minted_<id> in localStorage → "Registry (Public)" (legacy fallback)
```

### Mint Button Visibility Rules

- In edit mode: show when `visibility` not yet set server-side
- In view mode: show when item is in Library AND no server-side visibility AND user is authenticated
- Computed in `useEffect` to avoid SSR hydration mismatches

### Public vs Private Implications

| Visibility | Discoverable | Forkable | Reversible |
|-----------|--------------|----------|------------|
| Public | All users | Yes | No |
| Private | Owner only | No | Yes (promote to Public) |

### Registry API Endpoints

```bash
# Create new template
POST /api/registry/templates
{ "name": "...", "type": "ContentQube", "visibility": "public" }

# Update visibility
PATCH /api/registry/templates/:id
{ "visibility": "public" }

# Delete
DELETE /api/registry/templates/:id

# Get current user
GET /api/dev/user
# → { "maskedDevUserId": "dev-****-1234", "validUuid": true }
```

---

## Cross-Chain Operations Console

The Ops Console (`/ops` or Settings → Network Ops in Aigent Z) provides real-time monitoring.

### Infrastructure Stack

1. **ICP Internet Computer**
   - `proof_of_state` — Transaction anchoring
   - `cross_chain_service` — DVN operations
   - `btc_signer_psbt` — Bitcoin PSBT signing
   - `evm_rpc` — EVM network relay

2. **EVM Networks**
   - Ethereum Sepolia (11155111)
   - Polygon Amoy (80002)

3. **Bitcoin Network**
   - Bitcoin Testnet integration via PSBT
   - Anchor transaction monitoring

### EVM Transaction Monitoring

**DVN Transaction Flow**:
```
EVM Transaction → DVN Monitor → Receipt Creation → Batch Processing → BTC Anchoring
```

- Create test transactions from DVN card in Ops Console
- Supports Ethereum Sepolia and Polygon Amoy
- Fallback monitoring via local RPC when DVN canister unavailable
- Transactions tracked as `local:txHash` when canister offline

### BTC Anchor Operations

- Real-time connection status to `proof_of_state` canister
- Display of pending receipts and batch information
- Bitcoin txid tracking when anchors confirmed

**Available canister methods**: `get_batches`, `get_pending_count` (query)
**Requires canister redeployment**: `issue_receipt`, `batch`, `anchor` (update)

### Status Indicators

| Indicator | Meaning |
|-----------|---------|
| Green | Service healthy and responsive |
| Red | Service unavailable or erroring |

Auto-refresh every 30 seconds.

### Fallback Systems

| Service | Primary | Fallback |
|---------|---------|---------|
| BTC testnet height | Blockstream API | mempool.space |
| DVN monitoring | ICP canister | Local RPC queries |
| Network data | Live | Client-side cache (10 min TTL) |

---

## Troubleshooting

### Mint Button Missing

- Ensure template has no `visibility` set server-side (minted items won't offer Mint again)
- Hard refresh to re-evaluate client-only localStorage rules

### Hydration Errors

- Caused by reading `localStorage` in SSR branches
- Fix: compute visibility in `useEffect`, render from state

### DVN Canister Issues

- **Symptom**: `canister_not_found` in console
- **Cause**: Canister compiled with outdated dependency IDs
- **Effect**: System auto-falls back to local RPC monitoring

### BTC Testnet Connectivity

- **Symptom**: Block height shows "—" or red status
- **Cause**: API rate limiting or outage
- **Effect**: Auto-tries blockstream.info, then caches last good value for 10 minutes

### Manual Recovery

1. **Browser refresh** — resets connections
2. **Clear localStorage** — fixes corrupted transaction state
3. **Switch MetaMask networks** — refreshes chain connections
4. **Dev server restart** — `npm run dev -- -p 3007`

---

## Monitoring Best Practices

1. Check all network cards for green status on each session start
2. Use small test transactions (verify DVN monitoring with confirmed status)
3. Verify fallback systems activate properly when primary fails

**Performance expectations**:
- Page load: < 3 seconds
- Network status updates: 30-second intervals
- Fallback activation: < 5 seconds
- Transaction confirmation: 1–3 minutes (network dependent)
