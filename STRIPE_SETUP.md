# Stripe Subscription Setup Guide

## Overview

This application now includes a complete Stripe-based subscription system with three tiers:

1. **Free Plan**: 100 API calls/month, basic features
2. **Pay-per-token**: ~$0.20 per API call, no monthly commitment
3. **Pro Plan**: $20/month, unlimited usage with premium features

## Stripe Configuration

### 1. Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Complete account verification
3. Switch to Test mode for development

### 2. Create Products and Prices

In your Stripe Dashboard:

1. **Navigate to Products**
   - Go to Products → Add product
   - Name: "Pro Plan"
   - Description: "Unlimited API access with premium features"

2. **Create Monthly Price**
   - Click "Add price"
   - Type: Recurring
   - Price: $20.00
   - Billing period: Monthly
   - Copy the Price ID (starts with `price_`)

### 3. Set Up Webhooks

1. **Create Webhook Endpoint**
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe-subscription/webhook`
   - Select events to send:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get Webhook Secret**
   - After creating, click on the webhook
   - Copy the "Signing secret" (starts with `whsec_`)

### 4. Environment Variables

Update your `.env` file:

```bash
# Stripe Payment Processing
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret
STRIPE_PRICE_ID_PRO_MONTHLY=price_your_actual_price_id
```

### 5. Update Price ID in Code

In `/backend/app/api/routes/stripe_subscription.py`, update the price ID:

```python
SUBSCRIPTION_PLANS = {
    "pro_monthly": {
        "price_id": "price_your_actual_price_id_here",  # Replace with your actual Price ID
        # ... rest of config
    }
}
```

## Frontend Integration

### Subscription Modal

The subscription modal is integrated into the header and can be triggered by:

1. **Upgrade Button**: Visible when user is on Free or Pay-per-token plan
2. **Plan Badge**: Clickable indicator showing current plan
3. **Programmatic**: Call `setSubscriptionModalOpen(true)` anywhere in the app

### Usage Examples

```typescript
// In any component
import { SubscriptionModal } from '../components/subscription/SubscriptionModal'

// Show modal
const [modalOpen, setModalOpen] = useState(false)

// Handle subscription upgrade
const handleUpgrade = async (planType: string) => {
  if (planType === 'pro') {
    // Redirects to Stripe Checkout
    const response = await fetch('/api/stripe-subscription/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_type: 'pro_monthly',
        success_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancel`
      })
    })
    
    const { checkout_url } = await response.json()
    window.location.href = checkout_url
  }
}
```

## API Endpoints

### Create Checkout Session
```
POST /api/stripe-subscription/create-checkout-session
```

Creates a Stripe Checkout session for Pro subscription.

**Request Body:**
```json
{
  "plan_type": "pro_monthly",
  "success_url": "https://your-app.com/subscription/success",
  "cancel_url": "https://your-app.com/subscription/cancel",
  "email": "user@example.com"
}
```

### Webhook Handler
```
POST /api/stripe-subscription/webhook
```

Handles Stripe webhook events for subscription lifecycle management.

### Subscription Status
```
GET /api/stripe-subscription/subscription-status?tenant_id=xxx&user_id=xxx
```

Returns current subscription status and available plans.

### Cancel Subscription
```
POST /api/stripe-subscription/cancel-subscription
```

Cancels active subscription (can be immediate or at period end).

### Billing Portal
```
GET /api/stripe-subscription/billing-portal?return_url=xxx
```

Creates Stripe Customer Portal session for subscription management.

## Frontend Routes

Add these routes to your React Router configuration:

```typescript
import { SubscriptionSuccess } from './pages/SubscriptionSuccess'
import { SubscriptionCancel } from './pages/SubscriptionCancel'

// In your router
<Route path="/subscription/success" element={<SubscriptionSuccess />} />
<Route path="/subscription/cancel" element={<SubscriptionCancel />} />
```

## Testing

### Test Cards

Use Stripe's test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### Test Workflow

1. Start with Free plan
2. Click "Upgrade to Pro" button in header
3. Fill out checkout form with test card
4. Verify redirect to success page
5. Check webhook events in Stripe Dashboard
6. Test subscription management via Customer Portal

## Production Deployment

### 1. Switch to Live Mode

1. In Stripe Dashboard, toggle to "Live mode"
2. Create new products/prices in live mode
3. Set up live webhook endpoint
4. Update environment variables with live keys

### 2. Security Considerations

- Always validate webhook signatures
- Use HTTPS for webhook endpoints
- Store Stripe keys securely (environment variables)
- Implement proper error handling
- Log subscription events for debugging

### 3. Customer Portal

Enable Stripe Customer Portal for self-service:

1. Go to Settings → Billing → Customer portal
2. Enable portal and configure allowed actions
3. Set branding and business information

## Features Included

### ✅ Complete Implementation

- **Stripe Checkout Integration**: Seamless payment flow
- **Webhook Handling**: Real-time subscription updates
- **Plan Management**: Free, Pay-per-token, Pro tiers
- **UI Components**: Modal, buttons, success/cancel pages
- **Error Handling**: Graceful error states and recovery
- **Customer Portal**: Self-service subscription management
- **Test Environment**: Full test mode support

### 🎨 UI/UX Features

- **Claude-style Modal**: Clean, professional subscription interface
- **Upgrade Prompts**: Contextual calls-to-action
- **Plan Badges**: Clear indication of current subscription status
- **Loading States**: Smooth user experience during transactions
- **Success/Cancel Pages**: Clear feedback for payment outcomes

### 🔒 Security & Compliance

- **Webhook Signature Verification**: Ensures data integrity
- **Environment Variables**: Secure key management
- **HTTPS Required**: Secure data transmission
- **PCI Compliance**: Stripe handles sensitive card data

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving Events**
   - Check webhook URL is accessible
   - Verify webhook events are selected
   - Check webhook signing secret

2. **Price ID Not Found**
   - Ensure price ID matches exactly
   - Check you're using the correct environment (test/live)

3. **Checkout Session Creation Fails**
   - Verify API keys are correct
   - Check price ID exists in Stripe
   - Review request payload format

### Debug Tips

- Enable Stripe logs in Dashboard
- Check webhook delivery attempts
- Use Stripe CLI for local webhook testing
- Monitor application logs for errors

## Support

For additional help:

1. **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
2. **Stripe Support**: Available in Dashboard
3. **Test Environment**: Use extensively before going live