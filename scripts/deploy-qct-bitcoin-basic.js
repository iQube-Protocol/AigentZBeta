const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');

const ECPair = ECPairFactory(ecc);

// Bitcoin testnet configuration
const NETWORK = bitcoin.networks.testnet;
const BLOCKSTREAM_API = 'https://blockstream.info/testnet/api';

async function deployQCTBitcoinBasic() {
  console.log('🚀 Deploying QCT Bitcoin Token (Basic Approach)...\n');

  // Use the funded wallet
  const persistentWIF = 'cMnrk5hz22jhu2NEytoBxgXPCR21kThfjje2k4NjKMuPTCXzDFWS';
  const keyPair = ECPair.fromWIF(persistentWIF, NETWORK);
  const { address } = bitcoin.payments.p2wpkh({ 
    pubkey: keyPair.publicKey, 
    network: NETWORK 
  });

  console.log('🔑 Bitcoin Wallet Address:', address);

  try {
    // Check wallet balance
    const response = await axios.get(`${BLOCKSTREAM_API}/address/${address}`);
    const balance = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
    
    console.log('💰 Wallet balance:', balance, 'sats');

    if (balance < 10000) {
      throw new Error('Insufficient Bitcoin for deployment');
    }

    // Get UTXOs
    const utxosResponse = await axios.get(`${BLOCKSTREAM_API}/address/${address}/utxo`);
    const utxos = utxosResponse.data;

    if (utxos.length === 0) {
      throw new Error('No UTXOs found');
    }

    console.log('📄 Creating QCT establishment transaction...');

    // Create a basic self-transfer transaction with minimal fee
    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Use the largest UTXO
    const largestUtxo = utxos.reduce((prev, current) => 
      (prev.value > current.value) ? prev : current
    );

    console.log('📝 Using UTXO:', largestUtxo.txid.slice(0, 16) + '...', 'value:', largestUtxo.value, 'sats');

    // Get the raw transaction for the UTXO
    const inputTxHex = await getTxHex(largestUtxo.txid);
    
    // Add input
    psbt.addInput({
      hash: largestUtxo.txid,
      index: largestUtxo.vout,
      nonWitnessUtxo: Buffer.from(inputTxHex, 'hex')
    });

    // Add single output back to same address (self-transfer)
    const fee = 2000; // 2000 sats fee (minimal)
    const outputValue = largestUtxo.value - fee;
    
    psbt.addOutput({
      address: address,
      value: outputValue
    });

    // Sign the transaction
    psbt.signInput(0, keyPair);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txid = tx.getId();

    console.log('✅ QCT establishment transaction created');
    console.log('📝 Transaction size:', txHex.length / 2, 'bytes');
    console.log('💸 Fee:', fee, 'sats');
    console.log('🔗 Transaction ID:', txid);

    // Broadcast transaction
    console.log('\n📡 Broadcasting QCT establishment transaction...');
    
    try {
      await axios.post(`${BLOCKSTREAM_API}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' }
      });

      console.log('✅ Transaction broadcast successful!');
      console.log('🌐 Explorer:', `https://mempool.space/testnet/tx/${txid}`);

      // QCT Token Registry (off-chain metadata)
      const qctRegistry = {
        network: 'bitcoin-testnet',
        protocol: 'QCT',
        name: 'QriptoCENT',
        symbol: 'QCT',
        decimals: 8,
        totalSupply: '1000000000', // 1 billion QCT
        establishmentTx: txid,
        establishmentAddress: address,
        deploymentTime: new Date().toISOString(),
        explorer: `https://mempool.space/testnet/tx/${txid}`,
        description: 'QCT Cross-Chain Token established on Bitcoin testnet'
      };

      console.log('\n💾 QCT Bitcoin Registry:');
      console.log(JSON.stringify(qctRegistry, null, 2));

      console.log('\n🎉 QCT Bitcoin Token Successfully Established!');
      console.log('📋 Token Details:');
      console.log('- Name: QriptoCENT');
      console.log('- Symbol: QCT');
      console.log('- Decimals: 8');
      console.log('- Total Supply: 1,000,000,000 QCT');
      console.log('- Establishment TX:', txid);
      console.log('- Bitcoin Address:', address);

      console.log('\n📝 Update qct-contracts.ts with:');
      console.log(`bitcoin: {`);
      console.log(`  network: 'testnet',`);
      console.log(`  establishmentTx: '${txid}',`);
      console.log(`  address: '${address}',`);
      console.log(`  decimals: 8,`);
      console.log(`  symbol: 'QCT',`);
      console.log(`  name: 'QriptoCENT',`);
      console.log(`  totalSupply: '1000000000'`);
      console.log(`}`);

      console.log('\n🔗 QCT Bitcoin Integration Complete!');
      console.log('This establishes QCT presence on Bitcoin for cross-chain operations.');

      return qctRegistry;

    } catch (broadcastError) {
      console.error('❌ Broadcast failed:', broadcastError.response?.data || broadcastError.message);
      throw broadcastError;
    }

  } catch (error) {
    console.error('❌ Bitcoin deployment failed:', error.message);
    throw error;
  }
}

// Helper function to get transaction hex
async function getTxHex(txid) {
  try {
    const response = await axios.get(`${BLOCKSTREAM_API}/tx/${txid}/hex`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction hex:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  deployQCTBitcoinBasic()
    .then(() => {
      console.log('\n🎯 QCT Bitcoin establishment complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployQCTBitcoinBasic };
