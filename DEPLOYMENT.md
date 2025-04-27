# Neo N3 MCP Deployment

This document provides information on how to deploy the Neo N3 Model Context Protocol (MCP) implementation in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Deployment](#local-deployment)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying the Neo N3 MCP, ensure you have the following:

- Node.js 16.x or higher
- npm or yarn
- Git (for cloning the repository)
- Docker (for Docker deployment)
- Access to Neo N3 RPC nodes

## Local Deployment

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/neo-n3-mcp.git
cd neo-n3-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

### Running the MCP Server

The Neo N3 MCP can be run in two modes:

1. **Standard Mode** - Uses standard input/output for communication
```bash
npm start
```

2. **HTTP Server Mode** - Exposes an HTTP endpoint for communication
```bash
npm run start:http
```

By default, the HTTP server listens on port 5000. You can change this by setting the PORT environment variable:

```bash
PORT=8080 npm run start:http
```

### Running as a Service

To run the Neo N3 MCP as a service on Linux, you can use systemd:

1. Create a systemd service file:
```bash
sudo nano /etc/systemd/system/neo-n3-mcp.service
```

2. Add the following content:
```
[Unit]
Description=Neo N3 MCP
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/neo-n3-mcp
ExecStart=/usr/bin/npm run start:http
Restart=on-failure
Environment=PORT=5000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl enable neo-n3-mcp
sudo systemctl start neo-n3-mcp
```

4. Check the service status:
```bash
sudo systemctl status neo-n3-mcp
```

## Docker Deployment

### Building the Docker Image

1. Build the Docker image:
```bash
npm run publish:docker
```

This will create a Docker image named `r3e/neo-n3-mcp:latest`.

### Running the Docker Container

1. Run the Docker container:
```bash
docker run -p 5000:5000 r3e/neo-n3-mcp:latest
```

This will start the Neo N3 MCP HTTP server on port 5000.

### Docker Compose

You can also use Docker Compose to run the Neo N3 MCP:

1. Create a `docker-compose.yml` file:
```yaml
version: '3'
services:
  neo-n3-mcp:
    image: r3e/neo-n3-mcp:latest
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - NODE_ENV=production
    restart: always
```

2. Start the services:
```bash
docker-compose up -d
```

## Cloud Deployment

### AWS Deployment

To deploy the Neo N3 MCP on AWS:

1. Create an EC2 instance with Amazon Linux 2.
2. Install Node.js, npm, and Git.
3. Clone the repository and install dependencies.
4. Build the project.
5. Run the MCP server as a service.

Alternatively, you can use AWS Elastic Beanstalk:

1. Create a new Elastic Beanstalk application.
2. Choose the Node.js platform.
3. Upload a ZIP file containing the Neo N3 MCP code.
4. Configure environment variables.
5. Deploy the application.

### Google Cloud Deployment

To deploy the Neo N3 MCP on Google Cloud:

1. Create a Compute Engine instance.
2. Install Node.js, npm, and Git.
3. Clone the repository and install dependencies.
4. Build the project.
5. Run the MCP server as a service.

Alternatively, you can use Google App Engine:

1. Create a new App Engine application.
2. Choose the Node.js standard environment.
3. Deploy the application using the gcloud CLI.

### Azure Deployment

To deploy the Neo N3 MCP on Azure:

1. Create a Virtual Machine with Ubuntu.
2. Install Node.js, npm, and Git.
3. Clone the repository and install dependencies.
4. Build the project.
5. Run the MCP server as a service.

Alternatively, you can use Azure App Service:

1. Create a new App Service.
2. Choose the Node.js runtime.
3. Deploy the application using the Azure CLI or Visual Studio Code.

## Configuration

The Neo N3 MCP can be configured using environment variables:

- `PORT`: The port to listen on (default: 5000)
- `NODE_ENV`: The environment (development, production)
- `MAINNET_RPC_URL`: The URL of the mainnet RPC node
- `TESTNET_RPC_URL`: The URL of the testnet RPC node
- `NETWORK_MODE`: The network mode (mainnet, testnet, both)
- `LOG_LEVEL`: The log level (debug, info, warn, error)

You can set these environment variables in various ways:

1. In the terminal:
```bash
PORT=8080 NODE_ENV=production npm run start:http
```

2. In a `.env` file:
```
PORT=8080
NODE_ENV=production
MAINNET_RPC_URL=https://mainnet1.neo.coz.io:443
TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
NETWORK_MODE=both
LOG_LEVEL=info
```

3. In your deployment platform's configuration.

## Monitoring

### Logging

The Neo N3 MCP uses a structured logging system that outputs logs in JSON format. You can configure the log level using the `LOG_LEVEL` environment variable.

To view the logs:

1. In local deployment:
```bash
npm run start:http > mcp.log 2>&1
```

2. In Docker deployment:
```bash
docker logs -f neo-n3-mcp
```

3. In systemd service:
```bash
journalctl -u neo-n3-mcp -f
```

### Health Checks

The Neo N3 MCP provides a health check endpoint at `/health` that returns the status of the service.

To check the health of the service:
```bash
curl http://localhost:5000/health
```

### Metrics

The Neo N3 MCP can be configured to expose metrics for monitoring systems like Prometheus.

To enable metrics:
1. Set the `ENABLE_METRICS` environment variable to `true`.
2. Access the metrics endpoint at `/metrics`.

## Scaling

### Horizontal Scaling

To scale the Neo N3 MCP horizontally:

1. Deploy multiple instances of the MCP server.
2. Use a load balancer to distribute traffic between the instances.
3. Ensure that each instance has access to the same Neo N3 RPC nodes.

### Vertical Scaling

To scale the Neo N3 MCP vertically:

1. Increase the resources (CPU, memory) of the server running the MCP.
2. Adjust the Node.js memory limits if necessary.

## Security

### Network Security

1. Use HTTPS for all communication with the MCP server.
2. Configure a firewall to restrict access to the MCP server.
3. Use a reverse proxy like Nginx to add additional security layers.

### Authentication

1. Implement API key authentication for the MCP server.
2. Use OAuth or JWT for more advanced authentication.
3. Implement rate limiting to prevent abuse.

### Encryption

1. Use HTTPS to encrypt all communication with the MCP server.
2. Ensure that sensitive data like private keys are encrypted at rest.
3. Use secure environment variables for storing secrets.

## Troubleshooting

### Common Issues

#### Connection Refused

If you get a "Connection Refused" error:
1. Check that the MCP server is running.
2. Verify that the port is correct.
3. Ensure that the firewall allows connections to the port.

#### RPC Node Unavailable

If the RPC node is unavailable:
1. Check the RPC node URL.
2. Verify that the RPC node is running.
3. Try using a different RPC node.

#### Out of Memory

If the MCP server runs out of memory:
1. Increase the Node.js memory limit.
2. Optimize the code to reduce memory usage.
3. Use a larger server with more memory.

### Getting Help

If you encounter issues that you cannot resolve, please:

1. Check the [Neo N3 MCP documentation](https://docs.neo.org/mcp)
2. Join the [Neo Discord community](https://discord.gg/neo)
3. Open an issue on the [Neo N3 MCP GitHub repository](https://github.com/neo-project/neo-n3-mcp)
