import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// kiff System Types - for adaptive agentic API documentation extraction
export interface GeneratedApp {
  id: string
  name: string
  description: string
  createdAt: string
  status: 'generating' | 'completed' | 'error'
  files: GeneratedFile[]
  apiDomains: string[]
}

export interface GeneratedFile {
  path: string
  content: string
  type: 'code' | 'config' | 'documentation'
}

export interface APIGalleryItem {
  id: string
  name: string
  description: string
  baseUrl: string
  documentationUrl: string
  status: 'indexed' | 'indexing' | 'error' | 'pending'
  lastIndexed?: string
  categories: string[]
}

// Legacy Agent interface kept for compatibility but will be transformed for kiff use case
export interface Agent {
  id: string
  name: string
  description: string
  app_type: string
  api_domains: string[]
  model: string
  created_at: string
  updated_at: string
}

interface AppState {
  // Generated Applications for kiff system
  generatedApps: GeneratedApp[]
  selectedApp: GeneratedApp | null
  
  // API Gallery for kiff system
  apiGallery: APIGalleryItem[]
  selectedAPI: APIGalleryItem | null
  
  // UI State
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  loading: {
    apps: boolean
    gallery: boolean
    generating: boolean
  }
}

interface AppActions {
  // Generated App Actions
  setGeneratedApps: (apps: GeneratedApp[]) => void
  addGeneratedApp: (app: GeneratedApp) => void
  updateGeneratedApp: (id: string, updates: Partial<GeneratedApp>) => void
  deleteGeneratedApp: (id: string) => void
  setSelectedApp: (app: GeneratedApp | null) => void
  
  // API Gallery Actions
  setAPIGallery: (items: APIGalleryItem[]) => void
  addAPIGalleryItem: (item: APIGalleryItem) => void
  updateAPIGalleryItem: (id: string, updates: Partial<APIGalleryItem>) => void
  deleteAPIGalleryItem: (id: string) => void
  setSelectedAPI: (api: APIGalleryItem | null) => void
  
  // UI Actions
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  
  // Loading Actions
  setLoading: (key: 'apps' | 'gallery' | 'generating', loading: boolean) => void
}

export const useStore = create<AppState & AppActions>()(
  devtools(
    (set, get) => ({
      // Initial State for kiff system
      generatedApps: [],
      selectedApp: null,
      apiGallery: [],
      selectedAPI: null,
      sidebarOpen: true,
      theme: 'light',
      loading: {
        apps: false,
        gallery: false,
        generating: false,
      },

      // Generated App Actions
      setGeneratedApps: (apps) => set({ generatedApps: apps }),
      addGeneratedApp: (app) => set((state) => ({ generatedApps: [...state.generatedApps, app] })),
      updateGeneratedApp: (id, updates) =>
        set((state) => ({
          generatedApps: state.generatedApps.map((app) =>
            app.id === id ? { ...app, ...updates } : app
          ),
        })),
      deleteGeneratedApp: (id) =>
        set((state) => ({
          generatedApps: state.generatedApps.filter((app) => app.id !== id),
          selectedApp: state.selectedApp?.id === id ? null : state.selectedApp,
        })),
      setSelectedApp: (app) => set({ selectedApp: app }),

      // API Gallery Actions
      setAPIGallery: (items) => set({ apiGallery: items }),
      addAPIGalleryItem: (item) => set((state) => ({ apiGallery: [...state.apiGallery, item] })),
      updateAPIGalleryItem: (id, updates) =>
        set((state) => ({
          apiGallery: state.apiGallery.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      deleteAPIGalleryItem: (id) =>
        set((state) => ({
          apiGallery: state.apiGallery.filter((item) => item.id !== id),
          selectedAPI: state.selectedAPI?.id === id ? null : state.selectedAPI,
        })),
      setSelectedAPI: (api) => set({ selectedAPI: api }),

      // UI Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => set({ theme }),

      // Loading Actions
      setLoading: (key, loading) =>
        set((state) => ({
          loading: { ...state.loading, [key]: loading },
        })),
    }),
    {
      name: 'kiff-store', // Updated from 'tradeforge-store' to reflect kiff system
    }
  )
)
