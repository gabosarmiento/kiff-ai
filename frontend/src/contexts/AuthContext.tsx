import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from 'react-hot-toast'
import { apiRequest } from '../utils/apiConfig'

interface User {
  id: number
  email: string
  username: string
  full_name?: string
  avatar_url?: string
  role: string
  is_active: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, username: string, fullName?: string) => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true)
      
      const token = localStorage.getItem('authToken')
      if (!token) {
        setUser(null)
        return
      }
      
      // Verify token with backend
      const response = await apiRequest('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'  // Demo tenant UUID
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setUser(result.data)
        } else {
          // Invalid token, clear storage
          localStorage.removeItem('authToken')
          setUser(null)
        }
      } else {
        // Invalid token, clear storage
        localStorage.removeItem('authToken')
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      localStorage.removeItem('authToken')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      if (!email || !password) {
        toast.error('Please enter email and password')
        return false
      }
      
      // Make API call to backend with tenant context
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'  // Demo tenant UUID
        },
        body: JSON.stringify({ email, password })
      })
      
      const result = await response.json()
      console.log('Login API response status:', response.status)
      console.log('Login API response:', result)
      
      if (response.ok && result.access_token) {
        // Store token
        localStorage.setItem('authToken', result.access_token)
        console.log('Token stored, fetching user info...')
        
        // Get user info directly instead of relying on checkAuthStatus state update
        const userResponse = await apiRequest('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${result.access_token}`,
            'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'  // Demo tenant UUID
          }
        })
        
        if (userResponse.ok) {
          const userResult = await userResponse.json()
          console.log('User info response:', userResult)
          if (userResult.status === 'success') {
            setUser(userResult.data)
            console.log('User state set:', userResult.data)
            
            // Small delay to ensure state update propagates
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Check if user is admin and redirect accordingly
            const isAdmin = userResult.data.role === 'admin' || userResult.data.role === 'superadmin'
            if (isAdmin) {
              toast.success(`Welcome back, Admin!`)
              // Redirect to admin dashboard
              window.location.href = '/admin/dashboard'
            } else {
              toast.success(`Welcome back!`)
              // Regular users go to home page (handled by App.tsx routing)
            }
            
            return true
          } else {
            console.error('User info request failed:', userResult)
          }
        } else {
          console.error('User info request failed with status:', userResponse.status)
          const errorText = await userResponse.text()
          console.error('Error response:', errorText)
        }
        
        // Fallback: clear invalid token
        localStorage.removeItem('authToken')
        toast.error('Failed to get user information')
        return false
      } else {
        const errorMessage = result.detail || 'Login failed. Please check your credentials.'
        toast.error(errorMessage)
        return false
      }
      
    } catch (error) {
      console.error('Login failed:', error)
      toast.error('Login failed. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (
    email: string, 
    password: string, 
    username: string, 
    fullName?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true)
      
      if (!email || !password || !username) {
        toast.error('Please fill in all required fields')
        return false
      }
      
      // Make API call to backend with tenant context
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: {
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'  // Demo tenant UUID
        },
        body: JSON.stringify({ 
          email, 
          password, 
          username, 
          full_name: fullName || username 
        })
      })
      
      const result = await response.json()
      
      if (response.ok && result.status === 'success') {
        toast.success(`Welcome to Kiff! Account created successfully.`)
        
        // Auto-login after successful registration
        console.log('Registration successful, attempting auto-login...')
        const loginSuccess = await login(email, password)
        console.log('Auto-login result:', loginSuccess)
        
        if (loginSuccess) {
          // Ensure user state is properly set before returning
          console.log('Auto-login successful, user should be authenticated')
        }
        
        return loginSuccess
      } else {
        const errorMessage = result.detail || 'Registration failed. Please try again.'
        toast.error(errorMessage)
        return false
      }
      
    } catch (error) {
      console.error('Registration failed:', error)
      toast.error('Registration failed. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('authToken')
    toast.success('Logged out successfully')
  }

  const refreshUser = async () => {
    await checkAuthStatus()
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to get auth headers for API calls
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}
