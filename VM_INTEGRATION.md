# Kiff VM Integration

This document describes the implementation of custom micro VM infrastructure for Kiff's code execution, replacing E2B with an in-house solution that leverages existing ML infrastructure.

## Overview

The VM integration allows Kiff to execute user-generated code in secure, isolated micro VMs without relying on external services like E2B. The system reuses existing ML and vector storage infrastructure while providing fast, scalable code execution.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Kiff Platform                        │
├─────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                    │
│  └── Launcher → API calls → Backend                    │
├─────────────────────────────────────────────────────────┤
│  Backend (FastAPI)                                     │
│  ├── preview_live.py (Provider Factory)                │
│  ├── InfraVMProvider (New)                            │
│  └── E2BProvider (Existing)                           │
├─────────────────────────────────────────────────────────┤
│  VM Orchestrator (Port 8002)                          │
│  ├── VM Lifecycle Management                           │
│  ├── Resource Allocation                               │
│  └── Security & Isolation                              │
├─────────────────────────────────────────────────────────┤
│  Micro VMs (Docker-based)                             │
│  ├── Code Execution VM (Python 3.11-slim)             │
│  ├── File Management                                   │
│  ├── Package Installation                              │
│  └── Development Server                                │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Provider Factory Pattern

Modified `backend-lite-v2/app/routes/preview_live.py` to use a factory pattern instead of hardcoded E2B:

```python
def _provider():
    provider_type = os.getenv("SANDBOX_PROVIDER", "e2b").lower()
    
    if provider_type == "infra":
        return InfraVMProvider()
    else:
        return E2BProvider()  # Default fallback
```

### 2. InfraVMProvider

Implemented `backend-lite-v2/app/util/sandbox_infra.py` with the same interface as E2BProvider:

**Key Methods:**
- `create_sandbox()` - Provisions micro VM via orchestrator
- `apply_files()` - Deploys user code to VM workspace
- `set_runtime()` - Configures Python/Node.js/Vite runtime
- `install_packages()` - Installs dependencies in VM
- `restart()` - Starts development server
- `get_preview_url()` - Returns accessible URL
- `tail_logs()` - Retrieves application logs

### 3. VM Orchestrator Service

Created `micro-vm-service/vm-orchestrator/` with:

- **FastAPI API** for VM management
- **Docker integration** for container lifecycle
- **Resource management** with CPU/memory limits
- **Security policies** (non-root execution, capability dropping)
- **Health monitoring** and logging

### 4. Optimized VM Images

**Code Execution VM** (`vm-images/code-execution/`):
- Python 3.11-slim base (not Alpine for better Python compatibility)
- Minimal dependencies with `apt-get --no-install-recommends`
- `pip install --no-cache-dir` for optimized builds
- Non-root user (UID 1001) for security
- Node.js support for JavaScript execution

## Configuration

### Environment Variables

Added to `.env`:

```bash
# Sandbox Provider Selection
SANDBOX_PROVIDER=infra  # Options: e2b, infra

# Infrastructure VM Provider
INFRA_API_URL=http://localhost:8002
INFRA_API_KEY=your_infra_api_key_here
INFRA_TEMPLATE=code_execution
INFRA_ENABLE_MOCK=true  # For development
INFRA_PREVIEW_DOMAIN=preview.kiff.dev

# Preview Service Ports
PREVIEW_VITE_PORT=5173
PREVIEW_NODE_PORT=3000
PREVIEW_PYTHON_PORT=8000
```

## Deployment

### Development (Mock Mode)

```bash
# 1. Set environment
export SANDBOX_PROVIDER=infra
export INFRA_ENABLE_MOCK=true

# 2. Start backend
cd backend-lite-v2
python -m uvicorn app.main:app --reload --port 8000

# 3. Test integration
python test_vm_integration.py
```

### Production (Full VM Service)

```bash
# 1. Start VM infrastructure
docker-compose -f docker-compose.vm-service.yml up -d

# 2. Configure environment
export SANDBOX_PROVIDER=infra
export INFRA_ENABLE_MOCK=false
export INFRA_API_URL=http://vm-orchestrator:8002

# 3. Deploy backend with VM support
docker-compose up backend-lite-v2
```

## Supported Runtimes

### 1. Vite (React/Vue) Projects
- Auto-detects `package.json` with vite dependency
- Runs `npm run dev -- --host --port 5173`
- Supports hot reloading and live preview

### 2. Node.js Applications
- Detects Express/Fastify/Koa frameworks
- Runs `npm start` or `node server.js`
- Environment variable injection

### 3. Python Applications
- FastAPI with `uvicorn` server
- Flask with development server
- Virtual environment isolation
- Package installation with pip

## Security Features

### Container Security
- **Non-root execution** (UID 1001)
- **Capability dropping** (only essential capabilities)
- **Read-only filesystem** with specific write areas
- **Resource limits** (CPU, memory, storage)
- **Network isolation** with controlled access

### VM Isolation
- **Process isolation** via Docker containers
- **Filesystem isolation** with workspace boundaries
- **Execution timeouts** to prevent runaway processes
- **Secret management** with secure injection

## API Compatibility

The implementation maintains **100% API compatibility** with existing E2B integration:

- Same HTTP endpoints (`/api/preview/*`)
- Same request/response formats
- Same SSE streaming for real-time updates
- Same tenant isolation via `X-Tenant-ID` header

## Frontend Impact

**Zero frontend changes required.** The frontend continues to use:
- `frontend-lite/src/app/kiffs/launcher/utils/preview.ts`
- Same API calls to `/api/preview/sandbox`, `/api/preview/files`, etc.
- Same SSE streaming for live updates

## Testing

### Integration Test Suite

Run the comprehensive test suite:

```bash
python test_vm_integration.py
```

**Tests include:**
- Sandbox creation and configuration
- File deployment (React Vite app)
- Package installation (npm/pip)
- Development server startup
- Log retrieval and monitoring
- Python FastAPI application deployment

### Manual Testing

1. **Create Sandbox**: `POST /api/preview/sandbox`
2. **Deploy Files**: `POST /api/preview/files` 
3. **Install Packages**: `POST /api/preview/install`
4. **Start Server**: `POST /api/preview/restart`
5. **Check Logs**: `GET /api/preview/logs`
6. **Access Preview**: Visit returned preview URL

## Performance Optimizations

### Container Optimizations
- **Layer caching** with multi-stage builds
- **Minimal base images** (Python 3.11-slim)
- **Package cleanup** after installation
- **Fast startup** (<2 seconds for container creation)

### Resource Efficiency
- **Shared ML infrastructure** (no model duplication)
- **Connection pooling** to services
- **Resource limits** prevent resource exhaustion
- **Container reuse** for similar workloads

## Monitoring and Observability

### Health Checks
- VM Orchestrator health endpoint
- Container health monitoring
- Resource usage tracking
- Application log streaming

### Metrics (Optional)
- Prometheus metrics collection
- Grafana dashboards
- Container resource usage
- API response times

## Migration Path

### Phase 1: Development Testing
- [x] Implement InfraVMProvider
- [x] Add provider factory
- [x] Enable mock mode testing
- [x] Create integration tests

### Phase 2: Production Deployment
- [ ] Deploy VM Orchestrator service
- [ ] Configure preview domain/SSL
- [ ] Set up monitoring
- [ ] Switch SANDBOX_PROVIDER=infra

### Phase 3: E2B Phase-out
- [ ] Monitor VM service stability
- [ ] Optimize performance
- [ ] Remove E2B dependency
- [ ] Archive E2BProvider code

## Troubleshooting

### Common Issues

**1. VM Orchestrator not available**
```bash
# Check service status
curl http://localhost:8002/health

# Start VM service
docker-compose -f docker-compose.vm-service.yml up vm-orchestrator
```

**2. Container creation fails**
```bash
# Check Docker daemon
docker ps

# Check VM orchestrator logs
docker-compose logs vm-orchestrator
```

**3. Package installation fails**
```bash
# Check VM logs
curl "http://localhost:8000/api/preview/logs?session_id=your-session"

# Verify runtime detection
# Python: Creates .venv, uses pip
# Node: Uses npm install
```

**4. Preview URL not accessible**
```bash
# Check port forwarding
docker port vm-container-name

# Verify network configuration
docker network ls
docker network inspect kiff-vm-network
```

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=DEBUG
export INFRA_ENABLE_MOCK=true  # For safe testing
```

## Future Enhancements

### Planned Features
- **Auto-scaling** based on demand
- **VM pooling** for faster allocation
- **Persistent storage** for user projects
- **GPU support** for ML workloads
- **Multi-region deployment**

### Integration Opportunities
- **Vector store warming** for AI-powered features
- **ML model access** for code analysis
- **Agent coordination** for multi-step workflows
- **Code generation pipeline** integration

## Support

For issues or questions:
1. Check the integration test results
2. Review VM orchestrator logs
3. Verify environment configuration
4. Check Docker daemon status
5. Test with mock mode first