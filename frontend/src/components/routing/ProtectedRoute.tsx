import React from 'react'
import { Navigate } from 'react-router-dom'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'

interface ProtectedRouteProps {
  children: React.ReactNode
  featureFlag: string
  fallbackPath?: string
  requireEnabled?: boolean
}

export function ProtectedRoute({ 
  children, 
  featureFlag, 
  fallbackPath = '/', 
  requireEnabled = true 
}: ProtectedRouteProps) {
  const isFeatureEnabled = useFeatureFlag(featureFlag, false)
  
  // If feature flag is disabled and we require it to be enabled, redirect
  if (requireEnabled && !isFeatureEnabled) {
    return <Navigate to={fallbackPath} replace />
  }
  
  // If feature flag is enabled and we require it to be disabled, redirect
  if (!requireEnabled && isFeatureEnabled) {
    return <Navigate to={fallbackPath} replace />
  }
  
  return <>{children}</>
}