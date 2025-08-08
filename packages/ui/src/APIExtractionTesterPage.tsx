import React, { useMemo, useRef, useState } from 'react'
import type { APIProvider } from './APIGallery'
import { Card, CardContent, CardHeader, CardFooter } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { SearchableDropdown } from './SearchableDropdown'
import { Loader2, Info } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface APIExtractionTesterPageProps {
  className?: string
  providers?: APIProvider[]
}

const extractorOptions = [
  { label: 'Fast', value: 'fast' },
  { label: 'Quality', value: 'quality' },
]

const chunkingStrategies = [
  { label: 'Fixed Size Chunking', value: 'fixed' },
  { label: 'Agentic Chunking', value: 'agentic' },
  { label: 'Semantic Chunking', value: 'semantic' },
  { label: 'Recursive Chunking', value: 'recursive' },
  { label: 'Document Chunking', value: 'document' },
]

export const APIExtractionTesterPage: React.FC<APIExtractionTesterPageProps> = ({ className, providers }) => {
  // Left: single API selector (not full gallery)
  const apiOptions = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Google Cloud', value: 'google' },
    { label: 'Stripe', value: 'stripe' },
    { label: 'Twilio', value: 'twilio' },
    { label: 'SendGrid', value: 'sendgrid' },
  ]
  const [selectedApi, setSelectedApi] = useState<string>('openai')

  // Right: controls
  const [extractor, setExtractor] = useState<string>('fast')
  const [chunkStrategy, setChunkStrategy] = useState<string>('fixed')
  const [chunkSize, setChunkSize] = useState<number>(1024)
  const [chunkOverlap, setChunkOverlap] = useState<number>(128)
  const [metadata, setMetadata] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'markdown' | 'text' | 'metadata'>('markdown')
  const [stage, setStage] = useState<'configuration' | 'processing' | 'result'>('configuration')

  const handleExtract = () => {
    setStage('processing')
    setTimeout(() => {
      setStage('result')
      setActiveTab('markdown')
    }, 1400)
  }

  const mockMarkdown = useMemo(() => `# ${chunkingStrategies.find(c => c.value === chunkStrategy)?.label}\n\nThis is a mocked preview of extracted markdown using the **${chunkStrategy}** strategy with a chunk size of **${chunkSize}** tokens and an overlap of **${chunkOverlap}**.`, [chunkStrategy, chunkSize, chunkOverlap])

  const mockText = useMemo(() => `Section: ${chunkStrategy}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n[...simulated chunk content...]`, [chunkStrategy])

  const mockDocMetadata = useMemo(() => ({
    schema: 'generated',
    metadata: {
      title: 'Mocked Document',
      description: 'Mocked metadata extracted from the document.',
      keywords: ['chunking', chunkStrategy, 'AGNO', 'demo']
    },
    params: {
      extractor,
      chunkStrategy,
      chunkSize,
      chunkOverlap,
      metadata
    }
  }), [extractor, chunkStrategy, chunkSize, chunkOverlap, metadata])

  // Stage-based rendering
  if (stage === 'processing') {
    return (
      <div className={cn('w-full min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center', className)}>
        <div className="px-6 py-4 rounded-xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing…</span>
        </div>
      </div>
    )
  }

  if (stage === 'result') {
    return (
      <div className={cn('w-full min-h-screen bg-gray-50 dark:bg-slate-950', className)}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Extraction Result</h1>
          <p className="text-gray-600 dark:text-gray-400">View extracted content and metadata</p>
        </div>
        <Card variant="elevated" className="bg-white dark:bg-slate-900">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
              {(['markdown','text','metadata'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-2 text-sm -mb-px border-b-2 transition-colors',
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  )}
                >
                  {tab === 'markdown' ? 'Markdown' : tab === 'text' ? 'Text' : 'Document Metadata'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mt-4">
              {activeTab === 'markdown' && (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-gray-800 dark:text-gray-200">{mockMarkdown}</pre>
              )}
              {activeTab === 'text' && (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-gray-800 dark:text-gray-200">{mockText}</pre>
              )}
              {activeTab === 'metadata' && (
                <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-gray-800 dark:text-gray-200">{JSON.stringify(mockDocMetadata, null, 2)}</pre>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // configuration stage
  return (
    <div className={cn('w-full min-h-screen bg-gray-50 dark:bg-slate-950', className)}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Extraction Tester</h1>
        <p className="text-gray-600 dark:text-gray-400">Pick an API to test, then configure extraction on the right</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: API selector centered with explanation */}
        <div className="flex">
          <Card variant="elevated" className="bg-white dark:bg-slate-900 flex-1 flex">
            <CardContent className="flex-1 flex items-center justify-center text-center py-16">
              <div className="max-w-md w-full">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Choose an API to Test</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select the API provider you want to validate. Then configure the extraction options on the right.</p>
                <SearchableDropdown
                  value={selectedApi}
                  onChange={setSelectedApi}
                  options={apiOptions}
                  placeholder="Select an API..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: stacked controls and extract button */}
        <div className="flex flex-col gap-5">
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-2"><div className="text-sm font-semibold">Extraction</div></CardHeader>
            <CardContent>
              <label className="block text-xs font-semibold mb-1">Extractor</label>
              <SearchableDropdown
                value={extractor}
                onChange={setExtractor}
                options={extractorOptions}
                placeholder="Select extractor..."
              />
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-2"><div className="text-sm font-semibold">Chunks</div></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Chunking Strategy</label>
                <SearchableDropdown
                  value={chunkStrategy}
                  onChange={setChunkStrategy}
                  options={chunkingStrategies}
                  placeholder="Select a strategy..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Chunk Size (Tokens)</label>
                <input
                  type="range"
                  min={256}
                  max={4096}
                  step={32}
                  value={chunkSize}
                  onChange={e => setChunkSize(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{chunkSize}</span>
                  <span>tokens</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Chunk Overlap</label>
                <input
                  type="range"
                  min={0}
                  max={512}
                  step={16}
                  value={chunkOverlap}
                  onChange={e => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{chunkOverlap}</span>
                  <span>tokens</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-2"><div className="text-sm font-semibold">Metadata</div></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="extract-metadata"
                  checked={metadata}
                  onChange={e => setMetadata(e.target.checked)}
                  className="accent-blue-500"
                />
                <label htmlFor="extract-metadata" className="text-xs font-medium">Extract metadata from the document</label>
                <span title="Extract metadata from the document" className="ml-1"><Info className="w-4 h-4 text-slate-400" aria-label="Extract metadata from the document" /></span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              onClick={handleExtract}
            >
              Extract
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
