import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { User, Mail, UserPlus, LogIn } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    fullName: ''
  })
  
  const { login, register, isLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect to v0 generator if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is now authenticated, redirecting to v0 generator...')
      navigate('/generate-v0', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let success = false
    
    if (isLogin) {
      success = await login(formData.email, formData.password)
    } else {
      success = await register(
        formData.email, 
        formData.password, 
        formData.username, 
        formData.fullName
      )
    }
    
    if (success) {
      console.log('Authentication successful, useEffect will handle navigation')
      // Let the useEffect handle navigation when isAuthenticated becomes true
    } else {
      console.log('Authentication failed, staying on login page')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const fillDemoCredentials = () => {
    setFormData({
      email: 'demo@kiff.ai',
      password: 'demo12345',
      username: 'demo_user',
      fullName: 'Demo User'
    })
  }

  return (
    <div className="w-full flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <header className="grid gap-1 text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isLogin ? 'Sign in to Kiff' : 'Create your Kiff account'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLogin ? 'Welcome back! Enter your details to continue.' : 'Join Kiff to start building intelligent applications.'}
          </p>
        </header>

        {/* Demo Credentials Helper */}
        <section className="rounded-xl border border-gray-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-900">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Demo credentials</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Real database users — click to autofill</p>
            </div>
            <Button variant="secondary" size="sm" onClick={fillDemoCredentials}>Fill Demo</Button>
          </div>
          <div className="px-4 pb-4 text-xs text-gray-600 dark:text-gray-300">demo@kiff.ai / demo12345</div>
        </section>

        {/* Auth Card */}
        <section className="rounded-xl border border-gray-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-900">
          <div className="px-4 py-3 border-b border-gray-200/70 dark:border-slate-700">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">{isLogin ? 'Sign in' : 'Create account'}</h2>
          </div>
          <form className="p-4 grid gap-4" onSubmit={handleSubmit}>
            <Input
              label="Email address"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              name="email"
              leftIcon={<Mail className="h-4 w-4" />}
              fullWidth
            />

            {!isLogin && (
              <Input
                label="Username"
                type="text"
                required
                value={formData.username}
                onChange={handleInputChange}
                name="username"
                leftIcon={<User className="h-4 w-4" />}
                fullWidth
              />
            )}

            {!isLogin && (
              <Input
                label="Full Name (Optional)"
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                name="fullName"
                leftIcon={<User className="h-4 w-4" />}
                fullWidth
              />
            )}

            <Input
              label="Password"
              type="password"
              required
              value={formData.password}
              onChange={handleInputChange}
              name="password"
              fullWidth
            />

            <Button type="submit" fullWidth loading={isLoading} leftIcon={isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
