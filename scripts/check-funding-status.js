const { Connection } = require('@solana/web3.js');
const axios = require('axios');
const fs = require('fs');

async function checkFundingStatus() {
  console.log('🔍 Checking Multi-Chain Funding Status...\n');

  // Check Solana wallet
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const keypairData = JSON.parse(fs.readFileSync('./solana-keypair.json', 'utf8'));
    const solanaAddress = '5LJ8dAwGPvWSZ1FAWhk3fcnBXbyX9LvFxgxXoHALZxuT';
    
    const balance = await connection.getBalance({ toBase58: () => solanaAddress });
    const solBalance = balance / 1e9;
    
    console.log('🟣 **SOLANA DEVNET**');
    console.log('Address:', solanaAddress);
    console.log('Balance:', solBalance, 'SOL');
    console.log('Status:', solBalance >= 0.1 ? '✅ Ready to Deploy' : '❌ Needs Funding');
    console.log('Faucet: https://faucet.solana.com/');
    console.log('');
  } catch (error) {
    console.log('🟣 **SOLANA DEVNET**');
    console.log('Address: 5LJ8dAwGPvWSZ1FAWhk3fcnBXbyX9LvFxgxXoHALZxuT');
    console.log('Status: ❌ Needs Funding (0 SOL)');
    console.log('Faucet: https://faucet.solana.com/');
    console.log('');
  }

  // Check Bitcoin wallet
  try {
    const btcAddress = 'tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2';
    const response = await axios.get(`https://blockstream.info/testnet/api/address/${btcAddress}`);
    const balance = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
    const btcBalance = balance / 100000000; // Convert sats to BTC
    
    console.log('🟠 **BITCOIN TESTNET**');
    console.log('Address:', btcAddress);
    console.log('Balance:', balance, 'sats (', btcBalance.toFixed(8), 'BTC)');
    console.log('Status:', balance >= 10000 ? '✅ Ready to Deploy' : '❌ Needs Funding');
    console.log('Faucet: https://coinfaucet.eu/en/btc-testnet/');
    console.log('');
  } catch (error) {
    console.log('🟠 **BITCOIN TESTNET**');
    console.log('Address: tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2');
    console.log('Status: ❌ Needs Funding (0 sats)');
    console.log('Faucet: https://coinfaucet.eu/en/btc-testnet/');
    console.log('');
  }

  // EVM Status (already deployed)
  console.log('🔗 **EVM CHAINS STATUS**');
  console.log('✅ Ethereum Sepolia: 0x4C4f1aD931589449962bB675bcb8e95672349d09');
  console.log('✅ Base Sepolia: 0x4C4f1aD931589449962bB675bcb8e95672349d09');
  console.log('✅ Polygon Amoy: 0x4C4f1aD931589449962bB675bcb8e95672349d09');
  console.log('✅ Arbitrum Sepolia: 0x4C4f1aD931589449962bB675bcb8e95672349d09');
  console.log('✅ Optimism Sepolia: 0x4C4f1aD931589449962bB675bcb8e95672349d09');
  console.log('Owner: 0xE9c2A64226a698117986D44473FA73Ed767d3455');
  console.log('');

  console.log('📋 **NEXT STEPS:**');
  console.log('1. Fund Solana wallet: https://faucet.solana.com/');
  console.log('2. Fund Bitcoin wallet: https://coinfaucet.eu/en/btc-testnet/');
  console.log('3. Run: node scripts/deploy-qct-solana.js');
  console.log('4. Run: node scripts/deploy-qct-bitcoin.js');
  console.log('5. Update qct-contracts.ts with new addresses');
}

checkFundingStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  });
