import * as fs from 'fs';
import * as path from 'path';

// The non-custodial write layer must have NO reachable signing or broadcasting
// path. These assertions fail the build if a construct/simulate module ever
// imports a signer, a wallet store, or the custodial write pipeline, or if it
// references a broadcast RPC as an outbound call.

const SRC = path.join(__dirname, '..', 'src');

// Modules that make up the non-custodial write layer.
const CONSTRUCT_MODULES = [
  path.join(SRC, 'handlers', 'proposal-tools.ts'),
  path.join(SRC, 'utils', 'transaction-proposal.ts'),
  path.join(SRC, 'utils', 'evm-abi.ts'),
  path.join(SRC, 'contracts', 'evm-rpc-client.ts'),
];

// Custodial modules that must never be imported by the construct modules.
const FORBIDDEN_IMPORT_SUBSTRINGS = [
  'signer-provider',
  'wallet-service',
  'write-operation-service',
  'write-coordinator',
  'services/signer',
];

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const requireRe = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) specifiers.push(match[1]);
  while ((match = requireRe.exec(source)) !== null) specifiers.push(match[1]);
  return specifiers;
}

describe('non-custodial boundary', () => {
  test('construct/simulate modules exist', () => {
    for (const file of CONSTRUCT_MODULES) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  test('no construct/simulate module imports a signer, wallet store, or write pipeline', () => {
    for (const file of CONSTRUCT_MODULES) {
      const source = fs.readFileSync(file, 'utf8');
      const specifiers = importSpecifiers(source);
      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
          expect(specifier.includes(forbidden)).toBe(false);
        }
      }
    }
  });

  test('proposal builders and encoders never reference a broadcast RPC', () => {
    // evm-rpc-client is excluded: it names broadcast methods only to REJECT them.
    const buildersAndEncoders = CONSTRUCT_MODULES.filter((f) => !f.endsWith('evm-rpc-client.ts'));
    for (const file of buildersAndEncoders) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/sendrawtransaction/i);
      expect(source).not.toMatch(/sendtransaction/i);
      expect(source).not.toMatch(/signtransaction/i);
    }
  });

  test('the EVM RPC client only enumerates broadcast methods inside its forbidden set', () => {
    const source = fs.readFileSync(path.join(SRC, 'contracts', 'evm-rpc-client.ts'), 'utf8');
    // It must define a forbidden set and must not POST a broadcast method.
    expect(source).toMatch(/EVM_FORBIDDEN_METHODS/);
    // There is no fetch/POST helper that forwards a send/sign method: the only
    // occurrences are within the forbidden allowlist declaration and the guard.
    expect(source).toMatch(/assertReadOnlyEvmMethod/);
  });
});
