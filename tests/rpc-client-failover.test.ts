// A single unreachable Neo seed node must not take mainnet reads down.
//
// These tests pin the failover contract of createRpcClient: it accepts an ordered
// list of endpoints, advances to the next one only for faults that are properties of
// the *transport* (HTTP 5xx, connection reset, timeout), and never re-asks a second
// node a question the first node already answered definitively.

import * as neonJs from '@cityofzion/neon-js';
import { createRpcClient } from '../src/utils/rpc-client';

function versionQuery() {
  return new neonJs.rpc.Query({ method: 'getversion', params: [] });
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => null },
    body: null,
    json: async () => body,
  } as any;
}

const OK_VERSION = { jsonrpc: '2.0', id: 1, result: { protocol: { network: 860833102 } } };

describe('createRpcClient endpoint failover', () => {
  test('uses the first endpoint when it answers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(OK_VERSION));
    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      5000,
      fetchMock as any,
    );

    const result: any = await client.execute(versionQuery());

    expect(result.protocol.network).toBe(860833102);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://a.example:443');
  });

  test('advances to the next endpoint on an HTTP 5xx, including Cloudflare 520', async () => {
    // 520 is what a fronted-but-dead seed actually returns, and it is the exact status
    // that took the default mainnet node out of service.
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse('error code: 520', { ok: false, status: 520 }))
      .mockResolvedValueOnce(jsonResponse(OK_VERSION));

    const client = createRpcClient(
      ['https://dead.example:443', 'https://live.example:443'],
      5000,
      fetchMock as any,
    );

    const result: any = await client.execute(versionQuery());

    expect(result.protocol.network).toBe(860833102);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://live.example:443');
  });

  test('advances on a thrown connection failure', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(OK_VERSION));

    const client = createRpcClient(
      ['https://dead.example:443', 'https://live.example:443'],
      5000,
      fetchMock as any,
    );

    await expect(client.execute(versionQuery())).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('does not failover on a JSON-RPC error: that is the chain answering', async () => {
    // "Unknown block" is a fact about the chain, identical on every node. Retrying it
    // elsewhere multiplies latency and can mask the real answer behind a slower node.
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -100, message: 'Unknown block' } }),
    );

    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      5000,
      fetchMock as any,
    );

    await expect(client.execute(versionQuery())).rejects.toThrow('Unknown block');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reports every endpoint it tried when all of them fail', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse('error code: 520', { ok: false, status: 520 }),
    );

    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      5000,
      fetchMock as any,
    );

    // The operator has to be able to tell "my only node is down" from "all three of my
    // nodes are down" out of the error text alone.
    await expect(client.execute(versionQuery())).rejects.toThrow(/all 2 Neo RPC endpoints/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('never re-sends sendrawtransaction to a second endpoint', async () => {
    // The first node may have relayed the transaction before the socket died. Sending
    // it again elsewhere converts an unknown outcome into a real double-submit.
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse('error code: 520', { ok: false, status: 520 }),
    );
    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      5000,
      fetchMock as any,
    );

    await expect(client.execute(
      new neonJs.rpc.Query({ method: 'sendrawtransaction', params: ['00d1'] }),
    )).rejects.toThrow(/520/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('preserves the timeout error type, and honours a budget too small to failover', async () => {
    // neo-service turns RpcDeadlineError into "outcome unknown"; wrapping it in a
    // plain Error would silently downgrade that handling.
    // A 50ms budget is spent by the first stall, so the second endpoint is not asked:
    // the caller's deadline outranks the wish to try one more node.
    const fetchMock = jest.fn().mockImplementation((_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error: any = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }));
    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      50,
      fetchMock as any,
    );

    await expect(client.execute(versionQuery())).rejects.toMatchObject({
      name: 'RpcDeadlineError',
      message: expect.stringMatching(/1 of 2 Neo RPC endpoints tried within the 50ms budget/i),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not failover when a method is unsupported: callers have their own fallback', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }),
    );
    const client = createRpcClient(
      ['https://a.example:443', 'https://b.example:443'],
      5000,
      fetchMock as any,
    );

    await expect(client.execute(versionQuery())).rejects.toThrow(/Method not found/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('de-duplicates repeated endpoints so a typo does not double the wait', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse('error code: 520', { ok: false, status: 520 }),
    );
    const client = createRpcClient(
      ['https://a.example:443', 'https://a.example:443'],
      5000,
      fetchMock as any,
    );

    await expect(client.execute(versionQuery())).rejects.toThrow(/520/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('accepts a bare string for a single endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(OK_VERSION));
    const client = createRpcClient('https://only.example:443', 5000, fetchMock as any);

    await expect(client.execute(versionQuery())).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('rejects an empty endpoint list rather than failing at first use', async () => {
    expect(() => createRpcClient([], 5000)).toThrow(/at least one/i);
  });

  test('honours a per-call timeout smaller than the client timeout', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(OK_VERSION));
    const client = createRpcClient(['https://a.example:443'], 5000, fetchMock as any);

    await client.execute(versionQuery(), { timeout: 1000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  test('a stalled node cannot starve its successor: the stall is capped, not the budget', async () => {
    // A node that hangs is the case failover exists for. The stall is bounded by the
    // per-attempt ceiling so the healthy node is still asked with budget to spare.
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn()
        .mockImplementationOnce((_url: string, init: any) => new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error: any = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }))
        .mockResolvedValueOnce(jsonResponse(OK_VERSION));

      const client = createRpcClient(
        ['https://stalled.example:443', 'https://live.example:443'],
        20000,
        fetchMock as any,
      );

      const startedAt = Date.now();
      let settledAt = 0;
      // Sampled at settle time: reading the clock after advanceTimersByTimeAsync
      // would report the whole advance, not how long the call actually took.
      const pending = client.execute(versionQuery()).then((value) => {
        settledAt = Date.now();
        return value;
      });
      await jest.advanceTimersByTimeAsync(20001);

      await expect(pending).resolves.toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // The stall cost one attempt ceiling, not the caller's whole 20s.
      expect(settledAt - startedAt).toBeLessThanOrEqual(8000);
    } finally {
      jest.useRealTimers();
    }
  });

  test('bounds the total wait by the configured timeout, however many endpoints stall', async () => {
    // The regression this pins: with a full budget per endpoint, five stalled seeds turned a
    // 15s timeout into a 75s call, and one stalled seed made a single read take 20.6s. The
    // configured timeout is a budget for the whole call, not for each hop.
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn().mockImplementation((_url: string, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error: any = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }));

      const client = createRpcClient(
        [
          'https://a.example:443',
          'https://b.example:443',
          'https://c.example:443',
          'https://d.example:443',
          'https://e.example:443',
        ],
        15000,
        fetchMock as any,
      );

      const startedAt = Date.now();
      let settledAt = 0;
      const pending = client.execute(versionQuery()).catch((error) => {
        settledAt = Date.now();
        throw error;
      });
      const assertion = expect(pending).rejects.toMatchObject({ name: 'RpcDeadlineError' });
      await jest.advanceTimersByTimeAsync(15001);
      await assertion;

      expect(settledAt - startedAt).toBeLessThanOrEqual(15000);
      // Stalls are the expensive case, so the budget runs out before every seed is reached.
      // Endpoints that fail fast cost almost nothing and are all still tried.
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(fetchMock.mock.calls.length).toBeLessThan(5);
    } finally {
      jest.useRealTimers();
    }
  });

  test('says how many endpoints it reached when the budget ran out first', async () => {
    // "all 5 failed" would be a lie if only two were asked; an operator debugging an
    // outage needs to know the budget stopped the sweep.
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn().mockImplementation((_url: string, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error: any = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }));

      const client = createRpcClient(
        ['https://a.example:443', 'https://b.example:443', 'https://c.example:443'],
        15000,
        fetchMock as any,
      );

      const pending = client.execute(versionQuery());
      const assertion = expect(pending).rejects.toThrow(
        /2 of 3 Neo RPC endpoints tried within the 15000ms budget/i,
      );
      await jest.advanceTimersByTimeAsync(15001);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
