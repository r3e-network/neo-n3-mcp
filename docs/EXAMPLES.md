# Neo N3 MCP Examples

This document shows accurate examples for the current MCP and HTTP surfaces.

## Start the MCP Server

### Stdio mode

```bash
NEO_NETWORK=both \
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443 \
NEO_TESTNET_RPC=http://seed1t5.neo.org:20332 \
LOG_LEVEL=info \
LOG_FILE=./logs/neo-n3-mcp.log \
npx @r3e/neo-n3-mcp
```

### HTTP mode

```bash
npm run build
PORT=3000 NEO_NETWORK=testnet npm run start:http
```

## MCP Client Example

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@r3e/neo-n3-mcp'],
  env: {
    NEO_NETWORK: 'testnet',
    NEO_TESTNET_RPC: 'http://seed1t5.neo.org:20332',
    LOG_LEVEL: 'info',
  },
});

const client = new Client(
  { name: 'example-client', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
```

## Wallet Operations

### Create a wallet

```javascript
const wallet = await client.callTool({
  name: 'create_wallet',
  arguments: {
    password: 'secure-password-123',
  },
});

const payload = JSON.parse(wallet.content[0].text);
// payload.address
// payload.publicKey
// payload.encryptedPrivateKey
// payload.encryptedWIF (compatibility alias)
```

### Import a wallet without persisting encrypted material

```javascript
const wallet = await client.callTool({
  name: 'import_wallet',
  arguments: {
    privateKeyOrWIF: 'Kx...',
  },
});

const payload = JSON.parse(wallet.content[0].text);
// payload.address
// payload.publicKey
```

### Import a wallet and request an encrypted key

```javascript
const wallet = await client.callTool({
  name: 'import_wallet',
  arguments: {
    key: 'Kx...',
    password: 'new-password-123',
  },
});

const payload = JSON.parse(wallet.content[0].text);
// payload.encryptedPrivateKey
```

## Balance Query

```javascript
const balance = await client.callTool({
  name: 'get_balance',
  arguments: {
    address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
    network: 'testnet',
  },
});
```

## Contract Invocation

### Discover a script hash

```javascript
const contractInfo = await client.callTool({
  name: 'get_contract_info',
  arguments: {
    contract: 'NeoXBridgeManagement',
    network: 'mainnet',
  },
});

const info = JSON.parse(contractInfo.content[0].text);
const scriptHash = info.scriptHash;
```

The server resolves plain contract names through `https://api.n3index.dev` when they are not already known locally.

### Read invocation

```javascript
const readResult = await client.callTool({
  name: 'invoke_contract',
  arguments: {
    network: 'mainnet',
    contract: 'NeoXBridgeManagement',
    operation: 'owner',
    args: [],
  },
});
```

### Write invocation

```javascript
const writeResult = await client.callTool({
  name: 'invoke_contract',
  arguments: {
    network: 'testnet',
    fromWIF: 'Kx...',
    scriptHash,
    operation: 'transfer',
    args: ['NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'Nb2o2ey5...', '1', null],
    confirm: true,
  },
});
```

## HTTP Monitoring

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```
