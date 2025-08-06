"""
Knowledge-Driven AGNO Tools for Enhanced Kiff AI Workflow
========================================================

These tools integrate with the existing Julia BFF knowledge engine to provide
conversational, knowledge-driven development capabilities similar to Claude Code.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import json
import ast
import re
from dataclasses import dataclass

from agno.tools import tool
from agno.agent import Agent
from agno.models.groq import Groq

from app.knowledge.engine.julia_bff_knowledge_engine import get_julia_bff_engine, PREDEFINED_DOMAINS
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class APIPattern:
    """Represents an API usage pattern found in code"""
    api_name: str
    pattern_type: str  # authentication, request, webhook, etc.
    code_snippet: str
    best_practices: List[str]
    common_errors: List[str]
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
                    "relevance_score": result["score"],
                    "source": result["metadata"].get("url", "Unknown"),
                    "domain": domain
                })
            
            return {
                "success": True,
                "query": query,
                "domain": domain,
                "results": formatted_results,
                "total_found": len(results),
                "message": f"Found {len(results)} relevant documentation sections"
            }
            
        except Exception as e:
            logger.error(f"KnowledgeRAG error: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to query knowledge base"
            }


class APIPatternAnalyzer(Tool):
    """
    Analyze existing codebase for API usage patterns and suggest improvements
    based on indexed documentation.
    """
    
    def __init__(self):
        super().__init__(
            name="APIPatternAnalyzer", 
            description="Analyze existing API usage patterns in codebase and suggest improvements"
        )
        self.knowledge_engine = get_julia_bff_engine(settings.GROQ_API_KEY)
    
    def run(self, project_path: str, api_domain: str = None) -> Dict[str, Any]:
        """
        Analyze API patterns in the codebase
        
        Args:
            project_path: Path to the project directory
            api_domain: Specific API domain to analyze (optional)
        """
        try:
            project_dir = Path(project_path)
            if not project_dir.exists():
                return {"success": False, "error": "Project path does not exist"}
            
            patterns = self._extract_api_patterns(project_dir, api_domain)
            suggestions = self._generate_suggestions(patterns, api_domain)
            
            return {
                "success": True,
                "project_path": project_path,
                "api_domain": api_domain,
                "patterns_found": len(patterns),
                "patterns": [self._pattern_to_dict(p) for p in patterns],
                "suggestions": suggestions,
                "message": f"Analyzed {len(patterns)} API usage patterns"
            }
            
        except Exception as e:
            logger.error(f"APIPatternAnalyzer error: {e}")
            return {"success": False, "error": str(e)}
    
    def _extract_api_patterns(self, project_dir: Path, api_domain: str = None) -> List[APIPattern]:
        """Extract API usage patterns from code files"""
        patterns = []
        
        # Common API patterns to look for
        api_indicators = {
            "stripe": ["stripe.", "Stripe", "sk_", "pk_"],
            "openai": ["openai.", "OpenAI", "gpt-", "chat.completions"],
            "fastapi": ["FastAPI", "@app.", "APIRouter", "Depends"],
            "requests": ["requests.", "httpx.", "aiohttp."],
            "auth": ["jwt", "token", "Bearer", "Authorization"]
        }
        
        for py_file in project_dir.rglob("*.py"):
            try:
                content = py_file.read_text(encoding='utf-8')
                
                # Skip if file is too large or binary
                if len(content) > 100000:
                    continue
                
                # Look for API patterns
                for api_name, indicators in api_indicators.items():
                    if api_domain and api_name != api_domain:
                        continue
                        
                    for indicator in indicators:
                        if indicator in content:
                            # Extract relevant code snippets
                            snippets = self._extract_code_snippets(content, indicator)
                            for snippet in snippets:
                                patterns.append(APIPattern(
                                    api_name=api_name,
                                    pattern_type=self._classify_pattern(snippet),
                                    code_snippet=snippet,
                                    best_practices=[],
                                    common_errors=[],
                                    documentation_url=""
                                ))
                            break
                            
            except Exception as e:
                logger.warning(f"Error analyzing {py_file}: {e}")
                continue
        
        return patterns
    
    def _extract_code_snippets(self, content: str, indicator: str) -> List[str]:
        """Extract relevant code snippets containing the indicator"""
        lines = content.split('\n')
        snippets = []
        
        for i, line in enumerate(lines):
            if indicator in line:
                # Get context around the line (3 lines before and after)
                start = max(0, i - 3)
                end = min(len(lines), i + 4)
                snippet = '\n'.join(lines[start:end])
                snippets.append(snippet.strip())
        
        return snippets[:5]  # Limit to 5 snippets per indicator
    
    def _classify_pattern(self, snippet: str) -> str:
        """Classify the type of API pattern"""
        snippet_lower = snippet.lower()
        
        if any(word in snippet_lower for word in ['auth', 'token', 'key', 'secret']):
            return "authentication"
        elif any(word in snippet_lower for word in ['post', 'get', 'put', 'delete', 'request']):
            return "request"
        elif any(word in snippet_lower for word in ['webhook', 'callback', 'event']):
            return "webhook"
        elif any(word in snippet_lower for word in ['error', 'exception', 'try', 'catch']):
            return "error_handling"
        else:
            return "general"
    
    def _generate_suggestions(self, patterns: List[APIPattern], api_domain: str = None) -> List[str]:
        """Generate improvement suggestions based on patterns"""
        suggestions = []
        
        # Count pattern types
        pattern_counts = {}
        for pattern in patterns:
            key = f"{pattern.api_name}_{pattern.pattern_type}"
            pattern_counts[key] = pattern_counts.get(key, 0) + 1
        
        # Generate suggestions
        if pattern_counts.get("stripe_authentication", 0) > 0:
            suggestions.append("Consider using Stripe's webhook signature verification for security")
        
        if pattern_counts.get("openai_request", 0) > 0:
            suggestions.append("Implement proper rate limiting and error handling for OpenAI API calls")
        
        if sum(1 for p in patterns if p.pattern_type == "error_handling") < len(patterns) * 0.3:
            suggestions.append("Add more comprehensive error handling for API calls")
        
        return suggestions
    
    def _pattern_to_dict(self, pattern: APIPattern) -> Dict[str, Any]:
        """Convert APIPattern to dictionary"""
        return {
            "api_name": pattern.api_name,
            "pattern_type": pattern.pattern_type,
            "code_snippet": pattern.code_snippet[:200] + "..." if len(pattern.code_snippet) > 200 else pattern.code_snippet,
            "best_practices": pattern.best_practices,
            "common_errors": pattern.common_errors
        }


class DocumentationRetriever(Tool):
    """
    Retrieve specific sections of API documentation for implementation guidance.
    """
    
    def __init__(self):
        super().__init__(
            name="DocumentationRetriever",
            description="Retrieve specific API documentation sections and implementation examples"
        )
        self.knowledge_engine = get_julia_bff_engine(settings.GROQ_API_KEY)
    
    def run(self, domain: str, section: str, implementation_type: str = "basic") -> Dict[str, Any]:
        """
        Retrieve specific documentation sections
        
        Args:
            domain: API domain (e.g., 'stripe', 'openai')
            section: Specific section (e.g., 'webhooks', 'authentication', 'subscriptions')
            implementation_type: Type of implementation needed ('basic', 'advanced', 'production')
        """
        try:
            # Create targeted query based on section and implementation type
            query = f"{section} {implementation_type} implementation example"
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            results = loop.run_until_complete(
                self.knowledge_engine.search_domain_knowledge(domain, query, limit=3)
            )
            
            if not results:
                return {
                    "success": False,
                    "message": f"No documentation found for {section} in {domain}",
                    "available_domains": list(PREDEFINED_DOMAINS.keys())
                }
            
            # Process results to extract implementation guidance
            implementation_guide = self._process_documentation_results(results, section, implementation_type)
            
            return {
                "success": True,
                "domain": domain,
                "section": section,
                "implementation_type": implementation_type,
                "guide": implementation_guide,
                "raw_results": results[:2],  # Include raw results for reference
                "message": f"Retrieved {section} documentation for {domain}"
            }
            
        except Exception as e:
            logger.error(f"DocumentationRetriever error: {e}")
            return {"success": False, "error": str(e)}
    
    def _process_documentation_results(self, results: List[Dict], section: str, impl_type: str) -> Dict[str, Any]:
        """Process documentation results into implementation guidance"""
        guide = {
            "overview": "",
            "key_concepts": [],
            "implementation_steps": [],
            "code_examples": [],
            "best_practices": [],
            "common_pitfalls": []
        }
        
        for result in results:
            content = result["content"]
            
            # Extract key information based on content patterns
            if "example" in content.lower() or "```" in content:
                # Extract code examples
                code_blocks = re.findall(r'```[\w]*\n(.*?)\n```', content, re.DOTALL)
                guide["code_examples"].extend(code_blocks[:2])
            
            if any(word in content.lower() for word in ["step", "first", "then", "next"]):
                # Extract implementation steps
                steps = self._extract_steps(content)
                guide["implementation_steps"].extend(steps)
            
            if any(word in content.lower() for word in ["best practice", "recommended", "should"]):
                # Extract best practices
                practices = self._extract_best_practices(content)
                guide["best_practices"].extend(practices)
            
            # Use first result for overview
            if not guide["overview"] and len(content) > 100:
                guide["overview"] = content[:300] + "..."
        
        return guide
    
    def _extract_steps(self, content: str) -> List[str]:
        """Extract implementation steps from content"""
        # Simple step extraction - look for numbered or bulleted lists
        lines = content.split('\n')
        steps = []
        
        for line in lines:
            line = line.strip()
            if re.match(r'^\d+\.', line) or line.startswith('- ') or line.startswith('* '):
                steps.append(line)
                if len(steps) >= 5:  # Limit steps
                    break
        
        return steps
    
    def _extract_best_practices(self, content: str) -> List[str]:
        """Extract best practices from content"""
        practices = []
        sentences = content.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if any(word in sentence.lower() for word in ["should", "recommended", "best practice", "important"]):
                if len(sentence) > 20 and len(sentence) < 200:
                    practices.append(sentence + ".")
                    if len(practices) >= 3:
                        break
        
        return practices


class ProjectAnalyzer(Tool):
    """
    Analyze existing project structure and suggest API integrations based on
    project type and current architecture.
    """
    
    def __init__(self):
        super().__init__(
            name="ProjectAnalyzer",
            description="Analyze project structure and suggest appropriate API integrations"
        )
    
    def run(self, project_path: str) -> Dict[str, Any]:
        """
        Analyze project structure and suggest integrations
        
        Args:
            project_path: Path to the project directory
        """
        try:
            project_dir = Path(project_path)
            if not project_dir.exists():
                return {"success": False, "error": "Project path does not exist"}
            
            analysis = self._analyze_project_structure(project_dir)
            suggestions = self._generate_integration_suggestions(analysis)
            
            return {
                "success": True,
                "project_path": project_path,
                "analysis": analysis,
                "integration_suggestions": suggestions,
                "message": f"Analyzed project structure and found {len(suggestions)} integration opportunities"
            }
            
        except Exception as e:
            logger.error(f"ProjectAnalyzer error: {e}")
            return {"success": False, "error": str(e)}
    
    def _analyze_project_structure(self, project_dir: Path) -> Dict[str, Any]:
        """Analyze the project structure"""
        analysis = {
            "project_type": "unknown",
            "framework": "unknown",
            "has_database": False,
            "has_auth": False,
            "has_api": False,
            "has_frontend": False,
            "dependencies": [],
            "file_structure": {}
        }
        
        # Check for common files and patterns
        files = list(project_dir.rglob("*"))
        file_names = [f.name for f in files if f.is_file()]
        
        # Detect project type and framework
        if "package.json" in file_names:
            analysis["has_frontend"] = True
            if any("react" in f.lower() for f in file_names):
                analysis["framework"] = "react"
            elif any("vue" in f.lower() for f in file_names):
                analysis["framework"] = "vue"
            elif any("angular" in f.lower() for f in file_names):
                analysis["framework"] = "angular"
        
        if "requirements.txt" in file_names or "pyproject.toml" in file_names:
            analysis["project_type"] = "python"
            if any("fastapi" in f.lower() for f in file_names):
                analysis["framework"] = "fastapi"
                analysis["has_api"] = True
            elif any("django" in f.lower() for f in file_names):
                analysis["framework"] = "django"
                analysis["has_api"] = True
            elif any("flask" in f.lower() for f in file_names):
                analysis["framework"] = "flask"
                analysis["has_api"] = True
        
        # Check for database
        if any(db in " ".join(file_names).lower() for db in ["sqlite", "postgres", "mysql", "mongo"]):
            analysis["has_database"] = True
        
        # Check for auth
        if any(auth in " ".join(file_names).lower() for auth in ["auth", "jwt", "oauth", "login"]):
            analysis["has_auth"] = True
        
        # Get file structure summary
        analysis["file_structure"] = self._get_file_structure_summary(project_dir)
        
        return analysis
    
    def _get_file_structure_summary(self, project_dir: Path) -> Dict[str, int]:
        """Get a summary of file types in the project"""
        summary = {}
        
        for file_path in project_dir.rglob("*"):
            if file_path.is_file():
                ext = file_path.suffix.lower()
                if ext:
                    summary[ext] = summary.get(ext, 0) + 1
        
        return dict(sorted(summary.items(), key=lambda x: x[1], reverse=True)[:10])
    
    def _generate_integration_suggestions(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate API integration suggestions based on project analysis"""
        suggestions = []
        
        # Payment integration suggestions
        if analysis["has_api"] and analysis["has_database"]:
            suggestions.append({
                "api": "stripe",
                "reason": "Add payment processing capabilities",
                "priority": "high",
                "implementation_complexity": "medium",
                "benefits": ["Monetize your application", "Handle subscriptions", "Secure payment processing"]
            })
        
        # Authentication suggestions
        if analysis["has_api"] and not analysis["has_auth"]:
            suggestions.append({
                "api": "auth0",
                "reason": "Add user authentication and authorization",
                "priority": "high", 
                "implementation_complexity": "low",
                "benefits": ["Secure user management", "Social login", "Multi-factor authentication"]
            })
        
        # AI integration suggestions
        if analysis["project_type"] == "python":
            suggestions.append({
                "api": "openai",
                "reason": "Add AI capabilities to your application",
                "priority": "medium",
                "implementation_complexity": "low",
                "benefits": ["Natural language processing", "Content generation", "Intelligent features"]
            })
        
        # Email service suggestions
        if analysis["has_api"]:
            suggestions.append({
                "api": "resend",
                "reason": "Add email functionality",
                "priority": "medium",
                "implementation_complexity": "low",
                "benefits": ["Transactional emails", "User notifications", "Marketing campaigns"]
            })
        
        # Database suggestions
        if not analysis["has_database"]:
            suggestions.append({
                "api": "supabase",
                "reason": "Add database and backend services",
                "priority": "high",
                "implementation_complexity": "medium",
                "benefits": ["Real-time database", "Authentication", "File storage"]
            })
        
        return suggestions


# Tool factory function for easy integration with AGNO agents
def create_knowledge_driven_tools() -> List[Tool]:
    """Create all knowledge-driven tools for AGNO agents"""
    return [
        KnowledgeRAG(),
        APIPatternAnalyzer(),
        DocumentationRetriever(),
        ProjectAnalyzer()
    ]


# Example usage with AGNO agent
def create_knowledge_driven_agent(groq_api_key: str) -> Agent:
    """
    Create a knowledge-driven AGNO agent with all the enhanced tools
    
    This agent follows the user's requirements:
    - Minimalistic prompts using "Use the 'tool_name' to do X" pattern
    - Grounded in actual API documentation
    - Knowledge-first approach to development
    """
    
    agent = Agent(
        name="Kiff Knowledge Assistant",
        model=Groq(
            id="llama-3.3-70b-versatile",
            api_key=groq_api_key,
            temperature=0.3
        ),
        tools=create_knowledge_driven_tools(),
        instructions="""
You are a knowledge-driven development assistant with access to indexed API documentation.

ALWAYS leverage your knowledge base:
- Use 'KnowledgeRAG' to query indexed API documentation before suggesting implementations
- Use 'DocumentationRetriever' to get specific API sections and examples  
- Use 'APIPatternAnalyzer' to understand how APIs are used in existing codebases
- Use 'ProjectAnalyzer' to suggest appropriate API integrations for projects

Your strength is API knowledge. When users ask about integrations:
1. Query your indexed documentation first
2. Understand the API's actual capabilities and limitations
3. Suggest implementations based on official documentation
4. Generate code that follows API best practices

Be conversational but always ground responses in actual API documentation.
        """,
        markdown=True,
        show_tool_calls=True
    )
    
    return agent
