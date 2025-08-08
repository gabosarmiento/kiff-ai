import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Input } from './Input'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Badge } from './Badge'
import { Switch } from './switch'
import { ThemeToggle } from './ThemeToggle'
import { 
  Search, 
  User, 
  Mail, 
  Lock, 
  Heart, 
  Star, 
  Download,
  Copy,
  Code,
  Eye,
  Palette,
  Paperclip,
  Mic,
  Smile,
  Send,
  Pen,
  BookOpen,
  Globe,
  Calendar,
  HardDrive,
  Github,
  ChevronDown,
  Check
} from 'lucide-react'

interface ComponentSection {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

// --- PromptInputWithDropdownsDemo ---


const modelOptions = [
  { label: 'Claude Sonnet 4', value: 'claude-sonnet-4', desc: 'Smart, efficient model for everyday use' },
  { label: 'Claude Opus 4.1', value: 'claude-opus-4.1', desc: 'Powerful, large model for complex challenges' },
  { label: 'Grok 3', value: 'grok-3', desc: 'Fast, creative model for brainstorming' },
]

const personaOptions = [
  { label: 'Write', icon: <Pen className="w-4 h-4" /> },
  { label: 'Learn', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Code', icon: <Code className="w-4 h-4" /> },
  { label: 'Life stuff', icon: <Smile className="w-4 h-4" /> },
]

function Dropdown({ label, open, setOpen, children, width = 'w-56' }: any) {
  return (
    <div className="relative inline-block text-left">
      <span onClick={() => setOpen((v: boolean) => !v)}>{label}</span>
      {open && (
        <div className={`absolute z-20 mt-2 ${width} rounded-md shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none`}>{children}</div>
      )}
    </div>
  )
}

function PromptInputWithDropdownsDemo() {
  const [model, setModel] = useState(modelOptions[0]);
  const [modelOpen, setModelOpen] = useState(false);
  const [persona, setPersona] = useState(personaOptions[0]);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [calendarSearch, setCalendarSearch] = useState(false);
  const [driveSearch, setDriveSearch] = useState(false);
  const [extendedThinking, setExtendedThinking] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <Input
        placeholder="How can I help you today?"
        prepend={
          <div className="flex items-center space-x-1">
            {/* Attach */}
            <Button variant="ghost" size="sm" leftIcon={<Paperclip className="w-4 h-4" />} />
            {/* Research/settings menu */}
            <Dropdown
              label={<Button variant="ghost" size="sm" leftIcon={<Search className="w-4 h-4" />}>Research</Button>}
              open={menuOpen}
              setOpen={setMenuOpen}
              width="w-72"
            >
              <div className="p-2">
                <Input
                  placeholder="Search menu"
                  inputSize="sm"
                  className="mb-2"
                  leftIcon={<Search className="w-4 h-4" />}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="flex items-center gap-2"><Globe className="w-4 h-4" />Web search</span>
                    <input type="checkbox" checked={webSearch} onChange={() => setWebSearch(v => !v)} />
                  </div>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" />Extended thinking</span>
                    <input type="checkbox" checked={extendedThinking} onChange={() => setExtendedThinking(v => !v)} />
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Mail className="w-4 h-4" />Gmail search <span className="ml-auto text-xs text-blue-600">Connect</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Calendar className="w-4 h-4" />Calendar search <span className="ml-auto text-xs text-blue-600">Connect</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <HardDrive className="w-4 h-4" />Drive search <input type="checkbox" checked={driveSearch} onChange={() => setDriveSearch(v => !v)} className="ml-auto" />
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Github className="w-4 h-4" />Add from GitHub
                  </div>
                </div>
              </div>
            </Dropdown>
            {/* Persona dropdown */}
            <Dropdown
              label={<Button variant="ghost" size="sm" leftIcon={persona.icon}>{persona.label}</Button>}
              open={personaOpen}
              setOpen={setPersonaOpen}
            >
              <div className="py-1">
                {personaOptions.map((p) => (
                  <button
                    key={p.label}
                    className={`flex items-center w-full px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-800 ${persona.label === p.label ? 'font-semibold text-blue-700 dark:text-blue-300' : ''}`}
                    onClick={() => { setPersona(p); setPersonaOpen(false); }}
                  >
                    {p.icon}
                    <span className="ml-2">{p.label}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
            {/* Model selector dropdown */}
            <Dropdown
              label={<Button variant="ghost" size="sm">{model.label} <ChevronDown className="w-4 h-4 ml-1" /></Button>} 
              open={modelOpen}
              setOpen={setModelOpen}
              width="w-64"
            >
              <div className="py-1">
                {modelOptions.map((m) => (
                  <button
                    key={m.value}
                    className={`flex flex-col items-start w-full px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-800 ${model.value === m.value ? 'font-semibold text-blue-700 dark:text-blue-300' : ''}`}
                    onClick={() => { setModel(m); setModelOpen(false); }}
                  >
                    <span className="flex items-center">{m.label} {model.value === m.value && <Check className="w-4 h-4 ml-1 text-blue-500" />}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>
        }
        append={
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" leftIcon={<Mic className="w-4 h-4" />} />
            <Button variant="ghost" size="sm" leftIcon={<Smile className="w-4 h-4" />} />
            <Button variant="primary" size="sm" rightIcon={<Send className="w-4 h-4" />}>Send</Button>
          </div>
        }
      />
    </div>
  );
}

// --- End PromptInputWithDropdownsDemo ---

const componentSections: ComponentSection[] = [

  {
    id: 'buttons',
    title: 'Button',
    description: 'Interactive button component with multiple variants, sizes, and states',
    component: (
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Variants</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Sizes</h4>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">With Icons</h4>
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Download className="w-4 h-4" />}>Download</Button>
            <Button rightIcon={<Heart className="w-4 h-4" />} variant="outline">Like</Button>
            <Button loading>Loading</Button>
          </div>
        </div>
      </div>
    ),
    code: `<Button variant="primary" size="md" leftIcon={<Download />}>
  Download
</Button>`
  },
  {
    id: 'inputs',
    title: 'Input',
    description: 'Form input component with labels, validation, and icons',
    component: (
      <div className="space-y-4 max-w-md">
        <Input 
          label="Email" 
          placeholder="Enter your email"
          leftIcon={<Mail className="w-4 h-4" />}
        />
        <Input 
          label="Password" 
          type="password"
          placeholder="Enter your password"
        />
        <Input 
          label="Search" 
          placeholder="Search components..."
          variant="filled"
          leftIcon={<Search className="w-4 h-4" />}
        />
        <Input 
          label="Username" 
          placeholder="Enter username"
          error="Username is required"
          leftIcon={<User className="w-4 h-4" />}
        />
      </div>
    ),
    code: `<Input 
  label="Email" 
  placeholder="Enter your email"
  leftIcon={<Mail className="w-4 h-4" />}
/>`
  },

  {
    id: 'prompt-input',
    title: 'Prompt Input (Claude Style)',
    description: 'A Claude/ChatGPT-style prompt bar with multiple dropdowns, grouped actions, and advanced menus, matching modern AI chat UIs.',
    component: <PromptInputWithDropdownsDemo />,
    code: `<PromptInputWithDropdownsDemo />`
  },
  {
    id: 'cards',
    title: 'Card',
    description: 'Flexible card component with header, content, and footer sections',
    component: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <CardHeader divider>
            <h3 className="text-lg font-semibold">Default Card</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Basic card with header and content
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              This is the card content area where you can place any content.
            </p>
          </CardContent>
          <CardFooter divider>
            <Button size="sm">Action</Button>
          </CardFooter>
        </Card>
        
        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Elevated Card</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Card with elevated shadow styling.
            </p>
          </CardContent>
        </Card>
      </div>
    ),
    code: `<Card variant="elevated">
  <CardHeader divider>
    <h3>Card Title</h3>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
</Card>`
  },
  {
    id: 'badges',
    title: 'Badge',
    description: 'Small status indicators and labels',
    component: (
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Variants</h4>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">With Dots</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" dot>Online</Badge>
            <Badge variant="warning" dot>Pending</Badge>
            <Badge variant="error" dot>Offline</Badge>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Sizes</h4>
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="sm">Small</Badge>
            <Badge size="md">Medium</Badge>
            <Badge size="lg">Large</Badge>
          </div>
        </div>
      </div>
    ),
    code: `<Badge variant="success" dot>
  Online
</Badge>`
  },
  {
    id: 'switches',
    title: 'Switch',
    description: 'Toggle switch for binary choices',
    component: (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Switch />
          <span className="text-sm">Default switch</span>
        </div>
        <div className="flex items-center space-x-3">
          <Switch checked />
          <span className="text-sm">Checked switch</span>
        </div>
        <div className="flex items-center space-x-3">
          <Switch disabled />
          <span className="text-sm text-slate-400">Disabled switch</span>
        </div>
      </div>
    ),
    code: `<Switch 
  checked={isEnabled} 
  onCheckedChange={setIsEnabled} 
/>`
  },
  {
    id: 'theme-toggle',
    title: 'Theme Toggle',
    description: 'Theme switcher component',
    component: (
      <div className="max-w-xs">
        <ThemeToggle />
      </div>
    ),
    code: `<ThemeToggle showLabel={true} />`
  }
]

export const ComponentShowcase: React.FC = () => {
  const [selectedComponent, setSelectedComponent] = useState<string>('buttons')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCode, setShowCode] = useState<Record<string, boolean>>({})

  const filteredComponents = componentSections.filter(component =>
    component.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    component.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleCode = (componentId: string) => {
    setShowCode(prev => ({
      ...prev,
      [componentId]: !prev[componentId]
    }))
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Palette className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Component Library
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Reusable components for the Kiff AI application. Each component is designed to be 
            flexible, accessible, and consistent with the design system.
          </p>
          
          <div className="max-w-md">
            <Input
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              variant="filled"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card padding="sm">
              <CardHeader>
                <h2 className="text-lg font-semibold">Components</h2>
              </CardHeader>
              <CardContent>
                <nav className="space-y-1">
                  {filteredComponents.map((component) => (
                    <button
                      key={component.id}
                      onClick={() => setSelectedComponent(component.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedComponent === component.id
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      )}
                    >
                      {component.title}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {filteredComponents.map((component) => (
              <div
                key={component.id}
                className={cn(
                  'space-y-6',
                  selectedComponent !== component.id && 'hidden'
                )}
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {component.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    {component.description}
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Preview</h3>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleCode(component.id)}
                          leftIcon={<Code className="w-4 h-4" />}
                        >
                          {showCode[component.id] ? 'Hide Code' : 'Show Code'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyCode(component.code)}
                          leftIcon={<Copy className="w-4 h-4" />}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                      {component.component}
                    </div>
                    
                    {showCode[component.id] && (
                      <div className="mt-4">
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{component.code}</code>
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComponentShowcase
