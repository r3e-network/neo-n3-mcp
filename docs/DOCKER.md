# Docker Guide for Neo N3 MCP Server

This guide provides comprehensive instructions for running the Neo N3 MCP Server using Docker.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Images](#docker-images)
- [Configuration](#configuration)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/r3e-network/neo-n3-mcp.git
cd neo-n3-mcp

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f neo-mcp

# Stop
docker-compose down
```

### Using Docker Run

```bash
# Build the image
./scripts/docker-build.sh

# Run the container
./scripts/docker-run.sh --network testnet --detach

# Check logs
docker logs -f neo-n3-mcp-server
```

## Docker Images

### Production Image

- **Base**: `node:18-alpine`
- **Size**: ~150MB (optimized)
- **Features**: Multi-stage build, non-root user, health checks
- **Security**: Minimal attack surface, no dev dependencies

```bash
# Build production image
docker build -t r3enetwork/neo-n3-mcp:latest .

# Or use the build script
./scripts/docker-build.sh --tag v1.6.0 --registry r3enetwork
```

### Development Image

- **Base**: `node:18-alpine`
- **Features**: Hot reload, debugging support, dev tools
- **Debug Port**: 9229

```bash
# Build development image
docker build -f Dockerfile.dev -t r3enetwork/neo-n3-mcp:dev .

# Or use the build script
./scripts/docker-build.sh --dev --tag dev --registry r3enetwork
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEO_NETWORK` | Network mode (mainnet/testnet) | `mainnet` |
| `NEO_MAINNET_RPC` | Mainnet RPC endpoint | `https://mainnet1.neo.coz.io:443` |
| `NEO_TESTNET_RPC` | Testnet RPC endpoint | `https://testnet1.neo.coz.io:443` |
| `RATE_LIMITING_ENABLED` | Enable rate limiting | `true` |
| `MAX_REQUESTS_PER_MINUTE` | Rate limit per minute | `60` |
| `MAX_REQUESTS_PER_HOUR` | Rate limit per hour | `1000` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `/app/logs/neo-mcp.log` |
| `LOG_CONSOLE` | Console logging | `true` |
| `PORT` | Server port | `3000` |

### Configuration Files

#### Docker Compose Environment

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  neo-mcp:
    environment:
      - NEO_NETWORK=testnet
      - LOG_LEVEL=debug
      - RATE_LIMITING_ENABLED=false
```

#### Custom Configuration

```bash
# Create custom config
cp config/docker.json config/custom.json

# Mount custom config
docker run -v ./config/custom.json:/app/config/docker.json r3enetwork/neo-n3-mcp:latest
```

## Development

### Development Setup

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f neo-mcp-dev

# Run tests
docker-compose -f docker-compose.dev.yml run --rm neo-mcp-test

# Debug mode
docker-compose -f docker-compose.dev.yml up neo-mcp-dev
# Then attach debugger to localhost:9229
```

### Hot Reload

The development container supports hot reload:

```bash
# Start with hot reload
docker-compose -f docker-compose.dev.yml up neo-mcp-dev

# Edit files in ./src/ - changes will be reflected automatically
```

### Running Tests

```bash
# Run all tests
docker-compose -f docker-compose.dev.yml run --rm neo-mcp-test

# Run specific test
docker-compose -f docker-compose.dev.yml run --rm neo-mcp-test npm test -- --testNamePattern="validation"

# Run with coverage
docker-compose -f docker-compose.dev.yml run --rm neo-mcp-test npm test -- --coverage
```

## Production Deployment

### Basic Production Setup

```bash
# Production with Docker Compose
docker-compose up -d

# Check health
curl http://localhost:3000/health

# View metrics (if monitoring enabled)
curl http://localhost:3000/metrics
```

### Advanced Production Setup

```bash
# Build optimized image
./scripts/docker-build.sh --tag production --registry r3enetwork

# Run with custom configuration
docker run -d \
  --name neo-mcp-prod \
  -p 3000:3000 \
  -v ./config/production.json:/app/config/docker.json:ro \
  -v neo-mcp-logs:/app/logs \
  -v neo-mcp-wallets:/app/wallets \
  --restart unless-stopped \
  r3enetwork/neo-n3-mcp:production
```

### Docker Swarm Deployment

```yaml
# docker-stack.yml
version: '3.8'
services:
  neo-mcp:
    image: r3enetwork/neo-n3-mcp:latest
    ports:
      - "3000:3000"
    environment:
      - NEO_NETWORK=mainnet
    volumes:
      - neo-mcp-logs:/app/logs
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

```bash
# Deploy to swarm
docker stack deploy -c docker-stack.yml neo-mcp-stack
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neo-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: neo-mcp
  template:
    metadata:
      labels:
        app: neo-mcp
    spec:
      containers:
      - name: neo-mcp
        image: r3enetwork/neo-n3-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEO_NETWORK
          value: "mainnet"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
```

## Monitoring

### Enable Monitoring Stack

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access Grafana
open http://localhost:3001
# Login: admin/admin

# Access Prometheus
open http://localhost:9090
```

### Custom Metrics

The server exposes metrics at `/metrics` endpoint:

```bash
# View metrics
curl http://localhost:3000/metrics

# Sample metrics
neo_mcp_requests_total{method="get_balance"} 42
neo_mcp_request_duration_seconds{method="get_balance"} 0.123
neo_mcp_active_connections 5
```

### Health Checks

```bash
# Container health check
docker ps --format "table {{.Names}}\t{{.Status}}"

# Application health check
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.5.0"
}
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker logs neo-n3-mcp-server

# Check configuration
docker run --rm r3enetwork/neo-n3-mcp:latest cat /app/config/docker.json

# Validate environment
docker run --rm r3enetwork/neo-n3-mcp:latest env | grep NEO_
```

#### Network Connectivity Issues

```bash
# Test RPC connectivity from container
docker exec neo-n3-mcp-server curl -s https://mainnet1.neo.coz.io:443

# Check DNS resolution
docker exec neo-n3-mcp-server nslookup mainnet1.neo.coz.io
```

#### Performance Issues

```bash
# Check resource usage
docker stats neo-n3-mcp-server

# Check container limits
docker inspect neo-n3-mcp-server | grep -A 10 "Memory"

# View detailed logs
docker logs --details neo-n3-mcp-server
```

#### Permission Issues

```bash
# Check file permissions
docker exec neo-n3-mcp-server ls -la /app/logs /app/wallets

# Fix permissions
docker exec --user root neo-n3-mcp-server chown -R neo-mcp:nodejs /app/logs /app/wallets
```

### Debug Mode

```bash
# Run in debug mode
docker run -it --rm \
  -p 3000:3000 \
  -p 9229:9229 \
  -e NODE_ENV=development \
  -e LOG_LEVEL=debug \
  neo-n3-mcp:dev

# Attach debugger to localhost:9229
```

### Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Remove images
docker rmi neo-n3-mcp:latest neo-n3-mcp:dev

# Clean up everything
docker system prune -a
```

## Best Practices

### Security

1. **Use non-root user**: Images run as `neo-mcp` user
2. **Minimal base image**: Alpine Linux for smaller attack surface
3. **No secrets in environment**: Use Docker secrets or mounted files
4. **Regular updates**: Keep base images and dependencies updated

### Performance

1. **Multi-stage builds**: Separate build and runtime stages
2. **Layer caching**: Optimize Dockerfile for better caching
3. **Resource limits**: Set appropriate CPU and memory limits
4. **Health checks**: Implement proper health check endpoints

### Monitoring

1. **Structured logging**: Use JSON format for log aggregation
2. **Metrics collection**: Expose Prometheus metrics
3. **Distributed tracing**: Add tracing for complex operations
4. **Alerting**: Set up alerts for critical metrics

## Support

For issues and questions:

- **GitHub Issues**: https://github.com/r3e-network/neo-n3-mcp/issues
- **Documentation**: See README.md and other guides
- **Neo Community**: https://discord.gg/neo