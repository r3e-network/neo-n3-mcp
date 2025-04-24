/**
 * Transaction status test runner for Neo N3 MCP Server
 * This script runs the transaction-status-test.js file with the correct module system
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Running transaction status test for Neo N3 MCP Server...');

try {
  // Run the transaction status test with the --input-type=module flag
  execSync('node --input-type=module tests/transaction-status-test.js', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  console.log('Transaction status test completed successfully!');
} catch (error) {
  console.error('Transaction status test failed:', error.message);
  process.exit(1);
}
