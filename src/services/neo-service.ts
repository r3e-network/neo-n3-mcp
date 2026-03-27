import * as neonJs from '@cityofzion/neon-js';
import type { RPCClient } from '@cityofzion/neon-core/lib/rpc/RPCClient';
import type { Account } from '@cityofzion/neon-core/lib/wallet/Account';
import { KnownAccountMetadata, normalizeScriptHash, resolveKnownAccount, tryGetAddressFromScriptHash, tryGetScriptHashFromAddress } from '../metadata/known-accounts';
import { logger } from '../utils/logger';
import { ChainConfig, Nep17TransferEntry, Nep17TransfersResponse, Nep11BalanceEntry, Nep11BalancesResponse, Nep11TransfersResponse, StackItem } from '../types/neo';

/**
 * Supported Neo N3 networks
 */
export enum NeoNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

/**
 * Service for interacting with the Neo N3 blockchain
 */
export class NeoService {
  private rpcClient: RPCClient;
  private rpcUrl: string;
  private networkMagic?: number;
  private network: NeoNetwork;
  private lastCallTime: number = 0;
  private minCallInterval: number = 100; // Minimum time between RPC calls in milliseconds
  private rateLimitEnabled: boolean = true;

  /**
   * Create a new Neo service
   * @param rpcUrl URL of the Neo N3 RPC node
   * @param network Network type (mainnet or testnet)
   * @param options Additional service options
   */
  constructor(
    rpcUrl: string,
    network: NeoNetwork = NeoNetwork.MAINNET,
    options: {
      rateLimitEnabled?: boolean,
      minCallInterval?: number
    } = {}
  ) {
    if (!rpcUrl) {
      throw new Error('RPC URL is required');
    }

    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);

      // Validate that the RPC URL is formatted correctly
      const urlPattern = /^(http|https):\/\/[^ "]+$/;
      if (!urlPattern.test(rpcUrl)) {
        throw new Error(`Invalid RPC URL format: ${rpcUrl}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Neo RPC client: ${errorMessage}`);
    }

    // Validate network
    if (!Object.values(NeoNetwork).includes(network)) {
      throw new Error(`Invalid network: ${network}. Must be one of: ${Object.values(NeoNetwork).join(', ')}`);
    }

    this.network = network;
    this.rpcUrl = rpcUrl;

    // Apply options
    if (options.rateLimitEnabled !== undefined) {
      this.rateLimitEnabled = options.rateLimitEnabled;
    }

    if (options.minCallInterval !== undefined && options.minCallInterval > 0) {
      this.minCallInterval = options.minCallInterval;
    }
  }

  /**
   * Get essential blockchain information
   * @returns Object containing blockchain height and network
   */
  async getBlockchainInfo() {
    try {
      // Use dedicated methods
      const height = await this.rpcClient.getBlockCount();

      // Try to get validators using multiple approaches
      let validators = [];
      try {
        // Try to get validators using multiple approaches
        let validatorsResult: unknown = undefined;
        try {
          // Try execute method first
          validatorsResult = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'getvalidators', params: [] }));
        } catch (executeError) {
          // Fallback to getnextblockvalidators
          try {
            validatorsResult = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'getnextblockvalidators', params: [] }));
          } catch (nextError) {
            logger.warn('All validator query methods failed; continuing without validators', { network: this.network });
          }
        }
        if (validatorsResult && Array.isArray(validatorsResult)) {
          validators = validatorsResult;
        }
      } catch (validatorError) {
        logger.warn('Failed to get validators; continuing without validators', { network: this.network, error: validatorError instanceof Error ? validatorError.message : String(validatorError) });
        // Continue without validators
      }

      return {
        height,
        validators,
        network: this.network
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get blockchain info: ${errorMessage}`);
    }
  }

  /**
   * Get block details by height or hash
   * @param hashOrHeight Block height or hash
   * @returns Block details
   */
  async getBlock(hashOrHeight: string | number) {
    try {
      // Use dedicated method
      return await this.rpcClient.getBlock(hashOrHeight, 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get block ${hashOrHeight}: ${errorMessage}`);
    }
  }


  private enrichKnownParty(reference: string | null | undefined): { address?: string; scriptHash?: string; displayName?: string; name?: string; logo?: string; kind?: KnownAccountMetadata['kind']; knownAccount?: KnownAccountMetadata } | null {
    const scriptHash = normalizeScriptHash(reference) ?? tryGetScriptHashFromAddress(reference);
    const address = (reference && !normalizeScriptHash(reference) ? reference : null) ?? tryGetAddressFromScriptHash(scriptHash);
    const knownAccount = resolveKnownAccount(reference ?? scriptHash ?? undefined, this.network) ?? (scriptHash ? resolveKnownAccount(scriptHash, this.network) : null);

    if (!address && !scriptHash && !knownAccount) {
      return null;
    }

    return {
      ...(address ? { address } : {}),
      ...(scriptHash ? { scriptHash } : {}),
      ...((knownAccount || address || scriptHash)
        ? { displayName: knownAccount?.name ?? address ?? scriptHash ?? undefined }
        : {}),
      ...(knownAccount?.name ? { name: knownAccount.name } : {}),
      ...(knownAccount?.logo ? { logo: knownAccount.logo } : {}),
      ...(knownAccount?.kind ? { kind: knownAccount.kind } : {}),
      ...(knownAccount ? { knownAccount } : {}),
    };
  }

  private normalizeHash160FromStackItem(item: StackItem): string | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const value = typeof item.value === 'string' ? item.value.trim() : '';
    if (!value) {
      return null;
    }

    if (item.type === 'Hash160') {
      return normalizeScriptHash(value);
    }

    if (item.type === 'ByteString' || item.type === 'ByteArray') {
      const directHex = normalizeScriptHash(value);
      if (directHex) {
        return directHex;
      }

      try {
        const bytes = Buffer.from(value, 'base64');
        if (bytes.length === 20) {
          return normalizeScriptHash(bytes.toString('hex'));
        }

        const decodedText = bytes.toString('utf8');
        return normalizeScriptHash(decodedText) ?? tryGetScriptHashFromAddress(decodedText);
      } catch {
        return null;
      }
    }

    if (item.type === 'String') {
      return tryGetScriptHashFromAddress(value) ?? normalizeScriptHash(value);
    }

    return null;
  }

  private parseTransferParticipant(item: StackItem) {
    if (!item || item.type === 'Any' || item.type === 'Null') {
      return null;
    }

    const scriptHash = this.normalizeHash160FromStackItem(item);
    if (scriptHash) {
      return this.enrichKnownParty(scriptHash) ?? { scriptHash };
    }

    if (typeof item.value === 'string') {
      return this.enrichKnownParty(item.value) ?? { value: item.value };
    }

    return null;
  }

  private parseTransferAmount(item: StackItem): string | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    if (item.type === 'Integer') {
      return String(item.value);
    }

    if ((item.type === 'ByteString' || item.type === 'ByteArray') && typeof item.value === 'string') {
      try {
        return Buffer.from(item.value, 'base64').toString('utf8');
      } catch {
        return String(item.value);
      }
    }

    if (item.value !== undefined && item.value !== null) {
      return String(item.value);
    }

    return null;
  }

  private buildAssetDescriptor(reference: string | null | undefined) {
    const scriptHash = normalizeScriptHash(reference);
    const knownAccount = resolveKnownAccount(reference ?? scriptHash ?? undefined, this.network) ?? (scriptHash ? resolveKnownAccount(scriptHash, this.network) : null);
    const address = tryGetAddressFromScriptHash(scriptHash);

    return {
      ...(scriptHash ? { scriptHash } : {}),
      ...(address ? { address } : {}),
      ...(knownAccount?.symbol ? { symbol: knownAccount.symbol } : {}),
      name: knownAccount?.name ?? scriptHash ?? undefined,
      ...(knownAccount?.logo ? { logo: knownAccount.logo } : {}),
      ...(knownAccount ? { knownAccount } : {}),
    };
  }

  private buildTransferHistoryEntry(entry: Nep17TransferEntry, accountAddress: string, direction: 'sent' | 'received') {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    const selfParty = this.enrichKnownParty(accountAddress) ?? { address: accountAddress };
    const counterparty = this.enrichKnownParty(entry.transferaddress) ?? (entry.transferaddress ? { address: entry.transferaddress } : null);
    const from = direction === 'sent' ? selfParty : counterparty;
    const to = direction === 'sent' ? counterparty : selfParty;
    const timestampMs = typeof entry.timestamp === 'number'
      ? entry.timestamp
      : (typeof entry.timestamp === 'string' && /^\d+$/.test(entry.timestamp) ? Number.parseInt(entry.timestamp, 10) : null);

    return {
      ...entry,
      direction,
      ...(timestampMs !== null && Number.isFinite(timestampMs)
        ? { timestampIso: new Date(timestampMs).toISOString() }
        : {}),
      ...(entry.assethash ? { asset: this.buildAssetDescriptor(entry.assethash) } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(counterparty ? { counterparty } : {}),
    };
  }

  private enrichNep17Transfers(transfers: Nep17TransfersResponse, accountAddress: string) {
    if (!transfers || typeof transfers !== 'object') {
      return transfers;
    }

    return {
      ...transfers,
      sent: Array.isArray(transfers.sent)
        ? transfers.sent.map((entry: Nep17TransferEntry) => this.buildTransferHistoryEntry(entry, accountAddress, 'sent'))
        : transfers.sent,
      received: Array.isArray(transfers.received)
        ? transfers.received.map((entry: Nep17TransferEntry) => this.buildTransferHistoryEntry(entry, accountAddress, 'received'))
        : transfers.received,
    };
  }

  private buildNep11BalanceEntry(entry: Nep11BalanceEntry) {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    return {
      ...entry,
      ...(entry.assethash ? { asset: this.buildAssetDescriptor(entry.assethash) } : {}),
      ...(Array.isArray(entry.tokens) ? { tokenCount: entry.tokens.length } : {}),
    };
  }

  private enrichNep11Balances(balances: Nep11BalancesResponse) {
    if (!balances || typeof balances !== 'object') {
      return balances;
    }

    return {
      ...balances,
      balance: Array.isArray(balances.balance)
        ? balances.balance.map((entry: Nep11BalanceEntry) => this.buildNep11BalanceEntry(entry))
        : balances.balance,
    };
  }

  private enrichNep11Transfers(transfers: Nep11TransfersResponse, accountAddress: string) {
    if (!transfers || typeof transfers !== 'object') {
      return transfers;
    }

    return {
      ...transfers,
      sent: Array.isArray(transfers.sent)
        ? transfers.sent.map((entry: Nep17TransferEntry) => this.buildTransferHistoryEntry(entry, accountAddress, 'sent'))
        : transfers.sent,
      received: Array.isArray(transfers.received)
        ? transfers.received.map((entry: Nep17TransferEntry) => this.buildTransferHistoryEntry(entry, accountAddress, 'received'))
        : transfers.received,
    };
  }

  private enrichNotification(notification: Record<string, unknown>): Record<string, unknown> {
    if (!notification || typeof notification !== 'object') {
      return notification;
    }

    const eventName = notification.eventname ?? notification.eventName;
    const notifState = notification.state as Record<string, unknown> | undefined;
    const stateValues = Array.isArray(notifState?.value) ? notifState.value as StackItem[] : null;
    if (eventName !== 'Transfer' || !stateValues || stateValues.length < 3) {
      return notification;
    }

    const contractOrHash = notification.contract ?? notification.scriptHash;
    const contractReference = typeof contractOrHash === 'string' ? contractOrHash : undefined;
    const parsed = {
      type: 'nep17_transfer',
      contract: this.enrichKnownParty(contractReference) ?? { ...(normalizeScriptHash(contractReference) ? { scriptHash: normalizeScriptHash(contractReference) } : {}) },
      asset: this.buildAssetDescriptor(contractReference),
      from: this.parseTransferParticipant(stateValues[0]),
      to: this.parseTransferParticipant(stateValues[1]),
      amount: this.parseTransferAmount(stateValues[2]),
    };

    return {
      ...notification,
      parsed,
    };
  }

  private enrichApplicationLog(applicationLog: Record<string, unknown>) {
    if (!applicationLog || typeof applicationLog !== 'object' || !Array.isArray(applicationLog.executions)) {
      return applicationLog;
    }

    return {
      ...applicationLog,
      executions: (applicationLog.executions as Record<string, unknown>[]).map((execution: Record<string, unknown>) => ({
        ...execution,
        notifications: Array.isArray(execution?.notifications)
          ? (execution.notifications as Record<string, unknown>[]).map((notification: Record<string, unknown>) => this.enrichNotification(notification))
          : execution?.notifications,
      })),
    };
  }

  private enrichTransaction(transaction: Record<string, unknown>) {
    if (!transaction || typeof transaction !== 'object') {
      return transaction;
    }

    const senderInfo = typeof transaction.sender === 'string'
      ? this.enrichKnownParty(transaction.sender)
      : null;

    return senderInfo
      ? {
          ...transaction,
          senderInfo,
        }
      : transaction;
  }

  /**
   * Get transaction details by hash
   * @param txid Transaction hash
   * @returns Transaction details
   */
  async getTransaction(txid: string) {
    try {
      try {
        return this.enrichTransaction(await this.rpcClient.getRawTransaction(txid, true) as unknown as Record<string, unknown>);
      } catch (directError) {
        logger.warn('Direct getRawTransaction failed; trying query fallback', { txid, error: directError instanceof Error ? directError.message : String(directError) });
        return this.enrichTransaction(await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'getrawtransaction', params: [txid, 1] })) as Record<string, unknown>);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transaction ${txid}: ${errorMessage}`);
    }
  }

  /**
   * Get the application log for a transaction.
   * @param txid Transaction hash
   * @returns Application log payload
   */
  async getApplicationLog(txid: string) {
    try {
      return this.enrichApplicationLog(await this.rpcClient.getApplicationLog(txid) as unknown as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get application log for ${txid}: ${errorMessage}`);
    }
  }

  /**
   * Get the amount of claimable GAS for an address.
   * @param address Neo N3 address
   * @returns Unclaimed GAS summary
   */
  async getUnclaimedGas(address: string) {
    try {
      const unclaimedGas = await this.rpcClient.getUnclaimedGas(address);
      return {
        address,
        unclaimedGas: typeof unclaimedGas === 'string' ? unclaimedGas : String(unclaimedGas),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get unclaimed GAS for ${address}: ${errorMessage}`);
    }
  }

  /**
   * Get NEP-17 transfer history for an address.
   * @param address Neo N3 address
   * @param options Optional timestamp filters in Unix epoch milliseconds
   * @returns Transfer history payload from RPC with additive enrichment
   */
  async getNep17Transfers(
    address: string,
    options: {
      fromTimestampMs?: number,
      toTimestampMs?: number,
    } = {}
  ) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Invalid address format');
      }

      if (options.fromTimestampMs !== undefined && (!Number.isInteger(options.fromTimestampMs) || options.fromTimestampMs < 0)) {
        throw new Error(`Invalid fromTimestampMs: ${options.fromTimestampMs}`);
      }

      if (options.toTimestampMs !== undefined && (!Number.isInteger(options.toTimestampMs) || options.toTimestampMs < 0)) {
        throw new Error(`Invalid toTimestampMs: ${options.toTimestampMs}`);
      }

      if (options.fromTimestampMs !== undefined && options.toTimestampMs !== undefined && options.fromTimestampMs > options.toTimestampMs) {
        throw new Error('fromTimestampMs must be less than or equal to toTimestampMs');
      }

      const params: Array<string | number> = [address];
      if (options.fromTimestampMs !== undefined) {
        params.push(options.fromTimestampMs);
      }
      if (options.toTimestampMs !== undefined) {
        if (options.fromTimestampMs === undefined) {
          params.push(0);
        }
        params.push(options.toTimestampMs);
      }

      const transfers = await this.rpcClient.execute(new neonJs.rpc.Query({
        method: 'getnep17transfers',
        params,
      }));

      return this.enrichNep17Transfers(transfers as Nep17TransfersResponse, address);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get NEP-17 transfers for address ${address}: ${errorMessage}`);
    }
  }

  /**
   * Get NEP-11 balances for an address.
   * @param address Neo N3 address
   * @returns NFT balance payload from RPC with additive enrichment
   */
  async getNep11Balances(address: string) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Invalid address format');
      }

      const balances = await this.rpcClient.execute(new neonJs.rpc.Query({
        method: 'getnep11balances',
        params: [address],
      }));

      return this.enrichNep11Balances(balances as Nep11BalancesResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get NEP-11 balances for address ${address}: ${errorMessage}`);
    }
  }

  /**
   * Get NEP-11 transfer history for an address.
   * @param address Neo N3 address
   * @param options Optional timestamp filters in Unix epoch milliseconds
   * @returns NFT transfer history payload from RPC with additive enrichment
   */
  async getNep11Transfers(
    address: string,
    options: {
      fromTimestampMs?: number,
      toTimestampMs?: number,
    } = {}
  ) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Invalid address format');
      }

      if (options.fromTimestampMs !== undefined && (!Number.isInteger(options.fromTimestampMs) || options.fromTimestampMs < 0)) {
        throw new Error(`Invalid fromTimestampMs: ${options.fromTimestampMs}`);
      }

      if (options.toTimestampMs !== undefined && (!Number.isInteger(options.toTimestampMs) || options.toTimestampMs < 0)) {
        throw new Error(`Invalid toTimestampMs: ${options.toTimestampMs}`);
      }

      if (options.fromTimestampMs !== undefined && options.toTimestampMs !== undefined && options.fromTimestampMs > options.toTimestampMs) {
        throw new Error('fromTimestampMs must be less than or equal to toTimestampMs');
      }

      const params: Array<string | number> = [address];
      if (options.fromTimestampMs !== undefined) {
        params.push(options.fromTimestampMs);
      }
      if (options.toTimestampMs !== undefined) {
        if (options.fromTimestampMs === undefined) {
          params.push(0);
        }
        params.push(options.toTimestampMs);
      }

      const transfers = await this.rpcClient.execute(new neonJs.rpc.Query({
        method: 'getnep11transfers',
        params,
      }));

      return this.enrichNep11Transfers(transfers as Nep11TransfersResponse, address);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get NEP-11 transfers for address ${address}: ${errorMessage}`);
    }
  }

  /**
   * Poll for a transaction to be confirmed on-chain.
   * @param txid Transaction hash
   * @param options Polling options
   * @returns Confirmation status and transaction details
   */
  async waitForTransaction(
    txid: string,
    options: { timeoutMs?: number; pollIntervalMs?: number; includeApplicationLog?: boolean } = {}
  ) {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    const includeApplicationLog = options.includeApplicationLog ?? false;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      try {
        const blockHeight = await this.rpcClient.getTransactionHeight(txid);
        const transaction = await this.getTransaction(txid);
        const result: Record<string, unknown> = {
          txid,
          confirmed: true,
          blockHeight,
          transaction,
        };

        if (includeApplicationLog) {
          result.applicationLog = await this.getApplicationLog(txid);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryable = /unknown|not found|pending|mempool|missing/i.test(errorMessage);
        if (!retryable) {
          throw new Error(`Failed while waiting for transaction ${txid}: ${errorMessage}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return {
      txid,
      confirmed: false,
      timeoutMs,
      pollIntervalMs,
    };
  }

  /**
   * Get account balance for a specific address
   * @param address Neo N3 address
   * @returns Balance information
   */
  async getBalance(address: string) {
    try {
      if (!address || typeof address !== 'string') {
        throw new Error('Invalid address format');
      }

      try {
        // Try to use execute method for getNep17Balances
        const query = new neonJs.rpc.Query({ method: 'getnep17balances', params: [address] });
        const balanceResultRaw = await this.rpcClient.execute(query);
        const balanceResult = balanceResultRaw as Record<string, unknown> | undefined;
        if (balanceResult && balanceResult.balance) {
          return {
            address: balanceResult.address,
            balance: (balanceResult.balance as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
              asset_hash: item.assethash,
              amount: item.amount,
              asset_name: typeof item.assethash === 'string' ? this.getAssetNameByHash(item.assethash) : '',
              last_updated_block: item.lastupdatedblock
            }))
          };
        }
      } catch (nep17Error) {
        logger.warn('getnep17balances failed; trying alternative balance lookup', { address, error: nep17Error instanceof Error ? nep17Error.message : String(nep17Error) });

        // Try to get NEO and GAS balances directly
        try {
          const neoHash = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5'; // NEO hash
          const gasHash = '0xd2a4cff31913016155e38e474a2c06d08be276cf'; // GAS hash

          // Create a script to get NEO balance
          const neoScript = neonJs.sc.createScript({
            scriptHash: neoHash,
            operation: 'balanceOf',
            args: [neonJs.sc.ContractParam.hash160(address)]
          });

          // Create a script to get GAS balance
          const gasScript = neonJs.sc.createScript({
            scriptHash: gasHash,
            operation: 'balanceOf',
            args: [neonJs.sc.ContractParam.hash160(address)]
          });

          // Execute the scripts
          const neoResult = await this.rpcClient.invokeScript(neonJs.u.HexString.fromHex(neoScript).toString(), []);
          const gasResult = await this.rpcClient.invokeScript(neonJs.u.HexString.fromHex(gasScript).toString(), []);

          // Extract balances from results
          const neoBalance = neoResult.state === 'HALT' && neoResult.stack && neoResult.stack.length > 0
            ? neoResult.stack[0].value
            : '0';

          const gasBalance = gasResult.state === 'HALT' && gasResult.stack && gasResult.stack.length > 0
            ? gasResult.stack[0].value
            : '0';

          return {
            address,
            balance: [
              {
                asset: 'NEO',
                asset_hash: neoHash,
                asset_name: 'NEO',
                amount: neoBalance
              },
              {
                asset: 'GAS',
                asset_hash: gasHash,
                asset_name: 'GAS',
                amount: gasBalance
              }
            ]
          };
        } catch (invokeError) {
          throw new Error(`Invoke script approach also failed: ${invokeError instanceof Error ? invokeError.message : String(invokeError)}`);
        }
      }

      throw new Error(`No balance data returned for address ${address}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get balance for address ${address}: ${errorMessage}`);
    }
  }

  /**
   * Get asset name by hash
   * @param assetHash Asset hash
   * @returns Asset name or hash if not found
   */
  private getAssetNameByHash(assetHash: string): string {
    // Common NEO and GAS asset hashes (same for mainnet and testnet)
    const assetNames: Record<string, string> = {
      '0xd2a4cff31913016155e38e474a2c06d08be276cf': 'GAS',
      '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5': 'NEO'
    };

    return assetNames[assetHash.toLowerCase()] || assetHash;
  }

  /**
   * Transfer assets between addresses
   * @param fromAccount Sender account
   * @param toAddress Recipient address
   * @param asset Asset hash or symbol (e.g., 'NEO', 'GAS')
   * @param amount Amount to transfer
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction details
   */
  async transferAssets(
    fromAccount: Account,
    toAddress: string,
    asset: string,
    amount: string | number,
    additionalScriptAttributes: unknown[] = []
  ) {
    try {
      if (!fromAccount || !fromAccount.address) {
        throw new Error('Invalid sender account: missing address');
      }

      if (!toAddress) {
        throw new Error('Recipient address is required');
      }

      const normalizedAmount = typeof amount === 'string' ? Number(amount) : amount;
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error(`Invalid transfer amount: ${amount}`);
      }

      // Ensure addresses are strings, not objects
      const fromAddress = typeof fromAccount.address === 'string'
        ? fromAccount.address
        : String(fromAccount.address);

      // Validate addresses using Neo address pattern
      const addressPattern = /^[A-Za-z0-9]{33,35}$/;
      if (!addressPattern.test(fromAddress)) {
        throw new Error(`Invalid sender address format: ${fromAddress}`);
      }

      if (!addressPattern.test(toAddress)) {
        throw new Error(`Invalid recipient address format: ${toAddress}`);
      }

      const contractHash = asset.startsWith('0x') ? asset : this.getAssetHash(asset);
      const transferContract = new neonJs.experimental.nep17.Nep17Contract(
        neonJs.u.HexString.fromHex(this.stripHexPrefix(contractHash)),
        await this.getChainConfig(fromAccount)
      );

      const txid = await transferContract.transfer(fromAddress, toAddress, normalizedAmount);
      return { txid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to transfer assets: ${errorMessage}`);
    }
  }

  /**
   * Invoke a smart contract method for READ-ONLY operations.
   * Uses invokeScript RPC method.
   * @param scriptHash Contract script hash
   * @param operation Method name
   * @param args Method arguments
   * @returns The result of the invokeScript call (state, gasconsumed, stack, etc.)
   */
  async invokeReadContract(
    scriptHash: string,
    operation: string,
    args: unknown[] = []
  ) {
    try {
      if (!scriptHash) throw new Error('Script hash is required');
      if (!operation) throw new Error('Operation is required');

      const script = neonJs.sc.createScript({
        scriptHash,
        operation,
        args: args as import('@cityofzion/neon-core/lib/sc/ContractParam').ContractParamJson[],
      });
      const scriptHexString = neonJs.u.HexString.fromHex(script);

      // Use invokeScript for read-only calls, explicitly pass empty signers
      const result = await this.rpcClient.invokeScript(scriptHexString.toString(), []);
      if (result.state !== 'HALT') {
        // Log warning but return result anyway, as some reads might not HALT cleanly but still return data
        logger.warn('Read invoke state is not HALT', { scriptHash, operation, state: result.state, exception: result.exception ?? null });
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to invoke read contract', { scriptHash, operation, error: errorMessage });
      throw new Error(`Failed to invoke read contract ${scriptHash}.${operation}: ${errorMessage}`);
    }
  }

  /**
   * Invoke a smart contract method for WRITE operations.
   * Requires a signing account.
   * @param fromAccount Account to sign the transaction
   * @param scriptHash Contract script hash
   * @param operation Method name
   * @param args Method arguments
   * @param additionalScriptAttributes Additional script attributes
   * @returns { txid, tx } Transaction details
   */
  async invokeContract(
    fromAccount: Account,
    scriptHash: string,
    operation: string,
    args: unknown[] = [],
    additionalScriptAttributes: unknown[] = []
  ) {
    try {
      if (!scriptHash) throw new Error('Script hash is required');
      if (!operation) throw new Error('Operation is required');

      if (!fromAccount || !fromAccount.address) throw new Error('Invalid sender account: missing address');
      const contract = new neonJs.experimental.SmartContract(
        neonJs.u.HexString.fromHex(this.stripHexPrefix(scriptHash)),
        await this.getChainConfig(fromAccount)
      );

      const txid = await contract.invoke(operation, args as import('@cityofzion/neon-core/lib/sc/ContractParam').ContractParam[]);
      return { txid };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to invoke write contract', { scriptHash, operation, error: errorMessage });
      throw new Error(`Failed to invoke write contract ${scriptHash}.${operation}: ${errorMessage}`);
    }
  }

  /**
   * Get the current block count (height) of the blockchain.
   * @returns The current block height.
   */
  async getBlockCount(): Promise<number> {
    try {
      return await this.rpcClient.getBlockCount();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get block count: ${errorMessage}`);
    }
  }

  /**
   * Calculate the network and system fees for a transfer operation.
   * @param fromAddress Sender address
   * @param toAddress Recipient address
   * @param asset Asset hash or symbol
   * @param amount Amount to transfer
   * @returns Object containing networkFee and systemFee
   */
  async calculateTransferFee(
    fromAddress: string,
    toAddress: string,
    asset: string,
    amount: string | number
  ): Promise<{ networkFee: number; systemFee: number }> {
    try {
      const script = neonJs.sc.createScript({
        scriptHash: asset.startsWith('0x') ? asset : this.getAssetHash(asset),
        operation: 'transfer',
        args: [
          neonJs.sc.ContractParam.hash160(fromAddress),
          neonJs.sc.ContractParam.hash160(toAddress),
          neonJs.sc.ContractParam.integer(amount),
          neonJs.sc.ContractParam.any(null), // data argument for transfer
        ],
      });

      const signer = {
        account: neonJs.wallet.getScriptHashFromAddress(fromAddress),
        scopes: neonJs.tx.WitnessScope.CalledByEntry,
      } as unknown as import('@cityofzion/neon-core/lib/tx/components/Signer').Signer;

      const tx = new neonJs.tx.Transaction();
      tx.script = neonJs.u.HexString.fromHex(script);
      tx.addSigner(signer);

      const dummyAccount = new neonJs.wallet.Account();
      tx.addWitness(new neonJs.tx.Witness({
        invocationScript: '',
        verificationScript: neonJs.u.HexString.fromBase64(dummyAccount.contract.script).toString(),
      }));

      const systemFee = await neonJs.experimental.txHelpers.getSystemFee(
        tx.script,
        await this.getChainConfig(),
        [signer]
      );
      const networkFee = await neonJs.api.smartCalculateNetworkFee(tx, this.rpcClient);

      return {
        networkFee: Number(networkFee.toString()),
        systemFee: Number(systemFee.toString())
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to calculate transfer fee: ${errorMessage}`);
    }
  }

  /**
   * Calculate the network and system fees for a contract invocation.
   * @param fromAddress Signer address
   * @param scriptHash Contract script hash
   * @param operation Method name
   * @param args Method arguments
   * @returns Object containing networkFee and systemFee
   */
  async calculateInvokeFee(
    fromAddress: string,
    scriptHash: string,
    operation: string,
    args: unknown[] = []
  ): Promise<{ networkFee: number; systemFee: number }> {
    try {
      const script = neonJs.sc.createScript({ scriptHash, operation, args: args as import('@cityofzion/neon-core/lib/sc/ContractParam').ContractParamJson[] });
      const signer = {
        account: neonJs.wallet.getScriptHashFromAddress(fromAddress),
        scopes: neonJs.tx.WitnessScope.CalledByEntry,
      } as unknown as import('@cityofzion/neon-core/lib/tx/components/Signer').Signer;

      const tx = new neonJs.tx.Transaction();
      tx.script = neonJs.u.HexString.fromHex(script);
      tx.addSigner(signer);

      const dummyAccount = new neonJs.wallet.Account();
      tx.addWitness(new neonJs.tx.Witness({
        invocationScript: '',
        verificationScript: neonJs.u.HexString.fromBase64(dummyAccount.contract.script).toString(),
      }));

      const systemFee = await neonJs.experimental.txHelpers.getSystemFee(
        tx.script,
        await this.getChainConfig(),
        [signer]
      );
      const networkFee = await neonJs.api.smartCalculateNetworkFee(tx, this.rpcClient);

      return {
        networkFee: Number(networkFee.toString()),
        systemFee: Number(systemFee.toString())
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to calculate invoke fee: ${errorMessage}`);
    }
  }

  /**
   * Claim GAS for a given account.
   * @param fromAccount Account to claim GAS for and sign the transaction.
   * @returns Transaction details { txid, tx }
   */
  async claimGas(fromAccount: Account): Promise<{ txid: string }> {
    try {
      if (!fromAccount || !fromAccount.address) {
        throw new Error('Invalid account for claiming GAS: missing address');
      }
      const fromAddress = typeof fromAccount.address === 'string' ? fromAccount.address : String(fromAccount.address);
      const addressPattern = /^[A-Za-z0-9]{33,35}$/;
      if (!addressPattern.test(fromAddress)) {
        throw new Error(`Invalid address format for claiming GAS: ${fromAddress}`);
      }

      const neoToken = new neonJs.experimental.nep17.NEOContract(await this.getChainConfig(fromAccount));
      const txid = await neoToken.claimGas(fromAddress);
      return { txid };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to claim GAS', { address: fromAccount?.address ?? null, error: errorMessage });
      throw new Error(`Failed to claim GAS: ${errorMessage}`);
    }
  }

  /**
   * Create a new wallet
   * @param password Password for encrypting the wallet
   * @returns New wallet account
   */
  createWallet(password: string) {
    try {
      const account = new neonJs.wallet.Account();
      return {
        address: account.address,
        publicKey: account.publicKey,
        encryptedPrivateKey: account.encrypt(password),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create wallet: ${errorMessage}`);
    }
  }

  /**
   * Import a wallet from WIF or encrypted key
   * @param key WIF or encrypted private key
   * @param password Password for decrypting the key (if encrypted)
   * @returns Wallet account
   */
  importWallet(key: string, password?: string) {
    try {
      let account: Account;

      if (password) {
        // Import from NEP2-encrypted key: Account constructor takes the encrypted WIF,
        // then decrypt() takes the passphrase.
        account = new neonJs.wallet.Account(key);

        try {
          account.decrypt(password);
        } catch (decryptError: unknown) {
          const msg = decryptError instanceof Error ? decryptError.message : String(decryptError);
          throw new Error(`Failed to decrypt wallet: ${msg}`);
        }
      } else {
        // Import from WIF
        try {
          account = new neonJs.wallet.Account(key);
        } catch (wifError: unknown) {
          const msg = wifError instanceof Error ? wifError.message : String(wifError);
          throw new Error(`Invalid WIF key: ${msg}`);
        }
      }

      return {
        address: account.address,
        publicKey: account.publicKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import wallet: ${errorMessage}`);
    }
  }

  /**
   * Get asset hash from symbol based on the current network
   * @param symbol Asset symbol (e.g., 'NEO', 'GAS')
   * @returns Asset hash
   */
  private async getNetworkMagic(): Promise<number> {
    if (this.networkMagic !== undefined) {
      return this.networkMagic;
    }

    const versionRaw = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'getversion', params: [] }));
    const version = versionRaw as Record<string, unknown>;
    const versionProtocol = version?.protocol as Record<string, unknown> | undefined;
    const networkMagicRaw = versionProtocol?.network;
    if (!Number.isInteger(networkMagicRaw)) {
      throw new Error('Failed to determine network magic from RPC getversion');
    }
    const networkMagic = networkMagicRaw as number;

    this.networkMagic = networkMagic;
    return networkMagic;
  }

  private async getChainConfig(account?: Account): Promise<ChainConfig> {
    return {
      rpcAddress: this.rpcUrl,
      networkMagic: await this.getNetworkMagic(),
      account,
    };
  }

  private stripHexPrefix(value: string): string {
    return value.startsWith('0x') ? value.slice(2) : value;
  }

  private getAssetHash(symbol: string): string {
    if (!symbol) {
      throw new Error('Asset symbol is required');
    }

    // Asset hashes for different networks
    // Note: In Neo N3, NEO and GAS use the same contract hashes on both mainnet and testnet
    const assets: Record<NeoNetwork, Record<string, string>> = {
      [NeoNetwork.MAINNET]: {
        NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      },
      [NeoNetwork.TESTNET]: {
        NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',  // Same as mainnet in Neo N3
        GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf',  // Same as mainnet in Neo N3
      }
    };

    // Check if the network is supported
    if (!assets[this.network]) {
      throw new Error(`Unsupported network: ${this.network}`);
    }

    const networkAssets = assets[this.network];
    const symbolUpper = symbol.toUpperCase();

    if (!networkAssets[symbolUpper]) {
      const availableAssets = Object.keys(networkAssets).join(', ');
      throw new Error(`Unknown asset: "${symbol}" on network "${this.network}". Available assets: ${availableAssets}`);
    }

    return networkAssets[symbolUpper];
  }

  /**
   * Get the current network
   * @returns The current network
   */
  getNetwork(): NeoNetwork {
    return this.network;
  }

}
