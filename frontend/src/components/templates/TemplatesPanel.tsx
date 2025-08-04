import React from 'react'
import { FileText, Globe, Bot, Database, Smartphone, Gamepad2 } from 'lucide-react'

interface Template {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  prompt: string
  category: string
}

interface TemplatesPanelProps {
  onSelectTemplate?: (prompt: string) => void
  className?: string
}

const templates: Template[] = [
  {
    id: 'web-app',
    title: 'Web Application',
    description: 'Full-stack web application with authentication',
    icon: Globe,
    category: 'Web',
    prompt: 'Create a full-stack web application with user authentication, dashboard, and database integration using FastAPI backend and React frontend'
  },
  {
    id: 'trading-bot',
    title: 'Trading Bot',
    description: 'Cryptocurrency trading bot with Binance API',
    icon: Bot,
    category: 'Finance',
    prompt: 'Build a cryptocurrency trading bot that connects to Binance API, implements basic trading strategies, and includes risk management features'
  },
  {
    id: 'rest-api',
    title: 'REST API',
    description: 'RESTful API with database integration',
    icon: Database,
    category: 'Backend',
    prompt: 'Create a RESTful API using FastAPI with PostgreSQL database, JWT authentication, and comprehensive documentation'
  },
  {
    id: 'mobile-app',
    title: 'Mobile App',
    description: 'Cross-platform mobile application',
    icon: Smartphone,
    category: 'Mobile',
    prompt: 'Design a cross-platform mobile application with user authentication, data synchronization, and modern UI components'
  },
  {
    id: 'game-engine',
    title: 'Game Engine',
    description: 'Simple game engine with physics',
    icon: Gamepad2,
    category: 'Games',
    prompt: 'Create a simple 2D game engine with physics simulation, sprite rendering, and basic game loop structure'
  }
]

const TemplatesPanel: React.FC<TemplatesPanelProps> = ({
  onSelectTemplate,
  className = ''
}) => {
  const categories = [...new Set(templates.map(t => t.category))]

  return (
    <div className={`bg-slate-900/95 border-r border-slate-700/50 h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/60">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100">TEMPLATES</h2>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 overflow-y-auto">
        {categories.map(category => {
          const categoryTemplates = templates.filter(t => t.category === category)
          
          return (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                {category}
              </h3>
              
              <div className="space-y-2">
                {categoryTemplates.map(template => {
                  const Icon = template.icon
                  
                  return (
                    <button
                      key={template.id}
                      onClick={() => onSelectTemplate?.(template.prompt)}
                      className="w-full text-left p-3 hover:bg-slate-800/50 rounded-lg transition-colors group border border-transparent hover:border-slate-600/30"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center border border-slate-600/30 group-hover:border-slate-500/50 transition-colors">
                          <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-200 group-hover:text-slate-100">
                            {template.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TemplatesPanel