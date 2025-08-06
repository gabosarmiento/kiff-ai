import React, { useState, useRef, useEffect } from 'react'
import { 
  Zap, 
  Download, 
  Copy, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Brain,
  Database,
  Settings,
  Workflow,
  MonitorSpeaker
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface GeneratedFile {
  name: string
  content: string
  language: string
  path: string
  size: number
}

interface GenerationResult {
  id: string
  tenant_id: string
  output_dir: string
  status: string
  version: string
  features: {
    comprehensive_agno_knowledge: boolean
    advanced_patterns: boolean
    vector_database_integration: boolean
    workflow_orchestration: boolean
    custom_tools: boolean
    async_streaming: boolean
    production_ready: boolean
  }
  response?: string
}

interface StreamMessage {
  type: 'status' | 'completed' | 'error'
  content: {
    message: string
    stage: string
    result?: GenerationResult
  }
  timestamp: string | null
}

export function GenerateV01Page() {
  const [request, setRequest] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [currentStage, setCurrentStage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [statusMessage, currentStage])

  const handleGenerate = async () => {
    if (!request.trim()) {
      toast.error('Please enter a description for your application')
      return
    }

    setIsGenerating(true)
    setGenerationResult(null)
    setFiles([])
    setSelectedFile(null)
    setCurrentStage('init')
    setStatusMessage('🚀 Initializing advanced AGNO generator...')

    try {
      const response = await fetch('/api/agno-generation-v01/generate-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_request: request,
          session_id: `generate-v01-${Date.now()}`,
          complexity_level: 'advanced',
          include_vector_db: true,
          include_workflows: true,
          include_custom_tools: true,
          include_monitoring: true,
          target_deployment: 'docker'
        }),
      })

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamMessage = JSON.parse(line.slice(6))
              
              if (data.type === 'status') {
                setStatusMessage(data.content.message)
                setCurrentStage(data.content.stage)
              } else if (data.type === 'completed') {
                const result = data.content.result
                if (result) {
                  setGenerationResult(result)
                  setStatusMessage('✅ Advanced AGNO application generated successfully!')
                  setCurrentStage('completed')
                  
                  // Mock files for demonstration (in real implementation, these would come from the result)
                  const mockFiles: GeneratedFile[] = [
                    {
                      name: 'main.py',
                      content: `# Advanced AGNO Application
# Generated with comprehensive AGNO knowledge

from agno.agent import Agent
from agno.tools.file import FileTools
from agno.vectordb.lancedb import LanceDb
from agno.knowledge.combined import CombinedKnowledgeBase
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedAGNOApp:
    """Advanced AGNO application with comprehensive features"""
    
    def __init__(self):
        self.vector_db = LanceDb(
            table_name="app_knowledge",
            uri="vectordb/knowledge"
        )
        self.agent = None
        
    async def initialize(self):
        """Initialize the AGNO agent with knowledge base"""
        logger.info("🚀 Initializing advanced AGNO application...")
        
        # Create agent with comprehensive tools
        self.agent = Agent(
            model="groq/llama-3.1-70b",
            tools=[FileTools()],
            instructions=[
                "You are an advanced AI agent with comprehensive capabilities.",
                "Use vector database for knowledge retrieval.",
                "Implement async patterns for optimal performance.",
                "Follow AGNO best practices throughout."
            ]
        )
        
        logger.info("✅ AGNO application initialized successfully")
        
    async def run(self):
        """Run the main application loop"""
        await self.initialize()
        
        logger.info("🎯 AGNO application ready for tasks")
        
        # Your advanced application logic here
        result = await self.agent.arun("Process user request with advanced capabilities")
        
        return result

# Application entry point
async def main():
    app = AdvancedAGNOApp()
    result = await app.run()
    print(result)

if __name__ == "__main__":
    asyncio.run(main())`,
                      language: 'python',
                      path: 'main.py',
                      size: 1456
                    },
                    {
                      name: 'requirements.txt',
                      content: `# Advanced AGNO Application Dependencies
agno>=0.3.0
asyncio
logging
lancedb>=0.8.0
python-dotenv>=1.0.0
pydantic>=2.0.0
fastapi>=0.104.0
uvicorn>=0.24.0
pytest>=7.4.0
pytest-asyncio>=0.21.0`,
                      language: 'text',
                      path: 'requirements.txt',
                      size: 234
                    },
                    {
                      name: 'Dockerfile',
                      content: `# Advanced AGNO Application Container
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    libc-dev \\
    && apt-get clean \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash agno
RUN chown -R agno:agno /app
USER agno

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run application
CMD ["python", "main.py"]`,
                      language: 'dockerfile',
                      path: 'Dockerfile',
                      size: 956
                    },
                    {
                      name: 'README.md',
                      content: `# Advanced AGNO Application v0.1

A sophisticated application built with comprehensive AGNO framework knowledge, featuring advanced patterns and production-ready deployment.

## 🌟 Advanced Features

- **🧠 Comprehensive AGNO Knowledge**: Built with full framework documentation
- **🗄️ Vector Database Integration**: LanceDB for efficient knowledge retrieval  
- **⚡ Async/Streaming Support**: High-performance async patterns
- **🔧 Custom Tools**: Domain-specific tool implementations
- **📊 Workflow Orchestration**: Complex multi-step process management
- **📈 Monitoring & Observability**: Built-in monitoring capabilities
- **🐳 Production Deployment**: Docker and Kubernetes ready
- **🔒 Security**: Best practices implemented throughout

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker (optional)
- AGNO framework knowledge

### Installation

\`\`\`bash
# Clone the repository
git clone <your-repo>
cd advanced-agno-app

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py
\`\`\`

### Docker Deployment

\`\`\`bash
# Build image
docker build -t advanced-agno-app .

# Run container
docker run -p 8000:8000 advanced-agno-app
\`\`\`

## 🏗️ Architecture

This application showcases advanced AGNO patterns:

1. **Agent Architecture**: Sophisticated agent with comprehensive capabilities
2. **Vector Database**: Efficient knowledge storage and retrieval
3. **Async Patterns**: Non-blocking operations throughout
4. **Custom Tools**: Specialized tools for domain-specific tasks
5. **Monitoring**: Built-in observability and health checks

## 📚 AGNO Best Practices

This application demonstrates:

- ✅ Proper agent initialization and configuration
- ✅ Vector database integration for knowledge retrieval
- ✅ Async/await patterns for performance
- ✅ Custom tool development
- ✅ Error handling and logging
- ✅ Production deployment patterns
- ✅ Testing strategies for AGNO applications

## 🔧 Configuration

Environment variables:
- \`AGNO_MODEL\`: LLM model to use (default: groq/llama-3.1-70b)
- \`VECTOR_DB_URI\`: Vector database URI
- \`LOG_LEVEL\`: Logging level (default: INFO)

## 🧪 Testing

\`\`\`bash
# Run tests
pytest tests/

# Run with coverage
pytest --cov=. tests/
\`\`\`

## 📊 Monitoring

The application includes:
- Health check endpoints
- Performance metrics
- Error tracking
- Resource usage monitoring

## 🚀 Deployment

### Docker
\`\`\`bash
docker-compose up --build
\`\`\`

### Kubernetes
\`\`\`bash
kubectl apply -f k8s/
\`\`\`

## 🤝 Contributing

This application serves as a reference implementation for advanced AGNO patterns. Feel free to extend and customize for your specific needs.

## 📄 License

MIT License - feel free to use and modify.`,
                      language: 'markdown',
                      path: 'README.md',
                      size: 2456
                    }
                  ]
                  setFiles(mockFiles)
                  setSelectedFile(mockFiles[0])
                }
              } else if (data.type === 'error') {
                setStatusMessage(data.content.message)
                setCurrentStage('error')
                toast.error('Generation failed')
              }
            } catch (error) {
              console.error('Error parsing stream data:', error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error)
      setStatusMessage('❌ Generation failed')
      setCurrentStage('error')
      toast.error('Generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const downloadAsZip = () => {
    if (!generationResult) return
    
    // Mock download functionality
    toast.success('Download would start here - ZIP with all files')
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'init': return <Brain className="w-4 h-4 animate-pulse" />
      case 'knowledge': return <Database className="w-4 h-4 animate-spin" />
      case 'agent_init': return <Settings className="w-4 h-4 animate-spin" />
      case 'generation': return <Workflow className="w-4 h-4 animate-pulse" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return <Zap className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-slate-700/50">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Generate V0.1
                </h1>
                <p className="text-slate-400 text-sm">Advanced AGNO applications with comprehensive knowledge</p>
              </div>
            </div>
            
            {generationResult && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/30 text-green-400 rounded-lg border border-green-700/50">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Advanced App Ready</span>
                </div>
                <button
                  onClick={downloadAsZip}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <span>Advanced Application Request</span>
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Describe your advanced application
                  </label>
                  <textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="Create a sophisticated AI-powered task management system with vector database integration, custom agents for different domains, async processing capabilities, and comprehensive monitoring. Include workflow orchestration for complex multi-step operations and production-ready deployment configuration."
                    className="w-full h-32 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    ✨ V0.1 uses comprehensive AGNO documentation to create sophisticated applications
                  </p>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating Advanced App...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      <span>Generate Advanced V0.1</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Features */}
            <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 p-6">
              <h3 className="text-lg font-semibold mb-4 text-purple-400">V0.1 Advanced Features</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 text-sm">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Vector Database</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Workflow className="w-4 h-4 text-green-400" />
                  <span>Workflows</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span>Custom Tools</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <MonitorSpeaker className="w-4 h-4 text-orange-400" />
                  <span>Monitoring</span>
                </div>
              </div>
            </div>

            {/* Generation Status */}
            {(isGenerating || statusMessage) && (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  {getStageIcon(currentStage)}
                  <span className="text-lg font-medium">Generation Status</span>
                </div>
                
                <div className="space-y-3">
                  <div className="text-slate-300">
                    {statusMessage}
                  </div>
                  
                  {isGenerating && (
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className="bg-gradient-to-r from-purple-500 to-cyan-500 h-2 rounded-full animate-pulse" 
                           style={{ width: '45%' }}></div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Files Section */}
          <div className="space-y-6">
            {files.length > 0 && (
              <>
                <div className="bg-slate-900/50 rounded-xl border border-slate-800">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-lg font-semibold flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Generated Files ({files.length})</span>
                    </h3>
                  </div>
                  
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {files.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedFile(file)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          selectedFile?.name === file.name
                            ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{file.name}</span>
                          <span className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)}KB
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 capitalize">{file.language}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedFile && (
                  <div className="bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                      <h4 className="font-mono text-sm">{selectedFile.name}</h4>
                      <button
                        onClick={() => copyToClipboard(selectedFile.content)}
                        className="flex items-center space-x-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </button>
                    </div>
                    
                    <div className="p-4">
                      <pre className="text-sm bg-slate-950/50 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                        <code>{selectedFile.content}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}