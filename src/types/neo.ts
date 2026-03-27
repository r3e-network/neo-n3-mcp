/**
 * Custom type definitions for Neo N3 RPC response shapes
 * not directly provided by @cityofzion/neon-js.
 */
import type { Account } from '@cityofzion/neon-core/lib/wallet/Account';

// ---- Stack item (VM result stack entry) ----

export interface StackItem {
  type: string;
  value?: string | number | boolean | StackItem[] | null;
}

// ---- NEP-17 transfers ----

export interface Nep17TransferEntry {
  timestamp?: number;
  assethash?: string;
  transferaddress?: string;
  amount?: string | number;
  blockindex?: number;
  transfernotifyindex?: number;
  txhash?: string;
  [key: string]: unknown;
}

export interface Nep17TransfersResponse {
  address?: string;
  sent?: Nep17TransferEntry[];
  received?: Nep17TransferEntry[];
  [key: string]: unknown;
}

// ---- NEP-11 balances ----

export interface Nep11TokenEntry {
  tokenid?: string;
  amount?: string | number;
  [key: string]: unknown;
}

export interface Nep11BalanceEntry {
  assethash?: string;
  name?: string;
  symbol?: string;
  decimals?: string | number;
  tokens?: Nep11TokenEntry[];
  [key: string]: unknown;
}

export interface Nep11BalancesResponse {
  address?: string;
  balance?: Nep11BalanceEntry[];
  [key: string]: unknown;
}

// ---- NEP-11 transfers ----

export interface Nep11TransferEntry {
  timestamp?: number;
  assethash?: string;
  transferaddress?: string;
  tokenid?: string;
  amount?: string | number;
  blockindex?: number;
  transfernotifyindex?: number;
  txhash?: string;
  [key: string]: unknown;
}

export interface Nep11TransfersResponse {
  address?: string;
  sent?: Nep11TransferEntry[];
  received?: Nep11TransferEntry[];
  [key: string]: unknown;
}

// ---- Application log ----

export interface AppLogNotification {
  contract?: string;
  scriptHash?: string;
  eventname?: string;
  eventName?: string;
  state?: { value?: StackItem[] };
  [key: string]: unknown;
}

export interface AppLogExecution {
  trigger?: string;
  vmstate?: string;
  exception?: string | null;
  gasconsumed?: string;
  stack?: StackItem[];
  notifications?: AppLogNotification[];
  [key: string]: unknown;
}

export interface ApplicationLogResponse {
  txid?: string;
  executions?: AppLogExecution[];
  [key: string]: unknown;
}

// ---- Balance result ----

export interface BalanceItem {
  assethash?: string;
  amount?: string | number;
  lastupdatedblock?: number;
  [key: string]: unknown;
}

export interface BalanceResult {
  address?: string;
  balance?: BalanceItem[];
  [key: string]: unknown;
}

// ---- Chain config (for neon-js experimental API) ----

export interface ChainConfig {
  rpcAddress: string;
  networkMagic: number;
  account?: Account;
}

// ---- Wallet info ----

export interface WalletInfo {
  address: string;
  publicKey: string;
  encryptedPrivateKey?: string;
  keyFormat?: string;
  createdAt?: string;
  [key: string]: unknown;
}

// ---- Tool result (MCP content format) ----

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}
