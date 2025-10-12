# QCT ERC20 Token Deployment Guide

## Overview

Deploy **QriptoCENT (QCT)** as an ERC20 token across 5 EVM testnet chains.

---

## Token Specification

| Property | Value |
|----------|-------|
| **Name** | QriptoCENT |
| **Symbol** | QCT |
| **Decimals** | 18 (ERC20 standard) |
| **Total Supply** | 1,000,000,000 QCT |
| **Initial Supply** | 400,000,000 QCT (40% premine) |
| **Max Supply** | 1,000,000,000 QCT (capped) |
| **Burnable** | Yes (for bridge operations) |
| **Mintable** | Yes (by bridge only) |

---

## Target Chains

1. **Ethereum Sepolia** (Chain ID: 11155111)
2. **Polygon Amoy** (Chain ID: 80002)
3. **Arbitrum Sepolia** (Chain ID: 421614)
4. **Optimism Sepolia** (Chain ID: 11155420)
5. **Base Sepolia** (Chain ID: 84532)

---

## Prerequisites

### 1. EVM Private Key

Generate or use an existing EVM private key (without 0x prefix):

```bash
# Example format
export EVM_DEPLOYER_KEY="your_private_key_here"
```

### 2. Testnet Tokens

Get testnet ETH/tokens for each chain:

- **Sepolia ETH**: https://sepoliafaucet.com/
- **Polygon Amoy**: https://faucet.polygon.technology/
- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia
- **Optimism Sepolia**: https://app.optimism.io/faucet
- **Base Sepolia**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

---

## Deployment Steps

### Step 1: Set Environment Variable

```bash
export EVM_DEPLOYER_KEY="your_private_key_without_0x"
```

### Step 2: Run Deployment

```bash
npm run deploy:qct-erc20
```

The script will:
1. Deploy QCT to all configured chains
2. Show deployment addresses
3. Save addresses to `deployments/qct-erc20-addresses.json`

---

## Contract Features

### Core Functions

```solidity
// Transfer tokens
function transfer(address to, uint256 amount) external returns (bool)

// Approve spending
function approve(address spender, uint256 amount) external returns (bool)

// Burn tokens (for bridge)
function bridgeBurn(uint256 amount, string targetChain, string targetAddress) external

// Mint tokens (bridge only)
function bridgeMint(address to, uint256 amount, string sourceChain, string sourceTxHash) external

// Set bridge address (owner only)
function setBridge(address _bridge) external
```

### Events

```solidity
event TokensMinted(address indexed to, uint256 amount, string sourceChain, string sourceTxHash)
event TokensBurned(address indexed from, uint256 amount, string targetChain, string targetAddress)
event BridgeUpdated(address indexed oldBridge, address indexed newBridge)
```

---

## Post-Deployment

### 1. Verify Contracts

```bash
# Sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "<DEPLOYER_ADDRESS>"

# Amoy
npx hardhat verify --network amoy <CONTRACT_ADDRESS> "<DEPLOYER_ADDRESS>"

# And so on...
```

### 2. Update Application

Add contract addresses to `.env.local`:

```bash
NEXT_PUBLIC_QCT_SEPOLIA=0x...
NEXT_PUBLIC_QCT_AMOY=0x...
NEXT_PUBLIC_QCT_ARBITRUM_SEPOLIA=0x...
NEXT_PUBLIC_QCT_OPTIMISM_SEPOLIA=0x...
NEXT_PUBLIC_QCT_BASE_SEPOLIA=0x...
```

### 3. Set Bridge Address

Once bridge contract is deployed:

```bash
# For each chain
npx hardhat run scripts/set-bridge.js --network sepolia
```

---

## Distribution Plan

### Initial 400M QCT (40% Premine)

| Allocation | Amount | Purpose |
|------------|--------|---------|
| **DEX Liquidity** | 200M QCT | Uniswap/SushiSwap pools |
| **Bridge Reserves** | 100M QCT | Cross-chain liquidity |
| **Treasury** | 70M QCT | Development & operations |
| **Team/Advisors** | 30M QCT | 4-year vesting |

### Remaining 600M QCT (60%)

- Minted via bridge from Bitcoin Runes
- Minted via bridge from Solana SPL
- Locked in bridge contracts

---

## Bridge Operations

### Burn (Lock) Tokens

User burns QCT on EVM chain to transfer to Bitcoin/Solana:

```solidity
qct.bridgeBurn(
  1000 * 10**18,           // 1000 QCT
  "bitcoin",               // Target chain
  "tb1q..."                // Target address
);
```

### Mint (Unlock) Tokens

Bridge mints QCT on EVM chain from Bitcoin/Solana:

```solidity
qct.bridgeMint(
  userAddress,
  1000 * 10**18,           // 1000 QCT
  "bitcoin",               // Source chain
  "61f7b8e6..."            // Source tx hash
);
```

---

## Security Features

1. **Max Supply Cap**: Cannot mint beyond 1B QCT
2. **Owner Controls**: Only owner can set bridge address
3. **Bridge-Only Minting**: Only bridge can mint tokens
4. **Burnable**: Users can burn for cross-chain transfers
5. **OpenZeppelin**: Uses audited contracts

---

## Troubleshooting

### Error: "Insufficient balance"

**Solution**: Get testnet tokens from faucets

### Error: "Transaction underpriced"

**Solution**: Increase gas price in hardhat.config.js

### Error: "Nonce too high"

**Solution**: Reset account nonce or wait for pending txs

---

## Next Steps

1. ✅ Deploy QCT ERC20 (this guide)
2. ⏭️ Deploy QCT SPL on Solana
3. ⏭️ Deploy Bridge Contracts
4. ⏭️ Integrate with QCT Trading Card
5. ⏭️ Add Liquidity to DEXs

---

## Resources

- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts/
- **Hardhat Documentation**: https://hardhat.org/docs
- **ERC20 Standard**: https://eips.ethereum.org/EIPS/eip-20

---

**Ready to deploy QCT ERC20 across 5 EVM chains!** 🚀

Run: `npm run deploy:qct-erc20`
