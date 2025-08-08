# Kiff AI - Knowledge-Driven Development SaaS Platform

Enterprise-grade AI-powered SaaS platform that combines comprehensive knowledge bases with advanced LLM agents to generate sophisticated applications, provide intelligent development assistance, and deliver real-time insights across multiple domains.

## 🚀 Quick Start

```bash
# Backend (FastAPI + PostgreSQL)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (React + Vite)
cd frontend
npm install && npm run dev
```

**Backend**: http://localhost:8000 | **Frontend**: http://localhost:5173 | **API Docs**: http://localhost:8000/docs | **Admin**: http://localhost:5173/admin

## 🌟 **Platform Capabilities**

### 📊 **Real-Time Token Tracking & Billing**
- **Multi-Model Tracking**: Automatic detection and tracking of actual LLM models used (Llama, DeepSeek, Qwen, Kimi-K2)
- **Billing Cycle Management**: Monthly billing cycles with automatic reset and consumption aggregation
- **Dashboard Integration**: Real-time token consumption display in user dashboard with detailed breakdowns
- **Admin Monitoring**: Comprehensive tenant-wide token consumption analytics and cost management

### 🧠 **Knowledge-Driven Development**
- **Dynamic Knowledge Bases**: Real-time indexing of API documentation from major providers
- **Intelligent RAG**: Modular Retrieval-Augmented Generation with swappable knowledge sources
- **Conversational AI**: Context-aware development assistance with integrated knowledge retrieval
- **API Gallery**: Curated collection of indexed API documentation with smart filtering

### 🤖 **Advanced Application Generation**
- **Generate V0.1**: Comprehensive AGNO framework integration with 30+ documentation sources
- **Generate V0**: Fast, efficient application generation with curated knowledge
- **Production-Ready Output**: Complete applications with Docker, testing, and deployment configurations
- **Multi-Framework Support**: Flask, FastAPI, React, CLI tools, microservices, and full-stack applications

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

## 🏗️ Enterprise Architecture

**Knowledge-Driven SaaS Platform:**
```
kiff-ai/
├── frontend/              # React + TypeScript + Tailwind CSS
│   ├── src/components/    # Modular UI components
│   │   ├── admin/        # Admin dashboard components
│   │   ├── billing/      # Token tracking & billing UI
│   │   ├── chat/         # Conversational interfaces
│   │   └── knowledge/    # Knowledge base management
│   └── src/pages/        # Application pages & routing
├── backend/              # FastAPI + PostgreSQL + AGNO Framework
│   ├── app/api/routes/   # RESTful API endpoints
│   │   ├── admin*.py     # Admin & analytics APIs
│   │   ├── *_generation.py  # App generation services
│   │   ├── billing_*.py  # Token tracking & billing
│   │   └── knowledge.py  # Knowledge base APIs
│   ├── app/knowledge/    # Knowledge management system
│   │   ├── engine/       # Knowledge processing engines
│   │   ├── data/         # Vector databases (LanceDB)
│   │   └── interfaces/   # Modular RAG interfaces
│   ├── app/services/     # Business logic services
│   │   ├── *_generator.py    # Application generators
│   │   ├── billing_*.py      # Billing & token services
│   │   └── modular_rag_*.py  # RAG system services
│   └── app/core/         # Core infrastructure
│       ├── multi_tenant_db.py    # Multi-tenant database
│       ├── token_tracker.py      # Token consumption tracking
│       └── middleware/           # Security & tenant middleware
└── docs/                 # Documentation & guides
```

## 🛠️ Advanced Tech Stack

### 🔧 **Backend Infrastructure**
- **Framework**: FastAPI + SQLAlchemy + PostgreSQL with async operations
- **AI Framework**: AGNO (Advanced Agent Framework) with comprehensive tooling
- **Vector Databases**: LanceDB with hybrid search capabilities
- **Multi-Tenancy**: Advanced tenant isolation with security middleware
- **Observability**: LangTrace integration for LLM monitoring and analytics

### 🎨 **Frontend Architecture**
- **Framework**: React 18 + TypeScript + Vite for lightning-fast development
- **Styling**: Tailwind CSS with custom design system components
- **State Management**: Context API with optimized re-rendering
- **Real-Time**: WebSocket integration for streaming interfaces

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

### Vercel (Recommended)
1. Push to GitHub repository
2. Connect Vercel to this repo
3. Deploy both frontend and backend automatically
4. See `backend/VERCEL_DEPLOYMENT.md` for detailed instructions

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
