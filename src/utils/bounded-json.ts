function responseTooLarge(label: string, maxBytes: number): Error {
  return new Error(`${label} response exceeds ${maxBytes} bytes`);
}

export async function readBoundedJson<T>(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive safe integer');
  }

  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && BigInt(contentLength) > BigInt(maxBytes)) {
    await response.body?.cancel().catch(() => undefined);
    throw responseTooLarge(label, maxBytes);
  }

  if (!response.body) {
    // Test doubles may expose only json(); native fetch responses use the bounded stream path.
    return await response.json() as T;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw responseTooLarge(label, maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes).toString('utf8');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}
