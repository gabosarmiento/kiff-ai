# Kiff AI - Adaptive Application Generation Platform

AI-powered SaaS platform that generates complete Python applications from natural language descriptions, with automatic Docker containerization and cloud deployment.

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

**Backend**: http://localhost:8000 | **Frontend**: http://localhost:5173 | **API Docs**: http://localhost:8000/docs

## ✨ Core Features

- 🤖 **AI App Generation**: Natural language to complete Python applications
- 🐳 **Docker Integration**: Automatic containerization with Dockerfiles
- 🚀 **Cloud Deployment**: Deploy generated apps to AWS App Runner (Phase 2)
- 👤 **User Management**: Multi-tenant architecture with account isolation
- 📱 **Modern UI**: React + Tailwind CSS responsive interface
- 🔧 **Multi-Framework**: Flask, FastAPI, CLI tools, games, and more

## 🏗️ Architecture

**Monorepo Structure:**
```
kiff-ai/
├── frontend/          # React + TypeScript + Vite
├── backend/           # FastAPI + PostgreSQL + AGNO
├── README.md         # This file
└── .gitignore        # Git ignore rules
```

## 🛠️ Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL + AGNO Framework
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **AI/LLM**: Groq, OpenAI, Anthropic integration
- **Deployment**: Vercel (frontend + backend) + AWS App Runner (generated apps)
- **Database**: PostgreSQL with async operations

## 🌐 Deployment

### Vercel (Recommended)
1. Push to GitHub repository
2. Connect Vercel to this repo
3. Deploy both frontend and backend automatically
4. See `backend/VERCEL_DEPLOYMENT.md` for detailed instructions

## 📖 Documentation

- **API Documentation**: Available at `/docs` when running locally
- **Deployment Guide**: `backend/VERCEL_DEPLOYMENT.md`
- **Architecture**: Full-stack monorepo with React frontend and FastAPI backend

## 🔑 Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:pass@host:port/db
SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-key
OPENAI_API_KEY=your-openai-key
```

**Frontend (.env):**
```env
VITE_API_BASE_URL=http://localhost:8000
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

Proprietary - All rights reserved
