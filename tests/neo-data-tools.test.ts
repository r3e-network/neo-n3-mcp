import { dispatchNeoDataTool } from '../src/handlers/neo-data-tools';

function resultOf(response: Record<string, unknown>): Record<string, any> {
  return response.result as Record<string, any>;
}

describe('Neo data tools', () => {
  test('classifies checksum-valid N3 addresses and exposes their script hash', async () => {
    const result = resultOf(await dispatchNeoDataTool('inspect_neo_value', {
      value: 'NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg',
    }));
    expect(result.primaryType).toBe('neo_n3_address');
    expect(result.matches[0]).toMatchObject({
      type: 'neo_n3_address',
      confidence: 'exact',
    });
    expect(result.matches[0].scriptHash).toMatch(/^0x[0-9a-f]{40}$/);
  });

  test('converts byte encodings without using floating point', async () => {
    const hex = resultOf(await dispatchNeoDataTool('convert_neo_data', {
      value: 'Neo',
      inputFormat: 'utf8',
      outputFormat: 'hex',
    }));
    expect(hex.value).toBe('4e656f');
    expect(hex.byteLength).toBe(3);

    const integer = resultOf(await dispatchNeoDataTool('convert_neo_data', {
      value: '128',
      inputFormat: 'integer',
      outputFormat: 'hex',
    }));
    expect(integer.value).toBe('8000');

    const roundTrip = resultOf(await dispatchNeoDataTool('convert_neo_data', {
      value: integer.value,
      inputFormat: 'hex',
      outputFormat: 'integer',
    }));
    expect(roundTrip.value).toBe('128');
  });

  test('converts N3 addresses to script hashes and back', async () => {
    const address = 'NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg';
    const hash = resultOf(await dispatchNeoDataTool('convert_neo_data', {
      value: address,
      inputFormat: 'neo_address',
      outputFormat: 'script_hash',
    }));
    const restored = resultOf(await dispatchNeoDataTool('convert_neo_data', {
      value: hash.value,
      inputFormat: 'script_hash',
      outputFormat: 'neo_address',
    }));
    expect(restored.value).toBe(address);
  });

  test('disassembles NeoVM script into opcode offsets and explanations', async () => {
    const result = resultOf(await dispatchNeoDataTool('decode_neo_script', {
      script: '0c0568656c6c6f40',
      inputFormat: 'hex',
    }));
    expect(result.byteLength).toBe(8);
    expect(result.instructionCount).toBe(2);
    expect(result.instructions).toEqual([
      expect.objectContaining({
        index: 0,
        offset: 0,
        opcode: 'PUSHDATA1',
        operand: '68656c6c6f',
        category: 'stack/data',
      }),
      expect.objectContaining({
        index: 1,
        offset: 7,
        opcode: 'RET',
        category: 'control-flow',
      }),
    ]);
  });

  test('rejects malformed encodings instead of guessing', async () => {
    await expect(dispatchNeoDataTool('convert_neo_data', {
      value: 'abc',
      inputFormat: 'hex',
      outputFormat: 'utf8',
    })).rejects.toThrow(/even number/);
    await expect(dispatchNeoDataTool('decode_neo_script', {
      script: 'not-base64',
      inputFormat: 'base64',
    })).rejects.toThrow(/Base64/);
  });
});
