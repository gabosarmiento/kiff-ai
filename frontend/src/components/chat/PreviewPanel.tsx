import React, { useState, useEffect } from 'react'
import { Eye, Code, ExternalLink, RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react'

interface PreviewData {
  type: 'application' | 'component' | 'file'
  title: string
  description?: string
  content?: string
  url?: string
  files?: Array<{
    name: string
    path: string
    content: string
    language: string
  }>
  metadata?: {
    framework?: string
    dependencies?: string[]
    buildCommand?: string
    startCommand?: string
  }
}

interface PreviewPanelProps {
  previewData: PreviewData | null
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export function PreviewPanel({ 
  previewData, 
  isExpanded = false, 
  onToggleExpand 
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'files'>('preview')
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Set first file as selected when preview data changes
  useEffect(() => {
    if (previewData?.files && previewData.files.length > 0) {
      setSelectedFile(previewData.files[0].path)
    }
  }, [previewData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh delay
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleDownload = () => {
    if (!previewData) return
    
    // Create a simple download of the preview data as JSON
    const dataStr = JSON.stringify(previewData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${previewData.title.toLowerCase().replace(/\s+/g, '-')}-preview.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!previewData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 border-l border-slate-700/50">
        <div className="text-center p-8">
          <Eye className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">No Preview Available</h3>
          <p className="text-sm text-slate-500">
            Generate an application or component to see a live preview here.
          </p>
        </div>
      </div>
    )
  }

  const selectedFileData = previewData.files?.find(f => f.path === selectedFile)

  return (
    <div className={`bg-slate-900 border-l border-slate-700/50 flex flex-col ${
      isExpanded ? 'fixed inset-0 z-50' : 'h-full'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center border border-green-400/30">
            <Eye className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">{previewData.title}</h3>
            {previewData.description && (
              <p className="text-xs text-slate-400">{previewData.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleDownload}
            className="p-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
            title="Download preview data"
          >
            <Download className="w-4 h-4 text-slate-400" />
          </button>
          
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-slate-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/50">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Preview
        </button>
        
        {previewData.files && previewData.files.length > 0 && (
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'files'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Code className="w-4 h-4 inline mr-2" />
            Files ({previewData.files.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="h-full p-4">
            {previewData.url ? (
              <div className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <span>Live Preview:</span>
                    <code className="bg-slate-800 px-2 py-1 rounded">{previewData.url}</code>
                  </div>
                  <a
                    href={previewData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors text-sm text-slate-400"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in new tab</span>
                  </a>
                </div>
                <iframe
                  src={previewData.url}
                  className="w-full h-full bg-white rounded-lg border border-slate-600/50"
                  title="Application Preview"
                />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {previewData.content ? (
                  <div className="flex-1 bg-slate-800/50 rounded-lg p-4 overflow-auto">
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap">
                      {previewData.content}
                    </pre>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Eye className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">Preview will appear here once generated</p>
                    </div>
                  </div>
                )}
                
                {previewData.metadata && (
                  <div className="mt-4 bg-slate-800/30 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Metadata</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {previewData.metadata.framework && (
                        <div>
                          <span className="text-slate-500">Framework:</span>
                          <span className="text-slate-300 ml-1">{previewData.metadata.framework}</span>
                        </div>
                      )}
                      {previewData.metadata.buildCommand && (
                        <div>
                          <span className="text-slate-500">Build:</span>
                          <code className="text-slate-300 ml-1 bg-slate-800 px-1 rounded">
                            {previewData.metadata.buildCommand}
                          </code>
                        </div>
                      )}
                      {previewData.metadata.startCommand && (
                        <div>
                          <span className="text-slate-500">Start:</span>
                          <code className="text-slate-300 ml-1 bg-slate-800 px-1 rounded">
                            {previewData.metadata.startCommand}
                          </code>
                        </div>
                      )}
                    </div>
                    {previewData.metadata.dependencies && previewData.metadata.dependencies.length > 0 && (
                      <div className="mt-2">
                        <span className="text-slate-500 text-xs">Dependencies:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {previewData.metadata.dependencies.map((dep, index) => (
                            <span
                              key={index}
                              className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded"
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && previewData.files && (
          <div className="h-full flex">
            {/* File List */}
            <div className="w-64 border-r border-slate-700/50 bg-slate-800/30">
              <div className="p-3 border-b border-slate-700/50">
                <h4 className="text-sm font-medium text-slate-300">Files</h4>
              </div>
              <div className="overflow-y-auto">
                {previewData.files.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedFile(file.path)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/30 transition-colors ${
                      selectedFile === file.path ? 'bg-slate-700/50 text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-slate-500 truncate">{file.path}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 flex flex-col">
              {selectedFileData ? (
                <>
                  <div className="p-3 border-b border-slate-700/50 bg-slate-800/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-slate-300">{selectedFileData.name}</h4>
                        <p className="text-xs text-slate-500">{selectedFileData.path}</p>
                      </div>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                        {selectedFileData.language}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-slate-900">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                      <code>{selectedFileData.content}</code>
                    </pre>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-400">Select a file to view its content</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
