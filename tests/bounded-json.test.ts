import { readBoundedJson } from '../src/utils/bounded-json';

describe('bounded JSON response reader', () => {
  test('parses a JSON response within the configured byte limit', async () => {
    const response = new Response(JSON.stringify({ ok: true }));

    await expect(readBoundedJson(response, 64, 'Test upstream')).resolves.toEqual({ ok: true });
  });

  test('rejects a declared response length before consuming the body', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const response = {
      headers: new Headers({ 'Content-Length': '1024' }),
      body: { cancel },
    } as unknown as Response;

    await expect(readBoundedJson(response, 64, 'Test upstream'))
      .rejects.toThrow(/Test upstream response exceeds 64 bytes/i);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test('stops reading a streamed response after the byte limit', async () => {
    const response = new Response('x'.repeat(65));

    await expect(readBoundedJson(response, 64, 'Test upstream'))
      .rejects.toThrow(/Test upstream response exceeds 64 bytes/i);
  });
});
