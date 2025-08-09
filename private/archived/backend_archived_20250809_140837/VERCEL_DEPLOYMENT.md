# Kiff AI Backend - Vercel Deployment Guide

This guide explains how to deploy the Kiff AI backend to Vercel.

## Files Created for Vercel Deployment

### 1. `vercel.json` - Vercel Configuration
- Configures Python runtime and routing
- Uses lightweight `requirements-vercel.txt`
- Excludes heavy files from deployment

### 2. `api/index.py` - Vercel Entry Point
- Serverless function handler
- Imports the FastAPI app for Vercel

### 3. `app/main_vercel.py` - Optimized FastAPI App
- Simplified version without WebSockets
- Excludes heavy ML dependencies
- Optimized for serverless environment

### 4. `app/core/config_vercel.py` - Vercel Configuration
- Environment variable handling
- Vercel-specific settings
- AWS credentials for Phase 2

### 5. `app/core/database_vercel.py` - Database Configuration
- Connection pooling disabled for serverless
- Health check functions
- Async database operations

### 6. `requirements-vercel.txt` - Lightweight Dependencies
- Essential packages only (~50 vs 190+ packages)
- Excludes ML/NLP libraries to reduce bundle size

## Environment Variables Required

Set these in your Vercel project settings:

### Required (Production)
```
DATABASE_URL=postgresql://user:pass@host:port/db
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
```

### Optional API Keys
```
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
EXA_API_KEY=your-exa-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
RESEND_API_KEY=your-resend-api-key
```

### Frontend Configuration
```
FRONTEND_URL=https://your-frontend.vercel.app
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

### AWS (Phase 2 - App Runner)
```
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
```

## Deployment Steps

### 1. Connect to Vercel
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" and import your repository
4. Select the `backend` folder as the project root

### 2. Configure Environment Variables
1. In Vercel dashboard, go to Project → Settings → Environment Variables
2. Add all required environment variables listed above
3. Make sure to set them for Production, Preview, and Development environments

### 3. Deploy
1. Vercel will automatically deploy on push to main branch
2. Check the deployment logs for any issues
3. Test the endpoints:
   - `https://your-app.vercel.app/` - Root endpoint
   - `https://your-app.vercel.app/health` - Health check
   - `https://your-app.vercel.app/docs` - API documentation

## Database Setup

### Option 1: Vercel Postgres (Recommended)
1. In Vercel dashboard, go to Storage → Create Database → Postgres
2. Copy the connection string to `DATABASE_URL` environment variable

### Option 2: External Database
- Use any PostgreSQL provider (Supabase, Neon, AWS RDS, etc.)
- Ensure the database allows connections from Vercel's IP ranges

## Testing the Deployment

### Health Checks
```bash
# Basic health
curl https://your-app.vercel.app/health

# Database health
curl https://your-app.vercel.app/health/database

# API health with details
curl https://your-app.vercel.app/api/health
```

### Authentication Endpoints
```bash
# Test registration (replace with your domain)
curl -X POST https://your-app.vercel.app/api/auth/register \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: 4485db48-71b7-47b0-8128-c6dca5be352d" \\
  -d '{"email":"test@example.com","password":"testpass123","username":"testuser"}'
```

## Updating Frontend Configuration

After successful deployment, update your frontend's API base URL:

1. In `frontend/.env` or Vercel environment variables:
```
VITE_API_BASE_URL=https://your-backend.vercel.app
```

2. The frontend will automatically use the new backend URL.

## Troubleshooting

### Common Issues

1. **Function timeout**: Increase timeout in vercel.json
2. **Package too large**: Further reduce dependencies in requirements-vercel.txt
3. **Database connection**: Check DATABASE_URL format and network access
4. **Import errors**: Some routes may be disabled if dependencies are missing

### Monitoring

- Check Vercel Function logs in the dashboard
- Use `/health/database` to verify database connectivity
- Monitor function execution time and memory usage

## Phase 2: App Runner Integration

Once the backend is deployed, Phase 2 will add:
- Container orchestration endpoints
- Generated app deployment to AWS App Runner
- Real-time deployment status tracking
- App management dashboard in frontend

The AWS credentials configured above will be used for this functionality.