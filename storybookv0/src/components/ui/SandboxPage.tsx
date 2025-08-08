import React from 'react'
import { PageContainer } from './PageContainer'
import { ChatInput } from './ChatInput'
import { Button } from './Button'

interface FileItem {
  id: string
  name: string
  size: string
  type: string
  updatedAt: string
}

const SAMPLE_FILES: FileItem[] = [
  { id: '1', name: 'index.html', size: '2.3 KB', type: 'HTML', updatedAt: '2h ago' },
  { id: '2', name: 'styles.css', size: '5.8 KB', type: 'CSS', updatedAt: '3h ago' },
  { id: '3', name: 'app.tsx', size: '14.2 KB', type: 'TSX', updatedAt: '1h ago' },
  { id: '4', name: 'server.ts', size: '8.6 KB', type: 'TS', updatedAt: '1d ago' },
]

type TreeNode =
  | { kind: 'folder'; id: string; name: string; children: TreeNode[] }
  | { kind: 'file'; id: string; name: string; refId: string }

const SAMPLE_TREE: TreeNode[] = [
  {
    kind: 'folder',
    id: 'root-1',
    name: 'src',
    children: [
      { kind: 'file', id: 't1', name: 'app.tsx', refId: '3' },
      {
        kind: 'folder',
        id: 'root-1-1',
        name: 'components',
        children: [
          { kind: 'file', id: 't2', name: 'Chat.tsx', refId: '3' },
          { kind: 'file', id: 't3', name: 'Canvas.tsx', refId: '4' },
        ],
      },
      { kind: 'file', id: 't4', name: 'styles.css', refId: '2' },
    ],
  },
  {
    kind: 'folder',
    id: 'root-2',
    name: 'public',
    children: [
      { kind: 'file', id: 't5', name: 'index.html', refId: '1' },
    ],
  },
  { kind: 'file', id: 't6', name: 'server.ts', refId: '4' },
]

export function SandboxPage() {
  const [messages, setMessages] = React.useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Welcome to Sandbox. Ask me to build or modify your Kiff.' },
  ])
  const [files] = React.useState<FileItem[]>(SAMPLE_FILES)
  const [activeFileId, setActiveFileId] = React.useState<string>(files[0]?.id || '')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({ root: true, 'root-1': true })

  const activeFile = files.find(f => f.id === activeFileId)

  const handleSend = (value: string) => {
    setMessages(prev => [...prev, { role: 'user', content: value }])
    // Placeholder assistant echo
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Acknowledged: ${value}` }])
    }, 300)
  }

  const hasStarted = React.useMemo(() => messages.some(m => m.role === 'user'), [messages])

  return (
    <PageContainer fullscreen padded={false}>
      <div className={`h-full grid ${hasStarted ? 'grid-cols-1 md:grid-cols-[minmax(420px,1fr)_minmax(640px,2fr)]' : 'grid-cols-1'}`}>
        {/* Left: Chat */}
        <section className={`${hasStarted ? 'border-r border-gray-200/70 dark:border-white/10' : ''} flex flex-col min-h-0`}>
          {hasStarted ? (
            <>
              <header className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
                <h1 className="text-sm font-medium text-gray-900 dark:text-white">Chat</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Design, iterate, and generate your Kiff</p>
              </header>
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div className={`inline-block rounded-2xl px-3 py-2 text-sm shadow-sm border ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white/70 dark:bg-white/[0.06] text-gray-900 dark:text-gray-100 border-gray-200/70 dark:border-white/10'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-200/70 dark:border-white/10">
                <ChatInput
                  showModelSelector={false}
                  showActionButtons={false}
                  onSubmit={(val) => handleSend(val)}
                  placeholder="Describe what you want to build…"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center p-4">
              <div className="w-full max-w-xl">
                <ChatInput
                  showModelSelector={false}
                  showActionButtons={false}
                  showAttachments={false}
                  showVoiceInput={false}
                  onSubmit={(val) => handleSend(val)}
                  placeholder="Describe what you want to build…"
                />
              </div>
            </div>
          )}
        </section>

        {/* Right: Canvas */}
        {hasStarted && (
        <section className="min-h-0 flex flex-col">
          <header className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Canvas</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Files, details, and actions</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3">Download</Button>
              <Button size="sm" className="h-8 px-3 bg-blue-600 text-white hover:bg-blue-700">Go Live</Button>
            </div>
          </header>

          {/* Content */}
          {hasStarted ? (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] min-h-0 flex-1">
              {/* Folder tree */}
              <aside className="border-r border-gray-200/70 dark:border-white/10 min-h-0 overflow-auto">
                <div className="p-2">
                  <TreeView
                    nodes={SAMPLE_TREE}
                    expanded={expanded}
                    onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
                    onOpenFile={(refId) => setActiveFileId(refId)}
                    activeRefId={activeFileId}
                  />
                </div>
              </aside>

              {/* File detail */}
              <div className="min-h-0 overflow-auto p-4">
                {!activeFile ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Select a file to view details.</div>
                ) : (
                  <div className="grid gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">{activeFile.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{activeFile.type} • {activeFile.size} • Updated {activeFile.updatedAt}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-3">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{/* code preview placeholder */}
{`// Preview is not yet wired.
// This area will render file contents or rich previews.
// Use the chat to request changes and regenerate.`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
        )}
      </div>
    </PageContainer>
  )
}

function TreeView({
  nodes,
  expanded,
  onToggle,
  onOpenFile,
  activeRefId,
}: {
  nodes: TreeNode[]
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onOpenFile: (refId: string) => void
  activeRefId: string
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          expanded={expanded}
          onToggle={onToggle}
          onOpenFile={onOpenFile}
          activeRefId={activeRefId}
        />
      ))}
    </ul>
  )
}

function TreeNodeItem({
  node,
  expanded,
  onToggle,
  onOpenFile,
  activeRefId,
}: {
  node: TreeNode
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onOpenFile: (refId: string) => void
  activeRefId: string
}) {
  if (node.kind === 'folder') {
    const isOpen = !!expanded[node.id]
    return (
      <li>
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-50 dark:hover:bg-white/5"
          onClick={() => onToggle(node.id)}
        >
          <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">{node.name}</span>
        </button>
        {isOpen && node.children?.length > 0 && (
          <div className="pl-5">
            <TreeView
              nodes={node.children}
              expanded={expanded}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              activeRefId={activeRefId}
            />
          </div>
        )}
      </li>
    )
  }
  const isActive = node.refId === activeRefId
  return (
    <li>
      <button
        className={`w-full text-left px-2 py-1.5 text-sm rounded flex items-center justify-between ${
          isActive
            ? 'bg-white/80 dark:bg-white/[0.08] text-blue-700 dark:text-blue-300 border border-blue-500/50'
            : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200'
        }`}
        onClick={() => onOpenFile(node.refId)}
      >
        <span className="truncate mr-2">{node.name}</span>
      </button>
    </li>
  )
}
