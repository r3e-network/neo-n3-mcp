#!/usr/bin/env bash

set -euo pipefail

image_name="neo-mcp"
tag="latest"
target="production"
dockerfile="docker/Dockerfile"
push=false
registry=""

usage() {
  cat <<'EOF'
Usage: scripts/docker-build.sh [options]

Options:
  -t, --tag TAG            Image tag (default: latest)
  -n, --name NAME          Image name (default: neo-mcp)
  -d, --dev                Build the development image
  -p, --push               Push the image after a successful build
  -r, --registry REGISTRY  Prefix the image with a registry
  -h, --help               Show this help
EOF
}

require_value() {
  if [[ $# -lt 2 || -z "$2" ]]; then
    echo "Missing value for $1" >&2
    usage >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      require_value "$@"
      tag="$2"
      shift 2
      ;;
    -n|--name)
      require_value "$@"
      image_name="$2"
      shift 2
      ;;
    -d|--dev)
      target="development"
      dockerfile="docker/Dockerfile.dev"
      shift
      ;;
    -p|--push)
      push=true
      shift
      ;;
    -r|--registry)
      require_value "$@"
      registry="${2%/}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

image_ref="${image_name}:${tag}"
if [[ -n "$registry" ]]; then
  image_ref="${registry}/${image_ref}"
fi

echo "Building ${image_ref} from ${dockerfile} (${target})"
docker build --file "$dockerfile" --target "$target" --tag "$image_ref" .

if [[ "$push" == true ]]; then
  docker push "$image_ref"
fi

echo "Built ${image_ref}"
