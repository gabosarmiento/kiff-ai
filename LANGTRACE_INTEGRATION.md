# LangTrace Observability Integration for Agno

This document outlines the LangTrace observability integration implemented for your Agno-based backend system.

## Overview

LangTrace has been integrated to provide comprehensive observability for your Agno agents, including:
- Automatic tracing of agent interactions
- Performance metrics collection
- Error tracking and logging
- Cross-agent observability

## Setup and Configuration

### 1. Dependencies Added

The following dependency has been added to `backend/requirements.txt`:
```
langtrace-python-sdk>=2.0.0
```

### 2. Environment Variables

Add your LangTrace API key to your `.env` file:
```bash
LANGTRACE_API_KEY=your_langtrace_api_key_here
```

To get your API key:
1. Sign up at [Langtrace](https://app.langtrace.ai/)
2. Obtain your API key from the Langtrace dashboard
3. Add it to your environment variables

### 3. Automatic Initialization

LangTrace is automatically initialized in your FastAPI application (`app/main.py`) when the server starts. The initialization:
- Checks for the presence of `LANGTRACE_API_KEY`
- Initializes LangTrace if the key is available
- Logs initialization status
- Gracefully handles missing dependencies or configuration

## Implementation Details

### Core Configuration Module

A centralized configuration module has been created at `app/core/langtrace_config.py` that provides:

- **`initialize_langtrace()`**: Initializes LangTrace with environment configuration
- **`trace_agno_agent(name)`**: Decorator for tracing Agno agent operations
- **`log_agent_interaction()`**: Logs detailed agent interaction data
- **`is_langtrace_enabled()`**: Checks if LangTrace is available and initialized
- **`add_trace_metadata()`**: Adds custom metadata to traces

### Agent Instrumentation

The following key components have been instrumented with LangTrace observability:

#### 1. GroqLLMService (`app/services/groq_llm_service.py`)
- **Method**: `generate_application()`
- **Tracing**: `@trace_agno_agent("groq_generate_application")`
- **Logging**: Input parameters, output results, and errors

#### 2. Knowledge Management Engine (`app/knowledge/engine/knowledge_management_engine.py`)
- **Imports**: LangTrace configuration imported
- **Ready for**: Additional method-level tracing as needed

### Usage Examples

#### Basic Agent Tracing
```python
from app.core.langtrace_config import trace_agno_agent, log_agent_interaction

@trace_agno_agent("my_agent_operation")
async def my_agent_function(input_data):
    # Log the start of the operation
    log_agent_interaction(
        agent_name="MyAgent",
        input_data=input_data
    )
    
    try:
        # Your agent code here
        result = await agent.run(input_data)
        
        # Log successful completion
        log_agent_interaction(
            agent_name="MyAgent",
            input_data=input_data,
            output_data=result
        )
        
        return result
    except Exception as e:
        # Log errors
        log_agent_interaction(
            agent_name="MyAgent",
            input_data=input_data,
            error=e
        )
        raise
```

#### Adding Custom Metadata
```python
from app.core.langtrace_config import add_trace_metadata

# Add custom metadata to current trace
add_trace_metadata({
    "user_id": "user123",
    "session_id": "session456",
    "model_version": "llama-3.3-70b-versatile"
})
```

## Integration Points

### Current Integrations
1. **Main Application**: LangTrace initialized in FastAPI startup
2. **GroqLLMService**: Full tracing and logging for application generation
3. **Knowledge Management**: Ready for additional instrumentation

### Potential Additional Integrations
You can easily add LangTrace observability to other agent components:

- `app/services/agentic_monitoring_service.py`
- `app/knowledge/engine/julia_bff_knowledge_engine.py`
- `app/knowledge/engine/agentic_sitemap_extractor.py`
- `app/api/routes/kiff.py`

Simply import the decorators and add them to key methods:
```python
from app.core.langtrace_config import trace_agno_agent, log_agent_interaction

@trace_agno_agent("agent_method_name")
def your_agent_method(self, input_data):
    # Your existing code with added logging
    log_agent_interaction("YourAgent", input_data)
    # ... rest of method
```

## Frontend Integration

For your Docker-based frontend, you can optionally integrate LangTrace's JavaScript SDK:

1. Install the JavaScript SDK:
```bash
npm install @langtrace/typescript-sdk
```

2. Initialize in your frontend application:
```javascript
import { init } from '@langtrace/typescript-sdk';

init({
  api_key: process.env.LANGTRACE_API_KEY,
  // Additional configuration
});
```

## Testing the Integration

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Environment Variable
```bash
export LANGTRACE_API_KEY=your_actual_api_key_here
```

### 3. Start Your Backend
```bash
./start-backend.sh
```

### 4. Monitor Logs
Look for initialization messages:
- ✅ Success: "LangTrace observability initialized successfully"
- ⚠️ Warning: "LANGTRACE_API_KEY not found. LangTrace observability disabled."

### 5. Test Agent Operations
Trigger any agent operations (e.g., through your API endpoints) and check the LangTrace dashboard for traces.

## Benefits

With this integration, you now have:

1. **Automatic Tracing**: All instrumented agent operations are automatically traced
2. **Performance Monitoring**: Track execution times, token usage, and throughput
3. **Error Tracking**: Comprehensive error logging with context
4. **Cross-Agent Visibility**: See how different agents interact in complex workflows
5. **Production Ready**: Graceful handling of missing configuration or dependencies

## Troubleshooting

### Common Issues

1. **"langtrace-python-sdk not installed"**
   - Run: `pip install -r requirements.txt`

2. **"LANGTRACE_API_KEY not found"**
   - Add your API key to the `.env` file
   - Verify the key is correctly set: `echo $LANGTRACE_API_KEY`

3. **No traces appearing in dashboard**
   - Verify API key is correct
   - Check that agent methods are being called
   - Look for error messages in application logs

### Debug Mode
To enable more verbose logging, set:
```bash
export LANGTRACE_DEBUG=true
```

## Next Steps

1. **Get your LangTrace API key** from [app.langtrace.ai](https://app.langtrace.ai/)
2. **Add it to your `.env` file**
3. **Install dependencies**: `pip install -r requirements.txt`
4. **Start your backend** and test the integration
5. **Monitor the LangTrace dashboard** for agent traces
6. **Add tracing to additional agent methods** as needed

The integration is designed to be non-intrusive and will gracefully degrade if LangTrace is not available, ensuring your application continues to work normally.
