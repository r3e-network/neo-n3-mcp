export class RpcDeadlineError extends Error {
  constructor(timeoutMs: number) {
    super(`RPC request timed out after ${timeoutMs}ms`);
    this.name = 'RpcDeadlineError';
  }
}

export class SubmissionOutcomeUnknownError extends Error {
  constructor(
    readonly txid: string,
    timeoutMsOrReason: number | 'inconsistent_response' | 'transport_error'
  ) {
    const reason = timeoutMsOrReason === 'inconsistent_response'
      ? 'Transaction submission returned an inconsistent RPC response; the outcome is unknown. '
      : timeoutMsOrReason === 'transport_error'
        ? 'Transaction submission failed without a definitive RPC response; the outcome is unknown. '
        : `Transaction submission timed out after ${timeoutMsOrReason}ms; the outcome is unknown. `;
    super(`${reason}Expected transaction ID: ${txid}. Do not retry blindly; query this transaction ID before resubmitting.`);
    this.name = 'SubmissionOutcomeUnknownError';
  }
}

export class OperationAbortedError extends Error {
  constructor() {
    super('Operation aborted');
    this.name = 'OperationAbortedError';
  }
}

export function withRpcDeadline<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (timeoutMs <= 0) {
    return Promise.reject(new RpcDeadlineError(0));
  }
  if (signal?.aborted) {
    return Promise.reject(new OperationAbortedError());
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new OperationAbortedError());
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(new RpcDeadlineError(timeoutMs));
    }, timeoutMs);
    timeout.unref?.();
    signal?.addEventListener('abort', onAbort, { once: true });

    let operationResult: Promise<T>;
    try {
      operationResult = operation();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
      return;
    }

    operationResult.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    );
  });
}
