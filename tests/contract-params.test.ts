import * as neonJs from '@cityofzion/neon-js';
import { formatContractParameters } from '../src/utils/contract-params';
import { ValidationError } from '../src/utils/errors';

const VM_INTEGER_MIN = -(1n << 255n);
const VM_INTEGER_MAX = (1n << 255n) - 1n;
const HASH160 = 'ab'.repeat(20);
const HASH256 = 'cd'.repeat(32);

const account = new neonJs.wallet.Account('01'.repeat(32));
const n3Address = account.address;
const accountScriptHash = neonJs.wallet.getScriptHashFromAddress(n3Address).toLowerCase();
const compressedPublicKey = account.publicKey.toLowerCase();
const uncompressedPublicKey = neonJs.wallet.getPublicKeyUnencoded(compressedPublicKey);
const legacyAddress = neonJs.wallet.getAddressFromScriptHash(accountScriptHash, 0x17);
const invalidChecksumAddress = `${n3Address.slice(0, -1)}${n3Address.endsWith('1') ? '2' : '1'}`;

function formatOne(value: unknown) {
  return formatContractParameters([value])[0];
}

function expectRejected(value: unknown): void {
  expect(() => formatOne(value)).toThrow(ValidationError);
}

describe('formatContractParameters', () => {
  describe('Any and inferred primitive parameters', () => {
    test('formats null as an Any parameter with an explicit null value', () => {
      expect(formatOne(null)).toEqual({ type: 'Any', value: null });
      expect(formatOne({ type: 'Any', value: null })).toEqual({ type: 'Any', value: null });
    });

    test('rejects undefined instead of silently converting it to null', () => {
      expectRejected(undefined);
      expectRejected({ type: 'Any', value: undefined });
    });

    test('rejects non-null values for typed Any parameters', () => {
      expectRejected({ type: 'Any', value: 'not-null' });
    });

    test('infers canonical parameters for ordinary raw primitives', () => {
      expect(formatContractParameters([true, 42, 'hello'])).toEqual([
        { type: 'Boolean', value: true },
        { type: 'Integer', value: '42' },
        { type: 'String', value: 'hello' },
      ]);
    });

    test('requires the public input to be an array', () => {
      expect(() => formatContractParameters({} as unknown as unknown[])).toThrow(ValidationError);
    });
  });

  describe('Boolean', () => {
    test.each([true, false])('accepts the boolean value %s', (value) => {
      expect(formatOne({ type: 'Boolean', value })).toEqual({ type: 'Boolean', value });
    });

    test.each([
      ['a boolean-looking string', 'false'],
      ['zero', 0],
      ['one', 1],
      ['null', null],
      ['a missing value', undefined],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'Boolean', value });
    });
  });

  describe('Integer', () => {
    test.each([
      ['zero as a number', 0, '0'],
      ['negative zero as a number', -0, '0'],
      ['a negative safe integer', -42, '-42'],
      ['the largest safe integer number', Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)],
      ['canonical zero', '0', '0'],
      ['a canonical negative decimal', '-42', '-42'],
      ['the Neo VM minimum', VM_INTEGER_MIN.toString(), VM_INTEGER_MIN.toString()],
      ['the Neo VM maximum', VM_INTEGER_MAX.toString(), VM_INTEGER_MAX.toString()],
    ])('accepts %s and emits a canonical decimal string', (_label, value, expected) => {
      expect(formatOne({ type: 'Integer', value })).toEqual({
        type: 'Integer',
        value: expected,
      });
    });

    test.each([
      ['a fraction number', 1.5],
      ['an unsafe number', Number.MAX_SAFE_INTEGER + 1],
      ['NaN', Number.NaN],
      ['positive infinity', Number.POSITIVE_INFINITY],
      ['a decimal string', '1.0'],
      ['an exponent string', '1e3'],
      ['a leading plus sign', '+1'],
      ['a leading zero', '01'],
      ['negative zero', '-0'],
      ['leading whitespace', ' 1'],
      ['trailing whitespace', '1 '],
      ['an empty string', ''],
      ['one below the Neo VM minimum', (VM_INTEGER_MIN - 1n).toString()],
      ['one above the Neo VM maximum', (VM_INTEGER_MAX + 1n).toString()],
      ['a bigint typed value', 1n],
      ['a boolean', true],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'Integer', value });
    });
  });

  describe('String', () => {
    test('requires a string and preserves explicitly typed hash-shaped text', () => {
      const hashShapedText = `0x${HASH160.toUpperCase()}`;

      expect(formatOne({ type: 'String', value: hashShapedText })).toEqual({
        type: 'String',
        value: hashShapedText,
      });
    });

    test.each([
      ['a number', 12],
      ['a boolean', false],
      ['null', null],
      ['a missing value', undefined],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'String', value });
    });
  });

  describe('ByteArray', () => {
    test.each(['', 'AA==', 'qrs=', 'YWJj'])('accepts canonical base64 %j', (value) => {
      expect(formatOne({ type: 'ByteArray', value })).toEqual({ type: 'ByteArray', value });
    });

    test('encodes raw binary values as canonical base64', () => {
      expect(formatContractParameters([
        Buffer.from([0xaa, 0xbb]),
        new Uint8Array([0x00, 0xff]),
      ])).toEqual([
        { type: 'ByteArray', value: 'qrs=' },
        { type: 'ByteArray', value: 'AP8=' },
      ]);
    });

    test.each([
      ['a one-character payload', 'A'],
      ['missing required padding', 'AA'],
      ['partial padding', 'AA='],
      ['excess padding', 'AA==='],
      ['missing padding on a two-byte payload', 'qrs'],
      ['leading whitespace', ' qrs='],
      ['trailing whitespace', 'qrs=\n'],
      ['a URL-safe alphabet character', '__8='],
      ['non-zero discarded padding bits', 'ZE=='],
      ['a non-string value', Buffer.from([0xaa])],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'ByteArray', value });
    });
  });

  describe('Hash160', () => {
    test('canonicalizes exact 20-byte hex with an optional prefix', () => {
      expect(formatOne({ type: 'Hash160', value: `0x${HASH160.toUpperCase()}` })).toEqual({
        type: 'Hash160',
        value: HASH160,
      });
      expect(formatOne({ type: 'Hash160', value: HASH160.toUpperCase() })).toEqual({
        type: 'Hash160',
        value: HASH160,
      });
    });

    test('converts a checksum-valid Neo N3 address to its canonical script hash', () => {
      expect(neonJs.wallet.isAddress(n3Address, neonJs.CONST.DEFAULT_ADDRESS_VERSION)).toBe(true);
      expect(formatOne({ type: 'Hash160', value: n3Address })).toEqual({
        type: 'Hash160',
        value: accountScriptHash,
      });
    });

    test('infers and canonicalizes raw Hash160 hex and Neo N3 addresses', () => {
      expect(formatContractParameters([`0x${HASH160.toUpperCase()}`, n3Address])).toEqual([
        { type: 'Hash160', value: HASH160 },
        { type: 'Hash160', value: accountScriptHash },
      ]);
    });

    test.each([
      ['a 19-byte hash', 'ab'.repeat(19)],
      ['a 21-byte hash', 'ab'.repeat(21)],
      ['non-hex text', 'gg'.repeat(20)],
      ['an address with an invalid checksum', invalidChecksumAddress],
      ['a checksum-valid legacy Neo address', legacyAddress],
      ['a non-string value', 123],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'Hash160', value });
    });
  });

  describe('Hash256', () => {
    test('canonicalizes exact 32-byte hex', () => {
      expect(formatOne({ type: 'Hash256', value: HASH256.toUpperCase() })).toEqual({
        type: 'Hash256',
        value: HASH256,
      });
    });

    test.each([
      ['a 31-byte hash', 'cd'.repeat(31)],
      ['a 33-byte hash', 'cd'.repeat(33)],
      ['a prefixed hash', `0x${HASH256}`],
      ['non-hex text', 'zz'.repeat(32)],
      ['a non-string value', 256],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'Hash256', value });
    });
  });

  describe('PublicKey', () => {
    test('accepts a valid compressed 33-byte public key and canonicalizes its case', () => {
      expect(neonJs.wallet.isPublicKey(compressedPublicKey, true)).toBe(true);
      expect(formatOne({ type: 'PublicKey', value: compressedPublicKey.toUpperCase() })).toEqual({
        type: 'PublicKey',
        value: compressedPublicKey,
      });
    });

    test.each([
      ['an uncompressed public key', uncompressedPublicKey],
      ['a 33-byte value with an uncompressed prefix', `04${compressedPublicKey.slice(2)}`],
      ['a compressed-looking value that is not a curve point', `02${'ff'.repeat(32)}`],
      ['a 32-byte value', compressedPublicKey.slice(0, -2)],
      ['a non-string value', 22],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'PublicKey', value });
    });
  });

  describe('Array', () => {
    test('recursively infers raw array elements', () => {
      expect(formatOne([null, false, 7, ['nested']])).toEqual({
        type: 'Array',
        value: [
          { type: 'Any', value: null },
          { type: 'Boolean', value: false },
          { type: 'Integer', value: '7' },
          {
            type: 'Array',
            value: [{ type: 'String', value: 'nested' }],
          },
        ],
      });
    });

    test('recursively validates and canonicalizes typed array elements', () => {
      expect(formatOne({
        type: 'Array',
        value: [
          { type: 'Integer', value: 9 },
          { type: 'Hash256', value: HASH256.toUpperCase() },
          { type: 'Array', value: [{ type: 'Boolean', value: true }] },
        ],
      })).toEqual({
        type: 'Array',
        value: [
          { type: 'Integer', value: '9' },
          { type: 'Hash256', value: HASH256 },
          { type: 'Array', value: [{ type: 'Boolean', value: true }] },
        ],
      });
    });

    test.each([
      ['null', null],
      ['a string', 'not-an-array'],
      ['an object', {}],
    ])('rejects %s as its value', (_label, value) => {
      expectRejected({ type: 'Array', value });
    });

    test('rejects an invalid parameter nested inside an array', () => {
      expectRejected({
        type: 'Array',
        value: [{ type: 'Array', value: [{ type: 'Boolean', value: 'true' }] }],
      });
    });
  });

  describe('Map', () => {
    test('recursively validates and canonicalizes all supported primitive key types', () => {
      expect(formatOne({
        type: 'Map',
        value: [
          { key: { type: 'String', value: 'name' }, value: { type: 'Any', value: null } },
          { key: { type: 'Boolean', value: true }, value: { type: 'String', value: 'boolean' } },
          { key: { type: 'Integer', value: 3 }, value: { type: 'String', value: 'integer' } },
          { key: { type: 'ByteArray', value: 'AA==' }, value: { type: 'String', value: 'bytes' } },
          { key: { type: 'Hash160', value: `0x${HASH160.toUpperCase()}` }, value: { type: 'String', value: 'hash160' } },
          { key: { type: 'Hash256', value: HASH256.toUpperCase() }, value: { type: 'String', value: 'hash256' } },
          { key: { type: 'PublicKey', value: compressedPublicKey.toUpperCase() }, value: { type: 'String', value: 'public-key' } },
        ],
      })).toEqual({
        type: 'Map',
        value: [
          { key: { type: 'String', value: 'name' }, value: { type: 'Any', value: null } },
          { key: { type: 'Boolean', value: true }, value: { type: 'String', value: 'boolean' } },
          { key: { type: 'Integer', value: '3' }, value: { type: 'String', value: 'integer' } },
          { key: { type: 'ByteArray', value: 'AA==' }, value: { type: 'String', value: 'bytes' } },
          { key: { type: 'Hash160', value: HASH160 }, value: { type: 'String', value: 'hash160' } },
          { key: { type: 'Hash256', value: HASH256 }, value: { type: 'String', value: 'hash256' } },
          { key: { type: 'PublicKey', value: compressedPublicKey }, value: { type: 'String', value: 'public-key' } },
        ],
      });
    });

    test('keeps implicit plain-object keys as String even when they look like hashes or addresses', () => {
      const hashShapedKey = `0x${HASH160.toUpperCase()}`;

      expect(formatOne({
        [hashShapedKey]: 'hash-shaped',
        [n3Address]: 'address-shaped',
      })).toEqual({
        type: 'Map',
        value: [
          {
            key: { type: 'String', value: hashShapedKey },
            value: { type: 'String', value: 'hash-shaped' },
          },
          {
            key: { type: 'String', value: n3Address },
            value: { type: 'String', value: 'address-shaped' },
          },
        ],
      });
    });

    test.each([
      ['a non-array map value', {}],
      ['a null entry', [null]],
      ['an entry without key', [{ value: { type: 'String', value: 'value' } }]],
      ['an entry without value', [{ key: { type: 'String', value: 'key' } }]],
    ])('rejects %s', (_label, value) => {
      expectRejected({ type: 'Map', value });
    });

    test.each([
      ['Any', { type: 'Any', value: null }],
      ['Array', { type: 'Array', value: [] }],
      ['Map', { type: 'Map', value: [] }],
      ['Signature', { type: 'Signature', value: 'AA==' }],
    ])('rejects a %s key', (_label, key) => {
      expectRejected({
        type: 'Map',
        value: [{ key, value: { type: 'String', value: 'value' } }],
      });
    });

    test.each([
      [
        'integer keys after number-to-decimal normalization',
        { type: 'Integer', value: 1 },
        { type: 'Integer', value: '1' },
      ],
      [
        'Hash160 keys after prefix and case normalization',
        { type: 'Hash160', value: `0x${HASH160.toUpperCase()}` },
        { type: 'Hash160', value: HASH160 },
      ],
    ])('rejects duplicate %s', (_label, firstKey, secondKey) => {
      expectRejected({
        type: 'Map',
        value: [
          { key: firstKey, value: { type: 'String', value: 'first' } },
          { key: secondKey, value: { type: 'String', value: 'second' } },
        ],
      });
    });

    test('allows the same canonical payload under different key types', () => {
      expect(formatOne({
        type: 'Map',
        value: [
          { key: { type: 'String', value: '1' }, value: { type: 'String', value: 'string' } },
          { key: { type: 'Integer', value: '1' }, value: { type: 'String', value: 'integer' } },
        ],
      })).toEqual({
        type: 'Map',
        value: [
          { key: { type: 'String', value: '1' }, value: { type: 'String', value: 'string' } },
          { key: { type: 'Integer', value: '1' }, value: { type: 'String', value: 'integer' } },
        ],
      });
    });

    test('rejects an invalid parameter nested in a map value', () => {
      expectRejected({
        type: 'Map',
        value: [{
          key: { type: 'String', value: 'nested' },
          value: { type: 'Array', value: [{ type: 'Integer', value: '1e3' }] },
        }],
      });
    });
  });

  describe('unsupported types', () => {
    test.each(['Float', 'Signature', 'InteropInterface', 'Void', 'Unknown'])(
      'rejects the %s contract parameter type',
      (type) => {
        expectRejected({ type, value: null });
      }
    );
  });

  describe('toJson inputs', () => {
    test('accepts a genuine neon-js ContractParam only after canonical validation', () => {
      const parameter = neonJs.sc.ContractParam.array(
        neonJs.sc.ContractParam.integer(7),
        neonJs.sc.ContractParam.publicKey(compressedPublicKey)
      );

      expect(formatOne(parameter)).toEqual({
        type: 'Array',
        value: [
          { type: 'Integer', value: '7' },
          { type: 'PublicKey', value: compressedPublicKey },
        ],
      });
    });

    test('revalidates and canonicalizes a duck-typed toJson result', () => {
      expect(formatOne({
        toJson: () => ({ type: 'Hash256', value: HASH256.toUpperCase() }),
      })).toEqual({ type: 'Hash256', value: HASH256 });
    });

    test('rejects a malicious toJson result that tries to bypass typed validation', () => {
      expectRejected({
        toJson: () => ({ type: 'Boolean', value: 'false' }),
      });
    });
  });
});
