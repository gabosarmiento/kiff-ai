# Legacy Backend (App Runner) Info

- Region: eu-west-3 (Europe/Paris 3)
- Legacy App Runner URL (from `test_endpoint.py`):

```
https://z5cmpsm2zw.eu-west-3.awsapprunner.com
```

Use this to identify and delete the old service.

## How to find the exact ARN

Run (with your AWS CLI on this machine):

```bash
make aws-list-services
```

Or filter directly for that URL fragment:

```bash
AWS_REGION=${AWS_REGION:-eu-west-3} \
aws apprunner list-services --region "$AWS_REGION" \
  --query "ServiceSummaryList[?contains(ServiceUrl, 'z5cmpsm2zw')].{Name:ServiceName,Arn:ServiceArn,Url:ServiceUrl,Status:Status}" \
  --output table
```

Once you have the ARN, you can delete it via:

```bash
make apprunner-delete SERVICE_ARN="arn:aws:apprunner:eu-west-3:ACCOUNT_ID:service/NAME/ID"
```
