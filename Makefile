.PHONY: aws-list-services apprunner-delete ecr-create ecr-login ecr-build ecr-push-v2 apprunner-create-v2 local-run

# Load local private env if present
-include private/aws.env

AWS_REGION ?= eu-west-3
AWS_PROFILE ?= default
ECR_REPO ?= kiff/backend-lite-v2
APP_RUNNER_SERVICE ?= kiff-backend-lite-v2
ALLOWED_ORIGINS ?= https://your-vercel-domain,http://localhost:3000
DEFAULT_TENANT_ID ?= 4485db48-71b7-47b0-8128-c6dca5be352d
ALLOW_TENANT_FALLBACK ?= false

aws-list-services:
	aws apprunner list-services --region $(AWS_REGION) \
	  --query "ServiceSummaryList[].{Name:ServiceName,Status:Status,Arn:ServiceArn,Url:ServiceUrl}" --output table

apprunner-delete:
	@test -n "$(SERVICE_ARN)" || (echo "SERVICE_ARN is required" && exit 1)
	aws apprunner delete-service --service-arn "$(SERVICE_ARN)" --region $(AWS_REGION)

 ecr-create:
	aws ecr create-repository --repository-name $(ECR_REPO) --region $(AWS_REGION) || true

 ecr-login:
	$$(aws ecr get-login-password --region $(AWS_REGION)) | \
	docker login --username AWS --password-stdin $$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(AWS_REGION).amazonaws.com

 ecr-build:
	docker build -t backend-lite-v2:latest backend-lite-v2

 ecr-push-v2: ecr-create ecr-login ecr-build
	ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text); \
	docker tag backend-lite-v2:latest $$ACCOUNT_ID.dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO):latest; \
	docker push $$ACCOUNT_ID.dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO):latest

apprunner-role-create:
	@echo Creating App Runner ECR access role
	aws iam create-role --role-name AppRunnerECRAccessRole \
	  --assume-role-policy-document file://private/trust.json || true
	aws iam attach-role-policy --role-name AppRunnerECRAccessRole \
	  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess || true
	aws iam get-role --role-name AppRunnerECRAccessRole --query "Role.Arn" --output text

apprunner-create-v2:
	ACCOUNT_ID=$$(aws sts get-caller-identity --query Account --output text); \
	IMAGE="$$ACCOUNT_ID.dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO):latest"; \
	ROLE_ARN=$$(aws iam get-role --role-name AppRunnerECRAccessRole --query "Role.Arn" --output text); \
	aws apprunner create-service --region $(AWS_REGION) \
	  --service-name $(APP_RUNNER_SERVICE) \
	  --source-configuration "{\"ImageRepository\":{\"ImageIdentifier\":\"$$IMAGE\",\"ImageRepositoryType\":\"ECR\",\"ImageConfiguration\":{\"Port\":\"8000\",\"RuntimeEnvironmentVariables\":[{\"Name\":\"ALLOWED_ORIGINS\",\"Value\":\"$(ALLOWED_ORIGINS)\"},{\"Name\":\"DEFAULT_TENANT_ID\",\"Value\":\"$(DEFAULT_TENANT_ID)\"},{\"Name\":\"ALLOW_TENANT_FALLBACK\",\"Value\":\"$(ALLOW_TENANT_FALLBACK)\"}]}} ,\"AutoDeploymentsEnabled\": true, \"AuthenticationConfiguration\": { \"AccessRoleArn\": \"$$ROLE_ARN\" }}"

local-run:
	@echo Running backend-lite-v2 locally on :8000
	cd backend-lite-v2 && uvicorn app.main:app --host 0.0.0.0 --port 8000
