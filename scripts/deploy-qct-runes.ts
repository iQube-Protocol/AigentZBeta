/**
 * QCT Runes Token Deployment Script
 * Deploys QriptoCENT (QCT) as a Bitcoin Runes token
 */

import { Runestone, Etching, Rune, Terms, Range, none, some } from 'runelib';
import { networks, Psbt, payments, initEccLib } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

// Initialize ECC library
initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const network = networks.testnet; // Use testnet for deployment

// QCT Token Specification
const QCT_CONFIG = {
  name: 'QRIPTOCENT',
  symbol: 'Q¢',
  decimals: 8, // Match Bitcoin's precision
  totalSupply: 1_000_000_000, // 1 billion QCT
  cap: 21_000, // Maximum number of mints
  amountPerMint: 47_619, // ~1B / 21k = 47,619 QCT per mint
  premine: 400_000_000, // 40% premined for liquidity pools
};

/**
 * Convert public key to x-only format for Taproot
 */
function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.subarray(1, 33);
}

/**
 * Wait for UTXO to be available
 */
async function waitUntilUTXO(address: string): Promise<any[]> {
  const url = `https://blockstream.info/testnet/api/address/${address}/utxo`;
  
  console.log(`Waiting for UTXO at ${address}...`);
  
  let utxos: any[] = [];
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

/**
 * Sign and broadcast PSBT
 */
async function signAndSend(keyPair: any, psbt: Psbt, address: string): Promise<string> {
  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();
  
  console.log('Transaction hex:', txHex);
  console.log('Transaction size:', txHex.length / 2, 'bytes');
  
  // Broadcast transaction
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
  } catch (error: any) {
    console.error('Broadcast error:', error.message);
    throw error;
  }
}

/**
 * Deploy QCT Runes Token
 */
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
  
  // Check for private key in environment
  const privateKeyWIF = process.env.BTC_DEPLOYER_KEY;
  if (!privateKeyWIF) {
    throw new Error('BTC_DEPLOYER_KEY environment variable not set');
  }
  
  const keyPair = ECPair.fromWIF(privateKeyWIF, network);
  
  // Create Taproot script for etching
  const etching_script_asm = `${toXOnly(keyPair.publicKey).toString('hex')} OP_CHECKSIG`;
  const etching_script = Buffer.from(etching_script_asm, 'hex');
  
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
  
  const address = script_p2tr.address ?? '';
  console.log('📍 Deployment Address:', address);
  console.log('⚠️  Send testnet BTC to this address and wait for 6 confirmations\n');
  
  // Wait for UTXO
  const utxos = await waitUntilUTXO(address);
  console.log(`Using UTXO ${utxos[0].txid}:${utxos[0].vout}`);
  console.log(`UTXO Value: ${utxos[0].value} sats\n`);
  
  // Create PSBT
  const psbt = new Psbt({ network });
  
  psbt.addInput({
    hash: utxos[0].txid,
    index: utxos[0].vout,
    witnessUtxo: {
      value: utxos[0].value,
      script: script_p2tr.output!
    },
    tapLeafScript: [{
      leafVersion: etching_redeem.redeemVersion,
      script: etching_redeem.output,
      controlBlock: etching_p2tr.witness![etching_p2tr.witness!.length - 1]
    }]
  });
  
  // Create Rune from name
  const rune = Rune.fromName(QCT_CONFIG.name);
  
  // Define terms (minting rules)
  const terms = new Terms(
    QCT_CONFIG.amountPerMint * 10**QCT_CONFIG.decimals, // amount per mint (in smallest units)
    QCT_CONFIG.cap, // cap (max mints)
    new Range(none(), none()), // height range (no restriction)
    new Range(none(), none())  // offset range (no restriction)
  );
  
  // Create etching with premine
  const etching = new Etching(
    some(QCT_CONFIG.decimals), // divisibility
    some(QCT_CONFIG.premine * 10**QCT_CONFIG.decimals), // premine amount
    some(rune), // rune
    none(), // spacers
    some(QCT_CONFIG.symbol), // symbol
    some(terms), // terms
    true // turbo (allow immediate minting)
  );
  
  // Create runestone
  const stone = new Runestone(
    [], // edicts (none for etching)
    some(etching), // etching
    none(), // mint
    none()  // pointer
  );
  
  // Add OP_RETURN output with runestone
  psbt.addOutput({
    script: stone.encipher(),
    value: BigInt(0)
  });
  
  // Add output to receive premined runes
  const { address: ordAddress } = payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network
  });
  
  if (!ordAddress) {
    throw new Error('Failed to generate ordinals address');
  }
  
  psbt.addOutput({
    address: ordAddress,
    value: BigInt(546) // Dust limit
  });
  
  // Calculate change
  const fee = 10000; // 10k sats fee
  const change = utxos[0].value - 546 - fee;
  
  if (change > 546) {
    psbt.addOutput({
      address: ordAddress, // Send change back to same address
      value: BigInt(change)
    });
  }
  
  console.log('📝 Signing and broadcasting transaction...\n');
  
  // Sign and broadcast
  const txid = await signAndSend(keyPair, psbt, address);
  
  console.log('\n✅ QCT Runes Token Deployed Successfully!');
  console.log('\n📊 Deployment Summary:');
  console.log('  Transaction ID:', txid);
  console.log('  Rune Name:', QCT_CONFIG.name);
  console.log('  Rune ID: Will be assigned after confirmation');
  console.log('  Explorer:', `https://mempool.space/testnet/tx/${txid}`);
  console.log('\n⏳ Wait for 6 confirmations, then the Rune ID will be available');
  console.log('   Format: <block_height>:<tx_index>');
  
  return {
    txid,
    name: QCT_CONFIG.name,
    symbol: QCT_CONFIG.symbol,
    decimals: QCT_CONFIG.decimals,
    totalSupply: QCT_CONFIG.totalSupply,
    premine: QCT_CONFIG.premine,
    cap: QCT_CONFIG.cap,
    amountPerMint: QCT_CONFIG.amountPerMint
  };
}

// Run deployment
if (require.main === module) {
  deployQCTRunes()
    .then((result) => {
      console.log('\n✨ Deployment complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Deployment failed:', error.message);
      process.exit(1);
    });
}

export { deployQCTRunes, QCT_CONFIG };
