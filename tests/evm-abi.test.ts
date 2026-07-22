import {
  keccak256Hex,
  functionSelector,
  encodeAbiParameters,
  encodeFunctionCall,
  parseFunctionSignature,
} from '../src/utils/evm-abi';
import { ValidationError } from '../src/utils/errors';

describe('evm-abi keccak256', () => {
  test('matches known keccak256 vectors', () => {
    expect(keccak256Hex('')).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
    );
    expect(keccak256Hex('abc')).toBe(
      '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'
    );
  });
});

describe('evm-abi function selectors', () => {
  test('computes canonical selectors', () => {
    expect(functionSelector('transfer(address,uint256)')).toBe('0xa9059cbb');
    expect(functionSelector('balanceOf(address)')).toBe('0x70a08231');
    expect(functionSelector('approve(address,uint256)')).toBe('0x095ea7b3');
  });

  test('parses signatures and rejects malformed ones', () => {
    expect(parseFunctionSignature('transfer(address,uint256)')).toEqual({
      name: 'transfer',
      types: ['address', 'uint256'],
    });
    expect(parseFunctionSignature('name()')).toEqual({ name: 'name', types: [] });
    expect(() => parseFunctionSignature('not a signature')).toThrow(ValidationError);
  });
});

describe('evm-abi encoding', () => {
  test('encodes transfer(address,uint256) calldata correctly', () => {
    const calldata = encodeFunctionCall('transfer(address,uint256)', [
      '0x1111111111111111111111111111111111111111',
      '1',
    ]);
    expect(calldata).toBe(
      '0xa9059cbb'
      + '0000000000000000000000001111111111111111111111111111111111111111'
      + '0000000000000000000000000000000000000000000000000000000000000001'
    );
  });

  test('encodes a large uint256 amount without precision loss', () => {
    const oneEther = '1000000000000000000';
    const calldata = encodeFunctionCall('transfer(address,uint256)', [
      '0x1111111111111111111111111111111111111111',
      oneEther,
    ]);
    // 1e18 = 0x0de0b6b3a7640000
    expect(calldata.endsWith('0000000000000000000000000000000000000000000000000de0b6b3a7640000')).toBe(true);
  });

  test('encodes dynamic string with head/tail layout', () => {
    const encoded = encodeAbiParameters(['string'], ['Hi']);
    expect(encoded).toBe(
      '0x'
      + '0000000000000000000000000000000000000000000000000000000000000020' // offset
      + '0000000000000000000000000000000000000000000000000000000000000002' // length
      + '4869000000000000000000000000000000000000000000000000000000000000' // "Hi"
    );
  });

  test('rejects an argument count mismatch', () => {
    expect(() => encodeAbiParameters(['address', 'uint256'], ['0x' + '11'.repeat(20)])).toThrow(
      ValidationError
    );
  });

  test('rejects an unsupported type', () => {
    expect(() => encodeAbiParameters(['uint7'], [1])).toThrow(ValidationError);
  });

  test('rejects a bad address argument', () => {
    expect(() => encodeAbiParameters(['address'], ['0xnot-an-address'])).toThrow(ValidationError);
  });
});
