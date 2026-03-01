const fs = require('fs');

const testPath = 'tests/tool-handler.test.ts';
let content = fs.readFileSync(testPath, 'utf8');

// 1. missing network parameter now succeeds (defaults to mainnet)
content = content.replace(
  /test\('should handle missing network parameter', async \(\) => {[\s\S]*?}\);/,
  `test('should handle missing network parameter', async () => {\n      const result = await callTool('get_blockchain_info', {}, mockNeoServices, mockContractServices);\n      expect(result).toHaveProperty('result');\n    });`
);

// 2. create_wallet password too short
content = content.replace(
  /password: 'test'/g,
  `password: 'password123'`
);
content = content.replace(
  /password: '123'/g,
  `password: 'password123'`
);

// 3. add confirm: true to transfer_assets
content = content.replace(
  /const input = \{\s*network: 'mainnet',\s*fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',\s*toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',\s*asset: '0xd2a4cff31913016155e38e474a2c06d08be276cf',\s*amount: '10'\s*\};/g,
  `const input = { network: 'mainnet', fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8', toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', asset: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '10', confirm: true };`
);

// 4. invoke_contract write needs confirm
content = content.replace(
  /fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',\s*scriptHash/g,
  `fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',\n        confirm: true,\n        scriptHash`
);

// 5. claim_gas needs confirm
content = content.replace(
  /const input = { network: 'mainnet', fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8' };/g,
  `const input = { network: 'mainnet', fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8', confirm: true };`
);

// 6. get_block number vs hash validation
content = content.replace(
  /hashOrHeight: '0x123'/g,
  `hashOrHeight: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'`
);
content = content.replace(
  /hashOrHeight: '0x456'/g,
  `hashOrHeight: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'`
);
content = content.replace(
  /txid: '0x123'/g,
  `txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'`
);
content = content.replace(
  /txid: '0x456'/g,
  `txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'`
);

// 7. estimate_invoke_fees missing signerAddress
content = content.replace(
  /scriptHash: '0x1234567890abcdef1234567890abcdef12345678',\s*operation: 'transfer'/g,
  `signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',\n        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',\n        operation: 'transfer'`
);

// 8. estimate_invoke_fees (second occurrence)
content = content.replace(
  /scriptHash: 'invalid',\s*operation: 'transfer'/g,
  `signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',\n        scriptHash: 'invalid',\n        operation: 'transfer'`
);

// 9. get_contract_info invalid script hash or contract name 'NonExistent'
content = content.replace(
  /test\('should handle invalid contract name', async \(\) => {[\s\S]*?}\);/,
  `test('should handle invalid contract name', async () => {\n      const input = { network: 'mainnet', nameOrHash: 'NonExistent' };\n      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);\n      expect(result).toHaveProperty('error');\n    });`
);
content = content.replace(
  /contractName: 'NonExistent'/g,
  `nameOrHash: 'NonExistent'`
);

fs.writeFileSync(testPath, content);
console.log('Fixed tool-handler.test.ts');
