# @agentiq/smartwallet

Shared wallet UI and logic for AgentiQ franchises.

## Status

🚧 **In Development** - Being extracted in Phase 2

## Purpose

Provides crypto wallet integration and UI components:
- Wallet connection UI
- Balance display
- Transaction history
- Library/archive management
- Multi-chain support

## Planned API

```typescript
import { SmartWallet, useWallet } from '@agentiq/smartwallet';

function WalletSection() {
  const { connect, balance, transactions } = useWallet();
  
  return (
    <SmartWallet
      onConnect={connect}
      balance={balance}
      transactions={transactions}
    />
  );
}
```

## Dependencies

- React 18+
- ethers.js or viem
- @agentiq/didqube-client

## Extraction Source

Will be extracted from:
- `/components/wallet/*` (if exists)
- Wallet-related components from AigentZ

## Documentation

See [Phase 2 Plan](../../docs/phase-2-smartwallet.md) for extraction details.
