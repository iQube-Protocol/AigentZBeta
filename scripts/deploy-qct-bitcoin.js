/**
 * ⚠️  NON-AUTHORITATIVE DUPLICATE — DO NOT ETCH FROM THIS SCRIPT WITHOUT A RULING.
 *
 * This script etches the same concept as `deploy-qct-runes.ts` / `.js` but with
 * DIFFERENT AND IRRECONCILABLE tokenomics. Rune etching parameters are immutable
 * once broadcast, so whichever script runs first fixes them forever:
 *
 *   |                 | deploy-qct-runes.*   | this script      |
 *   |-----------------|----------------------|------------------|
 *   | premine         | 400,000,000 (40%)    | 100,000,000      |
 *   | amount per mint | 47,619               | 1,000            |
 *   | mint cap        | 21,000 mints         | 900,000,000      |
 *
 * Two scripts that etch one concept with different parameters is the
 * source-of-truth-parity defect class (CLAUDE.md `inv.engineering.037`), and
 * here the stale duplicate cannot be corrected after the fact.
 *
 * The naming canon below is applied to BOTH so that no path can etch the wrong
 * NAME while the TOKENOMICS question is open. The tokenomics question is an
 * operator ruling, not an agent's call — hence the guard in `deployQCTBitcoin`.
 *
 * NAMING CANON (R-1, ratified 2026-07-28): the class is QriptoCENT / Q¢; this is
 * the Bitcoin-specific version, BitCent / B¢ (ASCII fallback `Bc`, long form
 * "Bitcoin Q¢"). Etch `BITCENT`, never `QRIPTOCENT`.
 *
 * SECURITY (R-11/G-3, FIXED 2026-07-30): this file used to contain a hardcoded
 * testnet WIF private key. It now reads BITCENT_TESTNET_DEPLOYER_WIF from the
 * environment (.env.example documents the var) and refuses to run without it.
 * The previously-committed key is treated as compromised regardless of its
 * testnet-only, zero-value status -- it had already been committed to git
 * history AND displayed in an agent session transcript, either of which is
 * enough on its own. A fresh key was generated to replace it; if the OLD
 * address (tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2) holds testnet BTC from
 * an earlier faucet request, check it directly (this sandbox's outbound proxy
 * blocks blockstream.info, so that could not be verified here) and sweep it to
 * the new address before abandoning it, rather than assume either way.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const axios = require('axios');

// Same dual-path convention as scripts/show-deployer-info.js and
// run-independence-review.ts's loadLocalEnv(): .env.local first, then the
// .env.local.temp fallback this environment actually uses.
for (const envFile of ['.env.local', '.env.local.temp']) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

const ECPair = ECPairFactory(ecc);

// Bitcoin testnet configuration
const NETWORK = bitcoin.networks.testnet;
const BLOCKSTREAM_API = 'https://blockstream.info/testnet/api';

async function deployQCTBitcoin() {
  // Guard: this script's tokenomics disagree with deploy-qct-runes.* and an etch
  // is irreversible. Refuse rather than let the disagreement be settled by
  // whichever script someone happens to run.
  if (process.env.ACKNOWLEDGE_DIVERGENT_TOKENOMICS !== 'yes') {
    console.error(
      'Refusing to etch: this script disagrees with deploy-qct-runes.* on premine,\n' +
      'amount-per-mint and cap, and Rune etching is irreversible. Resolve which\n' +
      'script is authoritative first. To proceed deliberately anyway, re-run with\n' +
      'ACKNOWLEDGE_DIVERGENT_TOKENOMICS=yes.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('🚀 Deploying BitCent (B¢) Bitcoin Runes Token...\n');

  // R-11/G-3: never a hardcoded literal -- see the SECURITY note above.
  const persistentWIF = process.env.BITCENT_TESTNET_DEPLOYER_WIF;
  if (!persistentWIF) {
    console.error(
      'Refusing to run: BITCENT_TESTNET_DEPLOYER_WIF is not set. See .env.example ' +
      'for what this variable is and why it is no longer hardcoded here (R-11/G-3).',
    );
    process.exitCode = 1;
    return;
  }
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
      // IMMUTABLE ONCE ETCHED. Not 'QRIPTOCENT' — that names the class. See the
      // naming canon at the top of this file.
      name: 'BITCENT', // Runes name (max 26 chars)
      symbol: 'B¢',
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
