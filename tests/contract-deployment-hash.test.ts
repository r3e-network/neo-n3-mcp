import * as neonJs from '@cityofzion/neon-js';
import { ContractService } from '../src/contracts/contract-service';
import { NeoNetwork } from '../src/services/neo-service';

describe('contract deployment hash prediction', () => {
  test.each(['hex', 'base64'] as const)(
    'preserves a complete %s-encoded NEF and reports its wire-order contract hash',
    async (encoding) => {
    const account = new neonJs.wallet.Account();
    const manifest = {
      name: 'DeploymentHashRegression',
      groups: [],
      features: {},
      supportedstandards: [],
      abi: { methods: [], events: [] },
      permissions: [],
      trusts: [],
      extra: null,
    };
    const nef = new neonJs.sc.NEF({
      compiler: 'neo-devpack-dotnet 3.8',
      source: 'https://example.invalid/source.cs',
      tokens: [{
        hash: 'ef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        method: 'symbol',
        parametersCount: 0,
        hasReturnValue: true,
        callFlags: neonJs.sc.CallFlags.ReadOnly,
      }],
      script: 'aa55',
    });
    const serializedNef = nef.serialize();
    const encodedNef = {
      encoding,
      data: encoding === 'hex'
        ? serializedNef
        : Buffer.from(serializedNef, 'hex').toString('base64'),
    };
    const expectedHash = neonJs.experimental.getContractHash(
      neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(account.address)),
      nef.checksum,
      manifest.name
    );
    const service = new ContractService('http://127.0.0.1:10332', NeoNetwork.MAINNET);
    jest.spyOn(service as any, 'prepareSignedTransaction').mockResolvedValue({
      rawTransaction: 'aa55',
      txid: `0x${'a'.repeat(64)}`,
      validUntilBlock: 123,
    });
    const submitTransaction = jest
      .spyOn(service, 'submitPreparedTransaction')
      .mockResolvedValue(`0x${'a'.repeat(64)}`);
    const emitContractCall = jest.spyOn(neonJs.sc.ScriptBuilder.prototype, 'emitContractCall');

    const result = await (service as any).deployContract(account, encodedNef, manifest);

    expect(result.contractHash).toBe(`0x${expectedHash}`);
    expect(submitTransaction).toHaveBeenCalledTimes(1);
    const deployArguments = emitContractCall.mock.calls[0][0].args;
    expect(deployArguments[0].toJson()).toEqual({
      type: 'ByteArray',
      value: Buffer.from(serializedNef, 'hex').toString('base64'),
    });
    emitContractCall.mockRestore();
  });

  test.each([
    ['raw script bytes', { encoding: 'hex', data: 'aa55' }],
    ['corrupt checksum', { encoding: 'hex', data: `${new neonJs.sc.NEF({ script: 'aa55' }).serialize().slice(0, -2)}00` }],
    ['trailing bytes', { encoding: 'hex', data: `${new neonJs.sc.NEF({ script: 'aa55' }).serialize()}00` }],
    ['noncanonical base64', { encoding: 'base64', data: 'TkVG' }],
  ])('rejects %s instead of deploying an altered artifact', async (_name, encodedNef) => {
    const account = new neonJs.wallet.Account();
    const service = new ContractService('http://127.0.0.1:10332', NeoNetwork.MAINNET);

    await expect((service as any).deployContract(account, encodedNef, {
      name: 'InvalidNef',
      groups: [],
      features: {},
      supportedstandards: [],
      abi: { methods: [], events: [] },
      permissions: [],
      trusts: [],
      extra: null,
    })).rejects.toThrow(/NEF|checksum|canonical|serialized/i);
  });
});
