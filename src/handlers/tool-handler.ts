// src/handlers/tool-handler.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { NeoService, NeoNetwork } from '../services/neo-service';
import { ContractService } from '../contracts/contract-service';
import { FAMOUS_CONTRACTS } from '../contracts/contracts';
import { config, NetworkMode } from '../config';
import { validateAddress, validateHash, validateAmount, validatePassword, validateScriptHash, validateNetwork, validateContractName } from '../utils/validation';
import { handleError, createSuccessResponse } from '../utils/error-handler';
import * as neonJs from '@cityofzion/neon-js'; // Needed for Account creation

// --- Individual Tool Handlers ---

async function handleGetNetworkMode(): Promise<any> {
  return createSuccessResponse({ networkMode: config.networkMode });
}

async function handleSetNetworkMode(input: any): Promise<any> {
  // Note: In a real-world scenario, changing network mode dynamically might require re-initializing services.
  // This example assumes the mode is primarily set at startup.
  // For now, this might just reflect the intended mode without restarting.
  const newMode = validateNetwork(input.mode); // Use validateNetwork to parse mode string
  // config.networkMode = newMode; // Avoid direct mutation if possible
  console.warn(`Network mode change requested to ${newMode}. Restart might be needed for full effect.`);
  return createSuccessResponse({ message: `Network mode set to ${newMode}. Restart may be required.` });
}

async function handleGetBlockchainInfo(input: any, neoService: NeoService): Promise<any> {
  try {
    const info = await neoService.getBlockchainInfo();
    return createSuccessResponse(info);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBlockCount(input: any, neoService: NeoService): Promise<any> {
  try {
    const count = await neoService.getBlockCount();
    return createSuccessResponse({ blockCount: count });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBlock(input: any, neoService: NeoService): Promise<any> {
  try {
    validateHash(input.hashOrHeight);
    const block = await neoService.getBlock(input.hashOrHeight);
    return createSuccessResponse(block);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetTransaction(input: any, neoService: NeoService): Promise<any> {
  try {
    validateHash(input.txid);
    const tx = await neoService.getTransaction(input.txid);
    return createSuccessResponse(tx);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBalance(input: any, neoService: NeoService): Promise<any> {
  try {
    validateAddress(input.address);
    const balance = await neoService.getBalance(input.address); 
    return createSuccessResponse({ ...balance });
  } catch (error) {
    return handleError(error);
  }
}

async function handleTransferAssets(input: any, neoService: NeoService): Promise<any> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Transfer requires explicit confirmation. Set confirm=true.');
    }
    validateAddress(input.toAddress);
    validateAmount(input.amount);
    // Basic WIF validation
    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    const txid = await neoService.transferAssets(account, input.toAddress, input.asset, input.amount);
    return createSuccessResponse({ txid });
  } catch (error) {
    return handleError(error);
  }
}

async function handleInvokeReadContract(input: any, contractService: ContractService): Promise<any> {
  try {
    validateScriptHash(input.scriptHash);
    const result = await contractService.queryContract(input.scriptHash, input.operation, input.args || []);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleInvokeWriteContract(input: any, neoService: NeoService, contractService: ContractService): Promise<any> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Contract invocation requires explicit confirmation. Set confirm=true.');
    }
    validateScriptHash(input.scriptHash);
    // Basic WIF validation
    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    // Note: invokeContract PREPARES the transaction details, client needs to sign/send.
    // The tool name 'invoke_contract' is slightly misleading as it doesn't *send* the tx itself.
    // It returns the script and fees needed for the client.
    const result = await contractService.invokeContract(account, input.scriptHash, input.operation, input.args || []);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateWallet(input: any): Promise<any> {
  try {
    validatePassword(input.password);
    const account = new neonJs.wallet.Account();
    const encryptedWIF = await neonJs.wallet.encrypt(account.WIF, input.password);
    return createSuccessResponse({ address: account.address, encryptedWIF });
  } catch (error) {
    return handleError(error);
  }
}

async function handleImportWallet(input: any): Promise<any> {
  try {
    let account;
    if (neonJs.wallet.isWIF(input.key) || neonJs.wallet.isPrivateKey(input.key)) {
      account = new neonJs.wallet.Account(input.key);
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid private key or WIF format.');
    }
    if (input.password) {
      validatePassword(input.password);
      const encryptedWIF = await neonJs.wallet.encrypt(account.WIF, input.password);
      return createSuccessResponse({ address: account.address, encryptedWIF });
    } else {
      // Return unencrypted WIF if no password provided (use with caution)
      return createSuccessResponse({ address: account.address, WIF: account.WIF });
    }
  } catch (error) {
    return handleError(error);
  }
}

async function handleEstimateTransferFees(input: any, neoService: NeoService): Promise<any> {
  try {
    validateAddress(input.fromAddress);
    validateAddress(input.toAddress);
    validateAmount(input.amount);
    const fees = await neoService.calculateTransferFee(input.fromAddress, input.toAddress, input.asset, input.amount); 
    return createSuccessResponse(fees);
  } catch (error) {
    return handleError(error);
  }
}

async function handleEstimateInvokeFees(input: any, neoService: NeoService, contractService: ContractService): Promise<any> {
  try {
    validateScriptHash(input.scriptHash);
    // Need an account to sign the fee estimation invocation
    if (!input.signerAddress) {
        throw new McpError(ErrorCode.InvalidParams, 'Signer address is required to estimate invocation fees.');
    }
    validateAddress(input.signerAddress);
    const fees = await neoService.calculateInvokeFee(input.signerAddress, input.scriptHash, input.operation, input.args || []); 
    return createSuccessResponse(fees);
  } catch (error) {
    return handleError(error);
  }
}

async function handleClaimGas(input: any, neoService: NeoService): Promise<any> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'GAS claim requires explicit confirmation. Set confirm=true.');
    }
    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    const txid = await neoService.claimGas(account);
    return createSuccessResponse({ txid });
  } catch (error) {
    return handleError(error);
  }
}

async function handleListFamousContracts(input: any, contractService: ContractService): Promise<any> {
  try {
    // Call the correct method to get the list of supported contracts
    const contracts = contractService.listSupportedContracts();
    return { contracts };
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetContractInfo(input: any, contractService: ContractService): Promise<any> {
  try {
    // Get available contract names from the constant
    const availableContracts = Object.values(FAMOUS_CONTRACTS).map(c => c.name);
    const contractName = validateContractName(input.contractName, availableContracts);
    // Call the correct method to get contract operations/details
    const contractInfo = await contractService.getContractOperations(contractName);
    return { contractInfo }; // Adjust structure as needed based on return value
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateContainer(input: any, neoService: NeoService, contractService: ContractService): Promise<any> {
  try {
    // Assume input contains fromWIF, ownerId, and rules
    const fromAccount = await neoService.importWallet(input.fromWIF);
    // Call the correct method to create a new container
    const txid = await contractService.createNeoFSContainer(fromAccount, input.ownerId, input.rules);
    return { txid }; // Return transaction ID
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetContainers(input: any, neoService: NeoService, contractService: ContractService): Promise<any> {
  try {
    // Call the correct method to get containers owned by an address
    const containers = await contractService.getNeoFSContainers(input.ownerAddress);
    return { containers };
  } catch (error) {
    return handleError(error);
  }
}

// --- Tool Setup Function ---

export async function callTool(name: string, input: any, neoServices: Map<NeoNetwork, NeoService>, contractServices: Map<NeoNetwork, ContractService>): Promise<any> {
  // Handle non-network specific tools first
  switch (name) {
    case 'get_network_mode':
      return await handleGetNetworkMode();
    case 'set_network_mode':
      return await handleSetNetworkMode(input);
    case 'create_wallet':
      return await handleCreateWallet(input);
    case 'import_wallet':
      return await handleImportWallet(input);
    // Add other non-network tools here
  }

  // Validate network for network-specific tools
  if (!input || typeof input !== 'object' || !input.network) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid network parameter for this tool.');
  }

  let network: NeoNetwork;
  let neoService: NeoService | undefined;
  let contractService: ContractService | undefined;

  try {
    // Validate the network string and ensure it's a valid enum member
    network = validateNetwork(input.network as string); // Cast is safe due to check above
    neoService = neoServices.get(network);
    contractService = contractServices.get(network);

    if (!neoService || !contractService) {
      throw new McpError(ErrorCode.InvalidParams, `Network ${network} is not enabled or service unavailable.`);
    }
  } catch (error) {
    // Catch validation errors or service not found errors
    return handleError(error);
  }

  // Handle network-specific tools, passing the validated services
  try {
    switch (name) {
      case 'get_blockchain_info':
        return await handleGetBlockchainInfo(input, neoService);
      case 'get_block_count':
        return await handleGetBlockCount(input, neoService);
      case 'get_block':
        return await handleGetBlock(input, neoService);
      case 'get_transaction':
        return await handleGetTransaction(input, neoService);
      case 'get_balance':
        return await handleGetBalance(input, neoService);
      case 'transfer_assets':
        return await handleTransferAssets(input, neoService);
      case 'invoke_contract':
        if (input.fromWIF) {
          return await handleInvokeWriteContract(input, neoService, contractService);
        } else {
          return await handleInvokeReadContract(input, contractService);
        }
      case 'estimate_transfer_fees':
        return await handleEstimateTransferFees(input, neoService);
      case 'estimate_invoke_fees':
        return await handleEstimateInvokeFees(input, neoService, contractService);
      case 'claim_gas':
        return await handleClaimGas(input, neoService);
      case 'list_famous_contracts':
        return await handleListFamousContracts(input, contractService);
      case 'get_contract_info':
        return await handleGetContractInfo(input, contractService);
      // --- Add cases for specific contract tools --- //
      // These might need neoService, contractService, or both depending on the implementation
      case 'neofs_create_container':
      case 'neofs_get_containers':
        // Example: Pass both services if needed
        // return await handleNeoFSTool(input, neoService, contractService);
        throw new McpError(ErrorCode.InternalError, `Tool ${name} handler not fully implemented yet.`); // Corrected: Use InternalError
      default:
        throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found or requires network parameter.`);
    }
  } catch (error) {
    return handleError(error);
  }
}

// --- Tool Setup Function ---

export function setupToolHandlers(
  server: Server,
  neoServices: Map<NeoNetwork, NeoService>,
  contractServices: Map<NeoNetwork, ContractService>
) {
  const tools = [
      {
        name: 'get_network_mode',
        description: 'Get the currently configured network mode (mainnet_only, testnet_only, both)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'set_network_mode',
        description: 'Set the network mode (mainnet_only, testnet_only, both). Requires restart.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              description: 'Network mode to set',
              enum: [NetworkMode.MAINNET_ONLY, NetworkMode.TESTNET_ONLY, NetworkMode.BOTH],
            },
          },
          required: ['mode'],
        },
      },
      {
        name: 'get_blockchain_info',
        description: 'Get essential blockchain information (block height, version)',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_block_count',
        description: 'Get the current block height of the Neo N3 blockchain',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_block',
        description: 'Get block details by height or hash',
        inputSchema: {
          type: 'object',
          properties: {
            hashOrHeight: {
              oneOf: [
                { type: 'string', description: 'Block hash (hex string)' },
                { type: 'number', description: 'Block height (integer)' },
              ],
              description: 'Block hash or height',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['hashOrHeight'],
        },
      },
      {
        name: 'get_transaction',
        description: 'Get transaction details by hash',
        inputSchema: {
          type: 'object',
          properties: {
            txid: {
              type: 'string',
              description: 'Transaction hash (hex string)',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['txid'],
        },
      },
      {
        name: 'get_balance',
        description: 'Get native (NEO/GAS) and NEP-17 token balances for an address',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'transfer_assets',
        description: 'Transfer NEP-17 assets between addresses. Requires sender WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'WIF of the sender account',
            },
            toAddress: {
              type: 'string',
              description: 'Recipient address',
            },
            asset: {
              type: 'string',
              description: 'Asset script hash (hex string, e.g., GAS hash)',
            },
            amount: {
              oneOf: [
                { type: 'string', description: 'Amount as string' },
                { type: 'number', description: 'Amount as number' },
              ],
              description: 'Amount to transfer (in smallest unit, e.g., drops for GAS)',
            },
            confirm: {
              type: 'boolean',
              description: 'Set to true to confirm the transfer operation',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromWIF', 'toAddress', 'asset', 'amount', 'confirm'],
        },
      },
      {
        name: 'invoke_contract',
        description: 'Prepare invocation details for a smart contract method. If fromWIF is provided, prepares a write transaction (client signs/sends); otherwise, performs a read-only query.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'Optional: WIF of the account to sign the transaction (for write operations)',
            },
            scriptHash: {
              type: 'string',
              description: 'Contract script hash (hex string)',
            },
            operation: {
              type: 'string',
              description: 'Method name to invoke',
            },
            args: {
              type: 'array',
              description: 'Optional: Method arguments (array of values or SDK Signer/ContractParam objects)',
              default: [],
            },
            confirm: {
              type: 'boolean',
              description: 'Required for write operations (when fromWIF is provided). Set to true to confirm.',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['scriptHash', 'operation'], // `confirm` is conditionally required by handler
        },
      },
      {
        name: 'create_wallet',
        description: 'Create a new Neo N3 wallet (address and encrypted WIF)',
        inputSchema: {
          type: 'object',
          properties: {
            password: {
              type: 'string',
              description: 'Password to encrypt the wallet WIF',
            },
          },
          required: ['password'],
        },
      },
      {
        name: 'import_wallet',
        description: 'Import a Neo N3 wallet from private key or WIF. Returns address and optionally encrypted WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Private key (hex) or WIF string',
            },
            password: {
              type: 'string',
              description: 'Optional: Password to encrypt the imported wallet WIF',
            },
          },
          required: ['key'],
        },
      },
      {
        name: 'estimate_transfer_fees',
        description: 'Estimate network and system fees for a transfer transaction',
        inputSchema: {
          type: 'object',
          properties: {
            fromAddress: {
              type: 'string',
              description: 'Sender address',
            },
            toAddress: {
              type: 'string',
              description: 'Recipient address',
            },
            asset: {
              type: 'string',
              description: 'Asset script hash (hex string)',
            },
            amount: {
              oneOf: [
                { type: 'string', description: 'Amount as string' },
                { type: 'number', description: 'Amount as number' },
              ],
              description: 'Amount to transfer (in smallest unit)',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromAddress', 'toAddress', 'asset', 'amount'],
        },
      },
      {
        name: 'estimate_invoke_fees',
        description: 'Estimate network and system fees for a contract invocation',
        inputSchema: {
          type: 'object',
          properties: {
            signerAddress: {
              type: 'string',
              description: 'Address of the account that will sign the transaction',
            },
            scriptHash: {
              type: 'string',
              description: 'Contract script hash (hex string)',
            },
            operation: {
              type: 'string',
              description: 'Method name to invoke',
            },
            args: {
              type: 'array',
              description: 'Optional: Method arguments',
              default: [],
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['signerAddress', 'scriptHash', 'operation'],
        },
      },
      {
        name: 'claim_gas',
        description: 'Claim available GAS for an account. Requires account WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'WIF of the account to claim GAS for',
            },
            confirm: {
              type: 'boolean',
              description: 'Set to true to confirm the GAS claim operation',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromWIF', 'confirm'],
        },
      },
      {
        name: 'list_famous_contracts',
        description: 'List known famous contracts with their names and script hashes for the active network(s)',
        inputSchema: {
          type: 'object',
          properties: {
             network: {
              type: 'string',
              description: 'Optional: Filter by network ("mainnet" or "testnet"). Defaults to showing contracts for all configured networks.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_contract_info',
        description: 'Get details about a known famous contract by name or script hash',
        inputSchema: {
          type: 'object',
          properties: {
            nameOrHash: {
                type: 'string',
                description: 'Name (e.g., "flamingo") or script hash (hex string) of the famous contract',
            },
             network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['nameOrHash'],
        },
      },
      // Add specific contract interaction tools (as examples)
      // --- NeoFS --- (Assuming ContractService handles NeoFS interactions via its methods)
      {
        name: 'neofs_create_container',
        description: '[NeoFS] Create a new storage container (requires WIF)',
        inputSchema: {
          type: 'object',
          properties: {
             fromWIF: { type: 'string', description: 'WIF of the container owner' },
             ownerId: { type: 'string', description: 'Owner ID' },
             rules: { type: 'object', description: 'Container rules definition (complex object)' }, // Needs specific schema
             confirm: { type: 'boolean', description: 'Confirm operation' },
             network: { type: 'string', enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET], description: 'Optional: Network' },
          },
           required: ['fromWIF', 'ownerId', 'rules', 'confirm'],
        },
      },
      {
          name: 'neofs_get_containers',
          description: '[NeoFS] List containers owned by an address',
          inputSchema: {
              type: 'object',
              properties: {
                  ownerAddress: { type: 'string', description: 'Address of the owner' },
                  network: { type: 'string', enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET], description: 'Optional: Network' },
              },
              required: ['ownerAddress'],
          },
      },
      // --- Add other contract-specific tools similarly ---
  ];

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  }));

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: input = {} } = request.params;
    return await callTool(name, input, neoServices, contractServices);
  });

  console.log('Tool handlers setup complete.');
}
