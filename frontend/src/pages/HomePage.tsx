import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'
import { AppBuilderInterface } from '@/components/app-builder/AppBuilderInterface'
import DynamicProjectCreation from '@/components/DynamicProjectCreation'

export function HomePage() {
  const navigate = useNavigate()
  const { setLoading } = useStore()
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedApp, setGeneratedApp] = useState<any>(null)
  const [showDynamicUI, setShowDynamicUI] = useState(false)

  const handleGenerate = async (appPrompt: string) => {
    if (!appPrompt.trim()) return
    
    setPrompt(appPrompt)
    setIsProcessing(true)
    setLoading('generating', true)
    
    // Show dynamic UI for app generation
    setShowDynamicUI(true)
    
    // The dynamic UI component will handle the actual generation via WebSocket
    // This function just initiates the process
  }

  // Callback handlers for dynamic UI
  const handleProjectComplete = (result: any) => {
    setGeneratedApp(result)
    setIsProcessing(false)
    setLoading('generating', false)
    toast.success('Application generated successfully!')
    
    // Navigate immediately to Applications page
    navigate('/applications')
  }

  const handleProjectError = (error: string) => {
    setIsProcessing(false)
    setLoading('generating', false)
    setShowDynamicUI(false)
    toast.error(`Generation failed: ${error}`)
    console.error('Generation error:', error)
  }


  return (
    <div className="h-full">
      {!showDynamicUI ? (
        <AppBuilderInterface
          onGenerate={handleGenerate}
          isProcessing={isProcessing}
        />
      ) : (
        <div className="h-full p-6 bg-slate-950">
          <div className="max-w-6xl mx-auto">
            <DynamicProjectCreation
              request={prompt}
              onComplete={handleProjectComplete}
              onError={handleProjectError}
            />
          </div>
        </div>
      )}
    </div>
  )
}
