/**
 * Persona Payment Service
 * 
 * Handles x402 payments using persona wallet keys.
 * Integrates with session management for secure signing.
 */

import { PersonaQube } from '@/types/persona';
import { ChainId, CHAINS, getTokenContract, getRpcUrl, TokenSymbol } from '@/types/chains';
import { getKeyForSigning } from './sessionService';
import { signTransaction, signMessage } from './keyService';

// =============================================================================
// TYPES
// =============================================================================

export interface PaymentRequest {
  personaId: string;
  chainId: ChainId;
  tokenSymbol: TokenSymbol;
  amount: string; // In smallest unit (wei)
  recipientAddress: string;
  memo?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  chainId?: ChainId;
  amount?: string;
}

export interface BalanceRequest {
  personaId: string;
  chainId: ChainId;
  tokenSymbol?: 'QCT' | 'KNYT' | 'USDC';
}

export interface BalanceResult {
  balance: string;
  balanceFormatted: string;
  decimals: number;
  symbol: string;
}

// =============================================================================
// PAYMENT FUNCTIONS
// =============================================================================

/**
 * Execute a payment from persona wallet
 * 
 * Requires wallet to be unlocked (session active).
 */
export async function executePayment(request: PaymentRequest): Promise<PaymentResult> {
  try {
    // Get decrypted key from session
    const privateKey = getKeyForSigning(request.personaId);
    if (!privateKey) {
      return {
        success: false,
        error: 'Wallet is locked. Please unlock to make payments.',
      };
    }
    
    // Get chain configuration
    const chain = CHAINS[request.chainId];
    if (!chain || !chain.isEnabled) {
      return {
        success: false,
        error: `Chain ${request.chainId} is not supported or enabled.`,
      };
    }
    
    // Get token contract address
    const tokenContract = getTokenContract(request.chainId, request.tokenSymbol as TokenSymbol);
    if (!tokenContract && request.tokenSymbol !== chain.nativeToken) {
      return {
        success: false,
        error: `Token ${request.tokenSymbol} not available on ${chain.name}.`,
      };
    }
    
    // Build and sign transaction
    const rpcUrl = getRpcUrl(request.chainId);
    
    // For ERC-20 tokens, we need to call the transfer function
    const txData = request.tokenSymbol === chain.nativeToken
      ? undefined // Native token transfer
      : encodeERC20Transfer(request.recipientAddress, request.amount);
    
    const transaction = {
      to: tokenContract || request.recipientAddress,
      value: request.tokenSymbol === chain.nativeToken ? request.amount : '0',
      data: txData,
      chainId: chain.chainId!,
    };
    
    // Sign the transaction
    const signedTx = await signTransaction(transaction, privateKey);
    
    // Broadcast transaction
    const txHash = await broadcastTransaction(rpcUrl, signedTx);
    
    return {
      success: true,
      txHash,
      chainId: request.chainId,
      amount: request.amount,
    };
    
  } catch (error) {
    console.error('Payment execution error:', error);
    return {
      success: false,
      error: (error as Error).message || 'Payment failed',
    };
  }
}

/**
 * Sign a payment authorization message
 * 
 * Used for x402 payment authorization without immediate execution.
 */
export async function signPaymentAuthorization(
  personaId: string,
  message: string
): Promise<{ signature: string } | { error: string }> {
  try {
    const privateKey = getKeyForSigning(personaId);
    if (!privateKey) {
      return { error: 'Wallet is locked. Please unlock to sign.' };
    }
    
    const signature = await signMessage(message, privateKey);
    return { signature };
    
  } catch (error) {
    return { error: (error as Error).message || 'Signing failed' };
  }
}

/**
 * Get token balance for persona on a specific chain
 */
export async function getTokenBalance(request: BalanceRequest): Promise<BalanceResult> {
  const chain = CHAINS[request.chainId];
  if (!chain) {
    return {
      balance: '0',
      balanceFormatted: '0',
      decimals: 18,
      symbol: request.tokenSymbol || 'ETH',
    };
  }
  
  // TODO: Implement actual balance fetching via RPC
  // For now, return placeholder
  return {
    balance: '0',
    balanceFormatted: '0',
    decimals: 18,
    symbol: request.tokenSymbol || chain.nativeToken,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Encode ERC-20 transfer function call
 */
function encodeERC20Transfer(to: string, amount: string): string {
  // ERC-20 transfer(address,uint256) function selector: 0xa9059cbb
  const selector = '0xa9059cbb';
  
  // Pad address to 32 bytes (remove 0x, pad to 64 chars)
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0');
  
  // Pad amount to 32 bytes (convert to hex, pad to 64 chars)
  const amountHex = BigInt(amount).toString(16).padStart(64, '0');
  
  return selector + paddedTo + amountHex;
}

/**
 * Broadcast signed transaction to network
 */
async function broadcastTransaction(rpcUrl: string, signedTx: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: [signedTx],
      id: 1,
    }),
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || 'Transaction broadcast failed');
  }
  
  return result.result; // Transaction hash
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  chainId: ChainId,
  txHash: string
): Promise<any> {
  const rpcUrl = getRpcUrl(chainId);
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [txHash],
      id: 1,
    }),
  });
  
  const result = await response.json();
  return result.result;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  chainId: ChainId,
  txHash: string,
  confirmations: number = 1,
  timeout: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const receipt = await getTransactionReceipt(chainId, txHash);
    
    if (receipt && receipt.blockNumber) {
      // Transaction is mined
      if (confirmations <= 1) {
        return receipt.status === '0x1';
      }
      
      // Check for additional confirmations
      const currentBlock = await getCurrentBlock(chainId);
      const txBlock = parseInt(receipt.blockNumber, 16);
      
      if (currentBlock - txBlock >= confirmations) {
        return receipt.status === '0x1';
      }
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Transaction confirmation timeout');
}

/**
 * Get current block number
 */
async function getCurrentBlock(chainId: ChainId): Promise<number> {
  const rpcUrl = getRpcUrl(chainId);
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  });
  
  const result = await response.json();
  return parseInt(result.result, 16);
}

// All exports are inline with their declarations
