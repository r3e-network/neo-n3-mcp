import { ContractService, EncodedNef } from '../contracts/contract-service';
import type { NeonAccount } from '../types/neon';
import { ValidationError } from '../utils/errors';
import { validateAddress, validateScriptHash, validateTokenAmount } from '../utils/validation';
import { NeoNetwork, NeoService } from './neo-service';
import { SignerProvider } from './signer-provider';
import {
  WriteOperationRecord,
  WriteOperationService,
} from './write-operation-service';

export type WriteOperationName =
  | 'transfer_assets'
  | 'invoke_contract_write'
  | 'claim_gas'
  | 'deploy_contract';

export interface WriteRequest {
  operation: WriteOperationName;
  network: NeoNetwork;
  payload: Record<string, unknown>;
}

interface SigningProvider {
  readonly signerAddress: string;
  getAccount(requestedAddress: string): NeonAccount;
}

export class WriteCoordinator {
  constructor(
    private readonly signerProvider: SigningProvider | SignerProvider,
    private readonly operations: WriteOperationService,
  ) {}

  get signerAddress(): string {
    return this.signerProvider.signerAddress;
  }

  reserve(idempotencyKey: string, request: WriteRequest): WriteOperationRecord {
    this.validateRequest(request);
    return this.operations.reserve(idempotencyKey, {
      operation: request.operation,
      network: request.network,
      signerAddress: this.signerAddress,
      payload: request.payload,
    });
  }

  get(intentId: string): WriteOperationRecord {
    return this.operations.getById(intentId);
  }

  approve(intentId: string, fingerprint: string): WriteOperationRecord {
    return this.operations.approve(intentId, fingerprint);
  }

  decline(intentId: string): WriteOperationRecord {
    return this.operations.decline(intentId);
  }

  async execute(
    intentId: string,
    neoService: NeoService,
    contractService: ContractService,
  ): Promise<Record<string, unknown>> {
    const intent = this.operations.getById(intentId);
    if (neoService.getNetwork() !== intent.network || contractService.getNetwork() !== intent.network) {
      throw new ValidationError(
        `Write intent network ${intent.network} does not match the configured execution services`
      );
    }
    const account = this.signerProvider.getAccount(intent.signerAddress);
    return await this.operations.execute(intentId, {
      prepare: async () => {
        switch (intent.operation as WriteOperationName) {
          case 'transfer_assets':
            return await neoService.prepareTransferTransaction(
              account,
              validateAddress(this.requireString(intent.payload.toAddress, 'toAddress')),
              this.requireString(intent.payload.asset, 'asset'),
              validateTokenAmount(intent.payload.amount),
            );
          case 'invoke_contract_write': {
            const scriptHash = validateScriptHash(
              this.requireString(intent.payload.scriptHash, 'scriptHash')
            );
            await contractService.assertContractDeployed(scriptHash);
            return await neoService.prepareInvokeTransaction(
              account,
              scriptHash,
              this.requireString(intent.payload.operation, 'operation'),
              this.requireArray(intent.payload.args, 'args'),
            );
          }
          case 'claim_gas':
            return await neoService.prepareClaimGasTransaction(account);
          case 'deploy_contract': {
            const deployment = await contractService.prepareContractDeployment(
              account,
              this.requireEncodedNef(intent.payload.nef),
              this.requireRecord(intent.payload.manifest, 'manifest'),
            );
            return {
              ...deployment.transaction,
              metadata: {
                contractHash: deployment.contractHash,
                address: deployment.address,
              },
            };
          }
          default:
            throw new ValidationError(`Unsupported write operation: ${intent.operation}`);
        }
      },
      submit: async (prepared) => intent.operation === 'deploy_contract'
        ? await contractService.submitPreparedTransaction(prepared)
        : await neoService.submitPreparedTransaction(prepared),
      reconcile: async (txid) => {
        try {
          await neoService.getTransaction(txid);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/unknown transaction|not found|unknown item|unknown entity/i.test(message)) {
            return false;
          }
          throw error;
        }
      },
      isExpired: async (validUntilBlock) => await neoService.getBlockCount() > validUntilBlock,
      buildResult: (txid, metadata) => ({
        txid,
        operation: intent.operation,
        network: intent.network,
        signerAddress: intent.signerAddress,
        ...metadata,
      }),
    });
  }

  private validateRequest(request: WriteRequest): void {
    if (!request || typeof request !== 'object') {
      throw new ValidationError('Write request must be an object');
    }
    if (!Object.values(NeoNetwork).includes(request.network)) {
      throw new ValidationError('Write request requires an explicit mainnet or testnet network');
    }
    if (![
      'transfer_assets',
      'invoke_contract_write',
      'claim_gas',
      'deploy_contract',
    ].includes(request.operation)) {
      throw new ValidationError(`Unsupported write operation: ${request.operation}`);
    }
    const payload = this.requireRecord(request.payload, 'payload');
    switch (request.operation) {
      case 'transfer_assets':
        validateAddress(this.requireString(payload.toAddress, 'toAddress'));
        this.requireString(payload.asset, 'asset');
        validateTokenAmount(payload.amount);
        break;
      case 'invoke_contract_write':
        validateScriptHash(this.requireString(payload.scriptHash, 'scriptHash'));
        this.requireString(payload.operation, 'operation');
        this.requireArray(payload.args, 'args');
        break;
      case 'claim_gas':
        if (Object.keys(payload).length > 0) {
          throw new ValidationError('claim_gas payload must be empty');
        }
        break;
      case 'deploy_contract':
        this.requireEncodedNef(payload.nef);
        this.requireRecord(payload.manifest, 'manifest');
        break;
    }
  }

  private requireString(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ValidationError(`${name} must be a non-empty string`);
    }
    return value.trim();
  }

  private requireArray(value: unknown, name: string): unknown[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new ValidationError(`${name} must be an array`);
    }
    return value;
  }

  private requireRecord(value: unknown, name: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError(`${name} must be an object`);
    }
    return value as Record<string, unknown>;
  }

  private requireEncodedNef(value: unknown): EncodedNef {
    const nef = this.requireRecord(value, 'nef');
    if ((nef.encoding !== 'hex' && nef.encoding !== 'base64')
      || typeof nef.data !== 'string' || !nef.data) {
      throw new ValidationError('nef requires encoding "hex" or "base64" and string data');
    }
    return { encoding: nef.encoding, data: nef.data };
  }
}
