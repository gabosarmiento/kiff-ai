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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const isCreatingRef = useRef(false) // Persistent flag to prevent double generation

  // Smart auto-scroll - only scroll within container, not the whole page
  useEffect(() => {
    if (!scrollContainerRef.current || isUserScrolling) return
    
    const container = scrollContainerRef.current
    const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50
    
    if (isNearBottom) {
      // Scroll within container only, not the whole page
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [steps, isUserScrolling])

  // Track user scrolling to prevent auto-scroll interference
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let scrollTimeout: number
    
    const handleScroll = () => {
      setIsUserScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        setIsUserScrolling(false)
      }, 2000) // Stop considering user scrolling after 2 seconds
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  // Project creation using HTTP API (WebSocket fallback for Docker issues)
  useEffect(() => {
    if (!request) return
    
    // Prevent double generation using persistent ref
    if (isCreatingRef.current) {
      console.log('Project creation already in progress, skipping...')
      return
    }

    const createProjectWithHttp = async () => {
      isCreatingRef.current = true
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
            fileMatches.forEach((match: string, index: number) => {
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
        
        // Reset flag on error to allow retry
        isCreatingRef.current = false
        
        if (onError) {
          onError(error.message)
        }
      }
    }
    
    createProjectWithHttp()
    
    // Cleanup function to reset flag when component unmounts or request changes
    return () => {
      isCreatingRef.current = false
    }
  }, [request, onComplete, onError])

  // Get icon for step type
  const getStepIcon = (step: ProjectCreationStep) => {
    switch (step.type) {
      case 'status':
        return <Rocket className="w-4 h-4 text-cyan-400" />
      case 'progress':
        return <Clock className="w-4 h-4 text-blue-400 animate-spin" />
      case 'reasoning':
        return <Brain className="w-4 h-4 text-purple-400" />
      case 'file_created':
        return <FileText className="w-4 h-4 text-green-400" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return <Zap className="w-4 h-4 text-yellow-400" />
    }
  }

  // Get stage color
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'initializing':
        return 'text-cyan-400'
      case 'analysis':
        return 'text-blue-400'
      case 'planning':
        return 'text-purple-400'
      case 'generation':
        return 'text-yellow-400'
      case 'completed':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-slate-400'
    }
  }

  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-xl flex items-center justify-center border border-cyan-400/30 shadow-lg">
            <Rocket className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Agentic System</h3>
            <p className={`text-sm font-medium ${getStageColor(currentStage)}`}>
              {currentStage.replace('_', ' ').toUpperCase()}
            </p>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center space-x-3">
          {filesCreated.length > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-400/30">
              <FileText className="w-3 h-3" />
              <span>{filesCreated.length} FILES</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-400/30">
              <CheckCircle className="w-3 h-3" />
              <span>COMPLETE</span>
            </div>
          )}
        </div>
      </div>

      {/* System Logs */}
      <div ref={scrollContainerRef} className="h-80 overflow-y-auto bg-slate-950/50 scroll-smooth">
        <div className="p-4 space-y-2 min-h-full">
          {steps.map((step, index) => (
            <div key={index} className="group">
              <div className="flex items-start space-x-3 py-2 px-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getStepIcon(step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">
                      [{new Date(step.timestamp || Date.now()).toLocaleTimeString()}]
                    </span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${getStageColor(step.stage)}`}>
                      {step.stage.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 font-mono leading-relaxed">
                    {step.message}
                  </p>
                  {step.file_name && (
                    <div className="mt-2 flex items-center space-x-2 p-2 bg-slate-800/50 rounded border border-slate-700/50">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs font-mono text-emerald-400">{step.file_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Spacer to prevent over-scroll */}
          <div className="h-4" />
          <div ref={stepsEndRef} />
        </div>
      </div>

      {/* Files Created */}
      {filesCreated.length > 0 && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-800/20">
          <h4 className="text-sm font-medium text-slate-200 mb-2 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-green-400" />
            <span>Generated Files</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filesCreated.map((file, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-slate-700/30 rounded border border-slate-600/30">
                <FileText className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-300 font-mono truncate">{file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="border-t border-slate-700/50 p-4 bg-slate-800/20">
          <h4 className="text-sm font-medium text-slate-200 mb-2">Metrics</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-400 capitalize">{key.replace('_', ' ')}:</span>
                <span className="text-slate-200">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DynamicProjectCreation
