import React from 'react';
import { ChatOutput, ChatOutputMessage } from './ChatOutput';

export default {
  title: 'Kiff UI/ChatLayout',
  component: ChatDemo,
};

export function ChatDemo() {
  const initial: ChatOutputMessage[] = [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to Kiff AI Chat! Ask anything to get started.',
      timestamp: new Date(),
    },
  ]

  const handleSubmit = async (value: string): Promise<ChatOutputMessage> => {
    // Simple mock assistant reply for Storybook
    return {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: `You said: ${value}`,
      timestamp: new Date(),
    }
  }

  return (
    <div className="h-[600px] md:h-[700px] w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <ChatOutput initialMessages={initial} onSubmit={handleSubmit} />
    </div>
  )
}
