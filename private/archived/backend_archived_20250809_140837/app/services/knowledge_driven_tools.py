"""
Knowledge-Driven Development Tools for Kiff AI
==============================================

Core tools that make Kiff AI knowledge-driven by leveraging the Julia BFF knowledge engine
to understand API capabilities, limitations, and implementation patterns.

These tools are the heart of Kiff AI's value proposition - grounding all code generation
and suggestions in actual API documentation rather than generic templates.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
import json
import re
from dataclasses import dataclass

from agno.tools import tool
from agno.agent import Agent
from agno.models.groq import Groq

from app.knowledge.engine.julia_bff_knowledge_engine import get_julia_bff_engine, PREDEFINED_DOMAINS
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class APIDocumentation:
    """Represents API documentation metadata"""
    domain: str
    title: str
    description: str
    documentation_url: str


@tool(show_result=True)
def query_knowledge_rag(domain: str, query: str, limit: int = 5) -> str:
    """
    Query indexed API documentation using RAG for intelligent responses.
    
    This is the core tool that makes Kiff AI knowledge-driven by leveraging
    the Julia BFF knowledge engine to understand API capabilities and limitations.
    
    Args:
        domain: API domain (e.g., 'stripe', 'openai', 'fastapi')
        query: Natural language query about the API
        limit: Maximum number of results to return
    """
    try:
        # Initialize knowledge engine
        knowledge_engine = get_julia_bff_engine(settings.GROQ_API_KEY)
        
        # Use async wrapper for the async search method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        results = loop.run_until_complete(
            knowledge_engine.search_domain_knowledge(domain, query, limit)
        )
        
        if not results:
            return f"No documentation found for '{query}' in {domain} domain. Try broader terms or check if {domain} is indexed."
        
        # Format results for agent consumption
        formatted_output = f"Found {len(results)} results for '{query}' in {domain}:\n\n"
        for i, result in enumerate(results, 1):
            formatted_output += f"{i}. {result.get('content', 'No content')}\n"
            if 'source' in result:
                formatted_output += f"   Source: {result['source']}\n"
            formatted_output += "\n"
        
        return formatted_output
        
    except Exception as e:
        logger.error(f"KnowledgeRAG error: {e}")
        return f"Error querying knowledge base: {str(e)}"


@tool(show_result=True)
def analyze_api_patterns(domain: str, use_case: str) -> str:
    """
    Analyze API patterns and best practices for specific use cases.
    
    Args:
        domain: API domain to analyze
        use_case: Specific use case or pattern to analyze
    """
    try:
        # Initialize knowledge engine
        knowledge_engine = get_julia_bff_engine(settings.GROQ_API_KEY)
        
        # Search for patterns and best practices
        pattern_query = f"best practices patterns {use_case}"
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        results = loop.run_until_complete(
            knowledge_engine.search_domain_knowledge(domain, pattern_query, 3)
        )
        
        if not results:
            return f"No API patterns found for '{use_case}' in {domain}. Consider checking documentation or using a different domain."
        
        # Analyze patterns
        pattern_analysis = f"API Pattern Analysis for {use_case} in {domain}:\n\n"
        
        for i, result in enumerate(results, 1):
            pattern_analysis += f"Pattern {i}:\n"
            pattern_analysis += f"  Content: {result.get('content', 'No content')}\n"
            if 'source' in result:
                pattern_analysis += f"  Reference: {result['source']}\n"
            pattern_analysis += "\n"
        
        return pattern_analysis
        
    except Exception as e:
        logger.error(f"APIPatternAnalyzer error: {e}")
        return f"Error analyzing API patterns: {str(e)}"


@tool(show_result=True)
def retrieve_documentation(domain: str, topic: str) -> str:
    """
    Retrieve specific documentation for API topics.
    
    Args:
        domain: API domain
        topic: Specific topic or feature to retrieve documentation for
    """
    try:
        # Initialize knowledge engine
        knowledge_engine = get_julia_bff_engine(settings.GROQ_API_KEY)
        
        # Search for specific documentation
        doc_query = f"documentation {topic}"
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        results = loop.run_until_complete(
            knowledge_engine.search_domain_knowledge(domain, doc_query, 3)
        )
        
        if not results:
            return f"No documentation found for '{topic}' in {domain}. Try a different topic or check if the domain is indexed."
        
        # Format documentation
        documentation = f"Documentation for {topic} in {domain}:\n\n"
        
        for i, result in enumerate(results, 1):
            documentation += f"Section {i}:\n"
            documentation += f"{result.get('content', 'No content')}\n"
            if 'source' in result:
                documentation += f"Source: {result['source']}\n"
            documentation += "\n"
        
        return documentation
        
    except Exception as e:
        logger.error(f"DocumentationRetriever error: {e}")
        return f"Error retrieving documentation: {str(e)}"


@tool(show_result=True)
def analyze_project_structure(project_path: str) -> str:
    """
    Analyze project structure and suggest improvements based on API knowledge.
    
    Args:
        project_path: Path to the project to analyze
    """
    try:
        project_dir = Path(project_path)
        if not project_dir.exists():
            return f"Error: Project path {project_path} does not exist"
        
        # Basic project analysis
        files = list(project_dir.rglob("*"))
        file_count = len([f for f in files if f.is_file()])
        
        # Detect project type
        project_type = "unknown"
        if (project_dir / "package.json").exists():
            project_type = "node.js"
        elif (project_dir / "requirements.txt").exists() or (project_dir / "pyproject.toml").exists():
            project_type = "python"
        elif (project_dir / "Cargo.toml").exists():
            project_type = "rust"
        elif (project_dir / "go.mod").exists():
            project_type = "go"
        
        # Analyze structure
        analysis = f"Project Structure Analysis for {project_path}:\n\n"
        analysis += f"Project Type: {project_type}\n"
        analysis += f"Total Files: {file_count}\n\n"
        
        # Check for common patterns
        if project_type == "python":
            if (project_dir / "main.py").exists():
                analysis += "✓ Found main.py entry point\n"
            if (project_dir / "app").exists():
                analysis += "✓ Found app directory structure\n"
            if (project_dir / "tests").exists():
                analysis += "✓ Found tests directory\n"
        elif project_type == "node.js":
            if (project_dir / "src").exists():
                analysis += "✓ Found src directory\n"
            if (project_dir / "public").exists():
                analysis += "✓ Found public directory\n"
        
        analysis += f"\nReady for knowledge-driven development with API documentation integration."
        
        return analysis
        
    except Exception as e:
        logger.error(f"ProjectAnalyzer error: {e}")
        return f"Error analyzing project: {str(e)}"


@tool(show_result=True)
def modify_file_with_knowledge(file_path: str, modifications: str, api_domain: str = None) -> str:
    """
    Modify files with API knowledge and best practices.
    
    Args:
        file_path: Path to the file to modify
        modifications: Description of modifications to apply
        api_domain: API domain for knowledge context
    """
    try:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return f"Error: File {file_path} does not exist"
        
        # Read current file content
        with open(file_path, 'r') as f:
            current_content = f.read()
        
        # For now, return analysis - actual modification would require more complex logic
        analysis = f"File Modification Analysis for {file_path}:\n\n"
        analysis += f"Current file size: {len(current_content)} characters\n"
        analysis += f"Requested modifications: {modifications}\n"
        if api_domain:
            analysis += f"API domain context: {api_domain}\n"
        
        analysis += "\nFile ready for knowledge-driven modifications based on API documentation."
        
        return analysis
        
    except Exception as e:
        logger.error(f"FileModifier error: {e}")
        return f"Error analyzing file for modification: {str(e)}"


@tool(show_result=True)
def generate_preview_with_knowledge(project_path: str, preview_type: str = "web") -> str:
    """
    Generate application previews with API integrations.
    
    Args:
        project_path: Path to the project
        preview_type: Type of preview (web, api, mobile)
    """
    try:
        project_dir = Path(project_path)
        if not project_dir.exists():
            return f"Error: Project path {project_path} does not exist"
        
        # Analyze project for preview generation
        preview_info = f"Preview Generation for {project_path}:\n\n"
        preview_info += f"Preview Type: {preview_type}\n"
        
        # Check for common web frameworks
        if (project_dir / "package.json").exists():
            preview_info += "Framework: Node.js application detected\n"
            preview_info += "Setup: npm install && npm run dev\n"
            preview_info += "Preview URL: http://localhost:3000\n"
        elif (project_dir / "requirements.txt").exists() or (project_dir / "pyproject.toml").exists():
            preview_info += "Framework: Python application detected\n"
            if any(f.name == "main.py" for f in project_dir.rglob("*.py")):
                preview_info += "Setup: pip install -r requirements.txt && uvicorn main:app --reload\n"
                preview_info += "Preview URL: http://localhost:8000\n"
        
        preview_info += "\nPreview ready with API integration support."
        
        return preview_info
        
    except Exception as e:
        logger.error(f"PreviewGenerator error: {e}")
        return f"Error generating preview: {str(e)}"


@tool(show_result=True)
def manage_api_dependencies(project_path: str, api_domains: str, action: str = "analyze") -> str:
    """
    Manage API-specific dependencies.
    
    Args:
        project_path: Path to the project
        api_domains: Comma-separated list of API domains
        action: Action to perform (analyze, install, update)
    """
    try:
        project_dir = Path(project_path)
        if not project_dir.exists():
            return f"Error: Project path {project_path} does not exist"
        
        # Parse API domains
        domains = [domain.strip() for domain in api_domains.split(",")]
        
        # API domain to dependency mapping
        dependency_map = {
            "stripe": ["stripe"],
            "openai": ["openai"],
            "fastapi": ["fastapi", "uvicorn"],
            "supabase": ["supabase"],
            "resend": ["resend"],
            "auth0": ["authlib", "python-jose"],
            "postgres": ["psycopg2-binary", "sqlalchemy"],
            "redis": ["redis", "celery"]
        }
        
        required_deps = []
        for domain in domains:
            if domain in dependency_map:
                required_deps.extend(dependency_map[domain])
        
        # Check current dependencies
        current_deps = []
        requirements_file = project_dir / "requirements.txt"
        package_json = project_dir / "package.json"
        
        if requirements_file.exists():
            current_deps = requirements_file.read_text().strip().split('\n')
        elif package_json.exists():
            package_data = json.loads(package_json.read_text())
            current_deps = list(package_data.get("dependencies", {}).keys())
        
        missing_deps = [dep for dep in required_deps if not any(dep in curr for curr in current_deps)]
        
        result = f"Dependency Management for {project_path}:\n\n"
        result += f"API Domains: {', '.join(domains)}\n"
        result += f"Required Dependencies: {', '.join(required_deps)}\n"
        result += f"Missing Dependencies: {', '.join(missing_deps) if missing_deps else 'None'}\n"
        result += f"Action: {action}\n"
        
        if action == "install" and missing_deps:
            if requirements_file.exists():
                result += f"\nInstall Command: pip install {' '.join(missing_deps)}\n"
            elif package_json.exists():
                result += f"\nInstall Command: npm install {' '.join(missing_deps)}\n"
        
        return result
        
    except Exception as e:
        logger.error(f"DependencyManager error: {e}")
        return f"Error managing dependencies: {str(e)}"


# Available knowledge domains
def get_available_domains() -> List[str]:
    """Get list of available knowledge domains"""
    return list(PREDEFINED_DOMAINS.keys())


# Export all tools for easy import
__all__ = [
    'query_knowledge_rag',
    'analyze_api_patterns', 
    'retrieve_documentation',
    'analyze_project_structure',
    'modify_file_with_knowledge',
    'generate_preview_with_knowledge',
    'manage_api_dependencies',
    'get_available_domains'
]
