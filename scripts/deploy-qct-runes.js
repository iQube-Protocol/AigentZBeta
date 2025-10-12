/**
 * QCT Runes Token Deployment Script (JavaScript)
 * Deploys QriptoCENT (QCT) as a Bitcoin Runes token
 */

const { Runestone, Etching, Rune, Terms, Range, none, some } = require('runelib');
const { networks, Psbt, payments, initEccLib } = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');

// Initialize ECC library
initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const network = networks.testnet;

// QCT Token Specification
const QCT_CONFIG = {
  name: 'QRIPTOCENT',
  symbol: 'Q¢',
  decimals: 8,
  totalSupply: 1_000_000_000,
  cap: 21_000,
  amountPerMint: 47_619,
  premine: 400_000_000,
};

function toXOnly(pubkey) {
  return pubkey.subarray(1, 33);
}

async function waitUntilUTXO(address) {
  const url = `https://blockstream.info/testnet/api/address/${address}/utxo`;
  
  console.log(`Waiting for UTXO at ${address}...`);
  
  let utxos = [];
  while (utxos.length === 0) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      utxos = Array.isArray(data) ? data : [];
      
      if (utxos.length === 0) {
        console.log('No UTXO found, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.error('Error fetching UTXO:', error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log(`Found ${utxos.length} UTXO(s)`);
  return utxos;
}

async function signAndSend(keyPair, psbt) {
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();
  
  console.log('Transaction hex:', txHex);
  console.log('Transaction size:', txHex.length / 2, 'bytes');
  
  const url = 'https://blockstream.info/testnet/api/tx';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: txHex
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Broadcast failed: ${errorText}`);
    }
    
    const txid = await response.text();
    console.log('Transaction broadcast successfully!');
    console.log('TXID:', txid);
    console.log('Explorer:', `https://mempool.space/testnet/tx/${txid}`);
    
    return txid;
  } catch (error) {
    console.error('Broadcast error:', error.message);
    throw error;
  }
}

async function deployQCTRunes() {
  console.log('🚀 Deploying QCT Runes Token...\n');
  console.log('Token Configuration:');
  console.log('  Name:', QCT_CONFIG.name);
  console.log('  Symbol:', QCT_CONFIG.symbol);
  console.log('  Decimals:', QCT_CONFIG.decimals);
  console.log('  Total Supply:', QCT_CONFIG.totalSupply.toLocaleString(), 'QCT');
  console.log('  Premine:', QCT_CONFIG.premine.toLocaleString(), 'QCT (40%)');
  console.log('  Cap:', QCT_CONFIG.cap.toLocaleString(), 'mints');
  console.log('  Amount per Mint:', QCT_CONFIG.amountPerMint.toLocaleString(), 'QCT\n');
  
  const privateKeyWIF = process.env.BTC_DEPLOYER_KEY;
  if (!privateKeyWIF) {
    throw new Error('BTC_DEPLOYER_KEY environment variable not set');
  }
  
  const keyPair = ECPair.fromWIF(privateKeyWIF, network);
  
  const etching_script_asm = `${toXOnly(keyPair.publicKey).toString('hex')} OP_CHECKSIG`;
  const script = require('bitcoinjs-lib').script;
  const etching_script = script.fromASM(etching_script_asm);
  
  const scriptTree = {
    output: etching_script,
  };
  
  const script_p2tr = payments.p2tr({
    internalPubkey: toXOnly(keyPair.publicKey),
    scriptTree,
    network,
  });
  
  const etching_redeem = {
    output: etching_script,
    redeemVersion: 192
  };
  
  const etching_p2tr = payments.p2tr({
    internalPubkey: toXOnly(keyPair.publicKey),
    scriptTree,
    redeem: etching_redeem,
    network
  });
  
  const address = script_p2tr.address;
  console.log('📍 Deployment Address:', address);
  console.log('⚠️  Send testnet BTC to this address and wait for 6 confirmations\n');
  
  const utxos = await waitUntilUTXO(address);
  console.log(`Using UTXO ${utxos[0].txid}:${utxos[0].vout}`);
  console.log(`UTXO Value: ${utxos[0].value} sats\n`);
  
  const psbt = new Psbt({ network });
  
  psbt.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: {
      value: BigInt(utxos[0].value),
      script: script_p2tr.output
    },
    tapLeafScript: [{
      leafVersion: etching_redeem.redeemVersion,
      script: etching_redeem.output,
      controlBlock: etching_p2tr.witness[etching_p2tr.witness.length - 1]
    }]
  });
  
  const rune = Rune.fromName(QCT_CONFIG.name);
  
  const terms = new Terms(
    QCT_CONFIG.amountPerMint * Math.pow(10, QCT_CONFIG.decimals),
    QCT_CONFIG.cap,
    new Range(none(), none()),
    new Range(none(), none())
  );
  
  const etching = new Etching(
    some(QCT_CONFIG.decimals),
    some(QCT_CONFIG.premine * Math.pow(10, QCT_CONFIG.decimals)),
    some(rune),
    none(),
    some(QCT_CONFIG.symbol),
    some(terms),
    true
  );
  
  const stone = new Runestone(
    [],
    some(etching),
    none(),
    none()
  );
  
  psbt.addOutput({
    script: stone.encipher(),
    value: BigInt(0)
  });
  
  const { address: ordAddress } = payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network
  });
  
  psbt.addOutput({
    address: ordAddress,
    value: BigInt(546)
  });
  
  const fee = 10000;
  const change = utxos[0].value - 546 - fee;
  
  if (change > 546) {
    psbt.addOutput({
      address: ordAddress,
      value: BigInt(change)
    });
  }
  
  console.log('📝 Signing and broadcasting transaction...\n');
  
  const txid = await signAndSend(keyPair, psbt);
  
  console.log('\n✅ QCT Runes Token Deployed Successfully!');
  console.log('\n📊 Deployment Summary:');
  console.log('  Transaction ID:', txid);
  console.log('  Rune Name:', QCT_CONFIG.name);
  console.log('  Rune ID: Will be assigned after confirmation');
  console.log('  Explorer:', `https://mempool.space/testnet/tx/${txid}`);
  console.log('\n⏳ Wait for 6 confirmations, then the Rune ID will be available');
  
  return { txid, name: QCT_CONFIG.name };
}

deployQCTRunes()
  .then(() => {
    console.log('\n✨ Deployment complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  });
