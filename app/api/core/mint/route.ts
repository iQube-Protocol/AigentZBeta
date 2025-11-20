import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { idlFactory as posIdl } from '@/services/ops/idl/proof_of_state';
import { idlFactory as dvnIdl } from '@/services/ops/idl/cross_chain_service';
import { ethers } from "ethers";
import { IQUBE_ABI } from "@/lib/abi/iqube";
import { getMetaMaskWallet } from '@/services/wallet/metamask';

import axios from 'axios';

async function getEncryptionData(uri: string) {
  const res = await axios.post('https://iqubes-server.onrender.com/get-encryption-key', { uri });
  return res.data;
}

async function encryptMemberQube(encryptedFileHash: string) {
  const res = await axios.post('https://iqubes-server.onrender.com/encrypt-member-qube', {
    encryptedFileHash,
  });
  return res.data;
}

// Map network names to chain IDs for DVN
function getChainId(network: string): number {
  switch (network.toLowerCase()) {
    case 'ethereum': return 560048; // I am making this the Hoodi testnet
    case 'polygon': return 137;
    case 'optimism': return 10;
    case 'arbitrum': return 42161;
    case 'base': return 8453;
    case 'bitcoin': case 'btc': return 0; // Custom ID for Bitcoin
    case 'solana': case 'sol': return 101; // Solana mainnet
    default: return 560048; // Default to Ethereum
  }
}

export async function POST(request: NextRequest) {
  console.log('[API] /api/core/mint/ called');
  try {
    const body = await request.json().catch(() => ({}));
    console.log('🚀 Mint triggered with body:', body);

    const {
      uri,
      encryptionKey,
      tokenId: incomingTokenId,
      templateId,
      parentTemplateId = 0,
      isProvenanceTemplate = true,
      network = 'ethereum',
    } = body;

   if (!templateId) {
      return NextResponse.json({ error: 'Missing required field: templateId' }, { status: 400 });
    }

    // Build file URI (if the client didn't provide one)
    const fileUri = uri || `ipfs://${templateId}`;

    console.log('fileUri', fileUri);
    // Retrieve encryption data from remote service
    let encryptionData: any = null;
    try {
      encryptionData = await getEncryptionData(fileUri);
      console.log('fileUri', encryptionData);
    } catch (err) {
      console.error('[API] getEncryptionData failed', err);
    }
    if (!encryptionData?.key && !encryptionKey) {
      return NextResponse.json({ error: 'Failed to retrieve encryption key' }, { status: 500 });
    }

    // Call remote encryption service (server-side encryption step)
    let encrypted: any = null;
    try {
      encrypted = await encryptMemberQube(encryptionData?.fileHash || uri || fileUri);
      console.log('encrypted', encrypted);
    } catch (err) {
      console.error('[API] encryptMemberQube failed', err);
    }

    if (!encrypted?.success) {
      return NextResponse.json({ error: 'Failed to encrypt content' }, { status: 500 });
    }
    function idToBigInt(id: unknown): bigint {
      if (typeof id === 'bigint') return id;
      if (typeof id === 'number') return BigInt(id);
      if (typeof id === 'string') {
        // numeric string -> BigInt
        if (/^\d+$/.test(id)) return BigInt(id);
        // non-numeric -> hash then convert
        const hashHex = ethers.keccak256(ethers.toUtf8Bytes(id));
        // BigInt accepts '0x...' hex string
        return BigInt(hashHex);
      }
      // fallback to zero
      return 0n;
    }
    // Prepare tokenId (server can generate a placeholder if client didn't provide one)
    const tokenId = incomingTokenId || Math.floor(Date.now() / 1000);
    const tokenIdBig = typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId);
    const templateIdBig = idToBigInt(templateId);
    const parentTemplateIdBig = idToBigInt(parentTemplateId);
    console.log('[mint] templateIdBig (hex):', '0x' + templateIdBig.toString(16));
    let tx: any = null;
    let receipt: any = null;
    const ETH_RPC_URL = 'https://sepolia.drpc.org';
    const provider = new ethers.JsonRpcProvider(ETH_RPC_URL);
    const PRIVATE_KEY = process.env.AIGENTZ_PRIVATE_KEY!;
    const CONTRACT_ADDRESS = '0x6BCe4463425E6E972D82f1650CC72017C52dBc5D';
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, IQUBE_ABI, wallet);

    const to =  wallet.address;
    const overrides: any = {};
    const args = [
      fileUri,
      encryptionKey ?? '',
      tokenIdBig,
      templateIdBig,
      parentTemplateIdBig,
      Boolean(isProvenanceTemplate ?? true)
    ];
    try {
      // optional overrides
      const overrides = {
        // gasLimit: 600_000,
        // maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'), // v6 helper if needed
      };
      tx = await (contract as any).mintQube(...args, overrides);
      console.log('🧾 Mint transaction sent:', tx.hash);
      receipt = await tx.wait();
      console.log('✅ Mint transaction confirmed:', receipt.transactionHash ?? receipt.blockNumber);
    } catch (err: any) {
      console.error('[mint] contract call failed:', err?.message || err);
      return NextResponse.json({ error: 'On-chain mint failed', reason: err?.message || String(err) }, { status: 500 });
    }
    /*
    // 📜 Optional Proof-of-State integration
    let receiptId: string | null = null;
    try {
      const POS_ID =
        process.env.PROOF_OF_STATE_CANISTER_ID ||
        process.env.NEXT_PUBLIC_PROOF_OF_STATE_CANISTER_ID;
      if (POS_ID) {
        const pos = await getActor<any>(POS_ID, posIdl);
        const dataHash = `mint_${network.toLowerCase()}_${tokenId}_${templateId}_${Date.now()}`;
        receiptId = await pos.issue_receipt(dataHash);
        console.log('🎯 POS receipt created:', receiptId);
      }
    } catch (err) {
      console.warn('⚠️ POS receipt creation failed:', err);
    }

    // 🌐 Optional DVN cross-chain tracking
    let dvnMessageId: string | null = null;
    try {
      const DVN_ID =
        process.env.CROSS_CHAIN_SERVICE_CANISTER_ID ||
        process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID;
      if (DVN_ID && receiptId) {
        const dvn = await getActor<any>(DVN_ID, dvnIdl);
        const payload = {
          action: 'MINT',
          asset: 'TokenQube',
          tokenId,
          network,
          txHash: tx.hash,
          receiptId,
          timestamp: Date.now(),
        };
        const payloadBytes = Array.from(
          new TextEncoder().encode(JSON.stringify(payload)),
        );
        const sourceChain = getChainId(network);
        const destinationChain = 0; // ICP
        dvnMessageId = await dvn.submit_dvn_message(
          sourceChain,
          destinationChain,
          payloadBytes,
          receipt.from,
        );
        console.log('🌍 DVN message submitted:', dvnMessageId);
      }
      

      
    } catch (err) {
      console.warn('⚠️ DVN message creation failed:', err);
    }

    // 🧾 Final response
    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      proofOfState: receiptId
        ? {
            receiptId,
            status: 'pending',
            message: 'Transaction recorded in Proof-of-State system',
          }
        : null,
      dvnTracking: dvnMessageId
        ? {
            messageId: dvnMessageId,
            status: 'pending',
            message: 'Cross-chain transaction tracked in DVN system',
          }
        : null,
    });
    */
   console.log('Sending response back to client...');
    //return NextResponse.json({
      //success: true,
     // tokenId,
     // fileUri,
      //encryptionKey: encryptionKey || encryptionData?.key,
      //templateId,
     // parentTemplateId,
      //isProvenanceTemplate,
     // network,
      //encryptionServiceResult: encrypted,
     // message: 'Prepared payload for client-side mint. Use returned tokenId/fileUri/encryptionKey to mint with MetaMask.',
    //});
    return NextResponse.json({
      success: true,
      tokenId,
      fileUri,
      templateId,
      parentTemplateId,
      isProvenanceTemplate,
      network,
      encryptionServiceResult: encrypted,
      txHash: tx?.hash ?? null,
      onChainReceipt: receipt ?? null,
      message: 'Mint executed on-chain by server wallet',
    });


  } catch (error: any) {
    console.error('❌ Mint failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
