#!/bin/bash

# Docker build script for Neo N3 MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="neo-n3-mcp"
TAG="latest"
BUILD_TYPE="production"
PUSH=false
REGISTRY=""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -t, --tag TAG           Set image tag (default: latest)"
    echo "  -n, --name NAME         Set image name (default: neo-n3-mcp)"
    echo "  -d, --dev               Build development image"
    echo "  -p, --push              Push image to registry"
    echo "  -r, --registry REGISTRY Set registry URL"
    echo "  -h, --help              Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -d|--dev)
            BUILD_TYPE="development"
            shift
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
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

# Set full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"
else
    FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
fi

echo -e "${GREEN}Building Neo N3 MCP Docker image...${NC}"
echo -e "Image: ${YELLOW}$FULL_IMAGE_NAME${NC}"
echo -e "Build type: ${YELLOW}$BUILD_TYPE${NC}"

# Build the image
if [ "$BUILD_TYPE" = "development" ]; then
    echo -e "${GREEN}Building development image...${NC}"
    docker build -f docker/Dockerfile.dev -t "$FULL_IMAGE_NAME" --target development .
else
    echo -e "${GREEN}Building production image...${NC}"
    docker build -f docker/Dockerfile -t "$FULL_IMAGE_NAME" --target production .
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    
    # Show image info
    echo -e "${GREEN}Image details:${NC}"
    docker images "$FULL_IMAGE_NAME"
    
    # Push if requested
    if [ "$PUSH" = true ]; then
        echo -e "${GREEN}Pushing image to registry...${NC}"
        docker push "$FULL_IMAGE_NAME"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Push completed successfully!${NC}"
        else
            echo -e "${RED}❌ Push failed!${NC}"
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Ready to run with:${NC}"
echo -e "  ${YELLOW}docker run -p 3000:3000 $FULL_IMAGE_NAME${NC}"
echo -e "  ${YELLOW}docker-compose up${NC}"