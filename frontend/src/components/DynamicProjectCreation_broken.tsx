import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Clock, FileText, Zap, Brain, Rocket, AlertCircle } from 'lucide-react'

interface ProjectCreationStep {
  type: 'status' | 'file_created' | 'progress' | 'reasoning' | 'completed' | 'error'
  message: string
  stage: string
  file_name?: string
  files_created?: number
  action?: string
  task_info?: string
  app_path?: string
  app_name?: string
  metrics?: any
  response?: string
  timestamp?: string
}

interface DynamicProjectCreationProps {
  request: string
  onComplete?: (result: any) => void
  onError?: (error: string) => void
}

const DynamicProjectCreation: React.FC<DynamicProjectCreationProps> = ({ request, onComplete, onError }) => {
  const [steps, setSteps] = useState<ProjectCreationStep[]>([])
  const [isCompleted, setIsCompleted] = useState(false)
  const [currentStage, setCurrentStage] = useState('initializing')
  const [filesCreated, setFilesCreated] = useState<string[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  
  const stepsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  // Project creation using HTTP API (WebSocket fallback for Docker issues)
  useEffect(() => {
    if (!request) return

    const createProjectWithHttp = async () => {
      console.log('Creating project using HTTP API')
      
      // Show initial progress
      setSteps(prev => [...prev, {
        type: 'status',
        message: '🚀 Starting project creation...',
        stage: 'initializing',
        timestamp: new Date().toISOString()
      }])
      setCurrentStage('initializing')
      
      try {
        // Simulate progress updates
        setTimeout(() => {
          setSteps(prev => [...prev, {
            type: 'progress',
            message: '📝 Analyzing request...',
            stage: 'analysis',
            timestamp: new Date().toISOString()
          }])
          setCurrentStage('analysis')
        }, 500)
        
        setTimeout(() => {
          setSteps(prev => [...prev, {
            type: 'reasoning',
            message: '🧠 Agent reasoning: Planning application structure...',
            stage: 'planning',
            timestamp: new Date().toISOString()
          }])
          setCurrentStage('planning')
        }, 1000)
        
        setTimeout(() => {
          setSteps(prev => [...prev, {
            type: 'status',
            message: '⚙️ Generating application...',
            stage: 'generation',
            timestamp: new Date().toISOString()
          }])
          setCurrentStage('generation')
        }, 1500)
        
        // Make the actual HTTP request
        const response = await fetch('http://localhost:8000/api/kiff/process-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ request })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        // Show file creation progress
        if (result.response && typeof result.response === 'string') {
          const fileMatches = result.response.match(/Created file: ([^\n]+)/g)
          if (fileMatches) {
            fileMatches.forEach((match, index) => {
              const fileName = match.replace('Created file: ', '')
              setTimeout(() => {
                setSteps(prev => [...prev, {
                  type: 'file_created',
                  message: `📄 Created ${fileName}`,
                  stage: 'generation',
                  file_name: fileName,
                  timestamp: new Date().toISOString()
                }])
                setFilesCreated(prev => [...prev, fileName])
              }, 2000 + (index * 300))
            })
          }
        }
        
        // Show completion
        setTimeout(() => {
          setSteps(prev => [...prev, {
            type: 'completed',
            message: '✅ Project creation completed!',
            stage: 'completed',
            app_path: result.app_path,
            app_name: result.app_path?.split('/').pop() || 'Generated App',
            files_created: result.response?.match(/Created file:/g)?.length || 0,
            timestamp: new Date().toISOString()
          }])
          setCurrentStage('completed')
          setIsCompleted(true)
          
          if (result.metrics) {
            setMetrics(result.metrics)
          }
          
          if (onComplete) {
            onComplete({
              app_path: result.app_path,
              app_name: result.app_path?.split('/').pop() || 'Generated App',
              files_created: result.response?.match(/Created file:/g)?.length || 0,
              metrics: result.metrics,
              response: result.response
            })
          }
        }, 3000)
        
      } catch (error: any) {
        console.error('HTTP project creation error:', error)
        setSteps(prev => [...prev, {
          type: 'error',
          message: `❌ Error: ${error.message}`,
          stage: 'error',
          timestamp: new Date().toISOString()
        }])
        
        if (onError) {
          onError(error.message)
        }
      }
    }
    
    createProjectWithHttp()
  }, [request, onComplete, onError])

      ws.onmessage = (event) => {
        try {
          const data: ProjectCreationStep = JSON.parse(event.data)
          data.timestamp = new Date().toISOString()
          
          setSteps(prev => [...prev, data])
          setCurrentStage(data.stage)

          // Handle different message types
          switch (data.type) {
            case 'file_created':
              if (data.file_name) {
                setFilesCreated(prev => [...prev, data.file_name!])
              }
              break
            
            case 'completed':
              setIsCompleted(true)
              if (data.metrics) {
                setMetrics(data.metrics)
              }
              if (onComplete) {
                onComplete({
                  app_path: data.app_path,
                  app_name: data.app_name,
                  files_created: data.files_created,
                  metrics: data.metrics,
                  response: data.response
                })
              }
              break
            
            case 'error':
              if (onError) {
                onError(data.message)
              }
              break
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
        if (onError) {
          onError('Connection error occurred')
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
      }
    }

    connectWebSocket()

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [request, onComplete, onError])

  const getStageIcon = (stage: string, type: string) => {
    if (type === 'error') return <AlertCircle className="w-4 h-4 text-red-400" />
    if (type === 'completed') return <CheckCircle className="w-4 h-4 text-green-400" />
    
    switch (stage) {
      case 'initializing':
      case 'setup':
        return <Rocket className="w-4 h-4 text-blue-400" />
      case 'agent_setup':
      case 'analysis':
        return <Brain className="w-4 h-4 text-purple-400" />
      case 'file_creation':
        return <FileText className="w-4 h-4 text-cyan-400" />
      case 'progress_tracking':
        return <Zap className="w-4 h-4 text-yellow-400" />
      case 'thinking':
        return <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
      case 'execution':
        return <Clock className="w-4 h-4 text-orange-400 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getStageColor = (stage: string, type: string) => {
    if (type === 'error') return 'border-red-500/30 bg-red-500/10'
    if (type === 'completed') return 'border-green-500/30 bg-green-500/10'
    
    switch (stage) {
      case 'initializing':
      case 'setup':
        return 'border-blue-500/30 bg-blue-500/10'
      case 'agent_setup':
      case 'analysis':
        return 'border-purple-500/30 bg-purple-500/10'
      case 'file_creation':
        return 'border-cyan-500/30 bg-cyan-500/10'
      case 'progress_tracking':
        return 'border-yellow-500/30 bg-yellow-500/10'
      case 'thinking':
        return 'border-indigo-500/30 bg-indigo-500/10'
      case 'execution':
        return 'border-orange-500/30 bg-orange-500/10'
      default:
        return 'border-slate-500/30 bg-slate-500/10'
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <h2 className="text-xl font-semibold text-slate-100">
            {isCompleted ? '✅ Project Creation Complete!' : '🚀 Creating Your Project...'}
          </h2>
        </div>
        
        {/* Progress Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-1">Current Stage</div>
            <div className="text-lg font-medium text-slate-100 capitalize">
              {currentStage.replace('_', ' ') || 'Initializing'}
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-1">Files Created</div>
            <div className="text-lg font-medium text-cyan-400">
              {filesCreated.length}
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-1">Steps Completed</div>
            <div className="text-lg font-medium text-green-400">
              {steps.length}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Steps */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 max-h-96 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Live Progress
          </h3>
          
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${getStageColor(step.stage, step.type)}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStageIcon(step.stage, step.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-medium">
                    {step.message}
                  </div>
                  
                  {step.file_name && (
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      {step.file_name.split('/').pop()}
                    </div>
                  )}
                  
                  {step.task_info && step.task_info !== step.message && (
                    <div className="text-xs text-slate-400 mt-1">
                      {step.task_info}
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 mt-1">
                    {step.timestamp && new Date(step.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {steps.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Connecting to project creation service...</p>
              </div>
            )}
          </div>
          
          <div ref={stepsEndRef} />
        </div>
      </div>

      {/* Files Created */}
      {filesCreated.length > 0 && (
        <div className="mt-6 bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h3 className="text-lg font-medium text-slate-100 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Files Created ({filesCreated.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filesCreated.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-slate-700/30 rounded text-sm text-slate-300 font-mono"
              >
                <FileText className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span className="truncate">{file.split('/').pop()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="mt-6 bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <h3 className="text-lg font-medium text-slate-100 mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Tokens Used:</span>
              <span className="ml-2 text-slate-200">{metrics.total_tokens?.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400">Model:</span>
              <span className="ml-2 text-slate-200">{metrics.model_used}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DynamicProjectCreation
