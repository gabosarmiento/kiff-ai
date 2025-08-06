import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { UnifiedGenerationPage } from '@/pages/UnifiedGenerationPage'
import { GenerateV0Page } from '@/pages/GenerateV0Page'
import { GenerateV01Page } from '@/pages/GenerateV01Page'
import { LandingPage } from '@/pages/LandingPage'
import { ApplicationsPage } from '@/pages/ApplicationsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AccountPage } from '@/pages/AccountPage'
import { APIGalleryPage } from '@/pages/APIGalleryPage'
import { KnowledgePage } from '@/pages/KnowledgePage'
import { LoginPage } from '@/pages/LoginPage'
import AdminBillingPage from '@/pages/AdminBillingPage'
import AdminSupportPage from '@/pages/AdminSupportPage'
import AdminAuditLogPage from '@/pages/AdminAuditLogPage'
import AdminDashboardPage from '@/pages/AdminDashboardPage'
import AdminUserManagementPage from '@/pages/AdminUserManagementPage'
import AdminFeatureFlagsPage from '@/pages/AdminFeatureFlagsPage'
import { AdminTokenConsumptionPage } from '@/pages/AdminTokenConsumptionPage'
import MonitoringDashboard from '@/pages/admin/MonitoringDashboard'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

function App() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  // Debug logging
  console.log('App render:', { isAuthenticated, isLoading, user: user?.email, path: location.pathname })

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  // Show public routes if not authenticated
  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    )
  }

  // Check if user is admin and redirect accordingly
  // Only use secure role-based authentication
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  
  // Debug logging removed - admin detection working correctly
  
  // If admin user is on a regular route, redirect to admin dashboard
  const regularRoutes = ['/', '/generate-v0', '/gallery', '/knowledge', '/applications']
  if (isAdmin && regularRoutes.includes(location.pathname)) {
    console.log('Redirecting admin user to admin dashboard from:', location.pathname)
    return <Navigate to="/admin/dashboard" replace />
  }
  
  // Show main app if authenticated
  return (
    <ThemeProvider>
      <Routes>
      {/* Regular user routes with standard layout - only for non-admin users */}
      {!isAdmin && (
        <>
          <Route path="/generate-v0" element={<Layout><GenerateV0Page /></Layout>} />
          <Route path="/generate-v01" element={
            <ProtectedRoute featureFlag="generate_v01_enabled">
              <Layout><GenerateV01Page /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/unified-generation" element={
            <ProtectedRoute featureFlag="unified_generation_enabled">
              <Layout><UnifiedGenerationPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/generate-v0" replace />} />
          <Route path="/gallery" element={
            <ProtectedRoute featureFlag="api_gallery_enabled">
              <Layout><APIGalleryPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/knowledge" element={<Layout><KnowledgePage /></Layout>} />
          <Route path="/applications" element={<Layout><ApplicationsPage /></Layout>} />
          <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
          <Route path="/account" element={<Layout><AccountPage /></Layout>} />
        </>
      )}
      
      {/* Admin users should not see regular routes - they get redirected above */}
      
      {/* Admin routes with admin layout */}
      <Route path="/admin" element={<AdminLayout><AdminDashboardPage /></AdminLayout>} />
      <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboardPage /></AdminLayout>} />
      <Route path="/admin/monitoring" element={<AdminLayout><MonitoringDashboard /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUserManagementPage /></AdminLayout>} />
      <Route path="/admin/billing" element={<AdminLayout><AdminBillingPage /></AdminLayout>} />
      <Route path="/admin/support" element={<AdminLayout><AdminSupportPage /></AdminLayout>} />
      <Route path="/admin/audit" element={<AdminLayout><AdminAuditLogPage /></AdminLayout>} />
      <Route path="/admin/feature-flags" element={<AdminLayout><AdminFeatureFlagsPage /></AdminLayout>} />
      <Route path="/admin/token-consumption" element={<AdminLayout><AdminTokenConsumptionPage /></AdminLayout>} />
      <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
      
      {/* Fallback route for authenticated users */}
      <Route path="*" element={<Navigate to={isAdmin ? "/admin/dashboard" : "/generate-v0"} replace />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
