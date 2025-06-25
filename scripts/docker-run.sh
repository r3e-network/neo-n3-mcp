#!/bin/bash

# Docker run script for Neo N3 MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="neo-n3-mcp:latest"
CONTAINER_NAME="neo-n3-mcp-server"
PORT="3000"
NETWORK="mainnet"
DETACHED=false
REMOVE=false
ENV_FILE=""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -i, --image IMAGE       Docker image to run (default: neo-n3-mcp:latest)"
    echo "  -n, --name NAME         Container name (default: neo-n3-mcp-server)"
    echo "  -p, --port PORT         Host port to bind (default: 3000)"
    echo "  -N, --network NETWORK   Neo network (mainnet/testnet, default: mainnet)"
    echo "  -d, --detach            Run in detached mode"
    echo "  -r, --rm                Remove container when it exits"
    echo "  -e, --env-file FILE     Load environment variables from file"
    echo "  -h, --help              Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -n|--name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -N|--network)
            NETWORK="$2"
            shift 2
            ;;
        -d|--detach)
            DETACHED=true
            shift
            ;;
        -r|--rm)
            REMOVE=true
            shift
            ;;
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option $1"
            usage
            ;;
    esac
done

# Validate network
if [[ "$NETWORK" != "mainnet" && "$NETWORK" != "testnet" ]]; then
    echo -e "${RED}❌ Invalid network: $NETWORK. Must be 'mainnet' or 'testnet'${NC}"
    exit 1
fi

# Build docker run command
DOCKER_CMD="docker run"

# Add flags
if [ "$DETACHED" = true ]; then
    DOCKER_CMD="$DOCKER_CMD -d"
fi

if [ "$REMOVE" = true ]; then
    DOCKER_CMD="$DOCKER_CMD --rm"
fi

# Add name
DOCKER_CMD="$DOCKER_CMD --name $CONTAINER_NAME"

# Add port mapping
DOCKER_CMD="$DOCKER_CMD -p $PORT:3000"

# Add environment variables
DOCKER_CMD="$DOCKER_CMD -e NEO_NETWORK=$NETWORK"
DOCKER_CMD="$DOCKER_CMD -e NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443"
DOCKER_CMD="$DOCKER_CMD -e NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443"
DOCKER_CMD="$DOCKER_CMD -e LOG_LEVEL=info"
DOCKER_CMD="$DOCKER_CMD -e LOG_CONSOLE=true"

# Add env file if specified
if [ -n "$ENV_FILE" ]; then
    if [ -f "$ENV_FILE" ]; then
        DOCKER_CMD="$DOCKER_CMD --env-file $ENV_FILE"
    else
        echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
        exit 1
    fi
fi

# Add volumes for persistent data
DOCKER_CMD="$DOCKER_CMD -v neo-mcp-logs:/app/logs"
DOCKER_CMD="$DOCKER_CMD -v neo-mcp-wallets:/app/wallets"

# Add image name
DOCKER_CMD="$DOCKER_CMD $IMAGE_NAME"

echo -e "${GREEN}Starting Neo N3 MCP Server...${NC}"
echo -e "Image: ${YELLOW}$IMAGE_NAME${NC}"
echo -e "Container: ${YELLOW}$CONTAINER_NAME${NC}"
echo -e "Port: ${YELLOW}$PORT${NC}"
echo -e "Network: ${YELLOW}$NETWORK${NC}"
echo -e "Command: ${YELLOW}$DOCKER_CMD${NC}"

# Stop existing container if it exists
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${YELLOW}Stopping existing container...${NC}"
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# Run the container
eval $DOCKER_CMD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container started successfully!${NC}"
    
    if [ "$DETACHED" = true ]; then
        echo -e "${GREEN}Container is running in detached mode${NC}"
        echo -e "View logs with: ${YELLOW}docker logs -f $CONTAINER_NAME${NC}"
        echo -e "Stop with: ${YELLOW}docker stop $CONTAINER_NAME${NC}"
    fi
    
    echo -e "${GREEN}🚀 Neo N3 MCP Server is available at:${NC}"
    echo -e "  ${YELLOW}http://localhost:$PORT${NC}"
else
    echo -e "${RED}❌ Failed to start container!${NC}"
    exit 1
fi