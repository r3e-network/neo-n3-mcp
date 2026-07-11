/**
 * Neo N3 MCP Core Functionality Example
 *
 * This example demonstrates the core functionality of the Neo N3 MCP:
 * 1. Getting blockchain status
 * 2. Checking account balances
 * 3. Invoking smart contracts
 * 4. Sending transactions (simulated)
 */

const { NeoService, NeoNetwork } = require('../dist/services/neo-service');
const { ContractService } = require('../dist/contracts/contract-service');

// Configuration
const CONFIG = {
  rpcUrl: 'https://testnet1.neo.coz.io:443',
  network: NeoNetwork.TESTNET,
  testAddress: 'NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj', // Example address
  // Mock data for testing when RPC is unavailable
  mockData: {
    blockchainInfo: {
      height: 12345678,
      network: 'testnet'
    },
    block: {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      index: 12345678,
      time: 1609459200,
      tx: []
    },
    balance: {
      address: 'NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj',
      balance: []
    },
    contractInvocation: {
      state: 'HALT',
      gasconsumed: '0.123',
      stack: [
        {
          type: 'Integer',
          value: '100000000'
        }
      ]
    },
    estimateResult: {
      estimatedGas: '10.5',
      state: 'HALT'
    }
  }
};

// Initialize services
const neoService = new NeoService(CONFIG.rpcUrl, CONFIG.network);
const contractService = new ContractService(CONFIG.rpcUrl, CONFIG.network);

/**
 * Example 1: Get blockchain status
 */
async function getBlockchainStatus() {
  console.log('\n=== Example 1: Get Blockchain Status ===');

  try {
    let blockchainInfo;

    try {
      // Try to get current blockchain height
      blockchainInfo = await neoService.getBlockchainInfo();
    } catch (error) {
      console.log('⚠️ Using mock data for blockchain info due to RPC error');
      blockchainInfo = JSON.parse(JSON.stringify(CONFIG.mockData.blockchainInfo));
    }

    console.log(`Current block height: ${blockchainInfo.height}`);
    console.log(`Network: ${blockchainInfo.network}`);

    // Get a specific block
    const blockHeight = blockchainInfo.height - 10; // Get a block that's definitely confirmed
    console.log(`\nFetching block at height ${blockHeight}...`);

    let block;

    try {
      block = await neoService.getBlock(blockHeight);
    } catch (error) {
      console.log('⚠️ Using mock data for block details due to RPC error');
      block = JSON.parse(JSON.stringify(CONFIG.mockData.block));
    }

    console.log(`Block hash: ${block.hash}`);
    console.log(`Block time: ${new Date(block.time * 1000).toISOString()}`);
    console.log(`Transactions: ${block.tx.length}`);

    return blockchainInfo;
  } catch (error) {
    console.error('Error getting blockchain status:', error.message);
    throw error;
  }
}

/**
 * Example 2: Check account balance
 */
async function checkAccountBalance(address) {
  console.log('\n=== Example 2: Check Account Balance ===');

  try {
    console.log(`Checking balance for address: ${address}`);

    let balance;

    try {
      balance = await neoService.getBalance(address);
    } catch (error) {
      console.log('⚠️ Using mock data for account balance due to RPC error');
      balance = JSON.parse(JSON.stringify(CONFIG.mockData.balance));
    }

    console.log(`Address: ${balance.address}`);

    if (balance.balance.length === 0) {
      console.log('No assets found for this address');
    } else {
      console.log('Assets:');
      balance.balance.forEach(asset => {
        console.log(`- ${asset.asset_name || asset.asset_hash}: ${asset.amount}`);
      });
    }

    return balance;
  } catch (error) {
    console.error('Error checking account balance:', error.message);
    console.log('⚠️ Using mock data for account balance due to error');
    return JSON.parse(JSON.stringify(CONFIG.mockData.balance));
  }
}

/**
 * Example 3: Invoke a smart contract
 */
async function invokeContract() {
  console.log('\n=== Example 3: Invoke Smart Contract ===');

  try {
    // Invoke the totalSupply method on the NEO token contract
    console.log('Invoking totalSupply on NEO token contract...');

    let result;

    try {
      result = await contractService.queryContract(
        'NeoFS', // Using a built-in contract
        'getVersion',
        []
      );
    } catch (error) {
      console.log('⚠️ Using mock data for contract invocation due to RPC error');
      result = JSON.parse(JSON.stringify(CONFIG.mockData.contractInvocation));
    }

    console.log(`Invocation state: ${result.state}`);
    console.log(`Gas consumed: ${result.gasconsumed}`);

    if (result.stack && result.stack.length > 0) {
      console.log(`Result: ${JSON.stringify(result.stack[0])}`);
    }

    return result;
  } catch (error) {
    console.error('Error invoking contract:', error.message);
    console.log('⚠️ Using mock data for contract invocation due to error');
    return JSON.parse(JSON.stringify(CONFIG.mockData.contractInvocation));
  }
}

/**
 * Example 4: Simulate a transaction
 */
async function simulateTransaction() {
  console.log('\n=== Example 4: Simulate Transaction ===');

  try {
    // This is a simulation only - no actual transaction is sent
    console.log('Simulating a NEO token transfer...');

    let estimateResult;

    try {
      // Estimate the gas required for a transfer
      estimateResult = await neoService.estimateTransferFees({
        fromAddress: CONFIG.testAddress,
        toAddress: 'NVbGwMfRQVudQCcChhCFwQRwSxr5tYEqQs',
        asset: 'NEO',
        amount: '1'
      });
    } catch (error) {
      console.log('⚠️ Using mock data for transaction simulation due to RPC error');
      estimateResult = JSON.parse(JSON.stringify(CONFIG.mockData.estimateResult));
    }

    console.log(`Estimated gas required: ${estimateResult.estimatedGas}`);
    console.log(`Transaction would be in state: ${estimateResult.state}`);

    console.log('\nNote: No actual transaction was sent. This was a simulation only.');

    return estimateResult;
  } catch (error) {
    console.error('Error simulating transaction:', error.message);
    console.log('⚠️ Using mock data for transaction simulation due to error');
    return JSON.parse(JSON.stringify(CONFIG.mockData.estimateResult));
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    console.log('=== Neo N3 MCP Core Functionality Examples ===');

    // Run examples
    await getBlockchainStatus();
    await checkAccountBalance(CONFIG.testAddress);
    await invokeContract();
    await simulateTransaction();

    console.log('\n=== All examples completed successfully ===');
  } catch (error) {
    console.error('\nExample execution failed:', error);
    process.exit(1);
  }
}

// Run the examples
runExamples();
