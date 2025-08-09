#!/usr/bin/env bash
set -euo pipefail

# Load env
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
if [[ -f "$ROOT_DIR/private/aws.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/private/aws.env"
fi

AWS_REGION=${AWS_REGION:-eu-west-3}
AWS_PROFILE=${AWS_PROFILE:-default}
ECR_REPO=${ECR_REPO:-kiff/backend-lite-v2}
APP_RUNNER_SERVICE=${APP_RUNNER_SERVICE:-kiff-backend-lite-v2}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://your-vercel-domain,http://localhost:3000}
DEFAULT_TENANT_ID=${DEFAULT_TENANT_ID:-4485db48-71b7-47b0-8128-c6dca5be352d}
ALLOW_TENANT_FALLBACK=${ALLOW_TENANT_FALLBACK:-false}

DELETE_OLD=false
OLD_SERVICE_ARN=""

usage() {
  echo "Usage: $0 [--delete-old --old-arn <SERVICE_ARN>]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete-old)
      DELETE_OLD=true; shift ;;
    --old-arn)
      OLD_SERVICE_ARN="$2"; shift 2 ;;
    *) usage ;;
  esac
done

# Resolve AWS CLI binary (allow override via AWS_CLI env)
AWS_CLI=${AWS_CLI:-}
if [[ -z "$AWS_CLI" ]]; then
  # try system locations
  if command -v aws >/dev/null 2>&1; then
    AWS_CLI=$(command -v aws)
  elif [[ -x "/opt/homebrew/bin/aws" ]]; then
    AWS_CLI="/opt/homebrew/bin/aws"
  elif [[ -x "/usr/local/bin/aws" ]]; then
    AWS_CLI="/usr/local/bin/aws"
  else
    echo "aws CLI not found. Please install AWS CLI or set AWS_CLI to its path." >&2
    exit 2
  fi
fi

command -v docker >/dev/null || { echo "docker not found in PATH"; exit 2; }

export AWS_REGION AWS_PROFILE

echo "==> Region: $AWS_REGION | Profile: $AWS_PROFILE"

# Optionally delete old App Runner service
if [[ "$DELETE_OLD" == true ]]; then
  if [[ -z "$OLD_SERVICE_ARN" ]]; then
    echo "--delete-old specified but --old-arn not provided. Listing services to help:" >&2
    "$AWS_CLI" apprunner list-services --region "$AWS_REGION" \
      --query "ServiceSummaryList[].{Name:ServiceName,Status:Status,Arn:ServiceArn,Url:ServiceUrl}" --output table || true
    exit 3
  fi
  echo "==> Deleting old App Runner service: $OLD_SERVICE_ARN"
  "$AWS_CLI" apprunner delete-service --service-arn "$OLD_SERVICE_ARN" --region "$AWS_REGION"
fi

# ECR repo ensure
"$AWS_CLI" ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION" >/dev/null 2>&1 || true

# Build and push image
ACCOUNT_ID=$("$AWS_CLI" sts get-caller-identity --query Account --output text)
ECR="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMG="$ECR/$ECR_REPO:latest"

echo "==> Logging in to ECR: $ECR"
"$AWS_CLI" ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR"

echo "==> Building image"
docker build -t backend-lite-v2:latest "$ROOT_DIR/backend-lite-v2"

echo "==> Tagging and pushing image: $IMG"
docker tag backend-lite-v2:latest "$IMG"
docker push "$IMG"

# Ensure IAM role for App Runner ECR access
ROLE_NAME="AppRunnerECRAccessRole"
ROLE_ARN=$("$AWS_CLI" iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text 2>/dev/null || true)
if [[ -z "$ROLE_ARN" ]]; then
  echo "==> Creating App Runner ECR access role"
  "$AWS_CLI" iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document file://"$ROOT_DIR/private/trust.json" >/dev/null
  "$AWS_CLI" iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess >/dev/null
  ROLE_ARN=$("$AWS_CLI" iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text)
fi

echo "==> Creating App Runner service: $APP_RUNNER_SERVICE"
"$AWS_CLI" apprunner create-service --region "$AWS_REGION" \
  --service-name "$APP_RUNNER_SERVICE" \
  --source-configuration "{\"ImageRepository\":{\"ImageIdentifier\":\"$IMG\",\"ImageRepositoryType\":\"ECR\",\"ImageConfiguration\":{\"Port\":\"8000\",\"RuntimeEnvironmentVariables\":[{\"Name\":\"ALLOWED_ORIGINS\",\"Value\":\"$ALLOWED_ORIGINS\"},{\"Name\":\"DEFAULT_TENANT_ID\",\"Value\":\"$DEFAULT_TENANT_ID\"},{\"Name\":\"ALLOW_TENANT_FALLBACK\",\"Value\":\"$ALLOW_TENANT_FALLBACK\"}]}} ,\"AutoDeploymentsEnabled\": true, \"AuthenticationConfiguration\": { \"AccessRoleArn\": \"$ROLE_ARN\" }}" \
  --query "Service.ServiceUrl" --output text

echo "==> Done. Above is the service URL."
