/**
 * Network test runner for Neo N3 MCP Server
 * This script runs the network-test.js file with the correct module system
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Running network test for Neo N3 MCP Server...');

try {
  // Run the network test with the --input-type=module flag
  execSync('node --input-type=module tests/network-test.js', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  console.log('Network test completed successfully!');
} catch (error) {
  console.error('Network test failed:', error.message);
  process.exit(1);
}
