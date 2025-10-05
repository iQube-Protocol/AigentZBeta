# Network Route Pattern (Ops Console)

This document describes the standard pattern for building Ops API routes in `apps/aigent-z/app/api/ops/` that fetch live network data reliably.

- **Multi-endpoint fallback**
  - Define an ordered list of public RPC endpoints for the network.
  - Try each endpoint in order with a short timeout (5s) using `AbortController`.
  - On success, return immediately and include the `rpcUrl` host used in the response.

- **Timeout helper**
```ts
const withTimeout = async (url: string, body: any, ms = 5000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(id); }
};
```

- **Response shape**
  - Always include: `ok`, `at` (ISO timestamp), and a field indicating the network (e.g., `chainId` for EVM, `cluster` for Solana).
  - Include `rpcUrl`: the host of the endpoint actually used.
  - Provide at least one live metric: block number/height, latest tx/sig, etc.

- **Cards should prefer locally created tx/sigs**
  - When a user triggers a Test TX or similar, store the identifier in `localStorage` with a per-chain key pattern `last_tx_${chainId}` (or per-network equivalent).
  - In the card render, prefer the locally created identifier when displaying the “Latest TX/Signature.”

- **Examples**
  - EVM (Sepolia, Amoy, Optimism, Arbitrum, Base): use `eth_blockNumber` + `eth_getBlockByNumber` and optional `eth_gasPrice`.
  - Solana (Testnet/Devnet): use `getLatestBlockhash` + `getBlockHeight`.

- **Do NOT modify**
  - The MetaMask transaction creation function `createTestTx` unless explicitly approved (see project memory: CRITICAL MetaMask RPC Error Resolution Pattern).
