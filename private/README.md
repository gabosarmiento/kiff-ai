# Private Environment for Kiff AI (Local Only)

This folder is for local-only environment configuration and helper scripts. It should NOT contain secrets in Git. Use the provided `*.example` files and create local copies.

## Steps

1. Copy the AWS env example and edit it with your values (not committed):

```bash
cp private/aws.env.example private/aws.env
```

2. (Optional) If you use direnv, create a `.envrc` in the repo root:

```bash
# .envrc (at repo root)
export AWS_REGION=eu-west-3
export AWS_PROFILE=${AWS_PROFILE:-default}
# Load private AWS env if present
if [ -f "$(pwd)/private/aws.env" ]; then
  set -a
  . "$(pwd)/private/aws.env"
  set +a
fi
```

Then run `direnv allow`.

3. Use Makefile targets to operate App Runner/ECR:

- `make aws-list-services`
- `make apprunner-delete SERVICE_ARN=...`
- `make ecr-push-v2`
- `make apprunner-create-v2`

4. Frontend-lite envs to connect to backend-lite-v2:

```
NEXT_PUBLIC_API_BASE_URL=https://<apprunner-url>
NEXT_PUBLIC_TENANT_ID=4485db48-71b7-47b0-8128-c6dca5be352d
NEXT_PUBLIC_USE_MOCKS=false
```

## Notes
- Region: eu-west-3 (Europe/Paris 3)
- The backend enforces `X-Tenant-ID`. In dev you can allow fallback by setting `ALLOW_TENANT_FALLBACK=true`.
