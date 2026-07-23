import { jest } from '@jest/globals';
import path from 'path';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startMcpTestClient, stopMcpTestClient } from './mcp-test-utils';
import { TEST_WIF } from './test-wallet';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * The exact tool surface the server advertises when writes are disabled (the default).
 *
 * This is deliberately an explicit, sorted inventory rather than a count: adding or
 * renaming a tool then fails with a diff that names the tool, instead of an opaque
 * "expected 40, received 41". Update this list in the same commit that registers a tool.
 */
const READ_ONLY_TOOL_NAMES = [
  'estimate_invoke_fees',
  'estimate_transfer_fees',
  'get_application_log',
  'get_balance',
  'get_block',
  'get_block_count',
  'get_blockchain_info',
  'get_contract_info',
  'get_contract_status',
  'get_nep11_balances',
  'get_nep11_transfers',
  'get_nep17_transfers',
  'get_network_mode',
  'get_transaction',
  'get_unclaimed_gas',
  'get_wallet',
  'invoke_contract',
  'list_famous_contracts',
  'n3_application_log',
  'n3_asset_holders',
  'n3_assets_held_by_address',
  'n3_build_invoke',
  'n3_build_transfer',
  'n3_contract_by_name',
  'n3_get_address',
  'n3_list_transactions_by_address',
  'n3_list_transfers_by_address',
  'n3_test_invoke',
  'wait_for_transaction',
  'x_block',
  'x_build_contract_call',
  'x_build_transfer',
  'x_get_address',
  'x_list_token_transfers',
  'x_list_transactions_by_address',
  'x_search',
  'x_simulate_call',
  'x_token_holders',
  'x_token_info',
  'x_transaction',
];

/** The only secret-free write tools, added exclusively when NEO_ENABLE_WRITES is set. */
const WRITE_TOOL_NAMES = [
  'claim_gas',
  'deploy_contract',
  'invoke_contract_write',
  'transfer_assets',
];

/** Full surface with writes enabled; the count is derived, never hand-maintained. */
const WRITE_ENABLED_TOOL_NAMES = [...READ_ONLY_TOOL_NAMES, ...WRITE_TOOL_NAMES].sort();

/**
 * Non-custodial tools that build or simulate transactions without ever holding a key.
 * They must stay on the default read-only surface: the caller signs in their own wallet.
 */
const NON_CUSTODIAL_CONSTRUCTION_TOOL_NAMES = [
  'n3_build_invoke',
  'n3_build_transfer',
  'n3_test_invoke',
  'x_build_contract_call',
  'x_build_transfer',
  'x_simulate_call',
];

const sortedToolNames = (tools: Array<{ name: string }>): string[] =>
  tools.map(tool => tool.name).sort();

describe('Modern MCP tool registration', () => {
  const TEST_TIMEOUT = 30000;
  const serverPath = path.join(__dirname, '../dist/index.js');
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  jest.setTimeout(TEST_TIMEOUT);

  beforeEach(async () => {
    const session = await startMcpTestClient({
      serverPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        LOG_CONSOLE: 'false',
        LOG_FILE_ENABLED: 'false',
        RATE_LIMITING_ENABLED: 'true',
        MAX_REQUESTS_PER_MINUTE: '1',
        MAX_REQUESTS_PER_HOUR: '100',
      },
      clientInfo: { name: 'MCP Tool Registration Test Client', version: '1.0.0' },
    });

    client = session.client;
    transport = session.transport;
  });

  afterEach(async () => {
    await stopMcpTestClient(client, transport);
    client = null;
    transport = null;
  });

  test('applies one shared rate limit across directly handled modern tools', async () => {
    const first = await client!.callTool({ name: 'get_network_mode', arguments: {} });
    const second = await client!.callTool({
      name: 'get_balance',
      arguments: { address: 'invalid-address' },
    });

    expect(first.isError).not.toBe(true);
    expect(second.isError).toBe(true);
    expect(second.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringMatching(/rate limit exceeded/i),
        }),
      ]),
    );
  });

  test('charges callTool-delegated tools only once', async () => {
    const first = await client!.callTool({
      name: 'get_wallet',
      arguments: { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' },
    });
    const second = await client!.callTool({
      name: 'get_wallet',
      arguments: { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' },
    });

    expect(first.isError).toBe(true);
    expect(first.content).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringMatching(/rate limit exceeded/i) }),
      ]),
    );
    expect(second.isError).toBe(true);
    expect(second.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringMatching(/rate limit exceeded/i),
        }),
      ]),
    );
  });

  test('advertises invoke_contract as strictly read-only', async () => {
    const response = await client!.listTools();
    const invokeContract = response.tools.find(tool => tool.name === 'invoke_contract');

    expect(invokeContract).toBeDefined();
    expect(invokeContract?.inputSchema.properties).not.toHaveProperty('signers');
    expect(invokeContract?.inputSchema.properties).not.toHaveProperty('fromWIF');
    expect(invokeContract?.inputSchema.properties).not.toHaveProperty('wif');
    expect(invokeContract?.inputSchema.properties).not.toHaveProperty('confirm');
  });

  test('does not advertise unsupported estimate_invoke_fees signers', async () => {
    const response = await client!.listTools();
    const estimateInvokeFees = response.tools.find(tool => tool.name === 'estimate_invoke_fees');

    expect(estimateInvokeFees).toBeDefined();
    expect(estimateInvokeFees?.inputSchema.properties).not.toHaveProperty('signers');
  });

  test('defaults to a read-only tool surface with no secret-bearing administration', async () => {
    const response = await client!.listTools();
    const toolNames = response.tools.map(tool => tool.name);

    expect(sortedToolNames(response.tools)).toEqual(READ_ONLY_TOOL_NAMES);
    expect(response.tools).toHaveLength(READ_ONLY_TOOL_NAMES.length);
    expect(toolNames).toEqual(expect.arrayContaining(NON_CUSTODIAL_CONSTRUCTION_TOOL_NAMES));

    expect(toolNames).not.toContain('neofs_create_container');
    expect(toolNames).not.toContain('neofs_get_containers');
    expect(toolNames).not.toContain('set_network_mode');
    expect(toolNames).not.toContain('create_wallet');
    expect(toolNames).not.toContain('import_wallet');
    expect(toolNames).not.toContain('transfer_assets');
    expect(toolNames).not.toContain('invoke_contract_write');
    expect(toolNames).not.toContain('claim_gas');
    expect(toolNames).not.toContain('deploy_contract');
  });

  test('advertises four annotated secret-free write tools only when explicitly enabled', async () => {
    await stopMcpTestClient(client, transport);
    client = null;
    transport = null;
    const directory = mkdtempSync(path.join(tmpdir(), 'neo-mcp-write-tools-'));
    const signerFile = path.join(directory, 'signer.wif');
    const stateDirectory = path.join(directory, 'state');
    // A write state directory keeps a durable .writer.lock that is intentionally never
    // released, so the second server process below needs its own directory. It only
    // exercises the elicitation-capability refusal and never reads the first journal.
    const noElicitationStateDirectory = path.join(directory, 'state-no-elicitation');
    writeFileSync(signerFile, `${TEST_WIF}\n`, { mode: 0o600 });
    chmodSync(signerFile, 0o600);

    try {
      const session = await startMcpTestClient({
        serverPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          LOG_CONSOLE: 'false',
          LOG_FILE_ENABLED: 'false',
          RATE_LIMITING_ENABLED: 'false',
          NEO_ENABLE_WRITES: 'true',
          NEO_SIGNER_WIF_FILE: signerFile,
          NEO_WRITE_STATE_DIR: stateDirectory,
          HTTP_WRITE_APPROVAL_API_KEY: 'independent-approval-key-1234567890',
          NEO_TESTNET_RPC: 'http://127.0.0.1:1',
        },
        clientInfo: { name: 'MCP Write Registration Test Client', version: '1.0.0' },
        capabilities: { tools: {}, elicitation: { form: {} } },
      });
      client = session.client;
      transport = session.transport;

      const response = await client.listTools();
      const writeToolNames = WRITE_TOOL_NAMES;
      expect(sortedToolNames(response.tools)).toEqual(WRITE_ENABLED_TOOL_NAMES);
      expect(response.tools).toHaveLength(WRITE_ENABLED_TOOL_NAMES.length);
      expect(response.tools.map(tool => tool.name)).toEqual(
        expect.arrayContaining(NON_CUSTODIAL_CONSTRUCTION_TOOL_NAMES),
      );
      for (const name of writeToolNames) {
        const tool = response.tools.find((candidate) => candidate.name === name);
        expect(tool).toBeDefined();
        expect(tool?.annotations).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        });
        expect(tool?.inputSchema.properties).toHaveProperty('idempotencyKey');
        expect(tool?.inputSchema.properties).toHaveProperty('network');
        expect(tool?.inputSchema.properties).not.toHaveProperty('fromWIF');
        expect(tool?.inputSchema.properties).not.toHaveProperty('wif');
        expect(tool?.inputSchema.properties).not.toHaveProperty('privateKey');
        expect(tool?.inputSchema.properties).not.toHaveProperty('password');
        expect(tool?.inputSchema.properties).not.toHaveProperty('confirm');
      }

      let approvalMessage = '';
      client.setRequestHandler(ElicitRequestSchema, async (request) => {
        approvalMessage = request.params.message;
        const fingerprint = /Fingerprint: ([0-9a-f]{64})/.exec(approvalMessage)?.[1];
        return {
          action: 'accept' as const,
          content: { fingerprint: fingerprint as string, approve: true },
        };
      });
      const attempted = await client.callTool({
        name: 'transfer_assets',
        arguments: {
          idempotencyKey: 'mcp-positive-approval-flow',
          network: 'testnet',
          toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
          asset: 'GAS',
          amount: '1',
        },
      });
      expect(approvalMessage).toMatch(/Payload:[\s\S]*toAddress[\s\S]*asset[\s\S]*amount/);
      expect(attempted.isError).toBe(true);
      const journalFile = readdirSync(stateDirectory).find((name) => /^[0-9a-f]{64}\.json$/.test(name));
      expect(journalFile).toBeDefined();
      expect(JSON.parse(readFileSync(path.join(stateDirectory, journalFile as string), 'utf8')))
        .toMatchObject({ state: 'failed_before_submission' });

      await stopMcpTestClient(client, transport);
      client = null;
      transport = null;
      const unsupportedSession = await startMcpTestClient({
        serverPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          LOG_CONSOLE: 'false',
          LOG_FILE_ENABLED: 'false',
          RATE_LIMITING_ENABLED: 'false',
          NEO_ENABLE_WRITES: 'true',
          NEO_SIGNER_WIF_FILE: signerFile,
          NEO_WRITE_STATE_DIR: noElicitationStateDirectory,
          HTTP_WRITE_APPROVAL_API_KEY: 'independent-approval-key-1234567890',
        },
        clientInfo: { name: 'MCP No-Elicitation Client', version: '1.0.0' },
        capabilities: { tools: {} },
      });
      client = unsupportedSession.client;
      transport = unsupportedSession.transport;
      const denied = await client.callTool({
        name: 'claim_gas',
        arguments: {
          idempotencyKey: 'claim-request-without-elicitation',
          network: 'testnet',
        },
      });
      expect(denied.isError).toBe(true);
      expect(denied.content).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: expect.stringMatching(/form elicitation support/i) }),
      ]));
    } finally {
      await stopMcpTestClient(client, transport);
      client = null;
      transport = null;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
