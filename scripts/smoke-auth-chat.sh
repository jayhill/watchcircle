#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  smoke-auth-chat.sh \
    --api-base-url https://app-api-dev.example.com \
    --ws-base-url wss://app-ws-dev.example.com \
    --host-email host@example.com \
    --host-display "Host User" \
    [--participant-email user@example.com --participant-display "Participant User"] \
    [--event-id evt_123] \
    [--code-source manual|dynamo] \
    [--table-name WatchCircle-dev] \
    [--aws-region us-east-2]

Notes:
  - If --event-id is omitted, the script creates a new event as host.
  - code-source=manual prompts for verification codes unless provided via env vars.
  - code-source=dynamo scans the table for TOKEN records (dev only).

Verification code env vars:
  HOST_VERIFY_CODE
  PARTICIPANT_VERIFY_CODE
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command '$cmd' is not installed" >&2
    exit 1
  fi
}

json_escape() {
  jq -Rn --arg value "$1" '$value'
}

api_post() {
  local base_url="$1"
  local path="$2"
  local body="$3"
  local auth_header="${4:-}"

  if [[ -n "$auth_header" ]]; then
    curl -sS -X POST "${base_url}${path}" \
      -H "content-type: application/json" \
      -H "authorization: Bearer ${auth_header}" \
      -d "$body"
  else
    curl -sS -X POST "${base_url}${path}" \
      -H "content-type: application/json" \
      -d "$body"
  fi
}

find_code_from_dynamo() {
  local table_name="$1"
  local aws_region="$2"
  local email="$3"
  local event_id="$4"

  local expr_values
  expr_values="$(jq -n \
    --arg prefix "TOKEN#" \
    --arg email "$email" \
    --arg eventId "$event_id" \
    '{":prefix": {"S": $prefix}, ":email": {"S": $email}, ":eventId": {"S": $eventId}}')"

  local result
  result="$(aws dynamodb scan \
    --region "$aws_region" \
    --table-name "$table_name" \
    --filter-expression "begins_with(PK,:prefix) AND #e = :email AND eventId = :eventId" \
    --expression-attribute-names '{"#e":"email"}' \
    --expression-attribute-values "$expr_values")"

  jq -r '
    (.Items // [])
    | sort_by((.createdAtEpoch.N // "0") | tonumber)
    | last
    | .token.S // empty
  ' <<<"$result"
}

resolve_code() {
  local label="$1"
  local code_source="$2"
  local table_name="$3"
  local aws_region="$4"
  local email="$5"
  local event_id="$6"

  local env_var_name
  env_var_name="${label}_VERIFY_CODE"
  local env_code="${!env_var_name:-}"

  if [[ -n "$env_code" ]]; then
    echo "$env_code"
    return 0
  fi

  if [[ "$code_source" == "dynamo" ]]; then
    local dyn_code
    dyn_code="$(find_code_from_dynamo "$table_name" "$aws_region" "$email" "$event_id")"
    if [[ -z "$dyn_code" ]]; then
      echo "error: unable to find verification code in DynamoDB for $email event $event_id" >&2
      exit 1
    fi
    echo "$dyn_code"
    return 0
  fi

  local manual_code
  read -r -p "Enter verification code for ${label} (${email}): " manual_code
  if [[ -z "$manual_code" ]]; then
    echo "error: verification code is required" >&2
    exit 1
  fi
  echo "$manual_code"
}

auth_and_ws_token() {
  local label="$1"
  local api_base_url="$2"
  local code_source="$3"
  local table_name="$4"
  local aws_region="$5"
  local email="$6"
  local display_name="$7"
  local event_id="$8"

  local request_body
  request_body="$(jq -n --arg email "$email" --arg eventId "$event_id" '{email: $email, eventId: $eventId}')"
  local request_response
  request_response="$(api_post "$api_base_url" "/auth/request" "$request_body")"
  if [[ "$(jq -r '.ok // empty' <<<"$request_response")" != "true" ]]; then
    echo "error: auth request failed for ${label}: $request_response" >&2
    exit 1
  fi

  local code
  code="$(resolve_code "$label" "$code_source" "$table_name" "$aws_region" "$email" "$event_id")"

  local verify_body
  verify_body="$(jq -n \
    --arg email "$email" \
    --arg eventId "$event_id" \
    --arg code "$code" \
    --arg displayName "$display_name" \
    '{email: $email, eventId: $eventId, code: $code, displayName: $displayName}')"

  local verify_response
  verify_response="$(api_post "$api_base_url" "/auth/verify" "$verify_body")"
  local session_token
  session_token="$(jq -r '.sessionToken // empty' <<<"$verify_response")"
  if [[ -z "$session_token" ]]; then
    echo "error: verify failed for ${label}: $verify_response" >&2
    exit 1
  fi

  local ws_request_body
  ws_request_body="$(jq -n --arg eventId "$event_id" '{eventId: $eventId}')"
  local ws_response
  ws_response="$(api_post "$api_base_url" "/auth/ws-token" "$ws_request_body" "$session_token")"
  local ws_token
  ws_token="$(jq -r '.wsToken // empty' <<<"$ws_response")"
  if [[ -z "$ws_token" ]]; then
    echo "error: ws token issuance failed for ${label}: $ws_response" >&2
    exit 1
  fi

  echo "$session_token|$ws_token"
}

API_BASE_URL=""
WS_BASE_URL=""
HOST_EMAIL=""
HOST_DISPLAY="Host"
PARTICIPANT_EMAIL=""
PARTICIPANT_DISPLAY="Participant"
EVENT_ID=""
CODE_SOURCE="manual"
TABLE_NAME=""
AWS_REGION="us-east-2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base-url)
      API_BASE_URL="$2"
      shift 2
      ;;
    --ws-base-url)
      WS_BASE_URL="$2"
      shift 2
      ;;
    --host-email)
      HOST_EMAIL="$2"
      shift 2
      ;;
    --host-display)
      HOST_DISPLAY="$2"
      shift 2
      ;;
    --participant-email)
      PARTICIPANT_EMAIL="$2"
      shift 2
      ;;
    --participant-display)
      PARTICIPANT_DISPLAY="$2"
      shift 2
      ;;
    --event-id)
      EVENT_ID="$2"
      shift 2
      ;;
    --code-source)
      CODE_SOURCE="$2"
      shift 2
      ;;
    --table-name)
      TABLE_NAME="$2"
      shift 2
      ;;
    --aws-region)
      AWS_REGION="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd curl
require_cmd jq

if [[ -z "$API_BASE_URL" || -z "$HOST_EMAIL" ]]; then
  echo "error: --api-base-url and --host-email are required" >&2
  usage
  exit 1
fi

if [[ -n "$PARTICIPANT_EMAIL" && "$CODE_SOURCE" == "dynamo" ]]; then
  echo "warning: --code-source=dynamo still requires /auth/request to succeed first." >&2
  echo "         If SES sandbox blocks recipient emails, either verify recipients in SES" >&2
  echo "         or run with participant omitted for initial smoke setup." >&2
fi

if [[ "$CODE_SOURCE" != "manual" && "$CODE_SOURCE" != "dynamo" ]]; then
  echo "error: --code-source must be manual or dynamo" >&2
  exit 1
fi

if [[ "$CODE_SOURCE" == "dynamo" ]]; then
  require_cmd aws
  if [[ -z "$TABLE_NAME" ]]; then
    echo "error: --table-name is required when --code-source=dynamo" >&2
    exit 1
  fi
fi

if [[ -z "$EVENT_ID" ]]; then
  local_create_body="$(jq -n \
    --arg title "Smoke Test Event" \
    --arg youtubeUrl "https://youtube.com/watch?v=dQw4w9WgXcQ" \
    --arg creatorEmail "$HOST_EMAIL" \
    '{title: $title, youtubeUrl: $youtubeUrl, creatorEmail: $creatorEmail}')"

  create_response="$(api_post "$API_BASE_URL" "/events" "$local_create_body")"
  EVENT_ID="$(jq -r '.event.eventId // empty' <<<"$create_response")"
  if [[ -z "$EVENT_ID" ]]; then
    echo "error: failed to create event: $create_response" >&2
    exit 1
  fi
  echo "Created event: $EVENT_ID"
else
  echo "Using existing event: $EVENT_ID"
fi

host_tokens="$(auth_and_ws_token "HOST" "$API_BASE_URL" "$CODE_SOURCE" "$TABLE_NAME" "$AWS_REGION" "$HOST_EMAIL" "$HOST_DISPLAY" "$EVENT_ID")"
HOST_SESSION_TOKEN="${host_tokens%%|*}"
HOST_WS_TOKEN="${host_tokens##*|}"

echo "Host verified and wsToken issued."

PARTICIPANT_SESSION_TOKEN=""
PARTICIPANT_WS_TOKEN=""
if [[ -n "$PARTICIPANT_EMAIL" ]]; then
  participant_tokens="$(auth_and_ws_token "PARTICIPANT" "$API_BASE_URL" "$CODE_SOURCE" "$TABLE_NAME" "$AWS_REGION" "$PARTICIPANT_EMAIL" "$PARTICIPANT_DISPLAY" "$EVENT_ID")"
  PARTICIPANT_SESSION_TOKEN="${participant_tokens%%|*}"
  PARTICIPANT_WS_TOKEN="${participant_tokens##*|}"
  echo "Participant verified and wsToken issued."
fi

echo
echo "Smoke setup complete"
echo "--------------------"
echo "eventId: $EVENT_ID"
echo "host ws token: $HOST_WS_TOKEN"
if [[ -n "$PARTICIPANT_WS_TOKEN" ]]; then
  echo "participant ws token: $PARTICIPANT_WS_TOKEN"
fi

if [[ -n "$WS_BASE_URL" ]]; then
  echo
  echo "Manual chat check"
  echo "-----------------"
  echo "Open two terminals with wscat (or websocat):"
  echo
  echo "Host:"
  echo "  wscat -c \"${WS_BASE_URL}?token=${HOST_WS_TOKEN}&eventId=${EVENT_ID}\""
  if [[ -n "$PARTICIPANT_WS_TOKEN" ]]; then
    echo
    echo "Participant:"
    echo "  wscat -c \"${WS_BASE_URL}?token=${PARTICIPANT_WS_TOKEN}&eventId=${EVENT_ID}\""
  fi
  echo
  echo "Then send from either connection:"
  echo "  {\"action\":\"chat:send\",\"payload\":{\"text\":\"hello from smoke\"}}"
fi
