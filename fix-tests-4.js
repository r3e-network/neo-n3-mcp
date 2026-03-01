const fs = require('fs');

// Fix tool-handler.test.ts
const thPath = 'tests/tool-handler.test.ts';
let th = fs.readFileSync(thPath, 'utf8');

// fix the "should handle invalid password"
th = th.replace(
  /test\('should handle invalid password', async \(\) => {[\s\S]*?}\);/,
  `test('should handle invalid password', async () => {
      const input = { password: 'short' };
      const result = await callTool('create_wallet', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });`
);

// fix "should require signer address"
th = th.replace(
  /test\('should require signer address', async \(\) => {[\s\S]*?}\);/,
  `test('should require signer address', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer'
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });`
);
fs.writeFileSync(thPath, th);
console.log('Fixed tool-handler.test.ts tests that expected errors');

// Fix contract-service.test.ts
const csPath = 'tests/contract-service.test.ts';
let cs = fs.readFileSync(csPath, 'utf8');
cs = cs.replace(
  /const mockContractResult = {/g,
  `const mockContractResult = {
  script: 'mock-script',`
);
fs.writeFileSync(csPath, cs);
console.log('Fixed contract-service.test.ts mockContractResult');

// Fix blockchain-operations.test.ts mockContractResult if needed
const boPath = 'tests/blockchain-operations.test.ts';
let bo = fs.readFileSync(boPath, 'utf8');
bo = bo.replace(
  /const mockContractResult = {/g,
  `const mockContractResult = {
  script: 'mock-script',`
);
fs.writeFileSync(boPath, bo);
console.log('Fixed blockchain-operations.test.ts mockContractResult');
