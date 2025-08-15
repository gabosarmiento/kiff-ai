# Kiff AI - Microservice AI Development Platform

Enterprise-grade AI-powered platform with optimized microservice architecture that combines comprehensive knowledge bases with advanced LLM agents to generate sophisticated applications, provide intelligent development assistance, and deliver real-time insights across multiple domains.

## 🏗️ Microservice Architecture

### 🔧 Architecture Overview

The platform is built with a modern microservice architecture optimizing for performance and scalability:

- **Core Backend Service** (~214MB): Lightweight FastAPI service handling authentication, APIs, and database operations
- **ML Service** (~3.2GB): Specialized service for vector embeddings, LanceDB operations, and AGNO agent processing
- **Frontend**: Next.js application with localStorage-based file management

### 🚀 Quick Start

```bash
# Option 1: Microservices with Docker Compose
docker-compose -f docker-compose.kiff.yml up --build

# Option 2: Individual services for development
# Core Backend (FastAPI)
cd backend-lite-v2
pip install -r requirements-core.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ML Service (AGNO + Vector DB)
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Frontend (Next.js)
cd frontend-lite
npm install && npm run dev
```

**Local URLs**: Backend: http://localhost:8000 | ML Service: http://localhost:8001 | Frontend: http://localhost:3000

## 🌟 **Platform Capabilities**

### 🚀 **Kiff Launcher - AI-Powered Development Workspace**
- **Instant Project Generation**: Create complete project structures with AI assistance
- **Interactive Chat Agent**: AGNO-powered agent with file modification capabilities
- **Real-Time File Management**: localStorage-based file system with instant modifications
- **Live Preview Integration**: See changes applied immediately without external dependencies
- **Knowledge-Aware Development**: Agent leverages indexed API documentation and best practices

### 🧠 **Knowledge-Driven Development**
- **Pack-Based Knowledge System**: Curated knowledge packs with tenant-scoped access
- **Vector Search Integration**: LanceDB-powered semantic search with confidence scoring
- **Multi-Source RAG**: Combines pack knowledge with web search (Serper, Tavily, EXA APIs)
- **Intelligent Context Retrieval**: Automatic knowledge augmentation for low-confidence responses
- **API Documentation Index**: Real-time indexing of API documentation from major providers

### 🤖 **Advanced AI Agent Integration**
- **AGNO Framework**: Sophisticated agent framework with tool-driven interactions
- **File Modification Tools**: Direct file creation/editing with proposal-based approval system
- **Multi-Model Support**: Dynamic LLM selection (Groq: Llama, DeepSeek, Qwen, Kimi-K2)
- **Streaming Responses**: Real-time agent communication with intermediate steps visibility
- **Context-Aware Processing**: Agent maintains project context and applies changes intelligently

**Backend**: http://localhost:8000 | **Frontend**: http://localhost:5173 | **API Docs**: http://localhost:8000/docs | **Admin**: http://localhost:5173/admin

## ✨ Core Features

### 🧠 **Knowledge-Driven Intelligence**
- 📚 **Multi-Domain Knowledge Base**: Real-time indexed API documentation (OpenAI, Stripe, Leonardo AI, ElevenLabs, Stability AI, AGNO)
- 🔍 **Agentic RAG System**: Swappable modular RAG with vector databases and hybrid search
- 🌐 **Dynamic URL Discovery**: Automatic sitemap extraction and intelligent content filtering
- 💡 **Conversational Development**: Context-aware coding assistance with knowledge integration

### 🤖 **Advanced Application Generation**
- 🚀 **Generate V0.1**: Comprehensive AGNO-powered app generation with 30+ documentation sources
- 🏗️ **Generate V0**: Fast application generation with curated API knowledge
- 🐳 **Production-Ready**: Automatic Docker containerization with deployment configurations
- 🔧 **Multi-Framework**: FastAPI, Flask, React, CLI tools, microservices, and full-stack applications

### 💰 **Enterprise SaaS Features**
- 📊 **Real-Time Token Tracking**: Billing-cycle-based consumption monitoring across multiple LLM models
- 👥 **Multi-Tenant Architecture**: Complete tenant isolation with advanced security middleware
- 🎛️ **Admin Dashboard**: Comprehensive monitoring, analytics, and feature flag management
- 🔒 **Enterprise Security**: Role-based access control, audit logging, and compliance features

### 🎯 **Intelligent Operations**
- 🤖 **Multiple LLM Models**: Dynamic model selection (Llama, DeepSeek, Qwen, Kimi-K2) based on task requirements
- ⚡ **Performance Optimization**: Intelligent caching, resource allocation, and processing optimization
- 📈 **Observability**: LangTrace integration, metrics collection, and real-time monitoring
- 🔄 **Streaming Interfaces**: Real-time updates and progressive application generation

## 🏗️ Microservice Architecture

**Optimized Knowledge-Driven Platform:**
```
kiff-ai/
├── frontend-lite/         # Next.js + TypeScript + Tailwind CSS
│   ├── src/app/          # App router pages
│   │   ├── kiffs/        # Kiff management & launcher
│   │   ├── admin/        # Admin dashboard
│   │   └── api/          # API route handlers
│   ├── src/components/   # Modular UI components
│   │   ├── compose/      # Development workspace
│   │   ├── kiffs/        # Kiff-specific components  
│   │   └── ui/           # Shared UI components
│   └── src/lib/          # Utilities & API clients
├── backend-lite-v2/      # Core Backend Service (~214MB)
│   ├── app/routes/       # FastAPI API endpoints
│   │   ├── launcher_*.py # Launcher & project management
│   │   ├── auth.py       # Authentication & sessions
│   │   ├── packs.py      # Knowledge pack management
│   │   └── admin_*.py    # Admin operations
│   ├── app/services/     # Business logic services
│   │   ├── launcher_agent.py    # AGNO agent integration
│   │   ├── ml_api_client.py     # ML service client
│   │   └── vector_storage.py    # Vector operations
│   └── app/middleware/   # Security & tenant middleware
├── ml-service/           # ML Service (~3.2GB)
│   ├── app/services/     # AI/ML processing services
│   │   ├── embedder_service.py  # Text embeddings
│   │   ├── vector_service.py    # LanceDB operations
│   │   └── agent_service.py     # AGNO agent processing
│   └── requirements.txt  # ML-specific dependencies
├── storybookv0/          # Component library showcase
└── docs/                 # Documentation & guides
```

## 🛠️ Advanced Tech Stack

### 🔧 **Microservice Infrastructure**
- **Core Backend** (~214MB): FastAPI + SQLAlchemy + PostgreSQL with optimized Docker builds
- **ML Service** (~3.2GB): AGNO (Advanced Agent Framework) + LanceDB + sentence-transformers
- **Service Communication**: HTTP API client with async operations between services
- **Vector Databases**: LanceDB with hybrid search capabilities in dedicated ML service
- **Multi-Tenancy**: Advanced tenant isolation with security middleware
- **Observability**: LangTrace integration for LLM monitoring and analytics

### 🎨 **Frontend Architecture**
- **Framework**: Next.js 14 + TypeScript + App Router for modern development
- **Styling**: Tailwind CSS with custom design system components
- **State Management**: localStorage-based file management with React state
- **Real-Time**: Server-Sent Events (SSE) for streaming chat interfaces
- **File Management**: Direct localStorage integration replacing sandbox dependency

### 🤖 **AI & LLM Integration**
- **Multi-Model Support**: Dynamic selection across multiple LLM providers
  - **Groq**: Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1, Qwen 3, Kimi-K2
  - **Task Optimization**: Automatic model selection based on operation type
- **Knowledge Processing**: Intelligent document indexing and retrieval systems
- **Token Management**: Real-time consumption tracking with billing-cycle management

### 🏗️ **Enterprise Features**
- **Security**: Role-based access control, audit logging, data encryption
- **Scalability**: Multi-tenant architecture with horizontal scaling capabilities
- **Monitoring**: Real-time performance metrics and health checking
- **Deployment**: Production-ready containerization with Docker + orchestration

## 🌐 Deployment

### 🚀 Production Deployment

**Frontend (Vercel)**
```bash
cd frontend-lite
vercel --prod --env NEXT_PUBLIC_API_BASE_URL=<your-backend-url>
```

**Backend Services (AWS App Runner)**
```bash
# Build and push to ECR
docker build -t your-registry/core-backend ./backend-lite-v2
docker build -t your-registry/ml-service ./ml-service

# Deploy via AWS App Runner with ECR integration
# Core backend: Small instance (1 vCPU, 2GB RAM)
# ML service: Medium instance (2 vCPU, 4GB RAM)
```

**Environment Variables**
- Core Backend: API keys via AWS Secrets Manager
- ML Service: Model cache paths and vector storage configuration
- Frontend: Backend API URL via Vercel environment variables

## Monorepo Vercel Setup (frontend-lite + storybookv0)

This repo uses npm workspaces and multiple apps. Deploy each app as its own Vercel Project:

- __frontend-lite__ (Next.js)
  - Project root: `frontend-lite`
  - Build/Install: auto-detected by Vercel
  - Important: `next.config.js` already has `transpilePackages: ['@kiff/ui']`
  - Env vars (Project Settings → Environment Variables):
    - `NEXT_PUBLIC_API_BASE_URL = https://your-backend.example.com`
    - `NEXT_PUBLIC_TENANT_ID = <your-tenant-id>`
    - `NEXT_PUBLIC_USE_MOCKS = false`

- __storybookv0__ (Static Storybook, Vite)
  - Project root: `storybookv0`
  - Build command: `npm run build` (uses `storybook build`)
  - Output directory: `storybook-static`
  - Env vars:
    - `VITE_API_BASE_URL = https://your-backend.example.com`
    - `VITE_TENANT_ID = <your-tenant-id>`
    - `VITE_USE_MOCKS = false`

- __Backend__ (`backend-lite-v2` FastAPI)
  - Host separately (e.g., AWS App Runner, Fly.io, Render)
  - CORS: set `ALLOWED_ORIGINS` to include both Vercel domains, comma-separated
    - Example: `ALLOWED_ORIGINS=https://<frontend-lite>.vercel.app,https://<storybook>.vercel.app`

### Tenant Header Requirement

All frontend requests must include the exact header `X-Tenant-ID`. This is enforced by middleware in `backend-lite-v2`.

- Next.js helper: `frontend-lite/src/lib/api.ts` ensures the header using `getTenantId()` and `NEXT_PUBLIC_TENANT_ID` fallback.
- Storybook helper: `storybookv0/src/lib/api.ts` ensures the header using `VITE_TENANT_ID`.

If you see "Tenant not specified", verify env vars and that the header is being sent.

### Root Vercel Config

The monorepo root `vercel.json` is intentionally a no-op to avoid conflicts. Configure deploys per project as above.

## Local Development (3 processes)

Run backend, frontend-lite (Next.js), and Storybook in parallel:

```bash
# 1) Backend (FastAPI)
cd backend-lite-v2
export ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2) Frontend Lite (Next.js)
cd frontend-lite
export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
export NEXT_PUBLIC_TENANT_ID="4485db48-71b7-47b0-8128-c6dca5be352d"
export NEXT_PUBLIC_USE_MOCKS="false"
npm install
npm run dev    # http://localhost:3000

# 3) Storybook (Vite Storybook)
cd storybookv0
export VITE_API_BASE_URL="http://localhost:8000"
export VITE_TENANT_ID="4485db48-71b7-47b0-8128-c6dca5be352d"
export VITE_USE_MOCKS="false"
npm install
npm run storybook   # http://localhost:3001
```

Notes:
- __Tenant header__: The helpers in `frontend-lite/src/lib/api.ts` and `storybookv0/src/lib/api.ts` always send `X-Tenant-ID`.
- __CORS__: Ensure `ALLOWED_ORIGINS` includes `http://localhost:3000` and `http://localhost:3001`.
- __Shared UI__: `@kiff/ui` is linked via workspaces; edits in `packages/ui/src` hot-reload in both apps.

## 📖 Comprehensive Documentation

### 🚀 **Getting Started**
- **API Documentation**: Interactive Swagger UI at `/docs` when running locally
- **Admin Dashboard**: Access admin features at `/admin` (requires admin credentials)
- **Knowledge Base**: Manage knowledge sources at `/knowledge`

### 📚 **Platform Guides**
- **Deployment Guide**: `backend/VERCEL_DEPLOYMENT.md` - Production deployment instructions
- **Knowledge Management**: `backend/app/knowledge/README_MODULAR_RAG.md` - RAG system guide
- **Token Tracking**: `BILLING_CONSENT_WORKFLOW.md` - Billing and consumption tracking
- **LangTrace Integration**: `LANGTRACE_INTEGRATION.md` - Observability setup

### 🎯 **API Endpoints Overview**
- **Application Generation**: `/api/agno-generation/*` (V0) & `/api/agno-generation-v01/*` (V0.1)
- **Knowledge Management**: `/api/knowledge/*` - Knowledge base operations
- **Conversational AI**: `/api/conversational-chat/*` - AI-powered development assistance
- **Billing & Tracking**: `/api/billing/consumption/*` - Token usage and billing
- **Admin Operations**: `/api/admin/*` - Platform administration and analytics

## 🔑 Environment Configuration

**Backend (.env):**
```env
# Database Configuration
DATABASE_URL=postgresql://user:pass@host:port/db
SECRET_KEY=your-secret-key-256-bit

# Multi-LLM Provider Configuration
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-key

# Observability & Monitoring
LANGTRACE_API_KEY=your-langtrace-key

# Knowledge Base Configuration
KNOWLEDGE_BASE_PATH=./app/knowledge/data
VECTOR_DB_URI=./tmp/vector_databases

# Multi-Tenant Configuration
DEFAULT_TENANT_ID=default
ADMIN_SECRET_KEY=your-admin-secret
```

**Frontend (.env):**
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000

# Feature Flags
VITE_ENABLE_ADVANCED_FEATURES=true
VITE_ENABLE_BILLING_UI=true
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

Proprietary - All rights reserved
