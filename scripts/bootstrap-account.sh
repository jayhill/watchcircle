#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Bootstrap a WatchCircle AWS account foundation.

Usage:
  scripts/bootstrap-account.sh \
    --env dev \
    --region us-east-2 \
    --github-owner jayhill \
    --github-repo watchcircle \
    --tf-state-bucket watchcircle-dev-tf-state

Required:
  --env              Environment name (dev, prod, etc.)
  --region           AWS region (example: us-east-2)
  --github-owner     GitHub user/org that owns the repo
  --github-repo      GitHub repository name
  --tf-state-bucket  Globally-unique S3 bucket name for Terraform state

Optional:
  --tf-lock-table    DynamoDB lock table name (default: watchcircle-<env>-tf-locks)
  --role-name        IAM deploy role name (default: watchcircle-<env>-github-deploy)
  --account-id       AWS account id (auto-detected if omitted)
  --ses-from-email   Optional stage sender email; stores /watchcircle/<env>/ses-from-email in SSM

What this script creates/updates:
  1) Terraform state S3 bucket (versioning + encryption)
  2) Terraform lock DynamoDB table
  3) GitHub OIDC provider (token.actions.githubusercontent.com)
  4) GitHub deploy role with OIDC trust policy
  5) Optional SES sender config in SSM (/watchcircle/<env>/ses-from-email)

What this script does NOT create:
  - App runtime resources (DynamoDB app table, API Gateway, Lambda)
    Those are provisioned by Serverless compose via services/infra + app services.

IMPORTANT:
  This script intentionally DOES NOT attach role permissions.
  You must define and attach policy manually after review.
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
GITHUB_OWNER=""
GITHUB_REPO=""
TF_STATE_BUCKET=""
TF_LOCK_TABLE=""
ROLE_NAME=""
ACCOUNT_ID=""
SES_FROM_EMAIL=""

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
    --github-owner)
      GITHUB_OWNER="$2"
      shift 2
      ;;
    --github-repo)
      GITHUB_REPO="$2"
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
    --role-name)
      ROLE_NAME="$2"
      shift 2
      ;;
    --account-id)
      ACCOUNT_ID="$2"
      shift 2
      ;;
    --ses-from-email)
      SES_FROM_EMAIL="$2"
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
require_cmd jq

if [[ -z "$ENV_NAME" || -z "$AWS_REGION" || -z "$GITHUB_OWNER" || -z "$GITHUB_REPO" || -z "$TF_STATE_BUCKET" ]]; then
  echo "error: missing required arguments" >&2
  usage
  exit 1
fi

if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
fi

if [[ -z "$TF_LOCK_TABLE" ]]; then
  TF_LOCK_TABLE="watchcircle-${ENV_NAME}-tf-locks"
fi

if [[ -z "$ROLE_NAME" ]]; then
  ROLE_NAME="watchcircle-${ENV_NAME}-github-deploy"
fi

echo "Bootstrapping account ${ACCOUNT_ID} for env '${ENV_NAME}' in region '${AWS_REGION}'"

echo "[1/4] Ensure Terraform state bucket exists: ${TF_STATE_BUCKET}"
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

echo "[2/4] Ensure Terraform lock table exists: ${TF_LOCK_TABLE}"
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

echo "[3/4] Ensure GitHub OIDC provider exists"
OIDC_ARN=""
existing_providers="$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text)"
for arn in $existing_providers; do
  url="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$arn" --query Url --output text)"
  if [[ "$url" == "token.actions.githubusercontent.com" ]]; then
    OIDC_ARN="$arn"
    break
  fi
done

if [[ -z "$OIDC_ARN" ]]; then
  OIDC_ARN="$(aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --query OpenIDConnectProviderArn \
    --output text)"
  echo "  - OIDC provider created: ${OIDC_ARN}"
else
  echo "  - OIDC provider exists: ${OIDC_ARN}"
fi

echo "[4/4] Ensure GitHub deploy role exists: ${ROLE_NAME}"
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "  - Role exists"
else
  trust_doc_file="$(mktemp)"
  cat >"$trust_doc_file" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_OWNER}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${trust_doc_file}" >/dev/null

  rm -f "$trust_doc_file"
  echo "  - Role created"
fi

if [[ -n "$SES_FROM_EMAIL" ]]; then
  echo "[extra] Store SES sender email in SSM"
  aws ssm put-parameter \
    --name "/watchcircle/${ENV_NAME}/ses-from-email" \
    --type String \
    --value "$SES_FROM_EMAIL" \
    --overwrite \
    --region "$AWS_REGION" >/dev/null
  echo "  - Stored /watchcircle/${ENV_NAME}/ses-from-email"
fi

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"

echo
echo "Bootstrap complete for env '${ENV_NAME}'."
echo "Role ARN: ${ROLE_ARN}"
echo
echo "TODO: Attach a reviewed permissions policy to role '${ROLE_NAME}'."
echo "      This script intentionally does NOT attach any permissions policy."
echo
echo "Example (manual, NOT run by this script):"
echo "  aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn arn:aws:iam::aws:policy/AdministratorAccess"
echo
echo "IMPORTANT REMINDER: Restrict permissions in dev as soon as deployment stabilizes,"
echo "and never use broad AdministratorAccess in production deploy roles."
echo
echo "Next step after account bootstrap: deploy compose stack (infra -> app-api -> app-ws)."
echo "  npm run compose:deploy:dev"
echo "Before deploy, ensure required SSM params exist:"
echo "  /watchcircle/${ENV_NAME}/session-jwt-secret"
echo "  /watchcircle/${ENV_NAME}/ws-jwt-secret"
echo "  /watchcircle/${ENV_NAME}/ses-from-email (if AUTH_EMAIL_SENDER=ses)"
