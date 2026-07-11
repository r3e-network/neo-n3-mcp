import * as neonJs from '@cityofzion/neon-js';

export type NeonAccount = InstanceType<typeof neonJs.wallet.Account>;
export type NeonRpcClient = InstanceType<typeof neonJs.rpc.RPCClient>;
export type NeonContractManifestJson = Parameters<typeof neonJs.sc.ContractManifest.fromJson>[0];
export type NeonTransaction = InstanceType<typeof neonJs.tx.Transaction>;
