/**
 * Transaction monitoring service for Neo N3 MCP Server
 * Tracks and monitors transaction status
 */

import * as neonJs from '@cityofzion/neon-js';
import { logger } from '../utils/logger.js';
import { Cache } from '../utils/cache.js';
import { NetworkError, TransactionError } from '../utils/errors.js';

/**
 * Transaction status enum
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  UNKNOWN = 'unknown'
}

/**
 * Transaction information interface
 */
export interface TransactionInfo {
  txid: string;
  status: TransactionStatus;
  confirmations: number;
  blockHeight?: number;
  timestamp?: number;
  error?: string;
  lastChecked: number;
  network: string;
}

/**
 * Transaction monitor service
 */
export class TransactionMonitor {
  private rpcClient: any;
  private transactions: Cache<TransactionInfo>;
  private pollingInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs: number;
  private network: string;
  
  /**
   * Create a new transaction monitor
   * @param rpcUrl URL of the Neo N3 RPC node
   * @param network Network name (mainnet/testnet)
   * @param checkIntervalMs Interval to check transactions in milliseconds
   */
  constructor(rpcUrl: string, network: string, checkIntervalMs: number = 15000) {
    if (!rpcUrl) {
      throw new Error('RPC URL is required');
    }
    
    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new NetworkError(`Failed to initialize RPC client: ${errorMessage}`, {
        rpcUrl,
        network
      });
    }
    
    this.transactions = new Cache<TransactionInfo>('transactions', 86400000); // 24 hours TTL
    this.checkIntervalMs = checkIntervalMs;
    this.network = network;
    
    logger.info(`Transaction monitor initialized for ${network}`);
  }
  
  /**
   * Start monitoring transaction status
   * @param txid Transaction ID to monitor
   * @returns Initial transaction info
   */
  async trackTransaction(txid: string): Promise<TransactionInfo> {
    if (!txid || typeof txid !== 'string') {
      throw new TransactionError('Valid transaction ID is required');
    }
    
    // Normalize txid (remove 0x prefix if present)
    const normalizedTxid = txid.startsWith('0x') ? txid.substring(2) : txid;
    
    // Create cache key with network prefix
    const cacheKey = `${this.network}:${normalizedTxid}`;
    
    // Check if already tracking
    const existing = this.transactions.get(cacheKey);
    if (existing) {
      return existing;
    }
    
    // Initial transaction info
    const info: TransactionInfo = {
      txid: normalizedTxid,
      status: TransactionStatus.PENDING,
      confirmations: 0,
      lastChecked: Date.now(),
      network: this.network
    };
    
    // Store in cache
    this.transactions.set(cacheKey, info);
    
    // Start polling if not already running
    this.startPolling();
    
    logger.info(`Started tracking transaction ${normalizedTxid} on ${this.network}`, {
      txid: normalizedTxid,
      network: this.network
    });
    
    return info;
  }
  
  /**
   * Get current transaction status
   * @param txid Transaction ID
   * @returns Transaction info or undefined if not tracked
   */
  getTransaction(txid: string): TransactionInfo | undefined {
    const normalizedTxid = txid.startsWith('0x') ? txid.substring(2) : txid;
    const cacheKey = `${this.network}:${normalizedTxid}`;
    return this.transactions.get(cacheKey);
  }
  
  /**
   * Start polling for transaction updates
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }
    
    this.pollingInterval = setInterval(() => {
      this.checkTransactions().catch(error => {
        logger.error(`Error checking transactions on ${this.network}`, { 
          error: error instanceof Error ? error.message : String(error),
          network: this.network 
        });
      });
    }, this.checkIntervalMs);
    
    logger.debug(`Transaction polling started for ${this.network}`);
  }
  
  /**
   * Check status of all pending transactions
   */
  private async checkTransactions(): Promise<void> {
    // Get all transactions in the cache
    const entries = this.transactions.entries();
    
    if (entries.length === 0) {
      return;
    }
    
    // Get current chain height
    let currentHeight: number;
    try {
      currentHeight = await this.rpcClient.getBlockCount();
    } catch (error) {
      logger.error(`Failed to get chain height for ${this.network}`, { 
        error: error instanceof Error ? error.message : String(error),
        network: this.network
      });
      return;
    }
    
    logger.debug(`Checking ${entries.length} transactions on ${this.network} (current height: ${currentHeight})`);
    
    // Check each pending transaction
    for (const [cacheKey, info] of entries) {
      if (info.status !== TransactionStatus.PENDING) {
        continue;
      }
      
      try {
        // Try to get transaction
        const tx = await this.rpcClient.getRawTransaction(info.txid, 1);
        
        if (tx) {
          // Transaction found
          if (tx.confirmations === 0) {
            // Still pending
            info.lastChecked = Date.now();
            this.transactions.set(cacheKey, info);
            
            logger.debug(`Transaction ${info.txid} still pending on ${this.network}`);
          } else {
            // Confirmed
            info.status = TransactionStatus.CONFIRMED;
            info.confirmations = tx.confirmations;
            info.blockHeight = tx.blockheight;
            info.timestamp = tx.blocktime * 1000; // Convert to milliseconds
            info.lastChecked = Date.now();
            this.transactions.set(cacheKey, info);
            
            logger.info(`Transaction ${info.txid} confirmed on ${this.network} with ${tx.confirmations} confirmations`);
          }
        } else {
          // Transaction not found
          const timeSinceTracked = Date.now() - info.lastChecked;
          
          // If more than 1 hour and not found, mark as failed
          if (timeSinceTracked > 3600000) {
            info.status = TransactionStatus.FAILED;
            info.error = 'Transaction not found after timeout';
            info.lastChecked = Date.now();
            this.transactions.set(cacheKey, info);
            
            logger.warn(`Transaction ${info.txid} marked as failed on ${this.network}: not found after timeout`);
          }
        }
      } catch (error) {
        logger.warn(`Error checking transaction ${info.txid} on ${this.network}`, { 
          error: error instanceof Error ? error.message : String(error),
          txid: info.txid,
          network: this.network
        });
        
        // Update last checked time
        info.lastChecked = Date.now();
        this.transactions.set(cacheKey, info);
      }
    }
  }
  
  /**
   * Get all tracked transactions
   * @returns Array of transaction info
   */
  getAllTransactions(): TransactionInfo[] {
    return this.transactions.entries().map(([_, info]) => info);
  }
  
  /**
   * Get pending transactions count
   * @returns Number of pending transactions
   */
  getPendingCount(): number {
    return this.transactions.entries()
      .filter(([_, info]) => info.status === TransactionStatus.PENDING)
      .length;
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info(`Transaction monitor stopped for ${this.network}`);
    }
  }
} 