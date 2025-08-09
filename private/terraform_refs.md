# Terraform & Legacy AWS References (Paris eu-west-3)

From `docs/TERRAFORM_AWS_DEPLOYMENT.md`:

- Account ID (from ECR URL): `929018226542`
- Region: `eu-west-3`
- Legacy ECR repo (Terraform):
  - `929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff-ai-backend`
- Legacy minimal image tag example (Terraform):
  - `929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff-ai-backend:latest`
- Action pending (historical): App Runner subscription acceptance

From `test_endpoint.py` (legacy App Runner URL):
- `https://z5cmpsm2zw.eu-west-3.awsapprunner.com`

Use these references if you prefer to reuse the legacy ECR repo name.
