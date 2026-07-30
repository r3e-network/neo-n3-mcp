import {
  dispatchN3ProposalTool,
  handleN3BuildNnsOperation,
  handleN3BuildVote,
} from '../src/handlers/proposal-tools';
import { NNS_SCRIPT_HASHES } from '../src/handlers/ecosystem-tools';
import { NEO_NATIVE_SCRIPT_HASH } from '../src/utils/transaction-proposal';
import type { NeoService } from '../src/services/neo-service';

const FROM = 'NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg';
const TO = 'NMquFyaSmvtX4t3fV9TyFmVSDP2CK8aEcJ';
const CANDIDATE = '0239a37436652f41b3b802ca44cbcb7d65d3aa0b88c9a0380243bdbe1aaa5cb35b';

function resultOf(response: Record<string, unknown>): Record<string, any> {
  return response.result as Record<string, any>;
}

function simulation(value: boolean | null) {
  return {
    state: 'HALT',
    gasconsumed: '12345',
    exception: null,
    stack: value === null ? [] : [{ type: 'Boolean', value }],
  };
}

describe('Neo ecosystem unsigned proposals', () => {
  test('builds a simulated vote proposal against the native NEO contract', async () => {
    const service = {
      testInvoke: jest.fn().mockResolvedValue(simulation(true)),
    } as unknown as NeoService;
    const proposal = resultOf(await handleN3BuildVote({
      network: 'testnet',
      from: FROM,
      candidate: CANDIDATE,
    }, service));
    expect(proposal).toMatchObject({
      proposal: true,
      chain: 'n3',
      network: 'testnet',
      scriptHash: NEO_NATIVE_SCRIPT_HASH,
      operation: 'vote',
      from: FROM,
      simulation: { state: 'HALT' },
    });
    expect(proposal.args).toEqual([
      expect.objectContaining({ type: 'Hash160' }),
      { type: 'PublicKey', value: CANDIDATE },
    ]);
  });

  test('rejects a HALT vote whose Boolean result is false', async () => {
    const service = {
      testInvoke: jest.fn().mockResolvedValue(simulation(false)),
    } as unknown as NeoService;
    await expect(handleN3BuildVote({
      network: 'mainnet',
      from: FROM,
      candidate: CANDIDATE,
    }, service)).rejects.toThrow(/did not return true/);
  });

  test('uses the testnet NNS contract for registration', async () => {
    const service = {
      testInvoke: jest.fn().mockResolvedValue(simulation(true)),
    } as unknown as NeoService;
    const proposal = resultOf(await dispatchN3ProposalTool('n3_build_nns_operation', {
      network: 'testnet',
      from: FROM,
      action: 'register',
      domain: 'example.neo',
    }, service));
    expect(proposal).toMatchObject({
      scriptHash: NNS_SCRIPT_HASHES.testnet,
      operation: 'register',
      from: FROM,
    });
    expect(proposal.args).toEqual([
      { type: 'String', value: 'example.neo' },
      expect.objectContaining({ type: 'Hash160' }),
    ]);
  });

  test('builds NNS transfer arguments in NEP-11 order', async () => {
    const service = {
      testInvoke: jest.fn().mockResolvedValue(simulation(true)),
    } as unknown as NeoService;
    const proposal = resultOf(await handleN3BuildNnsOperation({
      network: 'mainnet',
      from: FROM,
      action: 'transfer',
      domain: 'example.neo',
      to: TO,
    }, service));
    expect(proposal).toMatchObject({
      scriptHash: NNS_SCRIPT_HASHES.mainnet,
      operation: 'transfer',
      from: FROM,
      to: TO,
    });
    expect(proposal.args).toEqual([
      expect.objectContaining({ type: 'Hash160' }),
      { type: 'ByteArray', value: Buffer.from('example.neo').toString('base64') },
      { type: 'Any', value: null },
    ]);
  });

  test('allows successful void NNS record writes and validates record types', async () => {
    const service = {
      testInvoke: jest.fn().mockResolvedValue(simulation(null)),
    } as unknown as NeoService;
    const proposal = resultOf(await handleN3BuildNnsOperation({
      network: 'mainnet',
      from: FROM,
      action: 'set_record',
      domain: 'example.neo',
      recordType: 'TXT',
      data: FROM,
    }, service));
    expect(proposal.operation).toBe('setRecord');
    expect(proposal.args).toEqual([
      { type: 'String', value: 'example.neo' },
      { type: 'Integer', value: '16' },
      { type: 'String', value: FROM },
    ]);

    await expect(handleN3BuildNnsOperation({
      network: 'mainnet',
      from: FROM,
      action: 'set_record',
      domain: 'example.neo',
      recordType: 'MX',
      data: 'mail.example.neo',
    }, service)).rejects.toThrow(/recordType/);
  });
});
