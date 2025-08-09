"""
TradeForge AI LLM Providers
===========================

Centralized LLM provider configuration following Julia BFF's proven pattern.
Multiple models for different tasks with proper initialization and cleanup.
"""

import os
import atexit
from pathlib import Path
from dotenv import load_dotenv
from agno.models.groq import Groq

# Load environment variables from .env file (in kiff-ai directory)
project_root = Path(__file__).parent.parent.parent.parent
env_file = project_root / ".env"
load_dotenv(env_file)

# Validate required environment variables
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError(f"GROQ_API_KEY not found in .env file at {env_file}")


def initialize_tradeforge_providers():
    """Initialize TradeForge AI's LLM providers with AGNO/Groq best practices."""
    print("[INFO]: Initializing TradeForge AI LLM providers with latest best practices...")

    # High-performance model for complex reasoning and knowledge processing
    llm_highest = Groq(
        id="llama-3.3-70b-versatile",
        api_key=groq_api_key,
        temperature=0.3
    )
    
    # DeepSeek reasoning model for advanced analysis and chain-of-thought
    llm_reasoning = Groq(
        id="deepseek-r1-distill-llama-70b",
        api_key=groq_api_key,
        temperature=0.6,
        top_p=0.95,
        max_tokens=20480    
    )
    
    # Qwen model for general analysis and content processing
    llm_analysis = Groq(
        id="qwen/qwen3-32b",
        api_key=groq_api_key,
        temperature=0.2
    )
    
    # Qwen planner for strategic planning and orchestration tasks
    llm_planning = Groq(
        id="qwen/qwen3-32b",
        api_key=groq_api_key,
        temperature=0.6,
        top_p=0.95
    )
    
    # MoonshotAI Kimi-K2 for agentic intelligence and tool use
    llm_agentic = Groq(
        id="moonshotai/kimi-k2-instruct",
        api_key=groq_api_key,
        temperature=0.3,
        max_tokens=16384
    )
    
    # Fast model for quick tasks and simple processing
    llm_quick = Groq(
        id="llama-3.1-8b-instant",
        api_key=groq_api_key,
        temperature=0.2
    )
    
    # Alternative middle-tier model for balanced performance
    llm_balanced = Groq(
        id="meta-llama/llama-4-scout-17b-16e-instruct",
        api_key=groq_api_key,
        temperature=0.5
    )
    
    # OpenAI GPT-OSS models for advanced reasoning and code generation
    llm_gpt_oss_120b = Groq(
        id="openai/gpt-oss-120b",
        api_key=groq_api_key,
        temperature=0.3,
        max_tokens=16384
    )
    
    llm_gpt_oss_20b = Groq(
        id="openai/gpt-oss-20b",
        api_key=groq_api_key,
        temperature=0.3,
        max_tokens=16384
    )

    print("✅ TradeForge AI LLM providers initialized with AGNO best practices")
    return llm_highest, llm_reasoning, llm_analysis, llm_planning, llm_agentic, llm_quick, llm_balanced, llm_gpt_oss_120b, llm_gpt_oss_20b


# Initialize providers
llm_highest, llm_reasoning, llm_analysis, llm_planning, llm_agentic, llm_quick, llm_balanced, llm_gpt_oss_120b, llm_gpt_oss_20b = initialize_tradeforge_providers()


def get_tradeforge_models():
    """Get TradeForge AI model dictionary for easy access."""
    return {
        "highest": llm_highest,
        "reasoning": llm_reasoning,
        "analysis": llm_analysis,
        "planning": llm_planning,
        "agentic": llm_agentic,
        "quick": llm_quick,
        "balanced": llm_balanced,
        "kimi-k2": llm_agentic,  # Alias for backward compatibility
        "gpt-oss-120b": llm_gpt_oss_120b,
        "gpt-oss-20b": llm_gpt_oss_20b
    }


def get_model_for_task(task_type: str):
    """Get the best model for a specific task type with AGNO best practices."""
    task_models = {
        # Knowledge management tasks
        "reasoning": llm_reasoning,          # Use DeepSeek for complex reasoning and CoT
        "planning": llm_planning,            # Use Qwen planner for strategic tasks
        "analysis": llm_analysis,            # Use Qwen for content analysis
        "discovery": llm_reasoning,          # Use reasoning model for sitemap discovery
        "extraction": llm_analysis,          # Use analysis model for URL extraction
        "filtering": llm_quick,              # Use quick model for URL filtering
        
        # Agent generation tasks
        "generation": llm_highest,           # Use highest quality for agent generation
        "agentic": llm_agentic,             # Use Kimi-K2 for agentic intelligence
        "coding": llm_agentic,              # Use Kimi-K2 for advanced code generation
        "tool_use": llm_agentic,            # Use Kimi-K2 for tool calling and API interactions
        
        # General tasks
        "quick": llm_quick,                 # Use fast model for simple tasks
        "balanced": llm_balanced,           # Use balanced model for general tasks
        "default": llm_analysis             # Default fallback
    }
    return task_models.get(task_type, llm_analysis)


def make_tradeforge_request(model, messages, max_retries=3):
    """
    Make a request to TradeForge AI LLM with error handling and retry logic.
    
    Args:
        model: The Groq model instance
        messages: List of message dicts for the chat
        max_retries: Maximum number of retry attempts
        
    Returns:
        tuple: (response_text, tokens_used, cost)
    """
    try:
        # Make the request using AGNO's built-in method
        response = model.chat(messages)
        
        # Extract response text
        if hasattr(response, 'choices') and response.choices:
            response_text = response.choices[0].message.content
        else:
            response_text = str(response)
        
        # Get token usage if available
        tokens_used = 0
        cost = 0.0
        
        if hasattr(response, 'usage'):
            tokens_used = getattr(response.usage, 'total_tokens', 0)
            
            # Calculate cost based on model pricing (per 1K tokens)
            model_id = getattr(model, 'id', 'unknown')
            pricing_map = {
                "deepseek-r1-distill-llama-70b": 0.008,  # Higher cost for reasoning
                "qwen/qwen3-32b": 0.006,
                "moonshotai/kimi-k2-instruct": 0.002,    # $1/1M input, $3/1M output (avg ~$2/1M)
                "llama-3.3-70b-versatile": 0.004,
                "llama-3.1-8b-instant": 0.002,
                "meta-llama/llama-4-scout-17b-16e-instruct": 0.003
            }
            price_per_1k = pricing_map.get(model_id, 0.005)
            cost = (tokens_used / 1000) * price_per_1k
        
        return response_text, tokens_used, cost
        
    except Exception as e:
        print(f"Error in TradeForge AI LLM request: {e}")
        return "", 0, 0.0


def _cleanup_tradeforge_clients():
    """Cleanup TradeForge AI LLM clients on exit."""
    for model in (llm_highest, llm_reasoning, llm_analysis, llm_planning, llm_agentic, llm_quick, llm_balanced):
        wrapper = getattr(model, "_client", None)
        if wrapper and hasattr(wrapper, 'close'):
            try:
                wrapper.close()
            except:
                pass


# Register cleanup on exit
atexit.register(_cleanup_tradeforge_clients)

# Fix for Groq client destructor issues
try:
    import groq._base_client
    groq._base_client.SyncHttpxClientWrapper.__del__ = lambda self: None
except ImportError:
    pass  # Groq not available, skip fix


# Export commonly used models for direct import
__all__ = [
    "get_model_for_task",
    "get_tradeforge_models", 
    "make_tradeforge_request",
    "llm_highest",
    "llm_reasoning", 
    "llm_analysis",
    "llm_planning",
    "llm_agentic",
    "llm_quick",
    "llm_balanced",
    "llm_gpt_oss_120b",
    "llm_gpt_oss_20b"
]
