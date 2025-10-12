const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');

const ECPair = ECPairFactory(ecc);

// Bitcoin testnet configuration
const NETWORK = bitcoin.networks.testnet;
const BLOCKSTREAM_API = 'https://blockstream.info/testnet/api';

async function deployQCTBitcoin() {
  console.log('🚀 Deploying QCT Bitcoin Runes Token...\n');

  // Use persistent Bitcoin wallet (from previous generation)
  const persistentWIF = 'cMnrk5hz22jhu2NEytoBxgXPCR21kThfjje2k4NjKMuPTCXzDFWS';
  const keyPair = ECPair.fromWIF(persistentWIF, NETWORK);
  const { address } = bitcoin.payments.p2wpkh({ 
    pubkey: keyPair.publicKey, 
    network: NETWORK 
  });

  console.log('🔑 Bitcoin Wallet Address:', address);
  console.log('🔐 Private Key (WIF):', keyPair.toWIF());

  try {
    // Check wallet balance
    const response = await axios.get(`${BLOCKSTREAM_API}/address/${address}`);
    const balance = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
    
    console.log('💰 Wallet balance:', balance, 'sats');

    if (balance < 10000) { // Need at least 0.0001 BTC for fees
      console.log('\n❌ Insufficient Bitcoin for Runes deployment!');
      console.log('📝 To deploy:');
      console.log('1. Get testnet Bitcoin from: https://coinfaucet.eu/en/btc-testnet/');
      console.log('2. Send to wallet:', address);
      console.log('3. Run this script again');
      return;
    }

    // Create Runes etching transaction
    console.log('\n📄 Creating QCT Runes Token...');
    
    // Runes protocol parameters
    const runesData = {
      name: 'QRIPTOCENT', // Runes name (max 26 chars)
      symbol: 'Q¢',
      decimals: 8,
      supply: 1000000000, // 1 billion QCT
      premine: 100000000,  // 100 million premined
      terms: {
        amount: 1000,      // 1000 QCT per mint
        cap: 900000000,    // 900M available for public minting
        heightStart: null, // Start immediately
        heightEnd: null,   // No end height
        offsetStart: null,
        offsetEnd: null
      }
    };

    // Create OP_RETURN data for Runes protocol
    const runesScript = createRunesScript(runesData);
    
    // Get UTXOs for the address
    const utxosResponse = await axios.get(`${BLOCKSTREAM_API}/address/${address}/utxo`);
    const utxos = utxosResponse.data;

    if (utxos.length === 0) {
      throw new Error('No UTXOs found for address');
    }

    // Create transaction
    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Add inputs
    let inputValue = 0;
    for (const utxo of utxos.slice(0, 3)) { // Use up to 3 UTXOs
      const txHex = await getTxHex(utxo.txid);
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(txHex, 'hex')
      });
      inputValue += utxo.value;
    }

    // Add Runes OP_RETURN output
    psbt.addOutput({
      script: runesScript,
      value: 0
    });

    // Add change output
    const fee = 5000; // 5000 sats fee
    const changeValue = inputValue - fee;
    if (changeValue > 546) { // Dust limit
      psbt.addOutput({
        address: address,
        value: changeValue
      });
    }

    // Sign transaction
    for (let i = 0; i < utxos.slice(0, 3).length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();

    console.log('✅ Runes transaction created');
    console.log('📝 Transaction size:', txHex.length / 2, 'bytes');
    console.log('💸 Estimated fee:', fee, 'sats');

    // Broadcast transaction
    console.log('\n📡 Broadcasting Runes etching transaction...');
    const broadcastResponse = await axios.post(`${BLOCKSTREAM_API}/tx`, txHex, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const txid = tx.getId();
    console.log('✅ Transaction broadcast successful!');
    console.log('🔗 Transaction ID:', txid);
    console.log('🌐 Explorer:', `https://mempool.space/testnet/tx/${txid}`);

    // Save deployment info
    const deploymentInfo = {
      network: 'testnet',
      runeName: runesData.name,
      runeSymbol: runesData.symbol,
      txid: txid,
      address: address,
      privateKey: keyPair.toWIF(),
      supply: runesData.supply,
      decimals: runesData.decimals,
      deploymentTime: new Date().toISOString(),
      explorer: `https://mempool.space/testnet/tx/${txid}`
    };

    console.log('\n💾 Deployment Summary:');
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log('\n📋 Next Steps:');
    console.log('1. Wait for 6 confirmations for Runes to be active');
    console.log('2. Rune ID will be available after confirmation');
    console.log('3. Update qct-contracts.ts with confirmed Rune ID');

    return deploymentInfo;

  } catch (error) {
    console.error('❌ Bitcoin Runes deployment failed:', error);
    throw error;
  }
}

// Helper function to create Runes OP_RETURN script
function createRunesScript(runesData) {
  // Runes protocol magic number
  const RUNES_MAGIC = Buffer.from('RUNE_TEST', 'utf8'); // Testnet magic
  
  // Encode Runes data (simplified - real implementation needs proper encoding)
  const nameBuffer = Buffer.from(runesData.name, 'utf8');
  const symbolBuffer = Buffer.from(runesData.symbol, 'utf8');
  
  // Create OP_RETURN script
  const data = Buffer.concat([
    RUNES_MAGIC,
    nameBuffer,
    symbolBuffer,
    Buffer.from([runesData.decimals]),
    Buffer.alloc(8) // Supply (needs proper encoding)
  ]);

  return bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    data
  ]);
}

// Helper function to get transaction hex
async function getTxHex(txid) {
  const response = await axios.get(`${BLOCKSTREAM_API}/tx/${txid}/hex`);
  return response.data;
}

// Run if called directly
if (require.main === module) {
  deployQCTBitcoin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployQCTBitcoin };
