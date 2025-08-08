# Terraform AWS Deployment Status

## Current Infrastructure Goal ✅

Single, minimal backend-lite-v2 on AWS App Runner (eu-west-3, Paris), with a lightweight ECR image and NO additional managed data services for v2 (in-memory only). Legacy resources should be decommissioned if unused.

## Pending Tasks:

### 1) Ensure App Runner subscription 🔄
If this is the first App Runner usage in the account, accept terms in Console once.

Steps:
- Console → App Runner → accept service terms.

### 2) Teardown legacy services (cost control)
Identify and delete legacy App Runner services not used by v2.

Commands (uses local AWS CLI):
```bash
make aws-list-services                                   # list all services in eu-west-3
make apprunner-delete SERVICE_ARN="<legacy_service_arn>" # delete specific legacy service
```

### 3) Build and deploy backend-lite-v2
We deploy via ECR + App Runner. Region is `eu-west-3`.

```bash
# 0) Bootstrap local env from ~/.aws (writes private/aws.env)
bash private/bootstrap_aws_env.sh

# 1) Build and push image to ECR
make ecr-push-v2

# 2) Ensure IAM role for App Runner → ECR
make apprunner-role-create

# 3) Create App Runner service for v2
make apprunner-create-v2
```

Alternatively, one-shot script (delete legacy + deploy v2):
```bash
bash private/deploy_v2.sh --delete-old --old-arn "arn:aws:apprunner:eu-west-3:ACCOUNT_ID:service/NAME/ID"
```

### 4) Retrieve service URL and update frontend
```bash
aws apprunner list-services --region eu-west-3 \
  --query "ServiceSummaryList[?ServiceName=='kiff-backend-lite-v2'].ServiceUrl" --output text
```
Update `frontend-lite/.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=https://<service-url>
NEXT_PUBLIC_TENANT_ID=4485db48-71b7-47b0-8128-c6dca5be352d
NEXT_PUBLIC_USE_MOCKS=false
```

## Next Steps After App Runner Subscription:

1. Complete App Runner deployment for backend-lite-v2
2. Get backend URL (see command above) and update frontend envs
3. Verify tenant header in all calls: `X-Tenant-ID`
4. Incremental features can be added post-stabilization

## Infrastructure Configuration:

Terraform remains for future infra (DB/Redis/etc.) if needed later. For backend-lite-v2 minimal deployment we use CLI + App Runner directly.

Terraform directory (legacy/optional): `/terraform/`
- `variables.tf` — includes `aws_region` (default eu-west-3) and defaults like `default_tenant_id`
- `terraform.tfvars.example` — example values

## Costs:
- Keep only one active App Runner for backend-lite-v2
- Delete legacy services immediately after migration
- Prefer small image and minimal dependencies
- Optionally set AWS Budget + alerts

## Security:
- Do NOT commit secrets; `private/aws.env` is git-ignored
- App Runner pulls image from ECR via IAM role
- Configure `ALLOWED_ORIGINS` for strict CORS in `private/aws.env`

## Manual Alternatives (if App Runner unsuitable):
1) ECS Fargate
2) Railway/Render
3) EC2 Auto Scaling

The deployment pipeline for backend-lite-v2 is ready and cost-conscious. Keep this doc updated with the latest service name, ECR repo, and the current App Runner URL.