#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Run dev smoke setup using deployed dev endpoints.

Required env vars:
  HOST_EMAIL                 Verified SES recipient email

Optional env vars:
  HOST_DISPLAY               Default: Host
  PARTICIPANT_EMAIL          Optional second user (must be SES-verified in sandbox)
  PARTICIPANT_DISPLAY        Default: Participant
  CODE_SOURCE                manual|dynamo (default: manual)
  TABLE_NAME                 Required when CODE_SOURCE=dynamo (default: WatchCircle-dev)
  AWS_REGION                 Default: us-east-2
  STAGE                      Default: dev

Examples:
  HOST_EMAIL=host@example.com npm run smoke:dev

  HOST_EMAIL=host@example.com \
  PARTICIPANT_EMAIL=guest@example.com \
  npm run smoke:dev
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command '$cmd' is not installed" >&2
    exit 1
  fi
}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${STAGE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-2}"
CODE_SOURCE="${CODE_SOURCE:-manual}"
TABLE_NAME="${TABLE_NAME:-WatchCircle-${STAGE}}"

HOST_EMAIL="${HOST_EMAIL:-}"
HOST_DISPLAY="${HOST_DISPLAY:-Host}"
PARTICIPANT_EMAIL="${PARTICIPANT_EMAIL:-}"
PARTICIPANT_DISPLAY="${PARTICIPANT_DISPLAY:-Participant}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$HOST_EMAIL" ]]; then
  echo "error: HOST_EMAIL is required" >&2
  usage
  exit 1
fi

require_cmd npx
require_cmd node

fetch_api_base_url() {
  local info
  info="$(AWS_REGION="$AWS_REGION" npx serverless info --stage "$STAGE")"

  node -e '
    const input = require("node:fs").readFileSync(0, "utf8");
    const match = input.match(/POST - (https:\/\/[^\s]+)\/auth\/request/);
    if (!match) process.exit(1);
    process.stdout.write(match[1]);
  ' <<<"$info"
}

fetch_ws_base_url() {
  local info
  info="$(AWS_REGION="$AWS_REGION" npx serverless info --stage "$STAGE")"

  node -e '
    const input = require("node:fs").readFileSync(0, "utf8");
    const match = input.match(/endpoint:\s*(wss:\/\/[^\s]+)/);
    if (!match) process.exit(1);
    process.stdout.write(match[1]);
  ' <<<"$info"
}

API_BASE_URL="$(fetch_api_base_url)" || {
  echo "error: failed to resolve app-api URL from serverless info" >&2
  exit 1
}

WS_BASE_URL="$(fetch_ws_base_url)" || {
  echo "error: failed to resolve app-ws URL from serverless info" >&2
  exit 1
}

echo "Using API base URL: $API_BASE_URL"
echo "Using WS base URL:  $WS_BASE_URL"

args=(
  --api-base-url "$API_BASE_URL"
  --ws-base-url "$WS_BASE_URL"
  --host-email "$HOST_EMAIL"
  --host-display "$HOST_DISPLAY"
  --code-source "$CODE_SOURCE"
  --aws-region "$AWS_REGION"
)

if [[ "$CODE_SOURCE" == "dynamo" ]]; then
  args+=(--table-name "$TABLE_NAME")
fi

if [[ -n "$PARTICIPANT_EMAIL" ]]; then
  args+=(
    --participant-email "$PARTICIPANT_EMAIL"
    --participant-display "$PARTICIPANT_DISPLAY"
  )
fi

bash "$ROOT_DIR/scripts/smoke-auth-chat.sh" "${args[@]}"
