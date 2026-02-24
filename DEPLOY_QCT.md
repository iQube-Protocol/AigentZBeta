# QCT Token Deployment Guide

## Prerequisites

1. **Environment Variables** - Add to `.env.local`:
```bash
# EVM Deployer Private Key (for testnet deployments)
EVM_DEPLOYER_KEY=your_private_key_here

# RPC URLs (already configured)
NEXT_PUBLIC_RPC_ETHEREUM_SEPOLIA=https://sepolia.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_RPC_POLYGON_AMOY=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA=https://sepolia.optimism.io
NEXT_PUBLIC_RPC_BASE_SEPOLIA=https://sepolia.base.org
```

2. **Install Dependencies**:
```bash
npm install @openzeppelin/contracts@^4.9.3 hardhat@^2.17.1 @nomicfoundation/hardhat-toolbox@^3.0.2
```

## Deployment Steps

### 1. Deploy to Ethereum Sepolia
```bash
npx hardhat run scripts/deploy-qct.js --network sepolia
```

### 2. Deploy to Polygon Amoy
```bash
npx hardhat run scripts/deploy-qct.js --network amoy
```

### 3. Deploy to All Testnets
```bash
# Deploy to all configured testnets
npx hardhat run scripts/deploy-qct.js --network sepolia
npx hardhat run scripts/deploy-qct.js --network amoy
npx hardhat run scripts/deploy-qct.js --network arbitrumSepolia
npx hardhat run scripts/deploy-qct.js --network optimismSepolia
npx hardhat run scripts/deploy-qct.js --network baseSepolia
```

## Post-Deployment

### 1. Update Contract Addresses
After deployment, update `/config/qct-contracts.ts` with the real deployed addresses.

### 2. Verify Contracts
```bash
# Example for Sepolia
npx hardhat verify --network sepolia CONTRACT_ADDRESS "Qripto Cross-Chain Token" "QCT" "100000000000000000000000000" "DEPLOYER_ADDRESS"
```

### 3. Test Integration
1. Open the app at `http://localhost:3000/ops`
2. Navigate to QCT Trading Card
3. Connect MetaMask to testnet
4. Check if real QCT balances load (should show 0 initially)
5. Test minting functionality

## Contract Features

- **Name**: Qripto Cross-Chain Token
- **Symbol**: QCT
- **Decimals**: 18
- **Initial Supply**: 100M QCT
- **Max Supply**: 1B QCT
- **Features**: Mintable, Burnable, Pausable, Bridge-compatible

## Faucet Setup (Optional)

To distribute test QCT tokens, the contract owner can:

```solidity
// Mint tokens to users
qctToken.mint(userAddress, amount);

// Set up bridge contract
qctToken.setBridgeContract(bridgeAddress);
```

## Next Steps

1. ✅ Deploy QCT contracts
2. ⏳ Update trading API with real addresses
3. ⏳ Test real balance loading
4. ⏳ Implement minting/burning UI
5. ⏳ Add DEX integration for trading
