"""
Pack Processing Service
======================

Service for processing API documentation using Agno Framework
to create comprehensive Kiff Packs with code examples and patterns.
"""

import asyncio
import json
from typing import Any, List, Optional
from datetime import datetime
import requests
from urllib.parse import urljoin, urlparse
import os
from contextlib import contextmanager

from agno.agent import Agent
from agno.models.groq import Groq
from agno.knowledge.pdf_url import PDFUrlKnowledgeBase
from agno.vectordb.lancedb import LanceDb
from agno.vectordb.search import SearchType
from agno.tools import tool
from agno.document.reader.website_reader import WebsiteReader
from agno.knowledge.pdf import PDFReader

from app.db_core import SessionLocal
from app.models.kiff_packs import KiffPack
from app.services.vector_storage import VectorStorageService

# --- Observability: OpenTelemetry tracer (safe import) ---
try:  # pragma: no cover - optional dependency
    from opentelemetry import trace as _otel_trace  # type: ignore
    _TRACER = _otel_trace.get_tracer(__name__)
except Exception:  # pragma: no cover
    _otel_trace = None  # type: ignore
    _TRACER = None  # type: ignore

@contextmanager
def _maybe_span(name: str):
    if _TRACER is None:
        yield None
        return
    with _TRACER.start_as_current_span(name) as span:  # type: ignore
        yield span

"""
Configurable crawl limits for pack processing. Defaults are tuned to be generous
so larger documentation sites are covered.

You can override via environment variables:
  PACK_PRIMARY_MAX_LINKS, PACK_PRIMARY_MAX_DEPTH,
  PACK_ADDITIONAL_MAX_LINKS, PACK_ADDITIONAL_MAX_DEPTH
"""
PRIMARY_MAX_LINKS = int(os.getenv("PACK_PRIMARY_MAX_LINKS", "100"))
PRIMARY_MAX_DEPTH = int(os.getenv("PACK_PRIMARY_MAX_DEPTH", "2"))
ADDITIONAL_MAX_LINKS = int(os.getenv("PACK_ADDITIONAL_MAX_LINKS", "100"))
ADDITIONAL_MAX_DEPTH = int(os.getenv("PACK_ADDITIONAL_MAX_DEPTH", "1"))


# Tool definitions using Agno's @tool decorator
@tool
def extract_api_endpoints(documentation: str) -> dict:
    """Extract API endpoints, methods, parameters, and responses from documentation
    
    Args:
        documentation: API documentation text content
    """
    import re
    
    # Simple regex patterns to extract common API patterns
    endpoints = []
    
    # Look for HTTP methods and paths
    http_patterns = [
        r'(GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-\{\}]+)',
        r'(get|post|put|delete|patch)\s*\(\s*[\'"]([\/\w\-\{\}]+)[\'"]',
        r'\/api\/[\/\w\-\{\}]+'
    ]
    
    for pattern in http_patterns:
        matches = re.findall(pattern, documentation, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple) and len(match) >= 2:
                method, path = match[0], match[1]
                endpoints.append({"method": method.upper(), "path": path})
            elif isinstance(match, str):
                endpoints.append({"method": "GET", "path": match})
    
    return {
        "endpoints": endpoints[:20],  # Limit to first 20 endpoints
        "total_found": len(endpoints)
    }


@tool
def generate_code_examples(api_info: dict, language: str = "python") -> str:
    """Generate code examples for API integration in specified language
    
    Args:
        api_info: Flexible API information dictionary with any format
        language: Programming language for the example (python, javascript, etc.)
    """
    
    if language.lower() == "python":
        return f"""
# Python API Integration Example
import requests
import os

# Configuration
API_BASE_URL = "https://api.example.com"
API_KEY = os.getenv("API_KEY")

class APIClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {{"Authorization": f"Bearer {{api_key}}"}}
    
    def make_request(self, method: str, endpoint: str, data=None):
        url = f"{{API_BASE_URL}}{{endpoint}}"
        response = requests.request(method, url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

# Usage example
client = APIClient(API_KEY)
# Add specific endpoint calls based on API structure
"""
    elif language.lower() == "javascript":
        return f"""
// JavaScript API Integration Example
class APIClient {{
    constructor(apiKey) {{
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.example.com';
        this.headers = {{
            'Authorization': `Bearer ${{apiKey}}`,
            'Content-Type': 'application/json'
        }};
    }}
    
    async makeRequest(method, endpoint, data = null) {{
        const url = `${{this.baseUrl}}${{endpoint}}`;
        const options = {{
            method,
            headers: this.headers,
        }};
        
        if (data) {{
            options.body = JSON.stringify(data);
        }}
        
        const response = await fetch(url, options);
        if (!response.ok) {{
            throw new Error(`HTTP error! status: ${{response.status}}`);
        }}
        return response.json();
    }}
}}

// Usage
const client = new APIClient(process.env.API_KEY);
"""
    else:
        return f"# {language} code example generation not implemented yet"


@tool  
def analyze_integration_patterns(api_structure: dict) -> List[str]:
    """Analyze API structure and suggest integration patterns
    
    Args:
        api_structure: Flexible API structure dictionary with any format
    """
    
    patterns = [
        "Authentication Setup - Configure API keys and authentication headers",
        "Error Handling - Implement proper error handling for API responses", 
        "Rate Limiting - Handle rate limits and implement retry logic",
        "Data Validation - Validate input data before sending to API",
        "Response Processing - Parse and handle API response data",
        "Configuration Management - Store API settings in environment variables",
        "Testing Strategy - Write unit and integration tests for API calls",
        "Monitoring - Add logging and monitoring for API usage"
    ]
    
    # Add specific patterns based on API structure
    if api_structure.get("endpoints"):
        patterns.append("Endpoint Management - Organize API calls by functionality")
    
    if "authentication" in str(api_structure).lower():
        patterns.append("Security Best Practices - Secure credential storage and rotation")
    
    return patterns


class PackProcessor:
    """Process API documentation to create comprehensive Kiff Packs"""
    
    def __init__(self):
        self.agent = self._create_agent()
        self.vector_service = VectorStorageService()
    
    def _create_agent(self) -> Agent:
        """Create Agno agent for pack processing"""
        return Agent(
            model=Groq(id="openai/gpt-oss-120b"),
            tools=[
                extract_api_endpoints,
                generate_code_examples, 
                analyze_integration_patterns
            ],
            instructions=[
                "You are an expert API documentation processor for creating Kiff Packs.",
                "Extract comprehensive API information: endpoints, parameters, authentication, examples.",
                "Generate practical, production-ready code examples in multiple languages.",
                "Create reusable integration patterns and best practices.",
                "Focus on real-world usage scenarios and common implementations.",
                "Ensure all generated code follows security best practices.",
                "Structure output in a clear, searchable format for easy consumption."
            ],
            show_tool_calls=True,
            markdown=True,
            debug_mode=False
        )
    
    async def process_pack(self, pack_id: str, tenant_id: str) -> bool:
        """Main processing pipeline for a pack with top-level tracing.

        Only annotate as model-triggered when we actually invoke the LLM or embeddings.
        No synthetic token/cost metrics are added here.
        """
        model_triggered = False
        with _maybe_span("pack.process") as span:
            if span is not None:
                try:
                    span.set_attribute("kiff.pack_id", pack_id)
                    span.set_attribute("kiff.tenant_id", tenant_id)
                    span.set_attribute("kiff.pipeline", "pack_process")
                    span.set_attribute("kiff.model_triggered", False)
                except Exception:
                    pass
        try:
            # Get pack details from database and immediately extract needed data
            db = SessionLocal()
            try:
                pack = db.query(KiffPack).filter(KiffPack.id == pack_id).first()
                if not pack:
                    raise ValueError(f"Pack {pack_id} not found")
                
                # Update status to processing
                pack.processing_status = "processing"
                db.commit()
                
                # Extract data we need before closing session
                api_url = pack.api_url
                documentation_urls = pack.documentation_urls or []
                
            finally:
                db.close()
            
            # Step 1: Crawl API documentation
            print(f"📖 Crawling API documentation for pack {pack_id}")
            documentation = await self._crawl_documentation(
                api_url, 
                documentation_urls
            )
            
            # Step 2: Extract API structure (LLM likely invoked by agent)
            print(f"🔍 Analyzing API structure for pack {pack_id}")
            # Mark model as triggered before awaiting agent to ensure span captures it
            model_triggered = True
            with _maybe_span("pack.llm.extract_api_structure") as subspan:
                if subspan is not None:
                    try:
                        subspan.set_attribute("kiff.stage", "extract_api_structure")
                        subspan.set_attribute("kiff.pack_id", pack_id)
                        subspan.set_attribute("kiff.tenant_id", tenant_id)
                    except Exception:
                        pass
                api_structure = await self._extract_api_structure(documentation)
            
            # Step 3: Generate code examples (LLM)
            print(f"💻 Generating code examples for pack {pack_id}")
            with _maybe_span("pack.llm.generate_code_examples") as subspan:
                if subspan is not None:
                    try:
                        subspan.set_attribute("kiff.stage", "generate_code_examples")
                        subspan.set_attribute("kiff.pack_id", pack_id)
                        subspan.set_attribute("kiff.tenant_id", tenant_id)
                    except Exception:
                        pass
                code_examples = await self._generate_code_examples(api_structure)
            
            # Step 4: Create integration patterns (LLM)
            print(f"🔧 Creating integration patterns for pack {pack_id}")
            with _maybe_span("pack.llm.create_integration_patterns") as subspan:
                if subspan is not None:
                    try:
                        subspan.set_attribute("kiff.stage", "create_integration_patterns")
                        subspan.set_attribute("kiff.pack_id", pack_id)
                        subspan.set_attribute("kiff.tenant_id", tenant_id)
                    except Exception:
                        pass
                integration_patterns = await self._create_integration_patterns(
                    api_structure, 
                    code_examples
                )
            
            # Step 5: Update pack in database
            db = SessionLocal()
            try:
                pack = db.query(KiffPack).filter(KiffPack.id == pack_id).first()
                if pack:
                    pack.api_structure = api_structure
                    pack.code_examples = code_examples
                    pack.integration_patterns = integration_patterns
                    pack.processing_status = "ready"
                    pack.updated_at = datetime.utcnow()
                    db.commit()
                    
                    # Step 6: Store in vector database (embeddings happen inside VectorStorageService)
                    print(f"💾 Storing pack vectors for pack {pack_id}")
                    # Embedding wrapper will emit its own spans/usage events.
                    # We mark model_triggered to ensure we only "track" when models run.
                    model_triggered = True
                    await self.vector_service.store_pack_vectors(pack, tenant_id)
            finally:
                db.close()
            
            print(f"✅ Pack {pack_id} processed successfully")
            with _maybe_span("pack.process") as span2:
                if span2 is not None:
                    try:
                        span2.set_attribute("kiff.status", "success")
                        span2.set_attribute("kiff.model_triggered", bool(model_triggered))
                    except Exception:
                        pass
            return True
            
        except Exception as e:
            print(f"❌ Error processing pack {pack_id}: {e}")
            with _maybe_span("pack.process") as span3:
                if span3 is not None:
                    try:
                        span3.set_attribute("kiff.status", "error")
                        span3.set_attribute("kiff.error", str(e))
                        span3.set_attribute("kiff.model_triggered", bool(model_triggered))
                    except Exception:
                        pass
            
            # Update pack status to failed
            try:
                db = SessionLocal()
                try:
                    pack = db.query(KiffPack).filter(KiffPack.id == pack_id).first()
                    if pack:
                        pack.processing_status = "failed"
                        pack.processing_error = str(e)
                        db.commit()
                finally:
                    db.close()
            except Exception as db_error:
                print(f"Error updating pack status: {db_error}")
            
            return False
    
    async def _crawl_documentation(self, primary_url: str, additional_urls: List[str]) -> str:
        """Crawl API documentation from URLs"""
        all_content = []
        
        # Crawl primary URL
        try:
            scraper = WebsiteReader(max_links=PRIMARY_MAX_LINKS, max_depth=PRIMARY_MAX_DEPTH)
            primary_docs = scraper.read(primary_url)
            all_content.extend([doc.content for doc in primary_docs])
        except Exception as e:
            print(f"Error crawling primary URL {primary_url}: {e}")
        
        # Crawl additional URLs
        for url in additional_urls:
            if not url or url == primary_url:
                continue
            
            try:
                if url.lower().endswith('.pdf'):
                    # Handle PDF documentation
                    pdf_reader = PDFReader()
                    # Download PDF to temp file first
                    response = requests.get(url, stream=True)
                    response.raise_for_status()
                    
                    with open('/tmp/temp_api_doc.pdf', 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    # Extract text from the downloaded PDF
                    pdf_docs = pdf_reader.read('/tmp/temp_api_doc.pdf')
                    all_content.extend([doc.content for doc in pdf_docs])
                else:
                    # Handle web documentation
                    scraper = WebsiteReader(max_links=ADDITIONAL_MAX_LINKS, max_depth=ADDITIONAL_MAX_DEPTH)
                    web_docs = scraper.read(url)
                    all_content.extend([doc.content for doc in web_docs])
                
            except Exception as e:
                print(f"Error crawling additional URL {url}: {e}")
                continue
        
        return "\n\n".join(all_content)
    
    async def _extract_api_structure(self, documentation: str) -> dict:
        """Extract structured API information using Agno agent"""
        
        prompt = f"""
        Analyze this API documentation and extract a comprehensive API structure.
        
        Extract the following information:
        1. API Overview (name, purpose, base URL)
        2. Authentication methods and requirements
        3. All available endpoints with:
           - HTTP method (GET, POST, PUT, DELETE, etc.)
           - Full endpoint path
           - Required and optional parameters
           - Request body schema
           - Response schema and examples
           - Rate limits if mentioned
        4. Error codes and handling
        5. SDKs and client libraries mentioned
        6. Pricing information if available
        
        Format the output as a structured JSON object with clear categorization.
        Focus on information that would be useful for developers integrating this API.
        
        Documentation:
        {documentation[:10000]}  # Limit to avoid token limits
        """
        
        try:
            response = await self.agent.arun(prompt)
            # Parse the response to extract JSON structure
            # This would need proper parsing logic
            return self._parse_api_structure_response(response.content)
        except Exception as e:
            print(f"Error extracting API structure: {e}")
            return {
                "overview": {"name": "Unknown API", "purpose": "API integration"},
                "authentication": {},
                "endpoints": [],
                "error_codes": {},
                "sdks": [],
                "pricing": {}
            }
    
    async def _generate_code_examples(self, api_structure: dict) -> dict:
        """Generate code examples in multiple languages"""
        
        languages = {
            "javascript": "JavaScript/Node.js",
            "python": "Python",
            "curl": "cURL",
            "typescript": "TypeScript"
        }
        
        code_examples = {}
        
        for lang_key, lang_name in languages.items():
            try:
                prompt = f"""
                Generate comprehensive {lang_name} code examples for this API.
                
                Create examples for:
                1. Authentication setup
                2. Basic API calls for top 5 most common endpoints
                3. Error handling
                4. Rate limiting handling
                5. Complete integration example
                
                Make the code production-ready with:
                - Proper error handling
                - Environment variable usage for API keys
                - Comments explaining key concepts
                - Best practices for the language
                
                API Structure:
                {json.dumps(api_structure, indent=2)}
                
                Format as clean, executable code with explanatory comments.
                """
                
                response = await self.agent.arun(prompt)
                code_examples[lang_key] = response.content
                
            except Exception as e:
                print(f"Error generating {lang_name} examples: {e}")
                code_examples[lang_key] = f"# {lang_name} example generation failed"
        
        return code_examples
    
    async def _create_integration_patterns(
        self, 
        api_structure: dict, 
        code_examples: dict
    ) -> List[str]:
        """Create integration patterns and best practices"""
        
        prompt = f"""
        Create comprehensive integration patterns and best practices for this API.
        
        Generate patterns for:
        1. Project setup and configuration
        2. Environment variables and secrets management
        3. Common workflow implementations
        4. Error handling strategies
        5. Testing approaches
        6. Deployment considerations
        7. Performance optimization
        8. Security best practices
        
        Make each pattern practical and actionable, with step-by-step guidance.
        Include real-world scenarios and common pitfalls to avoid.
        
        API Structure:
        {json.dumps(api_structure, indent=2)[:5000]}
        
        Code Examples Available:
        {list(code_examples.keys())}
        """
        
        try:
            response = await self.agent.arun(prompt)
            # Parse response into list of patterns
            patterns = self._parse_integration_patterns(response.content)
            return patterns
        except Exception as e:
            print(f"Error creating integration patterns: {e}")
            return [
                "Setup and Configuration",
                "Basic API Integration",
                "Error Handling",
                "Testing Strategy"
            ]
    
    def _parse_api_structure_response(self, response: str) -> dict:
        """Parse agent response to extract structured API information"""
        try:
            # Try to extract JSON from the response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                return json.loads(json_str)
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Error parsing API structure JSON: {e}")
        
        # Fallback to basic structure
        return {
            "overview": {"name": "API", "purpose": "Integration"},
            "authentication": {"type": "API Key"},
            "endpoints": [],
            "error_codes": {},
            "sdks": [],
            "pricing": {}
        }
    
    def _parse_integration_patterns(self, response: str) -> List[str]:
        """Parse integration patterns from agent response"""
        try:
            # Split response into patterns (this is a simple implementation)
            patterns = []
            lines = response.split('\n')
            current_pattern = []
            
            for line in lines:
                if line.strip().startswith('#') and current_pattern:
                    # New pattern started, save previous
                    patterns.append('\n'.join(current_pattern).strip())
                    current_pattern = [line]
                else:
                    current_pattern.append(line)
            
            # Add last pattern
            if current_pattern:
                patterns.append('\n'.join(current_pattern).strip())
            
            return [p for p in patterns if p.strip()]
            
        except Exception as e:
            print(f"Error parsing integration patterns: {e}")
            return [response]  # Return as single pattern if parsing fails


# Factory function for creating processor
def create_pack_processor() -> PackProcessor:
    """Create a new pack processor instance"""
    return PackProcessor()