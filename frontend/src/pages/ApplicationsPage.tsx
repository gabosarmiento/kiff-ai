import { useState, useEffect, useCallback, useMemo } from 'react'
import { FolderOpen, File, Code, Download, Trash2, Calendar, FileText, ChevronRight, ChevronDown, Folder } from 'lucide-react'
import { Editor } from '@monaco-editor/react'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface GeneratedApp {
  id: string
  name: string
  description: string
  path: string
  created_at: string
  files: string[]
  size: string
  status: 'completed' | 'generating' | 'error'
}

interface FileContent {
  name: string
  content: string
  language: string
}

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
  isExpanded?: boolean
}

interface AppFileCache {
  [appId: string]: {
    [fileName: string]: FileContent
  }
}

export function ApplicationsPage() {
  const { tenantId } = useTenant()
  const { user: _user } = useAuth() // Renamed to avoid unused variable warning
  const [apps, setApps] = useState<GeneratedApp[]>([])
  const [selectedApp, setSelectedApp] = useState<GeneratedApp | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [fileCache, setFileCache] = useState<AppFileCache>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loadingFileCounts, setLoadingFileCounts] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState<Set<string>>(new Set())
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(8) // Show 8 apps per page
  const [totalApps, setTotalApps] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  
  // Deletion state
  const [deletingApps, setDeletingApps] = useState<Set<string>>(new Set())

  // Instant loading with progressive enhancement
  useEffect(() => {
    const loadApplications = async () => {
      console.log('🚀 Starting to load applications immediately...')
      
      // Keep loading state until we have data
      setIsLoading(true)

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        
        // Add tenant header if available, but don't block loading
        if (tenantId) {
          headers['X-Tenant-ID'] = tenantId
        }
        
        console.log('📡 Making API call to load applications...')
        console.log('🔗 API URL:', `http://localhost:8000/api/kiff/generated-apps?page=${currentPage}&page_size=${pageSize}&sort_by=created&sort_order=desc`)
        console.log('📋 Headers:', headers)
        
        // Try multiple approaches to connect to backend
        let response: Response
        let data: any
        
        // Approach 1: Direct localhost:8000 (current)
        try {
          console.log('🔄 Attempt 1: Direct connection to localhost:8000')
          response = await fetch(`http://localhost:8000/api/kiff/generated-apps?page=${currentPage}&page_size=${pageSize}&sort_by=created&sort_order=desc`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(tenantId && { 'X-Tenant-ID': tenantId })
            },
            mode: 'cors'
          })
          
          if (response.ok) {
            data = await response.json()
            console.log('✅ Success with localhost:8000:', data)
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        } catch (error1) {
          console.log('❌ Attempt 1 failed:', error1)
          
          // Approach 2: Try 127.0.0.1:8000
          try {
            console.log('🔄 Attempt 2: Trying 127.0.0.1:8000')
            response = await fetch(`http://127.0.0.1:8000/api/kiff/generated-apps?page=${currentPage}&page_size=${pageSize}&sort_by=created&sort_order=desc`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...(tenantId && { 'X-Tenant-ID': tenantId })
              },
              mode: 'cors'
            })
            
            if (response.ok) {
              data = await response.json()
              console.log('✅ Success with 127.0.0.1:8000:', data)
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
          } catch (error2) {
            console.log('❌ Attempt 2 failed:', error2)
            
            // Approach 3: Mock data fallback for development
            console.log('🔄 Attempt 3: Using mock data fallback')
            data = {
              apps: [
                {
                  name: 'sample-calculator-app',
                  path: '/generated_apps/sample-calculator-app',
                  description: 'A sample calculator application (mock data - backend connection failed)',
                  created: new Date().toISOString(),
                  files: ['app.py', 'requirements.txt', 'README.md']
                }
              ],
              pagination: {
                current_page: 1,
                page_size: 8,
                total_apps: 1,
                total_pages: 1,
                has_next: false,
                has_prev: false
              }
            }
            console.log('⚠️ Using mock data due to connection issues')
            toast.error('Backend connection failed. Showing mock data. Please check if the backend server is running.')
          }
        }
        
        // Update pagination state
        if (data.pagination) {
          setTotalApps(data.pagination.total_apps)
          setTotalPages(data.pagination.total_pages)
          setHasNext(data.pagination.has_next)
          setHasPrev(data.pagination.has_prev)
        }
        
        // Transform backend data to frontend format (instant)
        const transformedApps: GeneratedApp[] = data.apps.map((app: any, index: number) => ({
          id: String((currentPage - 1) * pageSize + index + 1),
          name: app.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: app.description,
          path: app.path,
          created_at: app.created,
          files: app.files, // File list only (no content yet)
          size: 'Unknown',
          status: 'completed' as const
        }))
        
        // Set apps immediately for instant UI
        setApps(transformedApps)
        setIsLoading(false)
        
        // Load file counts for all apps in the background for better UX
        loadFileCountsInBackground(transformedApps)
        
        // Auto-select first app if none selected and we have apps
        if (transformedApps.length > 0 && !selectedApp) {
          const firstApp = transformedApps[0]
          console.log('Auto-selecting first app:', firstApp.name)
          
          // Set selected app FIRST
          setSelectedApp(firstApp)
          
          // Since backend returns empty files array for performance,
          // we need to load the app details immediately to get the file structure
          console.log('Loading app details and files for:', firstApp.name)
          setTimeout(async () => {
            try {
              // Extract app name from path for API call
              const appName = firstApp.path.split('/').pop() || firstApp.name.toLowerCase().replace(/\s+/g, '-')
              
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              }
              
              if (tenantId) {
                headers['X-Tenant-ID'] = tenantId
              }
              
              // Load app details to get file structure
              const response = await fetch(`http://localhost:8000/api/kiff/generated-apps/${appName}`, {
                method: 'GET',
                headers
              })
              
              if (response.ok) {
                const appData = await response.json()
                const fileList = Object.keys(appData.files || {})
                
                console.log('Loaded file list:', fileList)
                
                // Update the selected app with the file list
                const updatedApp = { ...firstApp, files: fileList }
                setSelectedApp(updatedApp)
                
                // Expand all folders by default for better UX
                const allFolderPaths = new Set<string>()
                fileList.forEach(filePath => {
                  const parts = filePath.split('/')
                  let currentPath = ''
                  parts.slice(0, -1).forEach(part => {
                    currentPath = currentPath ? `${currentPath}/${part}` : part
                    allFolderPaths.add(currentPath)
                  })
                })
                console.log('Setting expanded folders:', Array.from(allFolderPaths))
                setExpandedFolders(allFolderPaths)
                
                // Load first file content immediately
                if (fileList.length > 0) {
                  console.log('Loading first file:', fileList[0])
                  loadFileContent(updatedApp, fileList[0])
                }
              } else {
                console.error('Failed to load app details:', response.status)
              }
            } catch (error) {
              console.error('Error loading app details:', error)
            }
          }, 100) // Small delay to ensure state updates are processed
        }
        
      } catch (error) {
        console.error('❌ Failed to load applications:', error)
        
        // More specific error messages
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.error('⏰ Request timed out after 10 seconds')
            toast.error('Request timed out. Please check if the backend is running.')
          } else if (error.message.includes('fetch')) {
            console.error('🌐 Network error - backend might be down')
            toast.error('Cannot connect to backend. Please check if the server is running on port 8000.')
          } else {
            console.error('🚨 Unexpected error:', error.message)
            toast.error(`Failed to load applications: ${error.message}`)
          }
        } else {
          console.error('🚨 Unknown error:', error)
          toast.error('An unknown error occurred while loading applications')
        }
        
        setApps([])
      } finally {
        setIsLoading(false)
      }
    }

    // Start loading immediately (non-blocking)
    loadApplications()
  }, [currentPage]) // Only depend on currentPage, not auth

  // Build tree structure from file list
  const buildFileTree = useCallback((files: string[]): FileNode[] => {
    const tree: FileNode[] = []
    const folderMap = new Map<string, FileNode>()

    files.forEach(filePath => {
      const parts = filePath.split('/')
      let currentPath = ''
      
      parts.forEach((part, index) => {
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isFile = index === parts.length - 1
        
        if (!folderMap.has(currentPath)) {
          const node: FileNode = {
            name: part,
            type: isFile ? 'file' : 'folder',
            path: currentPath,
            children: isFile ? undefined : [],
            isExpanded: true  // Folders expanded by default for better UX
          }
          
          folderMap.set(currentPath, node)
          
          if (parentPath) {
            const parent = folderMap.get(parentPath)
            if (parent && parent.children) {
              parent.children.push(node)
            }
          } else {
            tree.push(node)
          }
        }
      })
    })

    return tree
  }, [])

  // Get file tree for selected app
  const fileTree = useMemo(() => {
    if (!selectedApp) return []
    console.log('Building file tree for app:', selectedApp.name, 'Files:', selectedApp.files)
    const tree = buildFileTree(selectedApp.files)
    console.log('Generated file tree:', tree)
    return tree
  }, [selectedApp, buildFileTree])

  // Load file counts for all apps in background
  const loadFileCountsInBackground = useCallback(async (appsToLoad: GeneratedApp[]) => {
    console.log('🔄 Loading file counts for', appsToLoad.length, 'applications in background...')
    
    // Process apps in batches to avoid overwhelming the backend
    const batchSize = 3
    for (let i = 0; i < appsToLoad.length; i += batchSize) {
      const batch = appsToLoad.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (app) => {
        // Skip if already has files or is currently loading
        if (app.files.length > 0 || loadingFileCounts.has(app.name)) {
          return
        }
        
        try {
          // Mark as loading
          setLoadingFileCounts(prev => new Set([...prev, app.name]))
          
          const appName = app.path.split('/').pop() || app.name.toLowerCase().replace(/\s+/g, '-')
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          
          if (tenantId) {
            headers['X-Tenant-ID'] = tenantId
          }
          
          const response = await fetch(`http://localhost:8000/api/kiff/generated-apps/${appName}`, {
            method: 'GET',
            headers
          })
          
          if (response.ok) {
            const appData = await response.json()
            const fileList = Object.keys(appData.files || {})
            
            console.log(`✅ Loaded ${fileList.length} files for ${app.name}`)
            
            // Update the app in the apps list with the actual file count
            setApps(prevApps => 
              prevApps.map(prevApp => 
                prevApp.name === app.name 
                  ? { ...prevApp, files: fileList }
                  : prevApp
              )
            )
          } else {
            console.warn(`⚠️ Failed to load files for ${app.name}:`, response.status)
          }
        } catch (error) {
          console.error(`❌ Error loading files for ${app.name}:`, error)
        } finally {
          // Remove from loading set
          setLoadingFileCounts(prev => {
            const newSet = new Set(prev)
            newSet.delete(app.name)
            return newSet
          })
        }
      })
      
      // Wait for batch to complete before processing next batch
      await Promise.allSettled(batchPromises)
      
      // Small delay between batches to be kind to the backend
      if (i + batchSize < appsToLoad.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log('✅ Finished loading file counts for all applications')
  }, [tenantId, loadingFileCounts])

  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': case 'jsx': return 'javascript'
      case 'ts': case 'tsx': return 'typescript'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'json': return 'json'
      case 'md': return 'markdown'
      case 'py': return 'python'
      default: return 'plaintext'
    }
  }

  const loadFileContent = useCallback(async (app: GeneratedApp, filename: string) => {
    // Check cache first for instant loading
    if (fileCache[app.id]?.[filename]) {
      setSelectedFile(fileCache[app.id][filename])
      setIsLoadingFile(false) // Ensure loading state is cleared
      return
    }

    // Show loading state only for uncached files
    setIsLoadingFile(true)
    
    // Show placeholder content immediately for better UX
    setSelectedFile({
      name: filename,
      content: '// Loading file content...',
      language: getFileLanguage(filename)
    })
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId
      }

      // Extract app name from path for API call
      const appName = app.path.split('/').pop() || app.name.toLowerCase().replace(/\s+/g, '-')
      
      // Load all files at once for better performance
      const response = await fetch(`http://localhost:8000/api/kiff/generated-apps/${appName}`, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error(`Failed to load app files: ${response.status}`)
      }

      const data = await response.json()
      
      // Cache all files from this app for instant future access
      const appCache: { [fileName: string]: FileContent } = {}
      Object.entries(data.files).forEach(([fileName, content]) => {
        appCache[fileName] = {
          name: fileName,
          content: content as string,
          language: getFileLanguage(fileName)
        }
      })
      
      // Update cache
      setFileCache(prev => ({
        ...prev,
        [app.id]: appCache
      }))
      
      // Set the requested file
      const fileContent = appCache[filename] || {
        name: filename,
        content: `// ${filename}\n// File not found or could not be loaded`,
        language: getFileLanguage(filename)
      }
      
      setSelectedFile(fileContent)
    } catch (error) {
      console.error('Failed to load file content:', error)
      toast.error(`Failed to load ${filename}`)
      
      // Fallback content
      setSelectedFile({
        name: filename,
        content: `// ${filename}\n// Error loading file: ${error}`,
        language: getFileLanguage(filename)
      })
    } finally {
      setIsLoadingFile(false)
    }
  }, [fileCache, tenantId, getFileLanguage])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'generating': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-slate-400'
    }
  }

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }, [])

  const downloadApp = async (appName: string) => {
    try {
      setIsDownloading(prev => new Set(prev).add(appName))
      
      const response = await fetch(`/api/kiff/generated-apps/${appName}/download`, {
        method: 'GET',
        headers: {
          ...(tenantId && { 'X-Tenant-ID': tenantId })
        }
      })

      if (!response.ok) {
        throw new Error('Failed to download application')
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${appName}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Application downloaded successfully')
    } catch (error) {
      console.error('Error downloading app:', error)
      toast.error('Failed to download application')
    } finally {
      setIsDownloading(prev => {
        const newSet = new Set(prev)
        newSet.delete(appName)
        return newSet
      })
    }
  }


  const renderFileTree = useCallback((nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path)
      const paddingLeft = depth * 16 + 8
      
      return (
        <div key={node.path}>
          <div
            className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-sm transition-all ${
              selectedFile?.name === node.name && node.type === 'file'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-300 hover:bg-slate-700/30'
            }`}
            style={{ paddingLeft }}
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(node.path)
              } else if (selectedApp) {
                loadFileContent(selectedApp, node.path)
              }
            }}
          >
            {node.type === 'folder' ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                )}
                <Folder className="w-3 h-3 text-blue-400" />
              </>
            ) : (
              <>
                <div className="w-3" /> {/* Spacer for alignment */}
                <Code className="w-3 h-3 text-slate-400" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </div>
          
          {node.type === 'folder' && isExpanded && node.children && (
            <div>
              {renderFileTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }, [expandedFolders, selectedFile, selectedApp, toggleFolder, loadFileContent])

  const handleDeleteApp = async (appId: string) => {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    
    // Prevent multiple simultaneous deletions of the same app
    if (deletingApps.has(appId)) {
      toast('This application is already being deleted', {
        icon: '⚠️',
        style: {
          background: '#f59e0b',
          color: '#fff',
        },
      })
      return
    }
    
    if (confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      // Add to deleting set to show loading state
      setDeletingApps(prev => new Set([...prev, appId]))
      
      try {
        // Get app name from path (last part of the path)
        const appName = app.path.split('/').pop() || app.name.toLowerCase().replace(/\s+/g, '_')
        
        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        
        if (tenantId) {
          headers['X-Tenant-ID'] = tenantId
        }
        
        // Call backend DELETE endpoint
        const response = await fetch(`http://localhost:8000/api/kiff/generated-apps/${appName}`, {
          method: 'DELETE',
          headers
        })
        
        if (!response.ok) {
          throw new Error(`Failed to delete application: ${response.status}`)
        }
        
        // Only remove from frontend state after successful backend deletion
        setApps(prevApps => {
          const newApps = prevApps.filter(app => app.id !== appId)
          
          // Update pagination state immediately
          const newTotalApps = totalApps - 1
          const newTotalPages = Math.max(1, Math.ceil(newTotalApps / pageSize))
          
          setTotalApps(newTotalApps)
          setTotalPages(newTotalPages)
          setHasNext(currentPage < newTotalPages)
          setHasPrev(currentPage > 1)
          
          // If current page is now empty and we're not on page 1, go to previous page
          if (newApps.length === 0 && currentPage > 1) {
            setCurrentPage(prev => prev - 1)
          }
          
          return newApps
        })
        
        if (selectedApp?.id === appId) {
          setSelectedApp(null)
          setSelectedFile(null)
        }
        
        toast.success('Application deleted successfully')
        
      } catch (error) {
        console.error('Failed to delete application:', error)
        toast.error('Failed to delete application. Please try again.')
      } finally {
        // Remove from deleting set regardless of success/failure
        setDeletingApps(prev => {
          const newSet = new Set(prev)
          newSet.delete(appId)
          return newSet
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading applications...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Generated Kiffs</h1>
        <p className="text-slate-400">Browse and manage your AI-generated applications</p>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
        {/* Apps List */}
        <div className="col-span-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Kiffs ({apps.length})
            </h2>
          </div>
          
          <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
            {apps.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-2">No applications yet</p>
                <p className="text-sm text-slate-500">Generate your first app from the Home page</p>
              </div>
            ) : (
              apps.map((app) => (
                <div
                  key={app.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedApp?.id === app.id
                      ? 'bg-cyan-500/20 border border-cyan-500/30'
                      : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
                  }`}
                  onClick={async () => {
                    console.log('🔍 Selecting app:', app.name, 'Files:', app.files)
                    
                    // Set selected app immediately for instant UI feedback
                    setSelectedApp(app)
                    
                    // If app already has files, use them immediately
                    if (app.files && app.files.length > 0) {
                      console.log('✅ App already has files, using cached data')
                      
                      // Expand folders immediately
                      const allFolderPaths = new Set<string>()
                      app.files.forEach(filePath => {
                        const parts = filePath.split('/')
                        let currentPath = ''
                        parts.slice(0, -1).forEach(part => {
                          currentPath = currentPath ? `${currentPath}/${part}` : part
                          allFolderPaths.add(currentPath)
                        })
                      })
                      setExpandedFolders(allFolderPaths)
                      
                      // Load first file immediately
                      if (app.files.length > 0) {
                        loadFileContent(app, app.files[0])
                      }
                      return
                    }
                    
                    // Only fetch files if not already loaded
                    console.log('📥 Fetching files for app:', app.name)
                    try {
                      // Extract app name from path for proper API call
                      const appName = app.path.split('/').pop() || app.name.toLowerCase().replace(/\s+/g, '-')
                      
                      const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                      }
                      
                      if (tenantId) {
                        headers['X-Tenant-ID'] = tenantId
                      }
                      
                      const response = await fetch(`http://localhost:8000/api/kiff/generated-apps/${appName}`, {
                        headers,
                        signal: AbortSignal.timeout(5000) // 5 second timeout
                      })
                      
                      if (response.ok) {
                        const appData = await response.json()
                        const fileList = Object.keys(appData.files || {})
                        console.log('✅ Loaded files:', fileList)
                        
                        // Update app with loaded files
                        const updatedApp = { ...app, files: fileList }
                        setSelectedApp(updatedApp)
                        
                        // Update the apps list to cache the files
                        setApps(prevApps => 
                          prevApps.map(a => a.id === app.id ? updatedApp : a)
                        )
                        
                        // Expand folders for this app
                        const allFolderPaths = new Set<string>()
                        fileList.forEach(filePath => {
                          const parts = filePath.split('/')
                          let currentPath = ''
                          parts.slice(0, -1).forEach(part => {
                            currentPath = currentPath ? `${currentPath}/${part}` : part
                            allFolderPaths.add(currentPath)
                          })
                        })
                        setExpandedFolders(allFolderPaths)
                        
                        // Load first file if available
                        if (fileList.length > 0) {
                          loadFileContent(updatedApp, fileList[0])
                        }
                      } else {
                        console.error('Failed to fetch files:', response.status, response.statusText)
                        toast.error(`Failed to load files: ${response.statusText}`)
                      }
                    } catch (error) {
                      console.error('Failed to load files for app:', error)
                      if (error instanceof Error && error.name === 'TimeoutError') {
                        toast.error('File loading timed out. Please try again.')
                      } else {
                        toast.error('Failed to load files. Please try again.')
                      }
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-100 text-sm">{app.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{app.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(app.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {app.files.length > 0 
                            ? `${app.files.length} files` 
                            : loadingFileCounts.has(app.name) 
                              ? 'Loading files...' 
                              : 'Files pending...'
                          }
                        </span>
                      </div>
                      <div className={`text-xs mt-1 ${getStatusColor(app.status)}`}>
                        {app.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadApp(app.name)
                        }}
                        disabled={isDownloading.has(app.name)}
                        className={`p-1 transition-colors ${
                          isDownloading.has(app.name)
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-500 hover:text-cyan-400'
                        }`}
                        title={isDownloading.has(app.name) ? 'Downloading...' : 'Download project as ZIP'}
                      >
                        {isDownloading.has(app.name) ? (
                          <div className="w-3 h-3 border border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteApp(app.id)
                        }}
                        disabled={deletingApps.has(app.id)}
                        className={`p-1 transition-colors ${
                          deletingApps.has(app.id)
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-500 hover:text-red-400'
                        }`}
                        title={deletingApps.has(app.id) ? 'Deleting...' : 'Delete application'}
                      >
                        {deletingApps.has(app.id) ? (
                          <div className="w-3 h-3 border border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-400">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalApps)} of {totalApps}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!hasPrev}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={!hasNext}
                    className="px-3 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* File Explorer */}
        <div className="col-span-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <File className="w-4 h-4" />
              Files
            </h2>
          </div>
          
          <div className="p-2 overflow-y-auto max-h-[calc(100vh-300px)]">
            {!selectedApp ? (
              <div className="text-center py-8">
                <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Select an app to view files</p>
              </div>
            ) : selectedApp.files.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading files for {selectedApp.name}...</p>
                <p className="text-xs text-slate-500 mt-1">Please wait while we fetch the file structure</p>
              </div>
            ) : fileTree.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-pulse">
                  <File className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Building file tree...</p>
                  <p className="text-xs text-slate-500 mt-1">Processing {selectedApp.files.length} files</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {renderFileTree(fileTree)}
              </div>
            )}
          </div>
        </div>

        {/* Code Editor */}
        <div className="col-span-5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                <Code className="w-4 h-4" />
                {selectedFile ? selectedFile.name : 'Code Editor'}
              </h2>
            </div>
          </div>
          
          <div className="h-[calc(100%-60px)]">
            {isLoadingFile ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Loading file...</p>
                </div>
              </div>
            ) : selectedFile ? (
              <Editor
                height="100%"
                language={selectedFile.language}
                value={selectedFile.content}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-1">No file selected</p>
                  <p className="text-sm text-slate-500">Choose a file to view its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
