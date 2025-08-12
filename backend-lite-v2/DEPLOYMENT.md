## Backend Deployment Notes

The backend is deployed on AWS App Runner using ECR auto-deployment.

### Current Status:
- Frontend has fallback models that work even if backend /api/models returns 404
- Backend is running but may not have latest models route changes
- ECR image needs to be rebuilt and pushed to deploy backend changes

### To deploy backend changes:
1. Build: `docker build -t kiff-backend-lite-v2 .`
2. Tag: `docker tag kiff-backend-lite-v2:latest 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:latest`
3. Push: `docker push 929018226542.dkr.ecr.eu-west-3.amazonaws.com/kiff/backend-lite-v2:latest`
4. App Runner auto-deploys from ECR

### App Runner Service:
- Service ARN: arn:aws:apprunner:eu-west-3:929018226542:service/kiff-backend-lite-v2/5476fceb75c34923a51eaa8778d60256  
- Auto-deployments: Enabled (ECR-triggered)
- URL: https://rfn5agrmiw.eu-west-3.awsapprunner.com

