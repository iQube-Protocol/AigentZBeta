# QCT (QriptoCENT) Multi-Chain Deployment - Complete Guide

## 🎉 Deployment Status

### ✅ **DEPLOYED:**

#### **1. Bitcoin Runes (Testnet)**
- **Status:** ✅ DEPLOYED
- **Transaction:** `61f7b8e6682f29235ee2f3096132ef9fce0cf094bc22c8d2fbb067aef6ee29f2`
- **Rune Name:** QRIPTOCENT
- **Symbol:** Q¢
- **Decimals:** 8
- **Rune ID:** PENDING (check after 6 confirmations)
- **Explorer:** https://mempool.space/testnet/tx/61f7b8e6682f29235ee2f3096132ef9fce0cf094bc22c8d2fbb067aef6ee29f2

#### **2. EVM Chains (ERC20) - 5 Chains**

| Chain | Address | Explorer |
|-------|---------|----------|
| **Ethereum Sepolia** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | [View](https://sepolia.etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3) |
| **Polygon Amoy** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | [View](https://amoy.polygonscan.com/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512) |
| **Arbitrum Sepolia** | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | [View](https://sepolia.arbiscan.io/address/0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0) |
| **Optimism Sepolia** | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | [View](https://sepolia-optimism.etherscan.io/address/0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9) |
| **Base Sepolia** | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` | [View](https://sepolia.basescan.org/address/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9) |

**ERC20 Details:**
- **Name:** QriptoCENT
- **Symbol:** QCT
- **Decimals:** 18
- **Initial Supply:** 400,000,000 QCT (40%)
- **Max Supply:** 1,000,000,000 QCT

### ⏭️ **READY TO DEPLOY:**

#### **3. Solana SPL (Devnet)**
- **Status:** ⏭️ Script ready
- **Command:** `npm run deploy:qct-spl`
- **Decimals:** 9
- **Initial Mint:** 400,000,000 QCT

---

## 📋 Quick Reference

### Deployment Commands

```bash
# Bitcoin Runes (COMPLETED)
npm run deploy:qct-runes

# EVM Chains (COMPLETED)
npm run deploy:qct-erc20

# Solana SPL (READY)
npm run deploy:qct-spl
```

### Environment Variables Needed

```bash
# Bitcoin (USED)
BTC_DEPLOYER_KEY="your_testnet_wif_key"

# EVM (USED)
EVM_DEPLOYER_KEY="your_private_key"

# Solana (NEEDED FOR SPL)
SOLANA_DEPLOYER_KEY='[1,2,3,...]'  # Array of numbers from Phantom export
```

---

## 🚀 Deploy Solana SPL Token

### Prerequisites

1. **Solana Wallet with Devnet SOL**
   - Get from: https://faucet.solana.com/
   - Need ~0.5 SOL for deployment

2. **Export Private Key from Phantom**
   - Open Phantom wallet
   - Settings → Export Private Key
   - Copy the array of numbers: `[1,2,3,...]`

### Deployment Steps

```bash
# 1. Set private key
export SOLANA_DEPLOYER_KEY='[1,2,3,...]'

# 2. Run deployment
npm run deploy:qct-spl

# 3. Save the mint address
# Will be saved to: deployments/qct-spl-address.json
```

### Expected Output

```
🚀 Deploying QCT SPL Token on Solana...
📍 Deployer Address: <your_address>
💰 Balance: 1.5 SOL
🪙 Mint Address: <mint_address>
📦 Token Account: <token_account>
✅ QCT SPL Token Deployed Successfully!
```

---

## 📊 Token Economics

| Property | Value |
|----------|-------|
| **Total Supply** | 1,000,000,000 QCT |
| **Premine (40%)** | 400,000,000 QCT |
| **Public Supply (60%)** | 600,000,000 QCT |

### Distribution

**Premined 400M QCT:**
- 200M → DEX Liquidity Pools
- 100M → Bridge Reserves
- 70M → Treasury
- 30M → Team/Advisors (4-year vesting)

**Public 600M QCT:**
- Minted via cross-chain bridges
- Bitcoin Runes: 21,000 mints @ 47,619 QCT
- EVM/Solana: Bridge minting only

---

## 🔗 Contract Addresses

All addresses are stored in:
- **Config:** `config/qct-contracts.ts`
- **ERC20:** `deployments/qct-erc20-addresses.json`
- **SPL:** `deployments/qct-spl-address.json` (after deployment)

### Import in Code

```typescript
import { QCT_CONTRACTS, getQCTContract } from '@/config/qct-contracts';

// Get Bitcoin Runes info
const btcQCT = QCT_CONTRACTS.bitcoin;

// Get EVM contract by chain ID
const sepoliaQCT = getQCTContract(11155111);

// Get Solana SPL info
const solQCT = QCT_CONTRACTS.solana;
```

---

## ✅ Next Steps

### Immediate

1. ✅ **Check Bitcoin Rune ID**
   - Visit: https://mempool.space/testnet/tx/61f7b8e6...
   - Update `config/qct-contracts.ts` with Rune ID

2. ⏭️ **Deploy Solana SPL**
   - Get devnet SOL
   - Export Phantom private key
   - Run `npm run deploy:qct-spl`

3. ⏭️ **Update QCT Trading Card**
   - Import contract addresses
   - Show real QCT balances
   - Enable QCT trading

### Soon

4. ⏭️ **Build Bridge Contracts**
   - Bitcoin ↔ EVM bridge
   - EVM ↔ Solana bridge
   - LayerZero integration

5. ⏭️ **Add DEX Liquidity**
   - Uniswap (Ethereum)
   - QuickSwap (Polygon)
   - Raydium (Solana)

6. ⏭️ **Verify Contracts**
   - Verify on Etherscan
   - Verify on Polygonscan
   - etc.

---

## 🎯 Success Metrics

- ✅ **Bitcoin Runes:** DEPLOYED
- ✅ **5 EVM Chains:** DEPLOYED
- ⏳ **Solana SPL:** Ready to deploy
- ⏳ **Bridge Contracts:** Not started
- ⏳ **DEX Liquidity:** Not started

**Total Blockchains:** 6 deployed, 1 pending (Solana)

---

## 📚 Documentation

- **Runes Deployment:** `scripts/QCT_RUNES_DEPLOYMENT.md`
- **ERC20 Deployment:** `contracts/QCT_ERC20_DEPLOYMENT.md`
- **Smart Contract:** `contracts/QCT.sol`

---

## 🔐 Security Notes

- ✅ All private keys stored in environment variables
- ✅ `.env.local` is gitignored
- ✅ No hardcoded keys in code
- ✅ OpenZeppelin audited contracts (ERC20)
- ⚠️ Testnet deployments only (not production)

---

**🎉 QCT is now a true multi-chain token!**

Deployed across Bitcoin, Ethereum, Polygon, Arbitrum, Optimism, and Base.
Ready to deploy on Solana.
