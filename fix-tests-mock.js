const fs = require('fs');

const mockValidation = `
jest.mock('../src/utils/validation', () => ({
  validateAddress: jest.fn((a) => {
    if (a === 'invalid') throw new Error('Invalid address');
    return a;
  }),
  validateHash: jest.fn((h) => {
    if (h === 'invalid') throw new Error('Invalid hash');
    return h;
  }),
  validateScriptHash: jest.fn((s) => {
    if (s === 'invalid') throw new Error('Invalid script hash');
    return s;
  }),
  validateAmount: jest.fn((a) => {
    if (a <= 0 || a === 'invalid') throw new Error('Invalid amount');
    return a.toString();
  }),
  validatePassword: jest.fn((p) => {
    if (p === 'short') throw new Error('Password too short');
    return p;
  }),
  validateNetwork: jest.fn((n) => {
    if (n === 'invalid') throw new Error('Invalid network');
    return n || 'mainnet';
  }),
  validateContractName: jest.fn((c) => {
    if (c === 'NonExistent') throw new Error('Invalid contract');
    return c;
  }),
  validateContractOperation: jest.fn(o => o)
}));
`;

function injectMock(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("jest.mock('../src/utils/validation'")) {
    content = content.replace(/import \{ jest \} from '@jest\/globals';|import { NeoNetwork } from/g, match => match + '
' + mockValidation);
    // If imports didn't match, insert after first import
    if (!content.includes('jest.mock')) {
      content = content.replace(/import .*?;
/, match => match + mockValidation + '
');
    }
    fs.writeFileSync(file, content);
    console.log('Injected validation mock in ' + file);
  }
}

injectMock('tests/tool-handler.test.ts');
injectMock('tests/blockchain-operations.test.ts');
injectMock('tests/contract-service.test.ts');
injectMock('tests/neo-service.test.ts');
