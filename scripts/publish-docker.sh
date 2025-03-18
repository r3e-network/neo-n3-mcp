#!/bin/bash

VERSION=$(node -p "require('../package.json').version")
DOCKER_IMAGE="r3e/neo-n3-mcp"
DOCKER_TAG="$DOCKER_IMAGE:$VERSION"
DOCKER_LATEST="$DOCKER_IMAGE:latest"

echo "Building Docker image $DOCKER_TAG..."
docker build -t "$DOCKER_TAG" -t "$DOCKER_LATEST" ..

echo "Docker image built successfully."
echo "To push to Docker Hub, run:"
echo "docker push $DOCKER_TAG"
echo "docker push $DOCKER_LATEST" 