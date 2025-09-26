# Operators Manual: Registry Operations and Cross-Chain Infrastructure

## Overview
This manual explains how iQube minting, saving to Library, and Registry visibility work in the Aigent Z Registry UI. It also covers the Operations Console for monitoring cross-chain infrastructure including ICP canisters, EVM networks, BTC testnet, and DVN (Decentralized Verifier Network) operations.

## Key Concepts
- **Library (Private)**
  - A client-side convenience state saved in the browser's `localStorage`.
  - Indicates the user has saved a template locally for private use or drafting.
  - Displayed as a `Library (Private)` badge on cards and takes precedence over Registry badges when present.

- **Registry (Public/Private)**
  - A server-side state persisted via Next.js API routes (backed by Supabase).
  - `visibility` field on a template determines if it is publicly visible or private to the owner.

## Where Things Are Saved
- **Local (Browser)**
  - `localStorage` keys:
    - `library_<templateId>`: marks item saved to your private library.
    - `minted_<templateId>`: legacy/local hint that an item has been minted.
    - `owner_minted_<templateId>`: local flag to indicate ownership locally.
    - `active_private_<templateId>`, `active_registry_<templateId>`: local activation hints.
  - Purpose: immediate UI responsiveness without waiting for server roundtrips.

- **Server (Registry)
  - Template records and their fields, including:
    - `visibility`: `public` or `private`.
    - `userId` (where applicable) to associate ownership.
  - Mutations happen through:
    - `POST /api/registry/templates` (create/fork)
    - `PATCH /api/registry/templates/:id` (update/visibility changes)

## Minting Flow
1. User clicks `Mint to Registry` in `IQubeDetailModal`.
2. An application notice (`ConfirmDialog`) opens asking to choose `Public` or `Private`.
3. After confirmation, the UI issues a `PATCH /api/registry/templates/:id` with `visibility` set to the chosen option and (if available) a `userId` from `/api/dev/user`.
4. On success, the UI:
   - Clears `library_<id>` so cards now show Registry badges.
   - Dispatches `registryTemplateUpdated` to refresh the grid.
   - Closes the modal.

## Badge Logic (Cards)
- If `library_<id>` exists in `localStorage`, the card shows `Library (Private)`.
- Else if `visibility === 'public'`, the card shows `Registry (Public)`.
- Else if `visibility === 'private'`, the card shows `Registry (Private)`.
- Else, if legacy local `minted_<id>` exists, it shows `Registry (Public)` as a fallback hint (kept for backward compatibility).

## Mint Button Visibility Rules
- In edit mode: shows the Mint button when `visibility` is not set (i.e., not minted server-side).
- In view mode: shows the Mint button when:
  - The template is not minted server-side (`visibility` not set), and
  - Any of the following are true:
    - Local owner flag (`owner_minted_<id>`) is present, or
    - Server owner matches the current user (when available), or
    - No server owner recorded (legacy), or
    - Item is in the local Library (`library_<id>` present).
- The visibility check is computed client-side in a `useEffect` to avoid SSR hydration mismatches.

## Public vs Private (Implications)
- **Public**
  - Visible to all registry users.
  - Others can view, fork, and mint derived versions.
  - This choice is irreversible; the app notice communicates this clearly.

- **Private**
  - Visible only to the owner on the server-side registry.
  - Can be activated to Public later via PATCH (`visibility: 'public'`).

## Troubleshooting
- **Mint button missing** when the item is in Library:
  - Ensure the template has no `visibility` set server-side; minted items won’t offer Mint.
  - Hard refresh to ensure client-only rules are applied.
- **Hydration errors**:
  - Caused by reading `localStorage` in SSR branches.
  - Resolved by computing visibility in `useEffect` and rendering from state.

## Operational Best Practices
- Prefer server `visibility` as source-of-truth for minted state.
- Use `registryTemplateUpdated` to trigger list refreshes after mutations.
- Keep local flags for immediate UX, but don’t hide server-minted items behind local-only state.

## Cross-Chain Operations Console

### Overview

The Operations Console (`/ops`) provides real-time monitoring of cross-chain infrastructure including:

- **ICP Canister Health**: Monitor proof_of_state, btc_signer_psbt, cross_chain_service, and evm_rpc canisters
- **EVM Networks**: Live monitoring of Ethereum Sepolia and Polygon Amoy testnets
- **BTC Integration**: Bitcoin testnet connectivity and anchor status
- **DVN Operations**: Decentralized Verifier Network transaction monitoring
- **Solana Integration**: Solana devnet connectivity monitoring

### Key Operations

#### EVM Transaction Creation and Monitoring

1. **MetaMask Integration**:
   - Create test transactions directly from the DVN card
   - Supports Ethereum Sepolia (Chain ID: 11155111) and Polygon Amoy (Chain ID: 80002)
   - Automatic chain switching and transaction creation

2. **DVN Transaction Monitoring**:
   - Monitor EVM transactions through the DVN system
   - Fallback system provides local monitoring when DVN canister is unavailable
   - Transaction status persists across page refreshes

3. **Transaction Flow**:
   ```
   EVM Transaction → DVN Monitor → Receipt Creation → Batch Processing → BTC Anchoring
   ```

#### BTC Anchor Operations

1. **Anchor Status Monitoring**:
   - Real-time connection status to proof_of_state canister
   - Display of pending receipts and batch information
   - Bitcoin transaction hash tracking when anchors are created

2. **Anchor Creation**:
   - Manual anchor creation via "Anchor" button
   - Currently in diagnostic mode (shows available canister methods)
   - Requires canister redeployment for full functionality

#### Network Health Monitoring

1. **Status Indicators**:
   - Green: Service healthy and responsive
   - Red: Service unavailable or experiencing issues
   - Automatic refresh every 30 seconds

2. **Fallback Systems**:
   - BTC testnet: Dual-API approach (mempool.space + blockstream.info)
   - DVN monitoring: Local RPC queries when canister unavailable
   - Client-side caching for resilience during outages

### Troubleshooting Common Issues

#### DVN Canister Issues

- **Symptom**: `canister_not_found` errors in console
- **Cause**: DVN canister compiled with outdated dependency IDs
- **Resolution**: System automatically uses fallback monitoring
- **Status**: Tracked transactions show as `local:txHash` format

#### BTC Testnet Connectivity

- **Symptom**: Block height shows "—" or red status
- **Cause**: API rate limiting or temporary outages
- **Resolution**: System automatically tries blockstream.info fallback
- **Caching**: Last good block height cached for 10 minutes

#### Anchor Functionality

- **Symptom**: "Anchor functionality not yet implemented" message
- **Cause**: proof_of_state canister missing update methods
- **Available**: get_batches, get_pending_count (query methods)
- **Missing**: issue_receipt, batch, anchor (update methods)
- **Resolution**: Requires canister redeployment with full functionality

### Monitoring Best Practices

1. **Regular Health Checks**:
   - Monitor all network cards for green status
   - Check transaction monitoring functionality weekly
   - Verify fallback systems activate properly

2. **Transaction Management**:
   - Use test transactions with small amounts
   - Monitor transaction hashes persist across sessions
   - Verify DVN monitoring shows confirmed status

3. **Performance Expectations**:
   - Page load: < 3 seconds
   - Network updates: 30-second intervals
   - Fallback activation: < 5 seconds
   - Transaction confirmation: 1-3 minutes (depending on network)

### Error Handling and Recovery

#### Automatic Recovery Systems

- **API Failures**: Automatic fallback to secondary endpoints
- **Canister Issues**: Local RPC queries maintain functionality
- **Network Outages**: Client-side caching preserves last known state

#### Manual Recovery Procedures

1. **Service Restart**: Refresh browser page to reset connections
2. **Cache Clear**: Clear localStorage if transaction state corrupted
3. **Network Reset**: Switch MetaMask networks to refresh connections
4. **Development Server**: Restart with `npm run dev -- -p 3007`

### Future Enhancements

#### Planned Improvements

1. **Full DVN Integration**: Deploy canisters with correct dependencies
2. **Complete BTC Anchoring**: Enable end-to-end anchor workflow
3. **Enhanced Monitoring**: Transaction history and audit trails
4. **Automated Alerts**: Health check notifications and alerting
5. **Performance Metrics**: Detailed monitoring dashboards

#### Integration Roadmap

- **Phase 1**: Fix canister dependencies and redeploy
- **Phase 2**: Enable full anchor workflow
- **Phase 3**: Add advanced monitoring and analytics
- **Phase 4**: Implement automated failover and recovery
