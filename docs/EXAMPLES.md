# Neo MCP Examples

## Read-Only MCP

```javascript
const height = await client.callTool({
  name: 'get_block_height',
  arguments: { chain: 'n3', network: 'testnet' },
});

const contract = await client.callTool({
  name: 'call_contract',
  arguments: {
    chain: 'n3',
    network: 'testnet',
    scriptHash: '0x0123456789abcdef0123456789abcdef01234567',
    operation: 'symbol',
    args: [],
  },
});
```

## Same Tools On Neo X

Tools that exist on both chains take a required `chain` discriminator:

```javascript
const neoxHeight = await client.callTool({
  name: 'get_block_height',
  arguments: { chain: 'neox', network: 'testnet' },
});

const symbol = await client.callTool({
  name: 'call_contract',
  arguments: {
    chain: 'neox',
    network: 'testnet',
    scriptHash: '0x0123456789abcdef0123456789abcdef01234567',
    operation: 'symbol',
    args: [],
  },
});
```

`call_contract` maps to `invokefunction` on Neo N3 and `eth_call` on Neo X. Neither variant can change state.

## Unsigned Transaction Proposal

```javascript
const proposal = await client.callTool({
  name: 'build_transfer',
  arguments: {
    chain: 'neox',
    network: 'testnet',
    fromAddress: '0x0123456789abcdef0123456789abcdef01234567',
    toAddress: '0xfedcba9876543210fedcba9876543210fedcba98',
    asset: 'GAS',
    amount: '1',
  },
});
```

The result is an UNSIGNED proposal. A wallet reviews it, signs it, and broadcasts it; the server never holds a key.

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
