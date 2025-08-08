import React from 'react';
import { RAGEvaluationCard } from './RAGEvaluationCard';

export default {
  title: 'Kiff UI/RAGEvaluationCard',
  component: RAGEvaluationCard,
};

export const Example = () => (
  <div className="flex flex-wrap gap-6 bg-slate-900 p-8 min-h-screen">
    <RAGEvaluationCard
      plan="Vectorization Plan 1"
      model="OpenAI v3 Large"
      extraction="Paragraph Chunking"
      chunkSize={1207}
      overlap={89}
      topK={5}
      dimensions={3072}
      relevancy={0.5308}
      recall={0.6597}
      ndcg={0.9182}
      status="Complete"
      scored="62/62 Questions"
      complete
      highlight
    />
    <RAGEvaluationCard
      plan="Vectorization Plan 2"
      model="Voyage AI 2"
      extraction="Paragraph Chunking"
      chunkSize={3000}
      overlap={308}
      topK={5}
      dimensions={1024}
      relevancy={0.0591}
      recall={0.0935}
      ndcg={0.6629}
      status="Complete"
      scored="62/62 Questions"
      complete
    />
    <RAGEvaluationCard
      plan="Vectorization Plan 3"
      model="OpenAI v3 Small"
      extraction="Paragraph Chunking"
      chunkSize={2233}
      overlap={138}
      topK={5}
      dimensions={1536}
      relevancy={0.4792}
      recall={0.5613}
      ndcg={0.8725}
      status="Complete"
      scored="62/62 Questions"
      complete
    />
    <RAGEvaluationCard
      plan="Vectorization Plan 4"
      model="OpenAI Ada v2"
      extraction="Paragraph Chunking"
      chunkSize={5124}
      overlap={302}
      topK={5}
      dimensions={1536}
      relevancy={0.0}
      recall={0.5613}
      ndcg={0.8725}
      status="Embedding"
      scored="105/105 Vectors"
      complete
    />
  </div>
);
