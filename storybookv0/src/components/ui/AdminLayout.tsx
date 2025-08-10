import React from 'react'
import { TopNavbar } from './TopNavbar'

export type AdminLayoutProps = {
  children: React.ReactNode
  initialActive?: string
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, initialActive = 'dashboard' }) => {
  const [active, setActive] = React.useState<string>(initialActive)
  

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 grid grid-rows-[auto,1fr]">
      {/* Top site navbar (pushes content down) */}
      <TopNavbar
        brand={<div className="text-sm font-extrabold text-slate-900 dark:text-white">Kiff</div>}
        links={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'users', label: 'Users' },
          { id: 'apis', label: 'APIs' },
          { id: 'models', label: 'Models' },
          { id: 'tenancy', label: 'Tenancy' },
        ]}
      />

      {/* Main content area (scrollable, full width) */}
      <main className="overflow-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
