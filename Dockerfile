# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage
FROM node:18-alpine

LABEL org.opencontainers.image.title="Neo N3 MCP Server"
LABEL org.opencontainers.image.description="MCP server for Neo N3 blockchain integration"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="R3E Network"
LABEL org.opencontainers.image.source="https://github.com/R3E-Network/neo-n3-mcp"
LABEL org.opencontainers.image.documentation="https://github.com/R3E-Network/neo-n3-mcp#readme"

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --production

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Create directory for wallet files
RUN mkdir -p /app/wallets

# Set executable permissions
RUN chmod +x ./dist/index.js

# Set environment variables
ENV NODE_ENV=production
ENV NEO_RPC_URL=http://neo-node:10332
ENV WALLET_PATH=/app/wallets

# Run the server in stdio mode for MCP compatibility
ENTRYPOINT ["node", "dist/index.js"]
