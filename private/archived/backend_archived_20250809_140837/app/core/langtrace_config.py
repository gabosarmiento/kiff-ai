"""
LangTrace configuration and utilities for Agno observability.
This module provides centralized LangTrace setup and helper functions.
"""

import os
import logging
from typing import Optional, Any, Dict
from functools import wraps

logger = logging.getLogger(__name__)

# Global flag to track if LangTrace is available and initialized
LANGTRACE_AVAILABLE = False
LANGTRACE_INITIALIZED = False

try:
    from langtrace_python_sdk import langtrace
    from langtrace_python_sdk.utils.with_root_span import with_langtrace_root_span
    LANGTRACE_AVAILABLE = True
except ImportError:
    logger.warning("langtrace-python-sdk not installed. LangTrace observability will be disabled.")
    # Create dummy decorator for when LangTrace is not available
    def with_langtrace_root_span(name: str = ""):
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            return wrapper
        return decorator


def initialize_langtrace() -> bool:
    """
    Initialize LangTrace with environment configuration.
    
    Returns:
        bool: True if initialization was successful, False otherwise
    """
    global LANGTRACE_INITIALIZED
    
    if not LANGTRACE_AVAILABLE:
        logger.warning("LangTrace SDK not available. Skipping initialization.")
        return False
    
    if LANGTRACE_INITIALIZED:
        logger.info("LangTrace already initialized.")
        return True
    
    api_key = os.getenv("LANGTRACE_API_KEY")
    if not api_key:
        logger.warning("LANGTRACE_API_KEY not found. LangTrace observability disabled.")
        return False
    
    try:
        # Initialize LangTrace with optional configuration
        langtrace.init(
            api_key=api_key,
            # You can add more configuration options here
            # batch_size=10,
            # write_spans_to_console=False,
        )
        LANGTRACE_INITIALIZED = True
        logger.info("LangTrace observability initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize LangTrace: {e}")
        return False


def is_langtrace_enabled() -> bool:
    """Check if LangTrace is available and initialized."""
    return LANGTRACE_AVAILABLE and LANGTRACE_INITIALIZED


def trace_agno_agent(name: str = "agno_agent"):
    """
    Decorator to trace Agno agent operations with LangTrace.
    
    Args:
        name: Name for the trace span
    
    Usage:
        @trace_agno_agent("my_agent_operation")
        def my_agent_function():
            # Your agent code here
            pass
    """
    if not is_langtrace_enabled():
        # Return a no-op decorator if LangTrace is not available
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    return with_langtrace_root_span(name)


def add_trace_metadata(metadata: Dict[str, Any]) -> None:
    """
    Add metadata to the current trace span.
    
    Args:
        metadata: Dictionary of metadata to add to the trace
    """
    if not is_langtrace_enabled():
        return
    
    try:
        # Add metadata to current span if available
        # This would depend on the specific LangTrace SDK implementation
        logger.debug(f"Adding trace metadata: {metadata}")
    except Exception as e:
        logger.warning(f"Failed to add trace metadata: {e}")


def log_agent_interaction(agent_name: str, input_data: Any, output_data: Any = None, error: Exception = None) -> None:
    """
    Log agent interaction details for observability.
    
    Args:
        agent_name: Name of the agent
        input_data: Input data for the agent
        output_data: Output data from the agent (optional)
        error: Any error that occurred (optional)
    """
    try:
        log_data = {
            "agent_name": agent_name,
            "input_type": type(input_data).__name__,
            "input_length": len(str(input_data)) if input_data else 0,
        }
        
        if output_data is not None:
            log_data.update({
                "output_type": type(output_data).__name__,
                "output_length": len(str(output_data)),
            })
        
        if error:
            log_data.update({
                "error": str(error),
                "error_type": type(error).__name__,
            })
            logger.error(f"Agent interaction error: {log_data}")
        else:
            logger.info(f"Agent interaction: {log_data}")
            
        # Add to trace if available
        add_trace_metadata(log_data)
        
    except Exception as e:
        logger.warning(f"Failed to log agent interaction: {e}")


# Initialize LangTrace when module is imported
initialize_langtrace()
