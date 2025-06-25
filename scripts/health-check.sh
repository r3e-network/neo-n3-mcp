#!/bin/bash

# Health check script for Neo N3 MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
HOST="localhost"
PORT="3000"
TIMEOUT=10
VERBOSE=false

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -h, --host HOST         Server host (default: localhost)"
    echo "  -p, --port PORT         Server port (default: 3000)"
    echo "  -t, --timeout TIMEOUT   Request timeout in seconds (default: 10)"
    echo "  -v, --verbose           Verbose output"
    echo "  --help                  Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option $1"
            usage
            ;;
    esac
done

echo -e "${BLUE}🏥 Neo N3 MCP Server Health Check${NC}"
echo -e "Target: ${YELLOW}$HOST:$PORT${NC}"
echo -e "Timeout: ${YELLOW}${TIMEOUT}s${NC}"
echo ""

# Check if server is responding
echo -e "${BLUE}📡 Checking server connectivity...${NC}"
if curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is responding${NC}"
else
    echo -e "${RED}❌ Server is not responding${NC}"
    exit 1
fi

# Check health endpoint
echo -e "${BLUE}🔍 Checking health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/health" 2>/dev/null || echo "")

if [ -n "$HEALTH_RESPONSE" ]; then
    echo -e "${GREEN}✅ Health endpoint accessible${NC}"
    if [ "$VERBOSE" = true ]; then
        echo -e "${YELLOW}Response: $HEALTH_RESPONSE${NC}"
    fi
else
    echo -e "${RED}❌ Health endpoint not accessible${NC}"
    exit 1
fi

# Check if it's a valid JSON response
if echo "$HEALTH_RESPONSE" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Valid JSON response${NC}"
    
    # Extract status if available
    STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"' 2>/dev/null)
    if [ "$STATUS" = "ok" ] || [ "$STATUS" = "healthy" ]; then
        echo -e "${GREEN}✅ Server reports healthy status${NC}"
    else
        echo -e "${YELLOW}⚠️  Server status: $STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Response is not valid JSON${NC}"
fi

# Check MCP protocol endpoint (if available)
echo -e "${BLUE}🔌 Checking MCP protocol...${NC}"
if curl -f -s --max-time $TIMEOUT "http://$HOST:$PORT/mcp" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️  MCP endpoint not accessible (may be stdio-only)${NC}"
fi

# Check process if running locally
if [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
    echo -e "${BLUE}🔍 Checking local process...${NC}"
    
    # Check if neo-mcp process is running
    if pgrep -f "neo.*mcp" > /dev/null; then
        echo -e "${GREEN}✅ Neo MCP process found${NC}"
        if [ "$VERBOSE" = true ]; then
            echo -e "${YELLOW}Process info:${NC}"
            pgrep -f "neo.*mcp" | head -5 | while read pid; do
                echo "  PID: $pid"
            done
        fi
    else
        echo -e "${YELLOW}⚠️  No Neo MCP process found${NC}"
    fi
    
    # Check port usage
    if netstat -tuln 2>/dev/null | grep ":$PORT " > /dev/null; then
        echo -e "${GREEN}✅ Port $PORT is in use${NC}"
    else
        echo -e "${YELLOW}⚠️  Port $PORT not found in netstat${NC}"
    fi
fi

# Docker health check
echo -e "${BLUE}🐳 Checking Docker containers...${NC}"
if command -v docker > /dev/null 2>&1; then
    DOCKER_CONTAINERS=$(docker ps --filter "name=neo" --filter "status=running" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "")
    
    if [ -n "$DOCKER_CONTAINERS" ] && [ "$DOCKER_CONTAINERS" != "NAMES	STATUS" ]; then
        echo -e "${GREEN}✅ Neo Docker containers found${NC}"
        if [ "$VERBOSE" = true ]; then
            echo -e "${YELLOW}Running containers:${NC}"
            echo "$DOCKER_CONTAINERS"
        fi
    else
        echo -e "${YELLOW}⚠️  No running Neo Docker containers found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker not available${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Health check completed successfully!${NC}"
echo -e "${BLUE}Server appears to be healthy and operational${NC}"

exit 0