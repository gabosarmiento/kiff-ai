import React, { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Card, CardContent, CardHeader } from './Card'
import { Input } from './Input'
import { Badge } from './Badge'
import { 
  Plus, Edit, Trash2, Search, Save, X, Filter, RefreshCw
} from 'lucide-react'

export type ModelPricing = {
  input_per_1m?: number
  output_per_1m?: number
}

export type ModelItem = {
  id: string
  provider: string
  name: string
  family?: string
  modality?: 'text' | 'vision' | 'audio' | 'multimodal'
  context_window?: number
  pricing?: ModelPricing
  tags?: string[]
  status?: 'active' | 'preview' | 'deprecated'
  notes?: string
}

export interface ModelAdminProps {
  models?: ModelItem[]
  onCreateModel?: (model: Omit<ModelItem, 'id'>) => void
  onUpdateModel?: (id: string, model: Partial<ModelItem>) => void
  onDeleteModel?: (id: string) => void
  className?: string
}

const defaultForm: Omit<ModelItem, 'id'> = {
  provider: 'Groq',
  name: '',
  family: '',
  modality: 'text',
  context_window: 128000,
  pricing: { input_per_1m: 0, output_per_1m: 0 },
  tags: [],
  status: 'active',
  notes: ''
}

const suggestedTags = ['groq', 'fast', 'cheap', 'general', 'coding', 'reasoning']

export const ModelAdmin = React.forwardRef<HTMLDivElement, ModelAdminProps>(function ModelAdmin(
  { models = [], onCreateModel, onUpdateModel, onDeleteModel, className, ...props }, ref
) {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ModelItem | null>(null)
  const [form, setForm] = useState<Omit<ModelItem, 'id'>>(defaultForm)
  const [newTag, setNewTag] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'preview' | 'deprecated'>('all')

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return models.filter(m => {
      const matches =
        m.name.toLowerCase().includes(s) ||
        (m.family || '').toLowerCase().includes(s) ||
        (m.provider || '').toLowerCase().includes(s) ||
        (m.tags || []).some(t => t.toLowerCase().includes(s))
      const statusOk = statusFilter === 'all' ? true : m.status === statusFilter
      return matches && statusOk
    })
  }, [models, search, statusFilter])

  // Group by provider for sectioned rendering
  const groupedByProvider = useMemo(() => {
    const map: Record<string, ModelItem[]> = {}
    for (const m of filtered) {
      const key = m.provider || 'Other'
      if (!map[key]) map[key] = []
      map[key].push(m)
    }
    return map
  }, [filtered])

  const resetForm = () => {
    setForm(defaultForm)
    setNewTag('')
  }

  const handleCreate = () => {
    onCreateModel?.(form)
    setView('list')
    resetForm()
  }

  const handleSave = () => {
    if (view === 'create') return handleCreate()
    if (view === 'edit' && selected) {
      onUpdateModel?.(selected.id, form)
      setView('list')
      setSelected(null)
      resetForm()
    }
  }

  const handleEdit = (m: ModelItem) => {
    setSelected(m)
    setForm({
      provider: m.provider,
      name: m.name,
      family: m.family || '',
      modality: m.modality || 'text',
      context_window: m.context_window,
      pricing: { input_per_1m: m.pricing?.input_per_1m, output_per_1m: m.pricing?.output_per_1m },
      tags: [...(m.tags || [])],
      status: m.status || 'active',
      notes: m.notes || ''
    })
    setView('edit')
  }

  const handleCancel = () => {
    setView('list')
    setSelected(null)
    resetForm()
  }

  const addTag = () => {
    const t = newTag.trim()
    if (!t) return
    if (!(form.tags || []).includes(t)) {
      setForm(prev => ({ ...prev, tags: [...(prev.tags || []), t] }))
    }
    setNewTag('')
  }

  const removeTag = (t: string) => {
    setForm(prev => ({ ...prev, tags: (prev.tags || []).filter(x => x !== t) }))
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div ref={ref} className={cn('max-w-4xl mx-auto space-y-6', className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {view === 'create' ? 'Create Model' : `Edit Model: ${selected?.name}`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Aligns with Admin/APIAdmin style</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              {view === 'create' ? 'Create Model' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Model Information</h3>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
                <Input
                  placeholder="e.g., Groq"
                  value={form.provider}
                  onChange={(e) => setForm(prev => ({ ...prev, provider: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Model Name</label>
                <Input
                  placeholder="e.g., llama-3.1-8b-instant"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Family</label>
                <Input
                  placeholder="e.g., Llama 3.1"
                  value={form.family}
                  onChange={(e) => setForm(prev => ({ ...prev, family: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modality</label>
                <select
                  value={form.modality}
                  onChange={(e) => setForm(prev => ({ ...prev, modality: e.target.value as any }))}
                  className="w-full h-11 px-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="text">Text</option>
                  <option value="vision">Vision</option>
                  <option value="audio">Audio</option>
                  <option value="multimodal">Multimodal</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Context Window</label>
                <Input
                  type="number"
                  placeholder="128000"
                  value={String(form.context_window ?? '')}
                  onChange={(e) => setForm(prev => ({ ...prev, context_window: parseInt(e.target.value || '0', 10) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price per 1M (input) USD</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={String(form.pricing?.input_per_1m ?? '')}
                  onChange={(e) => setForm(prev => ({ ...prev, pricing: { ...(prev.pricing||{}), input_per_1m: parseFloat(e.target.value || '0') } }))}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price per 1M (output) USD</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={String(form.pricing?.output_per_1m ?? '')}
                  onChange={(e) => setForm(prev => ({ ...prev, pricing: { ...(prev.pricing||{}), output_per_1m: parseFloat(e.target.value || '0') } }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['active','preview','deprecated'] as const).map(s => (
                  <Button key={s} variant={form.status === s ? 'primary':'outline'} onClick={() => setForm(prev => ({ ...prev, status: s }))}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  className="flex-1"
                />
                <Button onClick={addTag} disabled={!newTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {suggestedTags.filter(t => !(form.tags||[]).includes(t)).slice(0,6).map(t => (
                  <Button key={t} variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setForm(prev => ({ ...prev, tags: [ ...(prev.tags||[]), t ] }))}>+ {t}</Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.tags||[]).map(t => (
                  <div key={t} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                    {t}
                    <button onClick={() => removeTag(t)} className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes or caveats..."
                className="w-full min-h-[88px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // List view
  return (
    <div ref={ref} className={cn('space-y-6', className)} {...props}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Models</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage LLM models (aligned with Admin/APIAdmin)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStatusFilter('all')}><Filter className="h-4 w-4 mr-2"/>All</Button>
          <Button variant={statusFilter==='active'?'primary':'outline'} onClick={() => setStatusFilter('active')}>Active</Button>
          <Button variant={statusFilter==='preview'?'primary':'outline'} onClick={() => setStatusFilter('preview')}>Preview</Button>
          <Button variant={statusFilter==='deprecated'?'primary':'outline'} onClick={() => setStatusFilter('deprecated')}>Deprecated</Button>
          <Button onClick={() => setView('create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Model
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Input
                  placeholder="Search by name, family, provider, or tag..."
                  leftIcon={<Search className="h-4 w-4" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => setSearch('')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              No models found. Click "New Model" to create one.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByProvider).map(([provider, items]) => (
                <section key={provider} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{provider}</h2>
                    <Badge variant="info" size="sm">{items.length} model{items.length !== 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map(m => (
                      <div key={m.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">{m.name}</h3>
                              {m.status && (
                                <Badge variant={m.status === 'deprecated' ? 'error' : m.status === 'preview' ? 'warning' : 'success'} size="sm">
                                  {m.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{m.family ? m.family : ''} {m.modality ? `• ${m.modality}` : ''}</p>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {typeof m.context_window === 'number' && (
                                <span>Context: {m.context_window.toLocaleString()} tokens</span>
                              )}
                              {(m.pricing?.input_per_1m || m.pricing?.output_per_1m) && (
                                <div className="mt-1">
                                  <span>Input: ${m.pricing?.input_per_1m?.toFixed?.(3) ?? '-'} / 1M • Output: ${m.pricing?.output_per_1m?.toFixed?.(3) ?? '-'} / 1M</span>
                                </div>
                              )}
                            </div>
                            {!!(m.tags && m.tags.length) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {m.tags.map(t => (
                                  <span key={t} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{t}</span>
                                ))}
                              </div>
                            )}
                            {m.notes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 whitespace-pre-wrap">{m.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(m)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDeleteModel?.(m.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
