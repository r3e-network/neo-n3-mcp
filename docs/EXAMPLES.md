# Neo N3 MCP Examples

## Read-Only MCP

```javascript
const height = await client.callTool({
  name: 'get_block_count',
  arguments: { network: 'testnet' },
});

const contract = await client.callTool({
  name: 'invoke_contract',
  arguments: {
    network: 'testnet',
    scriptHash: '0x0123456789abcdef0123456789abcdef01234567',
    operation: 'symbol',
    args: [],
  },
});
```

## Controlled MCP Write

Enable writes with an owner-only signer file and durable journal. The MCP client must advertise form elicitation support.

```javascript
const result = await client.callTool({
  name: 'transfer_assets',
  arguments: {
    idempotencyKey: 'transfer-2026-07-11-001',
    network: 'testnet',
    toAddress: 'Nb...',
    asset: 'GAS',
    amount: '1',
  },
});
```

The client presents a form containing the signer address and exact intent fingerprint. A declined, cancelled, missing, or mismatched approval fails closed.

## Fee Estimate

```javascript
const response = await client.callTool({
  name: 'estimate_transfer_fees',
  arguments: {
    network: 'testnet',
    fromAddress: 'Na...',
    toAddress: 'Nb...',
    asset: 'GAS',
    amount: '1',
  },
});
```

## HTTP Intent And Approval

```bash
curl -X POST http://127.0.0.1:3000/api/transfers \
  -H "Authorization: Bearer $HTTP_API_KEY" \
  -H "Idempotency-Key: transfer-2026-07-11-001" \
  -H 'Content-Type: application/json' \
  -d '{"network":"testnet","toAddress":"Nb...","asset":"GAS","amount":"1"}'
```

After independently verifying the returned fingerprint:

```bash
curl -X POST http://127.0.0.1:3000/api/write-intents/INTENT_ID/approve \
  -H "Authorization: Bearer $HTTP_WRITE_APPROVAL_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"fingerprint":"RETURNED_64_HEX_FINGERPRINT"}'
```

Retry uncertain operations only with the same idempotency key and identical inputs.
