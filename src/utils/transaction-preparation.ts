import * as neonJs from '@cityofzion/neon-js';
import type { NeonAccount, NeonRpcClient, NeonTransaction } from '../types/neon';
import { ValidationError } from './errors';

const FALLBACK_TRANSACTION_LIFESPAN = 5_760;
const GAS_TOKEN_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
const GAS_FACTOR = 100_000_000n;
export const DEFAULT_MAX_TRANSACTION_FEE_GAS = '20';
export const DEFAULT_MAX_TRANSACTION_FEE_DATOS = 20n * GAS_FACTOR;

export function formatDatosAsGas(value: bigint): string {
  const digits = value.toString().padStart(9, '0');
  const whole = digits.slice(0, -8);
  const fraction = digits.slice(-8).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export async function calculateNetworkFee(
  transaction: NeonTransaction,
  rpcClient: NeonRpcClient
): Promise<NeonTransaction['networkFee']> {
  const validatingFeeClient = {
    calculateNetworkFee: async (candidate: NeonTransaction) => {
      const networkFee = await rpcClient.calculateNetworkFee(candidate);
      const networkFeeText = String(networkFee);
      if (
        (typeof networkFee !== 'string' && typeof networkFee !== 'number')
        || (typeof networkFee === 'number' && !Number.isSafeInteger(networkFee))
        || !/^\d+$/.test(networkFeeText)
      ) {
        throw new Error('Neo RPC returned an invalid network fee');
      }
      return networkFeeText;
    },
  } as NeonRpcClient;
  return await neonJs.api.smartCalculateNetworkFee(transaction, validatingFeeClient);
}

export function parseGasAmountToDatos(value: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/.exec(value);
  if (!match) {
    throw new RangeError('GAS amount must be a positive decimal with at most 8 decimal places');
  }
  const datos = BigInt(match[1]) * GAS_FACTOR + BigInt((match[2] ?? '').padEnd(8, '0') || '0');
  if (datos <= 0n) {
    throw new RangeError('GAS amount must be greater than zero');
  }
  return datos;
}

export async function calculateSystemFee(
  script: NeonTransaction['script'],
  signers: NeonTransaction['signers'],
  rpcClient: NeonRpcClient
): Promise<NeonTransaction['systemFee']> {
  const result = await rpcClient.invokeScript(script, signers);
  if (result.state !== 'HALT') {
    throw new Error(
      `Script execution failed with invalid VM state ${String(result.state || 'missing')}: `
      + `${result.exception || 'unknown VM fault'}`
    );
  }
  const gasConsumed = String(result.gasconsumed ?? '');
  if (!/^\d+$/.test(gasConsumed)) {
    throw new Error('Neo RPC returned an invalid system fee');
  }
  return neonJs.u.BigInteger.fromDecimal(gasConsumed, 0);
}

export async function prepareTransactionForSigning(
  transaction: NeonTransaction,
  account: NeonAccount,
  rpcClient: NeonRpcClient,
  options: { maxTransactionFeeDatos?: bigint } = {}
): Promise<void> {
  const blockCount = await rpcClient.getBlockCount();
  const lifespan = neonJs.tx.Transaction.MAX_TRANSACTION_LIFESPAN || FALLBACK_TRANSACTION_LIFESPAN;
  transaction.validUntilBlock = blockCount + lifespan - 1;
  transaction.systemFee = await calculateSystemFee(transaction.script, transaction.signers, rpcClient);

  const feeTransaction = new neonJs.tx.Transaction(transaction);
  if (feeTransaction.witnesses.length === 0) {
    feeTransaction.addWitness(new neonJs.tx.Witness({
      invocationScript: '',
      verificationScript: neonJs.u.HexString.fromBase64(account.contract.script).toString(),
    }));
  }
  transaction.networkFee = await calculateNetworkFee(feeTransaction, rpcClient);

  const networkFeeValue = transaction.networkFee.toString();
  if (!/^\d+$/.test(networkFeeValue)) {
    throw new Error('Neo RPC returned an invalid network fee');
  }
  const requiredGas = BigInt(transaction.systemFee.toString()) + BigInt(networkFeeValue);
  const maxTransactionFeeDatos = options.maxTransactionFeeDatos ?? DEFAULT_MAX_TRANSACTION_FEE_DATOS;
  if (maxTransactionFeeDatos <= 0n) {
    throw new RangeError('Maximum transaction fee must be greater than zero');
  }
  if (requiredGas > maxTransactionFeeDatos) {
    throw new ValidationError(
      `Transaction fees exceed the configured maximum of ${formatDatosAsGas(maxTransactionFeeDatos)} GAS. ` +
      `Required: ${formatDatosAsGas(requiredGas)} GAS.`
    );
  }

  const gasBalanceResult = await rpcClient.invokeFunction(
    GAS_TOKEN_HASH,
    'balanceOf',
    [neonJs.sc.ContractParam.hash160(account.address)]
  );
  const gasBalanceValue = gasBalanceResult.stack?.[0]?.value;
  if (
    gasBalanceResult.state !== 'HALT'
    || (typeof gasBalanceValue !== 'string' && typeof gasBalanceValue !== 'number')
    || !/^\d+$/.test(String(gasBalanceValue))
  ) {
    throw new Error('Neo RPC returned an invalid GAS balance');
  }

  const gasBalance = BigInt(gasBalanceValue);
  if (gasBalance < requiredGas) {
    throw new ValidationError(
      `Insufficient GAS for transaction fees. Required: ${formatDatosAsGas(requiredGas)} GAS; `
      + `available: ${formatDatosAsGas(gasBalance)} GAS.`
    );
  }
}
