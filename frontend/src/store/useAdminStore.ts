/**
 * Admin Data Cache Store - Zustand store for caching admin dashboard data
 * Prevents unnecessary API calls when navigating between admin sections
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Types for admin data
export interface AdminUser {
  id: number
  email: string
  full_name: string
  status: 'active' | 'suspended' | 'banned' | 'pending'
  subscription_plan: 'free' | 'starter' | 'pro' | 'enterprise'
  monthly_tokens_used: number
  monthly_token_limit: number
  sandbox_count: number
  created_at: string
  last_login?: string
  role: string
  is_active: boolean
}

export interface DashboardMetrics {
  user_stats: {
    total_users: number
    active_users_24h: number
    new_users_7d: number
  }
  sandbox_stats: {
    total_sandboxes: number
    active_sandboxes: number
  }
  usage_stats: {
    total_tokens_used: number
    total_api_calls: number
  }
  revenue_stats: {
    revenue_30d: number
    currency: string
  }
  system_health: {
    status: string
    cpu_usage: number
    memory_usage: number
    api_error_rate: number
  }
  recent_alerts: Array<{
    id: number
    type: string
    severity: string
    title: string
    created_at: string
  }>
  support_stats: {
    open_tickets: number
  }
}

export interface CachedData<T> {
  data: T
  timestamp: number
  loading: boolean
  error: string | null
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

interface AdminState {
  // Cached data with timestamps
  dashboardMetrics: CachedData<DashboardMetrics | null>
  users: CachedData<{
    users: AdminUser[]
    total: number
    page: number
    pages: number
  } | null>
  
  // Current filters for users (to avoid refetch on same filters)
  userFilters: {
    search: string
    status: string
    plan: string
    page: number
  }
}

interface AdminActions {
  // Dashboard actions
  setDashboardMetrics: (data: DashboardMetrics) => void
  setDashboardLoading: (loading: boolean) => void
  setDashboardError: (error: string | null) => void
  isDashboardStale: () => boolean
  
  // Users actions
  setUsers: (data: { users: AdminUser[], total: number, page: number, pages: number }) => void
  setUsersLoading: (loading: boolean) => void
  setUsersError: (error: string | null) => void
  setUserFilters: (filters: Partial<AdminState['userFilters']>) => void
  isUsersStale: () => boolean
  shouldRefetchUsers: (newFilters: Partial<AdminState['userFilters']>) => boolean
  
  // Cache management
  clearCache: () => void
  clearUserCache: () => void
}

const initialState: AdminState = {
  dashboardMetrics: {
    data: null,
    timestamp: 0,
    loading: false,
    error: null
  },
  users: {
    data: null,
    timestamp: 0,
    loading: false,
    error: null
  },
  userFilters: {
    search: '',
    status: '',
    plan: '',
    page: 1
  }
}

export const useAdminStore = create<AdminState & AdminActions>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Dashboard actions
      setDashboardMetrics: (data) => set(() => ({
        dashboardMetrics: {
          data,
          timestamp: Date.now(),
          loading: false,
          error: null
        }
      }), false, 'setDashboardMetrics'),
      
      setDashboardLoading: (loading) => set((state) => ({
        dashboardMetrics: {
          ...state.dashboardMetrics,
          loading
        }
      }), false, 'setDashboardLoading'),
      
      setDashboardError: (error) => set((state) => ({
        dashboardMetrics: {
          ...state.dashboardMetrics,
          loading: false,
          error
        }
      }), false, 'setDashboardError'),
      
      isDashboardStale: () => {
        const { dashboardMetrics } = get()
        return !dashboardMetrics.data || (Date.now() - dashboardMetrics.timestamp) > CACHE_DURATION
      },
      
      // Users actions
      setUsers: (data) => set(() => ({
        users: {
          data,
          timestamp: Date.now(),
          loading: false,
          error: null
        }
      }), false, 'setUsers'),
      
      setUsersLoading: (loading) => set((state) => ({
        users: {
          ...state.users,
          loading
        }
      }), false, 'setUsersLoading'),
      
      setUsersError: (error) => set((state) => ({
        users: {
          ...state.users,
          loading: false,
          error
        }
      }), false, 'setUsersError'),
      
      setUserFilters: (filters) => set((state) => ({
        userFilters: {
          ...state.userFilters,
          ...filters
        }
      }), false, 'setUserFilters'),
      
      isUsersStale: () => {
        const { users } = get()
        return !users.data || (Date.now() - users.timestamp) > CACHE_DURATION
      },
      
      shouldRefetchUsers: (newFilters) => {
        const { userFilters, users } = get()
        
        // Always refetch if no cached data
        if (!users.data) return true
        
        // Check if filters changed
        const filtersChanged = Object.keys(newFilters).some(key => 
          newFilters[key as keyof typeof newFilters] !== userFilters[key as keyof typeof userFilters]
        )
        
        // Refetch if filters changed or data is stale
        return filtersChanged || get().isUsersStale()
      },
      
      // Cache management
      clearCache: () => set(initialState, false, 'clearCache'),
      
      clearUserCache: () => set(() => ({
        users: initialState.users,
        userFilters: initialState.userFilters
      }), false, 'clearUserCache')
    }),
    {
      name: 'admin-store'
    }
  )
)
