import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useStore } from '@/store/useStore'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { sidebarOpen } = useStore()
  
  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar - always rendered */}
      <Sidebar />
      
      {/* Main content area - adjusts based on sidebar state */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-slate-900">
          {children}
        </main>
      </div>
    </div>
  )
}
