import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { SearchableDropdown } from './SearchableDropdown';
import { Loader2, UploadCloud, FileText, X, Info } from 'lucide-react';

interface ExtractionTesterCardProps {
  className?: string;
}

export const ExtractionTesterCard: React.FC<ExtractionTesterCardProps> = ({ className }) => {
  const [file, setFile] = useState<File | null>(null);
  const [extractor, setExtractor] = useState('iris');
  const [chunkSize, setChunkSize] = useState(2048);
  const [extracting, setExtracting] = useState(false);
  const [metadata, setMetadata] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractorOptions = [
    { label: 'Vectorize Iris', value: 'iris' },
    { label: 'OpenAI Embeddings', value: 'openai' },
    { label: 'Mistral Embeddings', value: 'mistral' },
    { label: 'VoyageAI', value: 'voyageai' },
  ];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  function removeFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleExtract() {
    setExtracting(true);
    setTimeout(() => setExtracting(false), 1500); // Demo only
  }

  return (
    <Card className={className} padding="xl" variant="elevated">
      <CardHeader className="flex items-center gap-3 pb-6">
        <UploadCloud className="w-8 h-8 text-blue-500" />
        <div>
          <div className="font-bold text-xl">Extraction Tester</div>
          <div className="text-slate-500 text-sm">Test the extraction of data from a document</div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-8">
        {/* File upload */}
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl min-h-[220px] bg-slate-50 dark:bg-slate-900">
          {!file ? (
            <>
              <UploadCloud className="w-12 h-12 text-slate-400 mb-2" />
              <div className="text-slate-500 text-center mb-2">
                Drag & Drop Your File Here
                <br />
                <span className="text-xs text-slate-400">
                  PDF, Document, Presentation (up to 20 MB)<br />
                  Text, Markdown (up to 500 KB)<br />
                  Image, HTML, Spreadsheet, CSV, JSON, Email (up to 5 MB)
                </span>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} variant="primary">
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFile}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.html,.csv,.json,.eml,.xlsx,.xls,.png,.jpg,.jpeg"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-blue-500" />
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{file.name}</div>
              <Button variant="outline" size="sm" onClick={removeFile} leftIcon={<X className="w-4 h-4" />}>Remove</Button>
            </div>
          )}
        </div>
        {/* Extraction controls */}
        <div className="flex-1 flex flex-col gap-6">
          <div>
            <label className="block text-xs font-semibold mb-1">Extractor</label>
            <SearchableDropdown
              value={extractor}
              onChange={setExtractor}
              options={extractorOptions}
              placeholder="Select extractor..."
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
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-6">
        <Button
          variant="primary"
          size="lg"
          disabled={!file || extracting}
          onClick={handleExtract}
          rightIcon={extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        >
          Extract
        </Button>
      </CardFooter>
    </Card>
  );
};
