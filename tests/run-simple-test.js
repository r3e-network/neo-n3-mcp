/**
 * Simple test runner for Neo N3 MCP Server
 * This script runs the simple-test.js file with the correct module system
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Running simple test for Neo N3 MCP Server...');

try {
  // Run the simple test with the --input-type=module flag
  execSync('node --input-type=module tests/simple-test.js', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  console.log('Simple test completed successfully!');
} catch (error) {
  console.error('Simple test failed:', error.message);
  process.exit(1);
}
