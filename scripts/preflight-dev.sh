#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-2}"
STAGE="${STAGE:-dev}"
SSM_PREFIX="${SSM_PREFIX:-/watchcircle}"
TABLE_NAME="WatchCircle-${STAGE}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command '$cmd' is not installed" >&2
    exit 1
  fi
}

require_cmd aws

echo "Preflight: region=${AWS_REGION}, stage=${STAGE}"

echo "- Checking DynamoDB app table"
aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" >/dev/null

echo "- Checking SSM parameters"
aws ssm get-parameter --name "${SSM_PREFIX}/${STAGE}/session-jwt-secret" --with-decryption --region "$AWS_REGION" >/dev/null
aws ssm get-parameter --name "${SSM_PREFIX}/${STAGE}/ws-jwt-secret" --with-decryption --region "$AWS_REGION" >/dev/null
aws ssm get-parameter --name "${SSM_PREFIX}/${STAGE}/ses-from-email" --region "$AWS_REGION" >/dev/null

echo "- Checking SES sender identity status"
SES_FROM_EMAIL="$(aws ssm get-parameter --name "${SSM_PREFIX}/${STAGE}/ses-from-email" --region "$AWS_REGION" --query 'Parameter.Value' --output text)"
STATUS="$(aws sesv2 get-email-identity --email-identity "$SES_FROM_EMAIL" --region "$AWS_REGION" --query 'VerificationStatus' --output text)"

if [[ "$STATUS" != "SUCCESS" ]]; then
  echo "error: SES identity '$SES_FROM_EMAIL' is not verified (status=$STATUS)" >&2
  exit 1
fi

echo "Preflight passed."
