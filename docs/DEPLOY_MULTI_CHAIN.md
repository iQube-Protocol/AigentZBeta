# QCT Multi-Chain + Treasury Deployment Guide

## 🎯 Current Status

### ✅ COMPLETED - EVM Chains (5/5)
- **Ethereum Sepolia**: `0x4C4f1aD931589449962bB675bcb8e95672349d09` ✅
- **Base Sepolia**: `0x4C4f1aD931589449962bB675bcb8e95672349d09` ✅  
- **Polygon Amoy**: `0x4C4f1aD931589449962bB675bcb8e95672349d09` ✅
- **Arbitrum Sepolia**: `0x4C4f1aD931589449962bB675bcb8e95672349d09` ✅
- **Optimism Sepolia**: `0x4C4f1aD931589449962bB675bcb8e95672349d09` ✅

**Owner Wallet**: `0xE9c2A64226a698117986D44473FA73Ed767d3455`
**Total Supply**: 500M QCT (100M per chain)

### ⏳ PENDING - Additional Chains

## 🚀 Next Deployments

### 1. Solana QCT SPL Token

**Prerequisites:**
```bash
npm install @solana/web3.js @solana/spl-token
```

**Deploy:**
```bash
node scripts/deploy-qct-solana.js
```

**Expected Output:**
- Mint Address: `[Generated SPL Token Address]`
- Initial Supply: 100M QCT (9 decimals)
- Network: Solana Devnet

**Funding Required:**
- Get devnet SOL from: https://faucet.solana.com/

### 2. Bitcoin QCT Runes Token

**Prerequisites:**
```bash
npm install bitcoinjs-lib axios
```

**Deploy:**
```bash
node scripts/deploy-qct-bitcoin.js
```

**Expected Output:**
- Rune Name: `QRIPTOCENT`
- Symbol: `Q¢`
- Supply: 1B QCT (8 decimals)
- Premine: 100M QCT

**Funding Required:**
- Get testnet BTC from: https://coinfaucet.eu/en/btc-testnet/

### 3. USDC Treasury Integration

**Already Deployed**: Treasury API endpoints ready

**Test Treasury:**
```bash
# Check USDC balances
curl "http://localhost:3000/api/qct/treasury?action=balances"

# Get QCT/USDC rates
curl "http://localhost:3000/api/qct/trading?action=rates"
```

**USDC Contract Addresses (Testnet):**
- Ethereum Sepolia: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- Polygon Amoy: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- Arbitrum Sepolia: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- Optimism Sepolia: `0x5fd84259d66Cd46123540766Be93DFE6D43130D7`
- Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## 📊 Treasury Features

### QCT/USDC Trading Pairs
- **Rate**: 1 QCT = 0.10 USDC (10 QCT = 1 USDC)
- **Supported Operations**: Buy QCT, Sell QCT, Add Liquidity
- **Slippage Protection**: Configurable (default 0.5%)

### Multi-Chain Treasury
- **Treasury Wallet**: Same as QCT deployment wallet
- **USDC Balance Tracking**: Real-time across all chains
- **Cross-Chain Arbitrage**: Rate monitoring across chains

## 🔗 Integration Points

### Frontend Integration
```typescript
// Get treasury balances
const response = await fetch('/api/qct/treasury?action=balances');
const { treasury } = await response.json();

// Execute QCT purchase
const buyResponse = await fetch('/api/qct/treasury', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'buy_qct',
    chain: 'polygon',
    amount: '100', // 100 USDC
    slippage: '0.5'
  })
});
```

### DEX Integration Ready
- **Uniswap V3**: Pool creation ready
- **SushiSwap**: Cross-chain swaps
- **PancakeSwap**: BSC integration (future)
- **Jupiter**: Solana DEX aggregation

## 🎯 Complete Ecosystem

### Phase 1: ✅ COMPLETE
- [x] 5 EVM chains deployed
- [x] Unified contract address
- [x] Real balance checking
- [x] Trading API functional

### Phase 2: 🚀 IN PROGRESS  
- [ ] Solana SPL token deployment
- [ ] Bitcoin Runes token deployment
- [ ] USDC treasury funding
- [ ] DEX liquidity provision

### Phase 3: 🔮 FUTURE
- [ ] Mainnet deployments
- [ ] Advanced trading features
- [ ] Yield farming integration
- [ ] Cross-chain bridge UI

## 💡 Key Benefits

### Unified Address Strategy
- **Same address across all EVM chains**: `0x4C4f1aD931589449962bB675bcb8e95672349d09`
- **Simplified user experience**: One address to remember
- **Cross-chain compatibility**: Easier bridge operations

### Treasury-Backed Trading
- **USDC reserves**: Stable value backing
- **Multi-chain liquidity**: Distributed across all networks
- **Arbitrage opportunities**: Cross-chain rate differences

### Complete Token Ecosystem
- **7 Total Chains**: 5 EVM + Solana + Bitcoin
- **3 Token Standards**: ERC-20, SPL, Runes
- **Multiple Trading Pairs**: QCT/USDC, QCT/ETH, QCT/SOL, QCT/BTC

## 🚀 Ready to Deploy Solana & Bitcoin!

Run the deployment scripts when ready to expand to all 7 chains! 🎯
