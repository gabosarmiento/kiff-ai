import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatInput } from './ChatInput'

export type ChatRole = 'user' | 'assistant'

export interface ChatOutputMessage {
  id: string
  role: ChatRole
  content: string
  timestamp?: Date
}

export interface ChatOutputProps {
  className?: string
  initialMessages?: ChatOutputMessage[]
  disabled?: boolean
  placeholder?: string
  onSubmit?: (value: string) => Promise<ChatOutputMessage | ChatOutputMessage[] | void> | (ChatOutputMessage | ChatOutputMessage[] | void)
}

export function ChatOutput({
  className,
  initialMessages = [],
  disabled = false,
  placeholder = 'Type your message…',
  onSubmit,
}: ChatOutputProps) {
  const [messages, setMessages] = useState<ChatOutputMessage[]>(() =>
    initialMessages.length
      ? initialMessages.map(m => ({ ...m, timestamp: m.timestamp ?? new Date() }))
      : [
          {
            id: 'welcome',
            role: 'assistant',
            content:
              "Hi! I'm your Kiff AI assistant. Ask me anything or describe what you want to build.",
            timestamp: new Date(),
          },
        ]
  )

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (value: string) => {
    const userMsg: ChatOutputMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: value,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    if (onSubmit) {
      try {
        const result = await onSubmit(value)
        if (!result) return
        const arr = Array.isArray(result) ? result : [result]
        const normalized = arr.map((m) => ({
          ...m,
          id: m.id || `assistant_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: m.role || 'assistant',
          timestamp: m.timestamp ?? new Date(),
        }))
        setMessages(prev => [...prev, ...normalized])
        return
      } catch (e) {
        // fall through to default echo below on error
      }
    }

    // Default simple echo if no onSubmit provided
    const assistantMsg: ChatOutputMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: 'Received! I\'m processing your request…',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMsg])
  }

  return (
    <div className={cn('relative flex flex-col h-full min-h-0 overflow-y-auto bg-white dark:bg-slate-900', className)}>
      {/* Messages (scrolls with the container). Add bottom padding to avoid overlap with sticky input) */}
      <div className="flex-1 p-4 space-y-4 pb-24 sm:pb-28">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('flex max-w-[92%] sm:max-w-[80%] items-start gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                  m.role === 'user'
                    ? 'bg-blue-500/20 border border-blue-400/30'
                    : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30'
                )}
              >
                {m.role === 'user' ? (
                  <User className="w-4 h-4 text-blue-400" />
                ) : (
                  <Bot className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              {/* Bubble */}
              <div className={cn('flex-1', m.role === 'user' ? 'mr-2' : 'ml-2')}>
                <div
                  className={cn(
                    'p-3 rounded-lg border',
                    m.role === 'user'
                      ? 'bg-blue-500/10 border-blue-400/20'
                      : 'bg-gray-100 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50'
                  )}
                >
                  <div className="text-gray-900 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                </div>
                {m.timestamp && (
                  <div className="text-[11px] text-slate-500 mt-1">
                    {m.timestamp.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={listRef} />
      </div>

      {/* Sticky Input (always visible at bottom of viewport/container) */}
      <div className="sticky bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-gray-200 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:dark:bg-slate-900/70 [padding-bottom:calc(env(safe-area-inset-bottom))]">
        <ChatInput
          placeholder={placeholder}
          disabled={disabled}
          showModelSelector={false}
          showActionButtons={false}
          className="max-w-full"
          onSubmit={(val) => handleSubmit(val)}
        />
      </div>
    </div>
  )
}
