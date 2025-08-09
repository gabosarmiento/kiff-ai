# Modular Agentic RAG System - "Lego" Architecture

## 🎯 Overview

The Modular Agentic RAG system provides a **swappable, "Lego-style" architecture** for Retrieval-Augmented Generation implementations. You can easily switch between different RAG approaches (ARAG1 → ARAG2 → ARAG3) without changing core application code.

## 🧱 Architecture Components

### 1. **Interface Layer** (`interfaces/agentic_rag_interface.py`)
- `AgenticRAGInterface` - Abstract base class defining the RAG contract
- `RAGFactory` - Factory pattern for creating and managing implementations
- `RAGMetrics` - Standardized metrics across all implementations
- `DomainConfig` - Configuration for knowledge domains

### 2. **Implementation Layer** (`implementations/`)
- `arag_v1.py` - Multi-agent pipeline (current sophisticated system)
- `arag_v2_example.py` - Enhanced parallel processing example
- Future: `arag_v3.py`, `arag_experimental.py`, etc.

### 3. **Service Layer** (`services/modular_rag_service.py`)
- `ModularRAGService` - Core service for RAG operations
- Global service management and easy swapping
- Clean integration with rest of Kiff AI

### 4. **API Layer** (`api/routes/modular_rag.py`)
- REST endpoints for RAG management
- Implementation switching via API
- Real-time processing metrics
- Knowledge search endpoints

## 🚀 Quick Start

### Basic Usage

```python
from app.services.modular_rag_service import get_rag_service

# Get default RAG implementation (ARAG v1)
rag_service = await get_rag_service()

# Search knowledge
results = await rag_service.search_knowledge("openai", "how to use GPT-4")

# Process new domain
domain_config = DomainConfig(
    name="fastapi",
    display_name="FastAPI Framework", 
    description="FastAPI documentation",
    sources=["https://fastapi.tiangolo.com/"]
)

async for metrics in rag_service.process_domain(domain_config):
    print(f"Stage: {metrics.stage.value}, Progress: {metrics.urls_processed}")
```

### Swapping Implementations ("Lego" Style)

```python
# Switch to enhanced v2 implementation
await rag_service.switch_implementation("arag_v2")

# Or switch via API
POST /api/rag/switch
{
    "implementation": "arag_v2",
    "kwargs": {"max_workers": 8, "enable_caching": true}
}
```

## 🔧 Available Implementations

### ARAG v1 - Multi-Agent Pipeline (Default)
- **4 Specialized Agents**: URL prioritizer, content analyzer, chunker, verifier
- **Domain-agnostic processing**
- **LanceDB vectorization**
- **Quality scoring and validation**

```python
# Use explicitly
rag = await create_rag("arag_v1")
```

### ARAG v2 - Enhanced Parallel (Example)
- **Parallel processing** with thread pools
- **Advanced caching** for faster retrieval
- **Better quality scoring**
- **Streaming search results**

```python
# Use with custom config
rag = await create_rag("arag_v2", max_workers=8, enable_caching=True)
```

## 📊 Real-time Metrics

All implementations provide standardized metrics:

```python
# Get current metrics
metrics = await rag_service.get_current_metrics()

# Example metrics structure
{
    "pipeline_id": "openai_v1_1234567890",
    "domain": "openai", 
    "stage": "vectorization",
    "status": "processing",
    "urls_processed": 45,
    "chunks_created": 230,
    "tokens_used": 12500,
    "quality_score": 0.87,
    "processing_time_seconds": 125.3
}
```

## 🌐 API Endpoints

### List Available Implementations
```http
GET /api/rag/implementations
```

### Switch Implementation
```http
POST /api/rag/switch
{
    "implementation": "arag_v2",
    "kwargs": {"max_workers": 4}
}
```

### Process Domain
```http
POST /api/rag/process-domain
{
    "name": "stripe",
    "display_name": "Stripe Payments",
    "description": "Stripe API documentation", 
    "sources": ["https://stripe.com/docs/"]
}
```

### Search Knowledge
```http
POST /api/rag/search
{
    "domain": "openai",
    "query": "how to use function calling",
    "limit": 5
}
```

### Get Metrics
```http
GET /api/rag/metrics?domain=openai
```

### Health Check
```http
GET /api/rag/health
```

## 🔨 Creating New Implementations

### 1. Implement the Interface

```python
from app.knowledge.interfaces.agentic_rag_interface import AgenticRAGInterface

class ARAG_V3(AgenticRAGInterface):
    @property
    def version(self) -> str:
        return "3.0.0"
    
    @property  
    def name(self) -> str:
        return "My Custom RAG v3"
    
    async def initialize(self, **kwargs) -> bool:
        # Your initialization logic
        pass
    
    async def process_domain(self, domain_config, progress_callback=None):
        # Your domain processing logic
        pass
    
    async def search_knowledge(self, domain, query, limit=5):
        # Your search logic
        pass
    
    # ... implement other required methods
```

### 2. Register with Factory

```python
from app.knowledge.interfaces.agentic_rag_interface import RAGFactory

# Register your implementation
RAGFactory.register("arag_v3", ARAG_V3, is_default=False)
```

### 3. Use Your Implementation

```python
# Switch to your new implementation
await rag_service.switch_implementation("arag_v3")
```

## 🔄 Integration with Existing Code

### Replace Current RAG Usage

**Before (hardcoded):**
```python
from app.knowledge.engine.knowledge_management_engine import get_knowledge_engine

engine = get_knowledge_engine()
results = await engine.search_domain_knowledge("openai", "GPT-4")
```

**After (modular):**
```python
from app.services.modular_rag_service import search_rag

results = await search_rag("openai", "GPT-4")
```

### Integration Points

1. **AGNO Agent Integration** - Replace knowledge base calls
2. **API Gallery** - Use for documentation processing  
3. **Conversational Chat** - Enhanced knowledge retrieval
4. **Generate V0** - Better context for code generation

## 📈 Performance Monitoring

### Built-in Metrics
- Processing time per stage
- Token consumption tracking
- Quality scores and validation
- Error rates and recovery

### Custom Metrics
```python
# Add custom metrics in your implementation
metrics.custom_field = "my_value"
yield metrics
```

## 🛡️ Error Handling & Recovery

### Graceful Degradation
- Automatic fallback to previous implementation on switch failure
- Partial processing recovery
- Cached results during failures

### Health Monitoring
```python
# Check system health
health = await rag_service.health_check()
if health["status"] != "healthy":
    # Handle degraded state
    pass
```

## 🔮 Future Roadmap

### Planned Implementations
- **ARAG v3**: Graph-based knowledge representation
- **ARAG Experimental**: LLM-based dynamic chunking
- **ARAG Hybrid**: Multi-modal document processing

### Integration Enhancements
- Real-time knowledge updates
- Cross-domain knowledge fusion
- Adaptive quality thresholds
- Auto-scaling based on load

## 🤝 Contributing

### Adding New Implementations
1. Create new file in `implementations/`
2. Implement `AgenticRAGInterface`
3. Register with `RAGFactory`
4. Add tests and documentation
5. Update this README

### Testing Your Implementation
```python
# Test basic functionality
rag = await create_rag("your_implementation")
await rag.initialize()

# Test domain processing
domain_config = DomainConfig(...)
async for metrics in rag.process_domain(domain_config):
    assert metrics.status in ["processing", "completed", "error"]

# Test search
results = await rag.search_knowledge("test_domain", "test query")
assert isinstance(results, list)
```

## 📝 Examples

See `arag_v2_example.py` for a complete implementation example showing:
- Enhanced parallel processing
- Advanced caching strategies  
- Better quality scoring
- Proper resource management

---

**The modular RAG system is now live and ready for easy "Lego" swapping! 🧱✨**
