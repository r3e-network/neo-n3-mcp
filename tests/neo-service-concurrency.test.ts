import { NEO_NETWORK_MAGIC, NeoService, NeoNetwork } from '../src/services/neo-service';

/**
 * getBlockchainInfo reads two independent things: the chain height and the
 * validator set. Awaiting them one after the other makes the tool cost the sum
 * of two RPC budgets, so a single slow seed is paid for twice. Under load that
 * turned a nominally 5s tool into a >20s one.
 *
 * These tests pin the shape rather than a wall-clock number: the second read
 * must be in flight before the first resolves.
 */

/**
 * A read the test can observe starting and choose when to answer.
 * `open()` stands in for the RPC call; `started` resolves the moment it is made.
 */
class Gate {
  private announceStarted!: () => void;
  private releaseValue!: (value: unknown) => void;
  private failValue!: (error: unknown) => void;
  readonly started: Promise<void>;
  private readonly held: Promise<unknown>;

  constructor() {
    this.started = new Promise<void>((resolve) => {
      this.announceStarted = resolve;
    });
    this.held = new Promise<unknown>((resolve, reject) => {
      this.releaseValue = resolve;
      this.failValue = reject;
    });
  }

  open(): Promise<unknown> {
    this.announceStarted();
    return this.held;
  }

  release(value: unknown): void {
    this.releaseValue(value);
  }

  reject(error: unknown): void {
    this.failValue(error);
  }
}

/**
 * A service whose transport is the given stub.
 *
 * The transport is the thing under test's collaborator, not its subject:
 * swapping it keeps the test off the network and makes read ordering observable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serviceWithClient(stubClient: Record<string, any>): NeoService {
  const service = new NeoService('https://seed1.example:443', NeoNetwork.MAINNET);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any).rpcClient = stubClient;
  // Every deadline-wrapped read first resolves the network magic. That handshake
  // has its own tests; caching it here keeps these tests about read ordering.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any).networkMagic = NEO_NETWORK_MAGIC[NeoNetwork.MAINNET];
  return service;
}

function buildService(gates: {
  blockCount: Gate;
  validators: Gate;
}): { service: NeoService; methods: string[] } {
  const methods: string[] = [];
  const service = serviceWithClient({
    getBlockCount: () => {
      methods.push('getblockcount');
      return gates.blockCount.open();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (query: any) => {
      const method = query?.req?.method ?? query?.method ?? 'unknown';
      methods.push(method);
      return gates.validators.open();
    },
  });
  return { service, methods };
}

describe('NeoService independent read concurrency', () => {
  test('getBlockchainInfo issues its independent reads together, not one after the other', async () => {
    const blockCount = new Gate();
    const validators = new Gate();
    const { service, methods } = buildService({ blockCount, validators });

    const pending = service.getBlockchainInfo();

    // Both reads must have gone out while neither has answered. If the
    // implementation awaits the height first, this wait never resolves.
    await Promise.all([blockCount.started, validators.started]);
    expect(methods).toContain('getblockcount');
    expect(methods.length).toBeGreaterThanOrEqual(2);

    blockCount.release(1_234);
    validators.release([{ publickey: '02aa', votes: '1', active: true }]);

    await expect(pending).resolves.toMatchObject({
      blockCount: 1_234,
      height: 1_233,
      network: NeoNetwork.MAINNET,
    });
  }, 10_000);

  test('a slow validator read does not extend the height read, and vice versa', async () => {
    const blockCount = new Gate();
    const validators = new Gate();
    const { service } = buildService({ blockCount, validators });

    const pending = service.getBlockchainInfo();
    await Promise.all([blockCount.started, validators.started]);

    // Release in the opposite order to the source: overlapping reads must not
    // depend on which one finishes first.
    validators.release([]);
    blockCount.release(7);

    await expect(pending).resolves.toMatchObject({ blockCount: 7, height: 6, validators: [] });
  }, 10_000);
});

describe('getBalance fallback read concurrency', () => {
  const address = 'NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY';
  const methodNotFound = Object.assign(new Error('Method not found'), { code: -32601 });

  /** A service whose getnep17balances is unsupported, forcing the two-script fallback. */
  function buildFallbackService(scripts: Gate[]): NeoService {
    let call = 0;
    return serviceWithClient({
      execute: () => Promise.reject(methodNotFound),
      invokeScript: () => scripts[call++].open(),
    });
  }

  test('NEO and GAS balance scripts are invoked together, not one after the other', async () => {
    const neo = new Gate();
    const gas = new Gate();
    const service = buildFallbackService([neo, gas]);

    const pending = service.getBalance(address);

    // Both invocations must be in flight before either answers. If the
    // implementation awaits the NEO script first, this wait never resolves.
    await Promise.all([neo.started, gas.started]);

    neo.release({ state: 'HALT', stack: [{ value: '100' }] });
    gas.release({ state: 'HALT', stack: [{ value: '250000000' }] });

    await expect(pending).resolves.toMatchObject({
      address,
      balance: [
        expect.objectContaining({ asset: 'NEO', amount: '100' }),
        expect.objectContaining({ asset: 'GAS', amount: '250000000' }),
      ],
    });
  }, 10_000);
});

describe('prepareClaimGasTransaction read concurrency', () => {
  const fromAddress = 'NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY';

  function buildClaimService(gates: { unclaimed: Gate; balance: Gate }): NeoService {
    return serviceWithClient({
      getUnclaimedGas: () => gates.unclaimed.open(),
      invokeFunction: () => gates.balance.open(),
    });
  }

  test('the unclaimed-GAS and NEO-balance reads are issued together', async () => {
    const unclaimed = new Gate();
    const balance = new Gate();
    const service = buildClaimService({ unclaimed, balance });

    const pending = service.prepareClaimGasTransaction({ address: fromAddress } as never);

    // Independent reads: the claim must not cost two RPC budgets in sequence.
    await Promise.all([unclaimed.started, balance.started]);

    unclaimed.release('100000000');
    balance.release({ state: 'HALT', stack: [{ value: '5' }] });

    // Script building and signing are covered elsewhere; this test only owns the
    // read ordering, so settling either way is enough once both reads went out.
    await pending.catch(() => undefined);
  }, 10_000);

  test('a below-minimum claim still reports the minimum, even if the balance read fails', async () => {
    const unclaimed = new Gate();
    const balance = new Gate();
    const service = buildClaimService({ unclaimed, balance });

    const pending = service.prepareClaimGasTransaction({ address: fromAddress } as never);
    await Promise.all([unclaimed.started, balance.started]);

    // Overlapping the reads must not let an incidental balance failure mask the
    // guard the caller actually needs to see, nor surface as an unhandled rejection.
    balance.reject(new Error('seed unavailable'));
    unclaimed.release('1');

    await expect(pending).rejects.toThrow('Minimum claim value is 0.5 GAS');
  }, 10_000);
});
