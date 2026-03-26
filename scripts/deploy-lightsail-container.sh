#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

get_service_state() {
  aws lightsail get-container-services \
    --region "$LIGHTSAIL_REGION" \
    --query "containerServices[?containerServiceName=='${LIGHTSAIL_SERVICE_NAME}'].state | [0]" \
    --output text \
    --no-cli-pager
}

wait_for_service_state() {
  local timeout_seconds="${1}"
  shift

  local start_time
  start_time="$(date +%s)"

  while true; do
    local state
    state="$(get_service_state)"

    for expected in "$@"; do
      if [[ "$state" == "$expected" ]]; then
        return 0
      fi
    done

    if (( "$(date +%s)" - start_time >= timeout_seconds )); then
      echo "Timed out waiting for Lightsail service state. Last state: ${state}" >&2
      exit 1
    fi

    sleep 5
  done
}

require_env "IMAGE_URI"
require_env "LIGHTSAIL_REGION"
require_env "LIGHTSAIL_SERVICE_NAME"

LIGHTSAIL_POWER="${LIGHTSAIL_POWER:-nano}"
LIGHTSAIL_SCALE="${LIGHTSAIL_SCALE:-1}"
LIGHTSAIL_CONTAINER_NAME="${LIGHTSAIL_CONTAINER_NAME:-app}"
LIGHTSAIL_CONTAINER_PORT="${LIGHTSAIL_CONTAINER_PORT:-8080}"
LIGHTSAIL_HEALTH_CHECK_PATH="${LIGHTSAIL_HEALTH_CHECK_PATH:-/health}"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8080}"
export LOG_FORMAT="${LOG_FORMAT:-json}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export SESSION_COOKIE_SECURE="${SESSION_COOKIE_SECURE:-true}"

service_count="$(
  aws lightsail get-container-services \
    --region "$LIGHTSAIL_REGION" \
    --query "length(containerServices[?containerServiceName=='${LIGHTSAIL_SERVICE_NAME}'])" \
    --output text \
    --no-cli-pager
)"

if [[ "$service_count" == "0" ]]; then
  aws lightsail create-container-service \
    --region "$LIGHTSAIL_REGION" \
    --service-name "$LIGHTSAIL_SERVICE_NAME" \
    --power "$LIGHTSAIL_POWER" \
    --scale "$LIGHTSAIL_SCALE" \
    --no-cli-pager >/dev/null
fi

wait_for_service_state 600 READY RUNNING

environment_json="$(jq -n \
  --arg NODE_ENV "$NODE_ENV" \
  --arg PORT "$PORT" \
  --arg LOG_FORMAT "$LOG_FORMAT" \
  --arg LOG_LEVEL "$LOG_LEVEL" \
  --arg SESSION_COOKIE_SECURE "$SESSION_COOKIE_SECURE" \
  '{
    NODE_ENV: $NODE_ENV,
    PORT: $PORT,
    LOG_FORMAT: $LOG_FORMAT,
    LOG_LEVEL: $LOG_LEVEL,
    SESSION_COOKIE_SECURE: $SESSION_COOKIE_SECURE
  }')"

optional_env_vars=(
  CLICKUP_API_BASE_URL
  CLICKUP_OAUTH_AUTHORIZE_URL
  CLICKUP_CLIENT_ID
  CLICKUP_CLIENT_SECRET
  CLICKUP_REDIRECT_URI
  CLICKUP_TARGET_TEAM_ID
  CLICKUP_TARGET_LIST_ID
  CLICKUP_READ_CACHE_TTL_MS
  CLICKUP_HTTP_TIMEOUT_MS
  SESSION_SECRET
)

for name in "${optional_env_vars[@]}"; do
  value="${!name:-}"
  if [[ -n "$value" ]]; then
    environment_json="$(jq --arg key "$name" --arg value "$value" '. + {($key): $value}' <<<"$environment_json")"
  fi
done

containers_json="$(jq -n \
  --arg name "$LIGHTSAIL_CONTAINER_NAME" \
  --arg image "$IMAGE_URI" \
  --arg port "$LIGHTSAIL_CONTAINER_PORT" \
  --argjson environment "$environment_json" \
  '{
    ($name): {
      image: $image,
      environment: $environment,
      ports: {
        ($port): "HTTP"
      }
    }
  }')"

public_endpoint_json="$(jq -n \
  --arg name "$LIGHTSAIL_CONTAINER_NAME" \
  --arg port "$LIGHTSAIL_CONTAINER_PORT" \
  --arg path "$LIGHTSAIL_HEALTH_CHECK_PATH" \
  '{
    containerName: $name,
    containerPort: ($port | tonumber),
    healthCheck: {
      path: $path,
      successCodes: "200-399"
    }
  }')"

aws lightsail create-container-service-deployment \
  --region "$LIGHTSAIL_REGION" \
  --service-name "$LIGHTSAIL_SERVICE_NAME" \
  --containers "$containers_json" \
  --public-endpoint "$public_endpoint_json" \
  --no-cli-pager >/dev/null

wait_for_service_state 900 RUNNING

aws lightsail get-container-services \
  --region "$LIGHTSAIL_REGION" \
  --query "containerServices[?containerServiceName=='${LIGHTSAIL_SERVICE_NAME}'].url | [0]" \
  --output text \
  --no-cli-pager
