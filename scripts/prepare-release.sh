#!/usr/bin/env bash

set -euo pipefail

version_type="patch"
dry_run=false
skip_docker=false

usage() {
  cat <<'EOF'
Usage: scripts/prepare-release.sh [options]

Options:
  -t, --type TYPE     Version type: patch, minor, or major
  -d, --dry-run       Verify the release without changing the version
      --skip-docker   Skip local container builds
  -h, --help          Show this help
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
    -t|--type)
      require_value "$@"
      version_type="$2"
      shift 2
      ;;
    -d|--dry-run)
      dry_run=true
      shift
      ;;
    --skip-docker)
      skip_docker=true
      shift
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

if [[ ! "$version_type" =~ ^(patch|minor|major)$ ]]; then
  echo "Invalid version type: $version_type" >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Release preparation requires a clean working tree" >&2
  exit 1
fi

echo "Installing the audited lockfile"
npm ci
npm run type-check
npm run test:unit -- --runInBand
npm run build
npm run test:mcp
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm pack --dry-run

compose_api_key="release-check-api-key-000000000000"
compose_mcp_bearer="release-check-mcp-bearer-00000000"
compose_image_digest=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
if [[ ! "$compose_image_digest" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Registry Compose validation requires a 64-character lowercase hexadecimal digest" >&2
  exit 1
fi
HTTP_API_KEY="$compose_api_key" MCP_HTTP_BEARER="$compose_mcp_bearer" \
  docker compose -f docker/docker-compose.yml config >/dev/null
HTTP_API_KEY="$compose_api_key" \
  MCP_HTTP_BEARER="$compose_mcp_bearer" \
  NEO_MCP_IMAGE_REPOSITORY=neo-n3-mcp \
  NEO_MCP_IMAGE_DIGEST="$compose_image_digest" \
  docker compose -f docker/docker-compose.yml -f docker/docker-compose.registry.yml config >/dev/null
docker compose -f docker/docker-compose.dev.yml config >/dev/null

if [[ "$skip_docker" != true ]]; then
  docker build --file docker/Dockerfile --target production --tag neo-n3-mcp:release-check .
  docker build --file docker/Dockerfile.dev --target development --tag neo-n3-mcp:release-check-dev .
fi

if [[ "$dry_run" == true ]]; then
  echo "Release verification passed; version was not changed"
  exit 0
fi

new_version=$(npm version "$version_type" --no-git-tag-version)
echo "Prepared ${new_version}. Review package.json and package-lock.json, then commit and tag the release."
