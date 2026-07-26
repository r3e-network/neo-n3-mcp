FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS builder

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
# tools/ holds the CommonJS-callable brace-expansion wrapper referenced by a
# `file:` devDependency, so it has to exist before npm ci links it.
COPY tools ./tools
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS production

WORKDIR /app

ENV NODE_ENV=production \
    NEO_NETWORK=mainnet \
    HTTP_HOST=0.0.0.0 \
    PORT=3000 \
    WALLETS_DIR=/app/wallets \
    LOG_CONSOLE=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/wallets && chown node:node /app /app/wallets
USER node

# 3000 serves the REST API (default CMD). 3001 serves the MCP Streamable HTTP
# transport when the container is started with `node dist/mcp-http.js`.
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/live',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/http.js"]
