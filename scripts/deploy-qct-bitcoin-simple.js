const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');

const ECPair = ECPairFactory(ecc);

// Bitcoin testnet configuration
const NETWORK = bitcoin.networks.testnet;
const BLOCKSTREAM_API = 'https://blockstream.info/testnet/api';

async function deployQCTBitcoinSimple() {
  console.log('🚀 Deploying QCT Bitcoin Token (Simplified Approach)...\n');

  // Use the funded wallet
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

    if (balance < 10000) {
      throw new Error('Insufficient Bitcoin for deployment');
    }

    // Get UTXOs
    const utxosResponse = await axios.get(`${BLOCKSTREAM_API}/address/${address}/utxo`);
    const utxos = utxosResponse.data;

    if (utxos.length === 0) {
      throw new Error('No UTXOs found');
    }

    console.log('📄 Creating Bitcoin transaction with QCT metadata...');

    // Create a simple transaction with OP_RETURN for QCT token metadata
    const psbt = new bitcoin.Psbt({ network: NETWORK });

    // Use the largest UTXO
    const largestUtxo = utxos.reduce((prev, current) => 
      (prev.value > current.value) ? prev : current
    );

    console.log('📝 Using UTXO:', largestUtxo.txid, 'value:', largestUtxo.value, 'sats');

    // Get the raw transaction for the UTXO
    const inputTxHex = await getTxHex(largestUtxo.txid);
    
    // Add input
    psbt.addInput({
      hash: largestUtxo.txid,
      index: largestUtxo.vout,
      nonWitnessUtxo: Buffer.from(inputTxHex, 'hex')
    });

    // Create simple QCT metadata (keep it small to avoid size limits)
    const qctData = 'QCT:QriptoCENT:1000000000:8'; // Protocol:Name:Supply:Decimals

    // Add OP_RETURN output with QCT metadata (keep under 80 bytes)
    const opReturnScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(qctData, 'utf8')
    ]);

    psbt.addOutput({
      script: opReturnScript,
      value: 0
    });

    // Add change output
    const fee = 5000; // 5000 sats fee
    const changeValue = largestUtxo.value - fee;
    
    if (changeValue > 546) { // Above dust limit
      psbt.addOutput({
        address: address,
        value: changeValue
      });
    }

    // Sign the transaction
    psbt.signInput(0, keyPair);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    const txid = tx.getId();

    console.log('✅ Transaction created successfully');
    console.log('📝 Transaction size:', txHex.length / 2, 'bytes');
    console.log('💸 Fee:', fee, 'sats');
    console.log('🔗 Transaction ID:', txid);

    // Broadcast transaction
    console.log('\n📡 Broadcasting QCT Bitcoin transaction...');
    
    try {
      await axios.post(`${BLOCKSTREAM_API}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' }
      });

      console.log('✅ Transaction broadcast successful!');
      console.log('🌐 Explorer:', `https://mempool.space/testnet/tx/${txid}`);

      // Save deployment info
      const deploymentInfo = {
        network: 'testnet',
        protocol: 'QCT',
        txid: txid,
        address: address,
        privateKey: keyPair.toWIF(),
        metadata: qctData,
        deploymentTime: new Date().toISOString(),
        explorer: `https://mempool.space/testnet/tx/${txid}`,
        blockstreamApi: `${BLOCKSTREAM_API}/tx/${txid}`
      };

      console.log('\n💾 QCT Bitcoin Deployment Summary:');
      console.log(JSON.stringify(deploymentInfo, null, 2));

      console.log('\n🎉 QCT Bitcoin Token Successfully Deployed!');
      console.log('📋 Token Details:');
      console.log('- Name: QriptoCENT');
      console.log('- Symbol: QCT');
      console.log('- Decimals: 8');
      console.log('- Total Supply: 1,000,000,000 QCT');
      console.log('- Bitcoin TX ID:', txid);

      console.log('\n📝 Update qct-contracts.ts with:');
      console.log(`bitcoin: {`);
      console.log(`  network: 'testnet',`);
      console.log(`  txid: '${txid}',`);
      console.log(`  address: '${address}',`);
      console.log(`  decimals: 8,`);
      console.log(`  symbol: 'QCT',`);
      console.log(`  name: 'QriptoCENT'`);
      console.log(`}`);

      return deploymentInfo;

    } catch (broadcastError) {
      console.error('❌ Broadcast failed:', broadcastError.response?.data || broadcastError.message);
      
      // Still return the transaction info even if broadcast fails
      return {
        network: 'testnet',
        txid: txid,
        txHex: txHex,
        address: address,
        status: 'created_but_not_broadcast',
        error: broadcastError.message
      };
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
  deployQCTBitcoinSimple()
    .then(() => {
      console.log('\n🎯 Bitcoin QCT deployment complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployQCTBitcoinSimple };
