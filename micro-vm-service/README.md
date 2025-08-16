# Kiff Micro VM Service

A custom micro VM system for agentic applications that leverages existing ML infrastructure and provides secure, isolated execution environments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Kiff Micro VM Platform                   │
├─────────────────────────────────────────────────────────────┤
│  VM Orchestrator (Python FastAPI)                          │
│  ├── VM Lifecycle Management                               │
│  ├── Resource Allocation & Limits                          │
│  ├── API Gateway & Service Discovery                       │
│  └── Security & Isolation Controls                         │
├─────────────────────────────────────────────────────────────┤
│  Existing ML Infrastructure (Reused)                       │
│  ├── Torch/Transformers Service (Port 8001)               │
│  ├── Vector Storage Service (External, App-Warmed)         │
│  └── Core Backend (Port 8000)                             │
├─────────────────────────────────────────────────────────────┤
│  Micro VMs (Python 3.11-slim based)                       │
│  ├── Agent VM 1 ────┐                                     │
│  ├── Agent VM 2 ────┼── Code Execution Sandboxes          │
│  ├── Agent VM N ────┘                                     │
│  └── Shared Resources: Vector Store, ML Models            │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 🔄 **Reuse Existing Infrastructure**
- Leverage your current ML service (torch/transformers)
- External vector store warmed by main app
- Minimal resource duplication

### 🐳 **Optimized Container Design**
- Python 3.11-slim base (not Alpine)
- `apt-get --no-install-recommends` + cleanup
- `pip install --no-cache-dir` for minimal image size
- Layer optimization for fast startup

### 🛡️ **Security & Isolation**
- Container-based micro VMs with resource limits
- Network isolation with controlled API access
- Secure code execution sandboxes
- Runtime security policies

### 🚀 **Performance Optimizations**
- Fast VM spin-up (<2 seconds)
- Shared ML model access (no duplication)
- Persistent connections to vector store
- Resource pooling and reuse

## VM Types

1. **Code Execution VM**: Secure Python/Node.js execution
2. **ML Agent VM**: Access to transformers + vector store
3. **API Composition VM**: Multi-service orchestration
4. **Data Processing VM**: ETL and data transformation

## Getting Started

See individual service documentation in their respective directories.