import React, { useState, useRef } from 'react'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import toast from 'react-hot-toast'

interface DocumentUploadProps {
  sessionId: string
  onDocumentUploaded?: (filename: string) => void
  className?: string
}

interface UploadedDocument {
  filename: string
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export function DocumentUpload({ sessionId, onDocumentUploaded, className = '' }: DocumentUploadProps) {
  const { user } = useAuth()
  const { tenantId } = useTenant()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    
    Array.from(files).forEach(file => {
      uploadDocument(file)
    })
  }

  const uploadDocument = async (file: File) => {
    // Validate tenant ID (following our recurring issue pattern)
    const currentTenantId = tenantId || user?.tenant_id || '4485db48-71b7-47b0-8128-c6dca5be352d'
    
    if (!currentTenantId) {
      toast.error('Tenant ID not available')
      return
    }

    // Add to uploading state
    const docId = `${file.name}-${Date.now()}`
    setUploadedDocs(prev => [...prev, {
      filename: file.name,
      status: 'uploading'
    }])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', sessionId)
      formData.append('document_type', 'user_upload')

      const response = await fetch(`http://localhost:8000/api/conversation-documents/upload?tenant_id=${currentTenantId}&user_id=${user?.id || '1'}`, {
        method: 'POST',
        headers: {
          'x-tenant-id': currentTenantId // Correct case-sensitive header
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        // Update status to success
        setUploadedDocs(prev => prev.map(doc => 
          doc.filename === file.name && doc.status === 'uploading'
            ? { ...doc, status: 'success' }
            : doc
        ))
        
        toast.success(`📄 Document "${file.name}" uploaded successfully`)
        onDocumentUploaded?.(file.name)
      } else {
        throw new Error(result.message || 'Upload failed')
      }

    } catch (error) {
      console.error('Document upload error:', error)
      
      // Update status to error
      setUploadedDocs(prev => prev.map(doc => 
        doc.filename === file.name && doc.status === 'uploading'
          ? { ...doc, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : doc
      ))
      
      toast.error(`Failed to upload "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const removeDocument = (filename: string) => {
    setUploadedDocs(prev => prev.filter(doc => doc.filename !== filename))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          PDF, TXT, MD, DOC, DOCX (max 10MB)
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.doc,.docx"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Uploaded Documents List */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Session Documents ({uploadedDocs.length})
          </h4>
          
          {uploadedDocs.map((doc, index) => (
            <div
              key={`${doc.filename}-${index}`}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {doc.filename}
                </span>
                
                {/* Status Icon */}
                {doc.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                )}
                {doc.status === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {doc.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
              </div>
              
              <button
                onClick={() => removeDocument(doc.filename)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={doc.status === 'uploading'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {/* Error Messages */}
          {uploadedDocs.some(doc => doc.status === 'error') && (
            <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
              {uploadedDocs
                .filter(doc => doc.status === 'error')
                .map((doc, index) => (
                  <div key={index}>
                    • {doc.filename}: {doc.error}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
      
      {/* Help Text */}
      {uploadedDocs.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
          💡 <strong>Uploaded documents</strong> will be automatically included in your conversation context. 
          The AI can reference and use information from these files when generating code.
        </div>
      )}
    </div>
  )
}
