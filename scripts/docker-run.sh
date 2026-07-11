#!/usr/bin/env bash

set -euo pipefail

image="neo-n3-mcp:latest"
container_name="neo-n3-mcp-server"
bind_address="127.0.0.1"
port="3000"
network="mainnet"
detached=false
remove=false
replace=false
env_file=""
replacement_backup=""
replacement_original_running=false
replacement_prepared=false
replacement_attempts="${NEO_MCP_REPLACEMENT_ATTEMPTS:-60}"

usage() {
  cat <<'EOF'
Usage: scripts/docker-run.sh [options]

Set HTTP_API_KEY to a value of at least 32 bytes, or provide an env file.

Options:
  -i, --image IMAGE         Image to run (default: neo-n3-mcp:latest)
  -n, --name NAME           Container name (default: neo-n3-mcp-server)
  -b, --bind ADDRESS        Host bind address (default: 127.0.0.1)
  -p, --port PORT           Host port (default: 3000)
  -N, --network NETWORK     Neo network: mainnet or testnet
  -d, --detach              Run in the background
  -r, --rm                  Remove the container when it exits
      --replace             Replace an existing container with the same name
  -e, --env-file FILE       Load additional environment variables from FILE
  -h, --help                Show this help
EOF
}

require_value() {
  if [[ $# -lt 2 || -z "$2" ]]; then
    echo "Missing value for $1" >&2
    usage >&2
    exit 2
  fi
}

rollback_replacement() {
  local exit_code=$?
  trap - EXIT

  if [[ "$replacement_prepared" == true ]]; then
    echo "Replacement failed; restoring ${container_name}" >&2
    docker rm --force "$container_name" >/dev/null 2>&1 || true
    if docker rename "$replacement_backup" "$container_name" >/dev/null 2>&1; then
      if [[ "$replacement_original_running" == true ]] && ! docker start "$container_name" >/dev/null 2>&1; then
        echo "Unable to restart restored container ${container_name}; it remains available as ${container_name} but is stopped" >&2
      fi
    else
      echo "Unable to restore previous container; it remains named ${replacement_backup}" >&2
    fi
  fi

  exit "$exit_code"
}

wait_for_replacement_health() {
  local attempt state running health

  for ((attempt = 1; attempt <= replacement_attempts; attempt += 1)); do
    if ! state="$(
      docker inspect \
        --format '{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
        "$container_name"
    )"; then
      echo "Unable to inspect replacement container ${container_name}" >&2
      return 1
    fi
    read -r running health <<< "$state"

    if [[ "$running" != true ]]; then
      echo "Replacement container ${container_name} stopped before becoming healthy" >&2
      return 1
    fi
    case "$health" in
      healthy)
        return 0
        ;;
      unhealthy)
        echo "Replacement container ${container_name} is unhealthy" >&2
        return 1
        ;;
      missing)
        echo "Replacement image ${image} does not define a health check" >&2
        return 1
        ;;
    esac

    sleep 1
  done

  echo "Replacement container ${container_name} did not become healthy within ${replacement_attempts} seconds" >&2
  return 1
}

wait_for_replacement_readiness() {
  local attempt

  for ((attempt = 1; attempt <= replacement_attempts; attempt += 1)); do
    if docker exec "$container_name" node -e \
      "require('http').get('http://127.0.0.1:3000/health',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Replacement container ${container_name} did not become RPC-ready within ${replacement_attempts} seconds" >&2
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--image)
      require_value "$@"
      image="$2"
      shift 2
      ;;
    -n|--name)
      require_value "$@"
      container_name="$2"
      shift 2
      ;;
    -b|--bind)
      require_value "$@"
      bind_address="$2"
      shift 2
      ;;
    -p|--port)
      require_value "$@"
      port="$2"
      shift 2
      ;;
    -N|--network)
      require_value "$@"
      network="$2"
      shift 2
      ;;
    -d|--detach)
      detached=true
      shift
      ;;
    -r|--rm)
      remove=true
      shift
      ;;
    --replace)
      replace=true
      shift
      ;;
    -e|--env-file)
      require_value "$@"
      env_file="$2"
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

if [[ "$network" != mainnet && "$network" != testnet ]]; then
  echo "Invalid network: $network" >&2
  exit 2
fi

if [[ ! "$replacement_attempts" =~ ^[0-9]+$ ]] || (( replacement_attempts < 1 )); then
  echo "Invalid NEO_MCP_REPLACEMENT_ATTEMPTS: ${replacement_attempts}" >&2
  exit 2
fi

if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "Invalid port: $port" >&2
  exit 2
fi

if [[ -n "$env_file" && ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 2
fi

if [[ -z "$env_file" && -z "${HTTP_API_KEY:-}" ]]; then
  echo "HTTP_API_KEY must be exported or supplied through --env-file" >&2
  exit 2
fi

if docker container inspect "$container_name" >/dev/null 2>&1; then
  if [[ "$replace" != true ]]; then
    echo "Container $container_name already exists; use --replace to replace it" >&2
    exit 2
  fi
  replacement_backup="${container_name}-replace-backup-$$"
  if docker container inspect "$replacement_backup" >/dev/null 2>&1; then
    echo "Replacement backup name already exists: $replacement_backup" >&2
    exit 2
  fi

  replacement_original_running="$(docker inspect --format '{{.State.Running}}' "$container_name")"
  if [[ "$replacement_original_running" != true && "$replacement_original_running" != false ]]; then
    echo "Unable to determine whether ${container_name} is running" >&2
    exit 1
  fi

  trap rollback_replacement EXIT
  docker rename "$container_name" "$replacement_backup"
  replacement_prepared=true
  if [[ "$replacement_original_running" == true ]]; then
    docker stop "$replacement_backup" >/dev/null
  fi
fi

args=(
  docker run
  --name "$container_name"
  --read-only
  --tmpfs "/tmp:rw,noexec,nosuid,size=64m,mode=1777"
  --cap-drop ALL
  --security-opt no-new-privileges:true
  --pids-limit 256
  --memory 512m
  --cpus 1
  --stop-timeout 30
  --publish "${bind_address}:${port}:3000"
  --env "NEO_NETWORK=${network}"
  --env HTTP_HOST=0.0.0.0
  --env WALLETS_DIR=/app/wallets
  --env LOG_CONSOLE=true
  --volume neo-mcp-wallets:/app/wallets
)

if [[ "$detached" == true || "$replacement_prepared" == true ]]; then
  args+=(--detach)
fi
if [[ "$remove" == true ]]; then
  args+=(--rm)
fi
if [[ -n "$env_file" ]]; then
  args+=(--env-file "$env_file")
else
  args+=(--env HTTP_API_KEY)
fi
args+=("$image")

echo "Starting ${container_name} from ${image} on ${bind_address}:${port}"
if [[ "$replacement_prepared" != true ]]; then
  "${args[@]}"
  exit 0
fi

if ! "${args[@]}"; then
  echo "Unable to start replacement container ${container_name}" >&2
  exit 1
fi
if ! wait_for_replacement_health; then
  exit 1
fi
if ! wait_for_replacement_readiness; then
  exit 1
fi

if docker rm --force "$replacement_backup" >/dev/null; then
  replacement_prepared=false
  trap - EXIT
else
  echo "Replacement is healthy, but previous container remains named ${replacement_backup}" >&2
  replacement_prepared=false
  trap - EXIT
  exit 1
fi

if [[ "$detached" != true ]]; then
  docker attach --sig-proxy=true "$container_name"
fi
