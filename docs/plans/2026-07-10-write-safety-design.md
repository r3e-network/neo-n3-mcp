# Production Write Safety Design

## Goal

Keep the Neo N3 MCP server read-only by default and make explicitly enabled writes safe against model-channel secret exposure, same-channel confirmation, and duplicate transaction construction after an uncertain submission.

## Capability Boundary

- `NEO_ENABLE_WRITES` defaults to `false`.
- MCP never registers wallet creation or import tools.
- `invoke_contract` is strictly read-only; enabled writes use `invoke_contract_write`.
- Write tools accept only public data: `network`, `signerAddress`, an idempotency key, and operation parameters.
- The signer WIF is loaded once from an owner-only, regular, non-symlink file.
- HTTP wallet administration is independently disabled by default and returns metadata only when enabled.

## Approval

- MCP reserves an immutable intent, then requires form elicitation from the connected client. Unsupported, cancelled, or declined elicitation fails closed.
- HTTP creates an `awaiting_approval` intent under the ordinary API key. A second request to the intent approval endpoint must use a distinct approval API key and the exact fingerprint.

## Idempotency

The journal hashes each idempotency key for its filename and binds it to a canonical SHA-256 fingerprint of the operation, network, signer, and payload. It writes mode-`0600` records atomically in a mode-`0700` directory.

Before any relay, the server persists the signed raw transaction, expected transaction ID, and validity height. Retries reconcile that ID first and may only relay the persisted bytes. A different request using the same key is rejected. The write state directory is single-instance; deployments must not share it across active replicas.

## States

`awaiting_approval`, `approved`, `preparing`, `submitting`, `outcome_unknown`, `submitted`, `rejected`, `failed_before_submission`, `declined`, and `expired` are durable. Terminal states return the stored result or failure. Recovery from `preparing` is safe because relay is impossible until a signed transaction has been persisted.

## Verification

- Default and enabled MCP registration tests
- Secret-file and idempotency journal unit tests
- Unknown-outcome restart/replay tests proving one preparation and byte-identical relay
- HTTP network, approval-key, fingerprint, and disabled-before-body-parse tests
- Full typecheck, unit, MCP, container, audit, and live read-only verification
