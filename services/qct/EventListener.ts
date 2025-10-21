// QCT Event Listener Service - Core Architecture
// Dual-tracking system for complete iQube ecosystem transaction visibility:
// 1. QCT Contract Events - External QCT token transactions on supported chains
// 2. DVN Queue Messages - Internal system transactions at final settlement checkpoint
// DVN messages represent the point where transactions leave our system for LayerZero settlement
import { EventEmitter } from 'events';
import { QCT_CONTRACTS } from '@/config/qct-contracts';

// Global storage for server-side persistence
declare global {
  var __qct_event_history: Record<string, QCTEvent[]> | undefined;
}

export interface QCTEvent {
  id: string;
  chainId: string;
  chainType: 'evm' | 'solana' | 'bitcoin';
  eventType: 'mint' | 'burn' | 'transfer';
  txHash: string;
  blockNumber?: number;
  blockHeight?: number;
  timestamp: number;
  from: string;
  to: string;
  amount: string;
  fee?: string;
  contractAddress?: string;
  programId?: string;
  runesId?: string;
  raw: any; // Original event data
}

export interface ChainConfig {
  chainId: string;
  name: string;
  type: 'evm' | 'solana' | 'bitcoin';
  rpcUrl: string;
  contractAddress?: string;
  programId?: string;
  runesId?: string;
  startBlock?: number;
  confirmations: number;
  enabled: boolean;
}

export interface ListenerStats {
  chainId: string;
  status: 'running' | 'stopped' | 'error';
  lastBlock: number;
  eventsProcessed: number;
  errors: number;
  uptime: number;
  lastEventAt?: number;
}

export class QCTEventListener extends EventEmitter {
  private chains: Map<string, ChainConfig> = new Map();
  private chainListeners: Map<string, any> = new Map();
  private stats: Map<string, ListenerStats> = new Map();
  private isRunning = false;
  private startTime = 0;
  private dvnPollingInterval: NodeJS.Timeout | null = null;
  private processedDvnMessages: Set<string> = new Set(); // Track processed messages to avoid duplicates
  private transactionHistory: Map<string, QCTEvent[]> = new Map(); // Store last 100 transactions per chain
  private readonly MAX_HISTORY_PER_CHAIN = 100;

  constructor() {
    super();
    this.setupChains();
    this.loadHistoryFromStorage();
  }

  // Initialize chain configurations
  private setupChains() {
    const chains: ChainConfig[] = [
      // EVM Chains
      {
        chainId: 'ethereum',
        name: 'Ethereum Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_ETH_SEPOLIA || 'https://sepolia.infura.io/v3/YOUR_KEY',
        contractAddress: QCT_CONTRACTS.evm.sepolia.address,
        startBlock: 0,
        confirmations: 3,
        enabled: true,
      },
      {
        chainId: 'polygon',
        name: 'Polygon Amoy',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology',
        contractAddress: QCT_CONTRACTS.evm.amoy.address,
        startBlock: 0,
        confirmations: 5,
        enabled: true,
      },
      {
        chainId: 'arbitrum',
        name: 'Arbitrum Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
        contractAddress: QCT_CONTRACTS.evm.arbitrumSepolia.address,
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      {
        chainId: 'optimism',
        name: 'Optimism Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
        contractAddress: QCT_CONTRACTS.evm.optimismSepolia.address,
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      {
        chainId: 'base',
        name: 'Base Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
        contractAddress: QCT_CONTRACTS.evm.baseSepolia.address,
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      // Solana
      {
        chainId: 'solana',
        name: 'Solana Testnet',
        type: 'solana',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_SOLANA_TESTNET || 'https://api.testnet.solana.com',
        programId: QCT_CONTRACTS.solana.mintAddress || 'PENDING',
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      // Bitcoin
      {
        chainId: 'bitcoin',
        name: 'Bitcoin Testnet',
        type: 'bitcoin',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BTC_TESTNET || 'https://mempool.space/testnet/api',
        runesId: QCT_CONTRACTS.bitcoin.establishmentTx,
        startBlock: 0,
        confirmations: 3,
        enabled: true,
      },
    ];

    chains.forEach(chain => {
      this.chains.set(chain.chainId, chain);
      this.stats.set(chain.chainId, {
        chainId: chain.chainId,
        status: 'stopped',
        lastBlock: chain.startBlock || 0,
        eventsProcessed: 0,
        errors: 0,
        uptime: 0,
      });
    });
  }

  // Start listening on all enabled chains
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[QCT Listener] Already running');
      return;
    }

    console.log('[QCT Listener] Starting event listeners...');
    this.isRunning = true;
    this.startTime = Date.now();

    const promises: Promise<void>[] = [];

    for (const [chainId, config] of this.chains) {
      if (!config.enabled) {
        console.log(`[QCT Listener] Skipping disabled chain: ${chainId}`);
        continue;
      }

      console.log(`[QCT Listener] Starting listener for ${config.name}...`);
      
      try {
        const promise = this.startChainListener(chainId, config);
        promises.push(promise);
      } catch (error) {
        console.error(`[QCT Listener] Failed to start ${chainId}:`, error);
        this.updateStats(chainId, { status: 'error', errors: 1 });
      }
    }

    // Wait for all listeners to initialize
    await Promise.allSettled(promises);
    
    // TODO: Re-enable DVN queue polling once async issues are resolved
    // this.startDVNPolling();
    
    console.log('[QCT Listener] All listeners started');
    this.emit('started', this.getStats());
  }

  // Stop all listeners
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[QCT Listener] Not running');
      return;
    }

    console.log('[QCT Listener] Stopping event listeners...');
    this.isRunning = false;

    // Stop all chain listeners
    for (const [chainId, listener] of this.chainListeners) {
      try {
        if (listener && typeof listener.stop === 'function') {
          await listener.stop();
        }
        this.updateStats(chainId, { status: 'stopped' });
      } catch (error) {
        console.error(`[QCT Listener] Error stopping ${chainId}:`, error);
      }
    }

    this.chainListeners.clear();
    
    // Stop DVN polling
    if (this.dvnPollingInterval) {
      clearInterval(this.dvnPollingInterval);
      this.dvnPollingInterval = null;
    }
    
    console.log('[QCT Listener] All listeners stopped (including DVN queue polling)');
    this.emit('stopped');
  }

  // Start listener for specific chain
  private async startChainListener(chainId: string, config: ChainConfig): Promise<void> {
    try {
      let listener;

      switch (config.type) {
        case 'evm':
          listener = await this.createEVMListener(chainId, config);
          break;
        case 'solana':
          listener = await this.createSolanaListener(chainId, config);
          break;
        case 'bitcoin':
          listener = await this.createBitcoinListener(chainId, config);
          break;
        default:
          throw new Error(`Unsupported chain type: ${config.type}`);
      }

      this.chainListeners.set(chainId, listener);
      this.updateStats(chainId, { status: 'running' });
      
      console.log(`[QCT Listener] ${config.name} listener started`);
    } catch (error) {
      console.error(`[QCT Listener] Failed to start ${config.name}:`, error);
      this.updateStats(chainId, { status: 'error' });
      throw error;
    }
  }

  // Create EVM chain listener (ETH, POL, ARB, OP, BASE)
  private async createEVMListener(chainId: string, config: ChainConfig): Promise<any> {
    // Import ethers dynamically to avoid SSR issues
    const { ethers } = await import('ethers');
    
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const contractAddress = config.contractAddress!;

    // ERC20 Transfer event signature
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    
    // Listen for Transfer events
    const filter = {
      address: contractAddress,
      topics: [transferTopic]
    };

    const handleEvent = async (log: any) => {
      try {
        const event = await this.parseEVMEvent(chainId, config, log);
        if (event) {
          await this.processEvent(event);
        }
      } catch (error) {
        console.error(`[QCT Listener] Error processing EVM event on ${chainId}:`, error);
        this.updateStats(chainId, { errors: 1 });
      }
    };

    // Start listening
    provider.on(filter, handleEvent);

    return {
      provider,
      filter,
      stop: () => provider.off(filter, handleEvent)
    };
  }

  // Create Solana listener
  private async createSolanaListener(chainId: string, config: ChainConfig): Promise<any> {
    // TODO: Implement Solana program log listener
    console.log(`[QCT Listener] Solana listener for ${config.name} - Coming soon`);
    
    return {
      stop: () => console.log(`[QCT Listener] Stopping Solana listener`)
    };
  }

  // Create Bitcoin listener
  private async createBitcoinListener(chainId: string, config: ChainConfig): Promise<any> {
    // TODO: Implement Bitcoin Runes transaction listener
    console.log(`[QCT Listener] Bitcoin listener for ${config.name} - Coming soon`);
    
    return {
      stop: () => console.log(`[QCT Listener] Stopping Bitcoin listener`)
    };
  }

  // Parse EVM Transfer event into QCTEvent
  private async parseEVMEvent(chainId: string, config: ChainConfig, log: any): Promise<QCTEvent | null> {
    try {
      const { ethers } = await import('ethers');
      
      // Decode Transfer event
      const iface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ]);
      
      const decoded = iface.parseLog(log);
      if (!decoded) return null;

      const { from, to, value } = decoded.args;
      
      // Determine event type
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      let eventType: 'mint' | 'burn' | 'transfer';
      
      if (from === zeroAddress) {
        eventType = 'mint';
      } else if (to === zeroAddress) {
        eventType = 'burn';
      } else {
        eventType = 'transfer';
      }

      const event: QCTEvent = {
        id: `${chainId}_${log.transactionHash}_${log.logIndex}`,
        chainId,
        chainType: 'evm',
        eventType,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: Date.now(), // TODO: Get actual block timestamp
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        amount: value.toString(),
        contractAddress: config.contractAddress,
        raw: log,
      };

      return event;
    } catch (error) {
      console.error(`[QCT Listener] Error parsing EVM event:`, error);
      return null;
    }
  }

  // Process and emit QCT event
  private async processEvent(event: QCTEvent): Promise<void> {
    try {
      console.log(`[QCT Listener] ${event.chainId} ${event.eventType}: ${event.amount} QCT`);
      
      // Update stats
      this.updateStats(event.chainId, { 
        eventsProcessed: 1,
        lastEventAt: event.timestamp,
        lastBlock: event.blockNumber || 0
      });

      // Emit event for other services to handle
      this.emit('qct_event', event);

      // Submit to DVN queue
      await this.submitToDVN(event);

    } catch (error) {
      console.error(`[QCT Listener] Error processing event:`, error);
      this.updateStats(event.chainId, { errors: 1 });
    }
  }

  // Submit event to DVN monitoring queue
  private async submitToDVN(event: QCTEvent): Promise<void> {
    try {
      // Map chain names to numeric IDs that DVN expects
      const chainIdMap: Record<string, number> = {
        'ethereum': 11155111,
        'polygon': 80002,
        'arbitrum': 421614,
        'optimism': 11155420,
        'base': 84532,
        'solana': 101,
        'bitcoin': 0,
      };

      const numericChainId = chainIdMap[event.chainId];
      if (!numericChainId && numericChainId !== 0) {
        throw new Error(`Unknown chain ID: ${event.chainId}`);
      }

      const dvnPayload = {
        txHash: event.txHash,
        chainId: numericChainId, // DVN monitor expects numeric chainId
        sourceChain: event.chainId,
        targetChain: event.chainId, // Same chain for mint/burn/transfer
        amount: event.amount,
        operation: `qct_${event.eventType}`,
        timestamp: event.timestamp,
        fromAddress: event.from,
        toAddress: event.to,
        eventId: event.id,
        metadata: {
          contractAddress: event.contractAddress,
          programId: event.programId,
          runesId: event.runesId,
          blockNumber: event.blockNumber,
          blockHeight: event.blockHeight,
        }
      };

      const response = await fetch('/api/ops/dvn/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dvnPayload),
      });

      if (!response.ok) {
        throw new Error(`DVN submission failed: ${response.status}`);
      }

      console.log(`[QCT Listener] Event ${event.id} submitted to DVN`);
    } catch (error) {
      console.error(`[QCT Listener] DVN submission error:`, error);
      // Don't throw - DVN submission failure shouldn't stop event processing
    }
  }

  // Update listener statistics
  private updateStats(chainId: string, updates: Partial<ListenerStats>): void {
    const current = this.stats.get(chainId);
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };

    // Accumulate counters
    if (updates.eventsProcessed) {
      updated.eventsProcessed = current.eventsProcessed + updates.eventsProcessed;
    }
    if (updates.errors) {
      updated.errors = current.errors + updates.errors;
    }

    this.stats.set(chainId, updated);
  }

  // Get current statistics
  getStats(): ListenerStats[] {
    const stats = Array.from(this.stats.values());
    // Enrich with transaction counts from history
    return stats.map(stat => {
      const txCount = this.getTransactionCount(stat.chainId);
      return {
        ...stat,
        eventsProcessed: txCount > 0 ? txCount : stat.eventsProcessed,
      };
    });
  }

  // Get stats for specific chain
  getChainStats(chainId: string): ListenerStats | undefined {
    const stats = this.stats.get(chainId);
    if (stats) {
      // Include transaction count from history
      const txCount = this.getTransactionCount(chainId);
      return {
        ...stats,
        eventsProcessed: txCount > 0 ? txCount : stats.eventsProcessed,
      };
    }
    return stats;
  }

  // Check if listener is running
  isListening(): boolean {
    return this.isRunning;
  }

  // Get supported chains
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  // Record DVN transaction (called by LayerZero processing)
  recordDVNTransaction(tx: {
    messageId: string;
    sourceChain: number;
    txHash: string;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    operation: string;
    metadata: any;
  }) {
    try {
      // Map numeric chain ID to chain name
      const chainId = this.mapChainIdToName(tx.sourceChain);
      
      console.log(`[QCT Listener] Recording transaction - sourceChain: ${tx.sourceChain}, mapped to: ${chainId}`);
      
      // Create event from DVN transaction
      const event: QCTEvent = {
        id: tx.messageId,
        chainId,
        chainType: this.getChainType(tx.sourceChain),
        eventType: this.detectEventTypeFromOperation(tx.operation),
        txHash: tx.txHash,
        timestamp: tx.timestamp,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        raw: tx,
      };
      
      // Emit event
      this.emit('qct_event', event);
      console.log(`[QCT Listener] iQube DVN transaction recorded: ${event.eventType} on ${event.chainId}`);
      
      // Store in transaction history
      this.addToHistory(chainId, event);
      
      // Update stats for the chain
      this.updateStats(chainId, {
        eventsProcessed: 1,
        lastEventAt: event.timestamp,
      });
    } catch (error) {
      console.error('[QCT Listener] Failed to record DVN transaction:', error);
    }
  }

  // Add transaction to history
  private addToHistory(chainId: string, event: QCTEvent) {
    if (!this.transactionHistory.has(chainId)) {
      this.transactionHistory.set(chainId, []);
    }
    
    const history = this.transactionHistory.get(chainId)!;
    
    // Check if transaction already exists (avoid duplicates)
    const exists = history.some(tx => tx.id === event.id || tx.txHash === event.txHash);
    if (exists) {
      console.log(`[QCT Listener] Transaction ${event.id} already in history, skipping`);
      return;
    }
    
    // Add to beginning (most recent first)
    history.unshift(event);
    
    console.log(`[QCT Listener] Added transaction to history - chainId: ${chainId}, total: ${history.length}`);
    
    // Keep only last MAX_HISTORY_PER_CHAIN transactions
    if (history.length > this.MAX_HISTORY_PER_CHAIN) {
      history.pop();
    }
    
    // Persist to localStorage
    this.saveHistoryToStorage();
    console.log(`[QCT Listener] Saved history to localStorage`);
  }

  // Load transaction history from localStorage (client) or file system (server)
  private loadHistoryFromStorage() {
    try {
      if (typeof window !== 'undefined') {
        // Client-side: use localStorage
        const stored = localStorage.getItem('qct_event_history');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert plain object back to Map
          for (const [chainId, events] of Object.entries(parsed)) {
            this.transactionHistory.set(chainId, events as QCTEvent[]);
          }
          console.log('[QCT Listener] Loaded transaction history from localStorage');
        }
      } else {
        // Server-side: load from global singleton storage
        if (globalThis.__qct_event_history) {
          const parsed = globalThis.__qct_event_history;
          for (const [chainId, events] of Object.entries(parsed)) {
            this.transactionHistory.set(chainId, events as QCTEvent[]);
          }
          console.log('[QCT Listener] Loaded transaction history from global storage');
        }
      }
    } catch (e) {
      console.error('[QCT Listener] Failed to load history from storage:', e);
    }
  }

  // Save transaction history to localStorage (client) or global storage (server)
  private saveHistoryToStorage() {
    try {
      // Convert Map to plain object for JSON serialization
      const obj: Record<string, QCTEvent[]> = {};
      for (const [chainId, events] of this.transactionHistory.entries()) {
        obj[chainId] = events;
      }
      
      if (typeof window !== 'undefined') {
        // Client-side: use localStorage
        localStorage.setItem('qct_event_history', JSON.stringify(obj));
      } else {
        // Server-side: use global singleton storage
        globalThis.__qct_event_history = obj;
        console.log('[QCT Listener] Saved history to global storage');
      }
    } catch (e) {
      console.error('[QCT Listener] Failed to save history to storage:', e);
    }
  }

  // Get transaction history for a chain
  getTransactionHistory(chainId: string, limit: number = 10, offset: number = 0): QCTEvent[] {
    const history = this.transactionHistory.get(chainId) || [];
    return history.slice(offset, offset + limit);
  }

  // Get total transaction count for a chain
  getTransactionCount(chainId: string): number {
    return this.transactionHistory.get(chainId)?.length || 0;
  }

  // Get the most recent transaction for a chain
  getLatestTransaction(chainId: string): QCTEvent | null {
    const history = this.transactionHistory.get(chainId);
    return history && history.length > 0 ? history[0] : null;
  }

  // Get all latest transactions (one per chain)
  getAllLatestTransactions(): Record<string, QCTEvent | null> {
    const result: Record<string, QCTEvent | null> = {};
    for (const [chainId] of this.chains) {
      result[chainId] = this.getLatestTransaction(chainId);
    }
    return result;
  }

  // Start DVN queue polling to capture all system transactions
  private startDVNPolling() {
    console.log('[QCT Listener] Starting DVN queue polling...');
    
    // Poll DVN queue every 30 seconds
    this.dvnPollingInterval = setInterval(async () => {
      try {
        await this.pollDVNQueue();
      } catch (error) {
        console.error('[QCT Listener] DVN polling error:', error);
      }
    }, 30000); // 30 seconds
    
    // Do initial poll immediately
    this.pollDVNQueue().catch(err => {
      console.error('[QCT Listener] Initial DVN poll failed:', err);
    });
  }

  // Poll DVN queue for new messages
  // CRITICAL: This captures internal system transactions at the final settlement checkpoint
  // These are transactions leaving our system for LayerZero settlement (not subject to drift)
  private async pollDVNQueue() {
    try {
      // Import dynamically to avoid circular dependencies
      const { getActor } = await import('@/services/ops/icAgent');
      const { idlFactory: dvnIdl } = await import('@/services/ops/idl/cross_chain_service');
      
      const DVN_ID = (process.env.CROSS_CHAIN_SERVICE_CANISTER_ID || process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID) as string;
      if (!DVN_ID) return;
      
      const dvn = await getActor<any>(DVN_ID, dvnIdl);
      const pendingMessages = await dvn.get_pending_messages();
      
      if (!Array.isArray(pendingMessages)) return;
      const data = { ok: true, messages: pendingMessages };
      
      // Process each DVN message
      for (const message of data.messages) {
        const messageId = message.message_id || message.id;
        
        // Skip if already processed
        if (this.processedDvnMessages.has(messageId)) continue;
        
        // Mark as processed
        this.processedDvnMessages.add(messageId);
        
        // Create event from DVN message
        const event: QCTEvent = {
          id: messageId,
          chainId: this.mapChainIdToName(message.source_chain || 0),
          chainType: this.getChainType(message.source_chain || 0),
          eventType: this.detectEventType(message),
          txHash: message.tx_hash || messageId,
          timestamp: message.timestamp || Date.now(),
          from: message.from || 'unknown',
          to: message.to || 'unknown',
          amount: message.amount || '0',
          raw: message,
        };
        
        // Emit event
        this.emit('qct_event', event);
        console.log(`[QCT Listener] DVN event captured: ${event.eventType} on ${event.chainId}`);
        
        // Update stats for the chain
        this.updateStats(event.chainId, {
          eventsProcessed: 1,
          lastEventAt: event.timestamp,
        });
      }
      
      // Clean up old processed messages (keep last 1000)
      if (this.processedDvnMessages.size > 1000) {
        const toDelete = Array.from(this.processedDvnMessages).slice(0, this.processedDvnMessages.size - 1000);
        toDelete.forEach(id => this.processedDvnMessages.delete(id));
      }
    } catch (error) {
      console.error('[QCT Listener] DVN queue poll error:', error);
    }
  }

  // Helper: Map numeric chain ID to chain name
  private mapChainIdToName(chainId: number): string {
    const chainMap: Record<number, string> = {
      11155111: 'ethereum',
      80002: 'polygon',
      421614: 'arbitrum',
      11155420: 'optimism',
      84532: 'base',
      101: 'solana',
      0: 'bitcoin',
    };
    return chainMap[chainId] || 'unknown';
  }

  // Helper: Get chain type from numeric ID
  private getChainType(chainId: number): 'evm' | 'solana' | 'bitcoin' {
    if (chainId === 101) return 'solana';
    if (chainId === 0) return 'bitcoin';
    return 'evm';
  }

  // Helper: Detect event type from DVN message
  private detectEventType(message: any): 'mint' | 'burn' | 'transfer' {
    const payload = message.payload || message.data || '';
    if (typeof payload === 'string') {
      if (payload.includes('mint') || payload.includes('MINT')) return 'mint';
      if (payload.includes('burn') || payload.includes('BURN')) return 'burn';
    }
    return 'transfer';
  }

  // Helper: Detect event type from operation string
  private detectEventTypeFromOperation(operation: string): 'mint' | 'burn' | 'transfer' {
    const op = operation.toLowerCase();
    if (op.includes('mint')) return 'mint';
    if (op.includes('burn')) return 'burn';
    return 'transfer';
  }
}

// Singleton instance
let listenerInstance: QCTEventListener | null = null;

export function getQCTEventListener(): QCTEventListener {
  if (!listenerInstance) {
    listenerInstance = new QCTEventListener();
  }
  return listenerInstance;
}
