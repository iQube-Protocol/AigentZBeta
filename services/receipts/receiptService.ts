/**
 * Unified Receipt Service for AigentiQ Platform
 * 
 * Standardizes receipt generation across:
 * - PoS (Proof of State) receipts
 * - KNYT purchase receipts  
 * - QubeTalk delegation receipts
 * - SmartTriad action receipts
 */

import { createHash } from 'crypto';
import {
  type QubeTalkReceiptPolicyContext,
  evaluateQubeTalkReceiptPolicy,
} from '@/services/policy/qubetalkPolicyGate';
import { submitQubeTalkReceiptToDvn } from '@/services/dvn/qubetalkReceiptPipeline';

export interface BaseReceipt {
  receiptId: string;
  tenantId?: string;
  type: ReceiptType;
  status: ReceiptStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface ReceiptType {
  category: 'pos' | 'purchase' | 'qubetalk' | 'smarttriad';
  subType: string;
}

export interface ReceiptStatus {
  state: 'pending' | 'completed' | 'failed' | 'expired';
  verified: boolean;
  error?: string;
}

export interface PoSReceipt extends BaseReceipt {
  type: ReceiptType & { category: 'pos'; subType: 'data_hash' };
  dataHash: string;
  source: string;
  canisterId: string;
  onChainReceiptId?: string;
}

export interface PurchaseReceipt extends BaseReceipt {
  type: ReceiptType & { category: 'purchase'; subType: 'knyt_purchase' };
  personaId: string;
  contentId?: string;
  sku?: string;
  transactionId: string;
  amount: number;
  currency: 'KNYT' | 'USD';
  entitlementId?: string;
  newBalance?: number;
}

export interface QubeTalkReceipt extends BaseReceipt {
  type: ReceiptType & { category: 'qubetalk'; subType: 'delegation_completion' };
  delegationId: string;
  fromAgent: AgentReference;
  toAgent: AgentReference;
  taskCompleted: string;
  resultData?: any;
  processingTimeMs?: number;
}

export interface SmartTriadReceipt extends BaseReceipt {
  type: ReceiptType & { category: 'smarttriad'; subType: string };
  action: string;
  component: string;
  personaId?: string;
  result?: any;
}

export interface AgentReference {
  id: string;
  role: 'system' | 'tenant' | 'external';
  name: string;
}

export type AnyReceipt = PoSReceipt | PurchaseReceipt | QubeTalkReceipt | SmartTriadReceipt;

/**
 * Receipt Service Class
 */
export class ReceiptService {
  private static instance: ReceiptService;
  
  static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService();
    }
    return ReceiptService.instance;
  }

  /**
   * Generate unique receipt ID
   */
  generateReceiptId(type: string, additionalData?: any): string {
    const timestamp = Date.now();
    const data = JSON.stringify({ type, timestamp, ...additionalData });
    const hash = createHash('sha256').update(data).digest('hex');
    return `rcpt_${type}_${timestamp}_${hash.substring(0, 8)}`;
  }

  /**
   * Create PoS Receipt
   */
  async createPoSReceipt(params: {
    dataHash: string;
    source: string;
    canisterId: string;
    onChainReceiptId?: string;
    tenantId?: string;
  }): Promise<PoSReceipt> {
    const receiptId = this.generateReceiptId('pos', { dataHash: params.dataHash });
    const now = new Date().toISOString();

    const receipt: PoSReceipt = {
      receiptId,
      tenantId: params.tenantId,
      type: { category: 'pos', subType: 'data_hash' },
      status: { state: 'completed', verified: true },
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: params.source,
        canisterId: params.canisterId,
      },
      dataHash: params.dataHash,
      source: params.source,
      canisterId: params.canisterId,
      onChainReceiptId: params.onChainReceiptId,
    };

    await this.storeReceipt(receipt);
    return receipt;
  }

  /**
   * Create Purchase Receipt
   */
  async createPurchaseReceipt(params: {
    personaId: string;
    transactionId: string;
    amount: number;
    currency: 'KNYT' | 'USD';
    contentId?: string;
    sku?: string;
    entitlementId?: string;
    newBalance?: number;
    tenantId?: string;
  }): Promise<PurchaseReceipt> {
    const receiptId = this.generateReceiptId('purchase', { 
      transactionId: params.transactionId,
      personaId: params.personaId 
    });
    const now = new Date().toISOString();

    const receipt: PurchaseReceipt = {
      receiptId,
      tenantId: params.tenantId,
      type: { category: 'purchase', subType: 'knyt_purchase' },
      status: { state: 'completed', verified: true },
      createdAt: now,
      updatedAt: now,
      metadata: {
        paymentMethod: params.currency === 'KNYT' ? 'ledger' : 'paypal',
      },
      personaId: params.personaId,
      transactionId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      contentId: params.contentId,
      sku: params.sku,
      entitlementId: params.entitlementId,
      newBalance: params.newBalance,
    };

    await this.storeReceipt(receipt);
    return receipt;
  }

  /**
   * Create QubeTalk Receipt
   */
  async createQubeTalkReceipt(params: {
    delegationId: string;
    fromAgent: AgentReference;
    toAgent: AgentReference;
    taskCompleted: string;
    resultData?: any;
    processingTimeMs?: number;
    tenantId?: string;
    policyContext?: QubeTalkReceiptPolicyContext;
  }): Promise<QubeTalkReceipt> {
    const receiptId = this.generateReceiptId('qubetalk', { 
      delegationId: params.delegationId 
    });
    const now = new Date().toISOString();
    const policyEvaluation = evaluateQubeTalkReceiptPolicy({
      tenantId: params.tenantId,
      ...params.policyContext,
    });

    const receipt: QubeTalkReceipt = {
      receiptId,
      tenantId: params.tenantId,
      type: { category: 'qubetalk', subType: 'delegation_completion' },
      status: policyEvaluation.allowed
        ? { state: 'pending', verified: false }
        : {
            state: 'failed',
            verified: false,
            error: policyEvaluation.reasons.join(' ') || 'QubeTalk policy validation failed.',
          },
      createdAt: now,
      updatedAt: now,
      metadata: {
        processingTimeMs: params.processingTimeMs,
        policy: policyEvaluation,
      },
      delegationId: params.delegationId,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      taskCompleted: params.taskCompleted,
      resultData: params.resultData,
      processingTimeMs: params.processingTimeMs,
    };

    const dvnResult = await submitQubeTalkReceiptToDvn({
      receiptId: receipt.receiptId,
      delegationId: receipt.delegationId,
      tenantId: receipt.tenantId,
      status: policyEvaluation.allowed ? 'completed' : 'failed',
      taskCompleted: receipt.taskCompleted,
      fromAgentId: receipt.fromAgent.id,
      toAgentId: receipt.toAgent.id,
      policyEvaluation,
      resultData: receipt.resultData,
    });

    receipt.metadata = {
      ...receipt.metadata,
      dvn: {
        submitted: dvnResult.ok,
        messageId: dvnResult.messageId || null,
        error: dvnResult.error || null,
      },
    };

    if (!dvnResult.ok) {
      receipt.status = {
        state: 'failed',
        verified: false,
        error: dvnResult.error || 'DVN submission failed.',
      };
    } else if (policyEvaluation.allowed) {
      receipt.status = {
        state: 'completed',
        verified: true,
      };
    }

    await this.storeReceipt(receipt);
    return receipt;
  }

  /**
   * Create SmartTriad Receipt
   */
  async createSmartTriadReceipt(params: {
    action: string;
    component: string;
    personaId?: string;
    result?: any;
    tenantId?: string;
  }): Promise<SmartTriadReceipt> {
    const receiptId = this.generateReceiptId('smarttriad', { 
      action: params.action,
      component: params.component 
    });
    const now = new Date().toISOString();

    const receipt: SmartTriadReceipt = {
      receiptId,
      tenantId: params.tenantId,
      type: { category: 'smarttriad', subType: params.action },
      status: { state: 'completed', verified: true },
      createdAt: now,
      updatedAt: now,
      metadata: {
        component: params.component,
      },
      action: params.action,
      component: params.component,
      personaId: params.personaId,
      result: params.result,
    };

    await this.storeReceipt(receipt);
    return receipt;
  }

  /**
   * Store receipt (implementation depends on storage backend)
   */
  private async storeReceipt(receipt: AnyReceipt): Promise<void> {
    // TODO: Implement storage based on backend choice
    // Options: Supabase, file system, or other storage
    console.log(`Storing receipt: ${receipt.receiptId}`);
    
    // For now, log the receipt
    console.log('Receipt details:', JSON.stringify(receipt, null, 2));
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(receiptId: string): Promise<AnyReceipt | null> {
    // TODO: Implement retrieval from storage
    console.log(`Retrieving receipt: ${receiptId}`);
    return null;
  }

  /**
   * List receipts by tenant and filters
   */
  async listReceipts(params: {
    tenantId?: string;
    type?: ReceiptType;
    status?: ReceiptStatus;
    limit?: number;
    offset?: number;
  }): Promise<AnyReceipt[]> {
    // TODO: Implement listing with filters
    console.log('Listing receipts with params:', params);
    return [];
  }

  /**
   * Verify receipt integrity
   */
  async verifyReceipt(receiptId: string): Promise<boolean> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return false;

    // TODO: Implement verification logic based on receipt type
    switch (receipt.type.category) {
      case 'pos':
        return this.verifyPoSReceipt(receipt as PoSReceipt);
      case 'purchase':
        return this.verifyPurchaseReceipt(receipt as PurchaseReceipt);
      case 'qubetalk':
        return this.verifyQubeTalkReceipt(receipt as QubeTalkReceipt);
      case 'smarttriad':
        return this.verifySmartTriadReceipt(receipt as SmartTriadReceipt);
      default:
        return false;
    }
  }

  private async verifyPoSReceipt(receipt: PoSReceipt): Promise<boolean> {
    // TODO: Verify against on-chain canister
    return receipt.status.verified;
  }

  private async verifyPurchaseReceipt(receipt: PurchaseReceipt): Promise<boolean> {
    // TODO: Verify against transaction ledger
    return receipt.status.verified;
  }

  private async verifyQubeTalkReceipt(receipt: QubeTalkReceipt): Promise<boolean> {
    // TODO: Verify against delegation system
    return receipt.status.verified;
  }

  private async verifySmartTriadReceipt(receipt: SmartTriadReceipt): Promise<boolean> {
    // TODO: Verify against component logs
    return receipt.status.verified;
  }
}

// Export singleton instance
export const receiptService = ReceiptService.getInstance();
