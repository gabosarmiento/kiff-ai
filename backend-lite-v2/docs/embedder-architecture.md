# Embedder Architecture - Kiff AI Backend

## Overview

The Kiff AI backend uses a **centralized embedder cache system** to avoid redundant model downloads and API costs while ensuring consistent embeddings across all services.

## Architecture Components

### 1. Cached Embedder Service
**File:** `app/services/embedder_cache.py`

- **Model:** `sentence-transformers/all-MiniLM-L6-v2` (~80MB)
- **Strategy:** Single global instance, lazy loading
- **Benefits:** No API costs, fast local processing, consistent embeddings

```python
from app.services.embedder_cache import get_embedder
embedder = get_embedder()  # Returns cached AGNO embedder instance
```

### 2. Vector Storage Integration
**File:** `app/services/vector_storage.py`

- **Database:** LanceDB for vector similarity search
- **Integration:** Uses cached embedder for text→vector conversion
- **Storage:** Pack content, descriptions, code examples

### 3. AGNO Framework Integration

#### Launcher Agent
**File:** `app/services/launcher_agent.py`

- **Vector DB:** LanceDB with cached embedder (no OpenAI calls)
- **Storage:** SQLite for session persistence
- **Model:** Groq `moonshotai/kimi-k2-instruct`

#### Pack Processor
**File:** `app/services/pack_processor.py`

- **Tools:** API analysis, code generation, pattern creation
- **Vector Storage:** Integrates with centralized vector service
- **Model:** Groq `llama-3.3-70b-versatile`

## Configuration

### Environment Variables
```bash
# Cached embedder settings
TRANSFORMERS_CACHE=/models/hf
SENTENCE_TRANSFORMERS_HOME=/models/sentence_transformers
TOKENIZERS_PARALLELISM=false

# Vector database
LANCEDB_DIR=./local_lancedb

# Groq API (for LLM inference only, not embeddings)
GROQ_API_KEY=your_groq_key_here
```

### Model Storage
- **Development:** `./local_lancedb/` (local directory)
- **Production:** `/models/` (mounted volume for Docker)

## Benefits of This Architecture

### 🚀 Performance
- **Fast startup:** Models cached in memory after first load
- **No API latency:** Local embedding generation
- **Consistent vectors:** Same model across all services

### 💰 Cost Efficiency
- **Zero API costs** for embeddings (vs $0.0001/1K tokens for OpenAI)
- **Predictable costs:** Only Groq API for LLM inference
- **Efficient storage:** Small model (~80MB) vs cloud dependencies

### 🔒 Privacy & Reliability
- **Local processing:** No external calls for embeddings
- **Offline capable:** Works without internet for embeddings
- **No quota limits:** Unlike OpenAI embedding APIs

## Usage Patterns

### ✅ Correct Usage
```python
# Use centralized embedder
from app.services.embedder_cache import get_embedder
embedder = get_embedder()

# LanceDB with cached embedder
vector_db = LanceDb(
    table_name="my_table",
    uri="./data",
    embedder=embedder  # Use cached embedder
)
```

### ❌ Avoid This
```python
# Don't create new embedder instances
from agno.vectordb.lancedb import LanceDb
vector_db = LanceDb(table_name="my_table")  # Uses OpenAI by default!
```

## Monitoring

### Health Check Endpoint
```bash
curl http://localhost:8000/health
```

Returns embedder cache status:
```json
{
  "model_cache": {
    "embed_model_cached": true,
    "raw_model_cached": true, 
    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
  }
}
```

### Debug Cache Status
```python
from app.services.embedder_cache import get_cache_stats
stats = get_cache_stats()
print(stats)
```

## Troubleshooting

### Issue: "Using OpenAIEmbedder as default"
**Cause:** LanceDb not configured with explicit embedder
**Solution:** Always pass `embedder=get_embedder()` to LanceDb constructor

### Issue: Model download taking long time
**Cause:** First-time model download from HuggingFace
**Solution:** Normal behavior, model will be cached for subsequent uses

### Issue: "AGNO agent initialization failed"
**Cause:** Missing GROQ_API_KEY or incorrect model ID
**Solution:** Check environment variables and model availability

## Future Enhancements

1. **Model Variants:** Support for different embedding models per use case
2. **Quantization:** Smaller model variants for resource-constrained environments  
3. **Batch Processing:** Optimize embedding generation for large documents
4. **Multi-language:** Support for multilingual embedding models