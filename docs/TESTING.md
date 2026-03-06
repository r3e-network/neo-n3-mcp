# Testing Guide

## Automated Validation

Run the same validation stack used during hardening:

```bash
npm run lint
npm run build
npm test
npm run test:mcp
npm run test:integration
```

## Manual HTTP Testing

Start HTTP mode:

```bash
npm run build
npm run start:http
```

Default port: `3000`.

### Health and metrics

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

### REST examples

```bash
curl http://localhost:3000/api/blockchain/info
```

```bash
curl http://localhost:3000/api/blockchain/height
```

```bash
curl http://localhost:3000/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/balance
```

Create a wallet via HTTP:

```bash
curl -X POST http://localhost:3000/api/wallets \
  -H 'Content-Type: application/json' \
  -d '{"password":"test-password-123"}'
```

Import a wallet via HTTP (use `key` or `privateKeyOrWIF`; omit `password` for stateless import):

```bash
curl -X POST http://localhost:3000/api/wallets/import \
  -H 'Content-Type: application/json' \
  -d '{"privateKeyOrWIF":"Kx...","password":"test-password-123"}'
```

Estimate transfer fees via HTTP:

```bash
curl -X POST http://localhost:3000/api/transfers/estimate-fees \
  -H 'Content-Type: application/json' \
  -d '{"fromAddress":"Na...","toAddress":"Nb...","asset":"NEO","amount":"1"}'
```

Submit a transfer via HTTP (requires explicit confirmation):

```bash
curl -X POST http://localhost:3000/api/transfers \
  -H 'Content-Type: application/json' \
  -d '{"fromWIF":"Kx...","toAddress":"Nb...","asset":"NEO","amount":"1","confirm":true}'
```

## Manual MCP Testing

Use an MCP client or the integration suite:

```bash
npm run test:integration
```
