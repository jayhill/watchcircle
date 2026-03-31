#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<EOF
Bootstrap Terraform backend prerequisites for WatchCircle.

Usage:
  scripts/bootstrap-account.sh \
    --env dev \
    --region us-east-2 \
    --tf-state-bucket watchcircle-dev-tf-state

Required:
  --env              Environment name (dev, prod, etc.)
  --region           AWS region (example: us-east-2)
  --tf-state-bucket  Globally-unique S3 bucket name for Terraform state

Optional:
  --tf-lock-table    DynamoDB lock table name (default: watchcircle-<env>-tf-locks)

This script only creates backend prerequisites used by Terraform:
  1) Terraform state S3 bucket (versioning + encryption)
  2) Terraform lock DynamoDB table

Everything else is managed by Terraform and Serverless:
  - Terraform: GitHub OIDC provider, GitHub deploy role, policy attachments, config params
  - Serverless: application runtime resources (table, APIs, Lambda, WebSocket)
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command '$cmd' is not installed" >&2
    exit 1
  fi
}

ENV_NAME=""
AWS_REGION=""
TF_STATE_BUCKET=""
TF_LOCK_TABLE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_NAME="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --tf-state-bucket)
      TF_STATE_BUCKET="$2"
      shift 2
      ;;
    --tf-lock-table)
      TF_LOCK_TABLE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd aws

if [[ -z "$ENV_NAME" || -z "$AWS_REGION" || -z "$TF_STATE_BUCKET" ]]; then
  echo "error: missing required arguments" >&2
  usage
  exit 1
fi

if [[ -z "$TF_LOCK_TABLE" ]]; then
  TF_LOCK_TABLE="watchcircle-${ENV_NAME}-tf-locks"
fi

echo "Bootstrapping Terraform backend prerequisites for env '${ENV_NAME}' in region '${AWS_REGION}'"

echo "[1/2] Ensure Terraform state bucket exists: ${TF_STATE_BUCKET}"
if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
  echo "  - Bucket exists"
else
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$TF_STATE_BUCKET" \
      --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}"
  fi
  echo "  - Bucket created"
fi

aws s3api put-bucket-versioning \
  --bucket "$TF_STATE_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$TF_STATE_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "  - Versioning + encryption ensured"

echo "[2/2] Ensure Terraform lock table exists: ${TF_LOCK_TABLE}"
if aws dynamodb describe-table --table-name "$TF_LOCK_TABLE" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  - Table exists"
else
  aws dynamodb create-table \
    --table-name "$TF_LOCK_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
  aws dynamodb wait table-exists --table-name "$TF_LOCK_TABLE" --region "$AWS_REGION"
  echo "  - Table created"
fi

echo
echo "Bootstrap complete for env '${ENV_NAME}'."
echo "Next step: run Terraform in terraform/${ENV_NAME} to create IAM/OIDC and SSM prerequisites."
