const fs = require('fs');

const validHash = 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e';

const files = [
  'tests/contract-service.test.ts',
  'tests/blockchain-operations.test.ts',
  'tests/neo-service.test.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /getScriptHashFromAddress: jest\.fn\(\)\.mockReturnValue\('mock-hash'\)/g,
    `getScriptHashFromAddress: jest.fn().mockReturnValue('${validHash}')`
  );
  content = content.replace(
    /getScriptHashFromAddress: jest\.fn\(\)\.mockReturnValue\('mock-script-hash'\)/g,
    `getScriptHashFromAddress: jest.fn().mockReturnValue('${validHash}')`
  );
  content = content.replace(
    /getScriptHashFromAddress: jest\.fn\(\)\.mockReturnValue\('scriptHash'\)/g,
    `getScriptHashFromAddress: jest.fn().mockReturnValue('${validHash}')`
  );
  fs.writeFileSync(file, content);
}
console.log('Fixed mocked script hashes');
