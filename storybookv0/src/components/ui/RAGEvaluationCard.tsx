import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Info } from 'lucide-react';

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
}
const MetricBar: React.FC<MetricBarProps> = ({ label, value, color }) => (
  <div className="flex items-center gap-2 text-xs mb-1">
    <span className="w-16 inline-block text-slate-500">{label}</span>
    <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded h-2 overflow-hidden">
      <div
        className={color}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
    <span className="w-10 text-right font-mono text-slate-700 dark:text-slate-200">{value.toFixed(3)}</span>
  </div>
);

interface RAGEvaluationCardProps {
  plan: string;
  model: string;
  extraction: string;
  chunkSize: number;
  overlap: number;
  topK: number;
  dimensions: number;
  relevancy: number;
  recall: number;
  ndcg: number;
  status: string;
  scored: string;
  complete?: boolean;
  highlight?: boolean;
}

export const RAGEvaluationCard: React.FC<RAGEvaluationCardProps> = ({
  plan,
  model,
  extraction,
  chunkSize,
  overlap,
  topK,
  dimensions,
  relevancy,
  recall,
  ndcg,
  status,
  scored,
  complete,
  highlight,
}) => {
  return (
    <Card
      className={`relative min-w-[320px] max-w-xs ${highlight ? 'border-2 border-green-400 shadow-lg' : ''}`}
      padding="lg"
      variant="filled"
    >
      <CardHeader className="flex items-center gap-3 pb-4">
        <Badge variant="info" size="md" className="p-2">
          <Info className="w-5 h-5" />
        </Badge>
        <div>
          <div className="font-semibold text-sm text-slate-500">{plan}</div>
          <div className="font-bold text-lg leading-tight">{model}</div>
          <div className="text-xs text-slate-400">{extraction}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div>Chunk Size/Overlap</div>
          <div className="text-right font-mono">{chunkSize}/{overlap}</div>
          <div>Top K</div>
          <div className="text-right font-mono">{topK}</div>
          <div>Dimensions</div>
          <div className="text-right font-mono">{dimensions}</div>
          <div>Scored</div>
          <div className="text-right font-mono">{scored}</div>
          <div>Status</div>
          <div className="text-right font-mono">{status}</div>
        </div>
        <div className="mt-2">
          <MetricBar label="Relevancy" value={relevancy} color="bg-blue-400" />
          <MetricBar label="Recall" value={recall} color="bg-yellow-300" />
          <MetricBar label="NDCG" value={ndcg} color="bg-green-400" />
        </div>
        {complete && (
          <div className="w-full h-3 rounded bg-blue-100 dark:bg-blue-900 mt-3 overflow-hidden">
            <div className="bg-blue-500 h-3 rounded" style={{ width: '100%' }} />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-4">
        <span className="text-xs text-slate-400">100%</span>
        <Button size="sm" variant="outline">Details</Button>
      </CardFooter>
      {highlight && (
        <span className="absolute top-2 right-2 bg-green-400 text-white text-xs px-2 py-0.5 rounded-full">Best</span>
      )}
    </Card>
  );
};
