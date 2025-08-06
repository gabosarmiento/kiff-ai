# Vercel Deployment Guide

This project is configured as a monorepo with both frontend (React + Vite) and backend (FastAPI) deployed on Vercel.

## Project Structure
```
├── frontend/          # React + Vite frontend
├── backend/           # FastAPI backend
├── vercel.json        # Vercel configuration
└── package.json       # Root package.json for monorepo
```

## Deployment Setup

### 1. Connect to Vercel
1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically detect the monorepo structure

### 2. Configure Environment Variables
In your Vercel dashboard, add these environment variables:

#### Required Environment Variables:
```
DATABASE_URL=your_production_database_url
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET_KEY=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
RESEND_API_KEY=your_resend_api_key
```

#### Optional Environment Variables:
```
LANGTRACE_API_KEY=your_langtrace_api_key
STRIPE_PRICE_ID_PRO_MONTHLY=your_stripe_price_id
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

### 3. Build Configuration
The `vercel.json` is configured to:
- Build the frontend as a static site from `frontend/`
- Deploy the backend as serverless functions from `backend/api/`
- Route `/api/*` requests to the backend
- Route all other requests to the frontend

### 4. API Routes
- Frontend: `https://your-app.vercel.app/`
- Backend API: `https://your-app.vercel.app/api/`

### 5. Local Development
```bash
# Install dependencies
npm install
npm run install:frontend

# Start development servers
npm run dev
```

## Deployment Process

1. **Push to GitHub**: Vercel will automatically deploy on push to main branch
2. **Environment Variables**: Set in Vercel dashboard
3. **Build**: Vercel runs both frontend and backend builds
4. **Deploy**: Static frontend + serverless backend functions

## Troubleshooting

### Build Issues
- Check build logs in Vercel dashboard
- Ensure all dependencies are in requirements-vercel.txt
- Verify environment variables are set

### API Issues
- API routes must be under `/api/` path
- Backend code should be in `backend/api/` directory
- Check function logs in Vercel dashboard

### Database Issues
- Use a production PostgreSQL database (not local)
- Consider using Vercel Postgres or external services like Railway/Supabase