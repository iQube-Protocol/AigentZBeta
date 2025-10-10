// QCT Event Listener Service - Core Architecture
// Listens to QCT transactions across all 7 chains and submits to DVN queue

import { EventEmitter } from 'events';

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

  constructor() {
    super();
    this.setupChains();
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
        contractAddress: process.env.QCT_CONTRACT_ETH || '0x...', // TODO: Load from config
        startBlock: 0,
        confirmations: 3,
        enabled: true,
      },
      {
        chainId: 'polygon',
        name: 'Polygon Amoy',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || 'https://rpc-amoy.polygon.technology',
        contractAddress: process.env.QCT_CONTRACT_POLYGON || '0x...',
        startBlock: 0,
        confirmations: 5,
        enabled: true,
      },
      {
        chainId: 'arbitrum',
        name: 'Arbitrum Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
        contractAddress: process.env.QCT_CONTRACT_ARBITRUM || '0x...',
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      {
        chainId: 'optimism',
        name: 'Optimism Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
        contractAddress: process.env.QCT_CONTRACT_OPTIMISM || '0x...',
        startBlock: 0,
        confirmations: 1,
        enabled: true,
      },
      {
        chainId: 'base',
        name: 'Base Sepolia',
        type: 'evm',
        rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
        contractAddress: process.env.QCT_CONTRACT_BASE || '0x...',
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
        programId: process.env.QCT_PROGRAM_SOLANA || 'QCT...', // TODO: Load from config
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
        runesId: process.env.QCT_RUNES_ID || 'QCT•MICRO•STABLECOIN',
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
    console.log('[QCT Listener] All listeners stopped');
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
      const dvnPayload = {
        txHash: event.txHash,
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
    return Array.from(this.stats.values());
  }

  // Get stats for specific chain
  getChainStats(chainId: string): ListenerStats | undefined {
    return this.stats.get(chainId);
  }

  // Check if listener is running
  isListening(): boolean {
    return this.isRunning;
  }

  // Get supported chains
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
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
