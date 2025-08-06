import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  BarChart3,
  Shield,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Database,
  Activity,
  FileText,
  Brain,
  DollarSign,
  AlertTriangle,
  Flag,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const adminNavItems = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: BarChart3,
    description: 'Overview and analytics'
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: Users,
    description: 'Manage users and permissions'
  },
  {
    name: 'AGNO Monitoring',
    href: '/admin/monitoring',
    icon: Brain,
    description: 'Agentic system monitoring'
  },
  {
    name: 'System Health',
    href: '/admin/system',
    icon: Activity,
    description: 'Server and infrastructure'
  },
  {
    name: 'Support Queue',
    href: '/admin/support',
    icon: MessageSquare,
    description: 'Customer support tickets'
  },
  {
    name: 'Billing & Revenue',
    href: '/admin/billing',
    icon: DollarSign,
    description: 'Financial analytics'
  },
  {
    name: 'Audit Logs',
    href: '/admin/audit',
    icon: FileText,
    description: 'Security and compliance'
  },
  {
    name: 'Feature Flags',
    href: '/admin/feature-flags',
    icon: Flag,
    description: 'Control UI features and rollouts'
  },
  {
    name: 'Token Consumption',
    href: '/admin/token-consumption',
    icon: Zap,
    description: 'Monitor AI token usage'
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'System configuration'
  }
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative lg:flex lg:flex-shrink-0
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 bg-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">kiff Admin</h1>
                <p className="text-xs text-slate-400">System Management</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto min-h-0">
            {adminNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors group
                    ${isActive
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`
                    w-5 h-5 mr-3 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                  `} />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className={`text-xs ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email || 'Admin User'}
                </p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="bg-slate-800/95 backdrop-blur-xl shadow-sm border-b border-slate-700/50">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-300 hover:text-slate-100"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Admin Dashboard
                </h2>
                <p className="text-sm text-slate-400">
                  Manage your kiff platform
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status indicator */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-sm border border-green-700/50">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>System Operational</span>
              </div>
              
              {/* Back to main app */}
              <Link
                to="/"
                className="px-3 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-600/50"
              >
                ← Back to App
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 bg-slate-900 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
