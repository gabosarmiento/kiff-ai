import type { Meta, StoryObj } from '@storybook/react'
import { ChatInput } from './ChatInput'
import { useState } from 'react'
import { Card } from './Card'

const meta: Meta<typeof ChatInput> = {
  title: 'UI/ChatInput',
  component: ChatInput,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    maxLines: {
      control: { type: 'number', min: 1, max: 20 },
    },
    disabled: {
      control: 'boolean',
    },
    showModelSelector: {
      control: 'boolean',
    },
    showActionButtons: {
      control: 'boolean',
    },
    showAttachments: {
      control: 'boolean',
    },
    showVoiceInput: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Basic ChatInput
export const Default: Story = {
  args: {
    placeholder: 'How can I help you today?',
  },
}

// With all features
export const FullFeatured: Story = {
  args: {
    placeholder: 'Ask me anything...',
    showModelSelector: true,
    showActionButtons: true,
    showAttachments: true,
    showVoiceInput: true,
    maxLines: 15,
  },
}

// Minimal version
export const Minimal: Story = {
  args: {
    placeholder: 'Type your message...',
    showModelSelector: false,
    showActionButtons: false,
    showAttachments: false,
    showVoiceInput: false,
  },
}

// Interactive demo
export const Interactive: Story = {
  render: () => {
    const [messages, setMessages] = useState<Array<{ text: string, sender: 'user' | 'ai' }>>([])
    const [isTyping, setIsTyping] = useState(false)

    const handleSubmit = (text: string, attachments?: File[]) => {
      // Add user message
      setMessages(prev => [...prev, { text, sender: 'user' }])
      
      // Simulate AI typing
      setIsTyping(true)
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          text: `I understand you said: "${text}". That's a great question! ${attachments?.length ? `I see you've attached ${attachments.length} file(s).` : ''}`, 
          sender: 'ai' 
        }])
        setIsTyping(false)
      }, 1500)
    }

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-96 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 pt-20">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">Type a message below to see the chat in action</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <ChatInput onSubmit={handleSubmit} />
      </div>
    )
  },
}

// Perplexity style
export const PerplexityStyle: Story = {
  render: () => (
    <div className="max-w-2xl mx-auto">
      <ChatInput
        placeholder="What do you want to know?"
        showActionButtons={false}
        showModelSelector={false}
        className="mb-4"
      />
      
      <div className="flex flex-wrap gap-2 justify-center">
        <button className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Create Images
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Edit Image
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Latest News
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Personas
        </button>
      </div>
    </div>
  ),
}

// Claude style
export const ClaudeStyle: Story = {
  render: () => (
    <div className="max-w-3xl mx-auto">
      <ChatInput
        placeholder="How can I help you today?"
        showActionButtons={true}
        showModelSelector={true}
        className="mb-4"
      />
      
      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
        Claude can make mistakes. Please double-check responses.
      </div>
    </div>
  ),
}

// With different sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Compact (3 lines max)</h3>
        <ChatInput
          placeholder="Compact input..."
          maxLines={3}
          showModelSelector={false}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3">Medium (8 lines max)</h3>
        <ChatInput
          placeholder="Medium input..."
          maxLines={8}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3">Large (20 lines max)</h3>
        <ChatInput
          placeholder="Large input for long conversations..."
          maxLines={20}
        />
      </div>
    </div>
  ),
}

// Different configurations
export const Configurations: Story = {
  render: () => (
    <div className="space-y-8">
      <Card className="p-6">
        <h3 className="font-semibold mb-3">AI Assistant</h3>
        <ChatInput
          placeholder="Ask your AI assistant anything..."
          showModelSelector={true}
          showActionButtons={true}
        />
      </Card>
      
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Search Interface</h3>
        <ChatInput
          placeholder="Search for information..."
          showModelSelector={false}
          showActionButtons={false}
          showAttachments={false}
        />
      </Card>
      
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Document Chat</h3>
        <ChatInput
          placeholder="Ask questions about your documents..."
          showModelSelector={false}
          showActionButtons={false}
          showAttachments={true}
        />
      </Card>
      
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Voice Assistant</h3>
        <ChatInput
          placeholder="Speak or type your question..."
          showVoiceInput={true}
          showActionButtons={false}
        />
      </Card>
    </div>
  ),
}

// Mobile responsive
export const MobileResponsive: Story = {
  render: () => (
    <div className="max-w-sm mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Mobile View</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Optimized for mobile devices with touch-friendly controls
        </p>
      </div>
      
      <ChatInput
        placeholder="How can I help you?"
        showActionButtons={false}
        maxLines={5}
      />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

// States demonstration
export const States: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-2">Normal State</h3>
        <ChatInput placeholder="Ready to chat..." />
      </div>
      
      <div>
        <h3 className="font-semibold mb-2">Disabled State</h3>
        <ChatInput 
          placeholder="Chat is temporarily disabled..."
          disabled={true}
        />
      </div>
      
      <div>
        <h3 className="font-semibold mb-2">With Content</h3>
        <ChatInput 
          value="This is a longer message that demonstrates how the input expands as you type more content. It will grow up to the maximum number of lines and then become scrollable for even longer messages."
          placeholder="Type your message..."
        />
      </div>
    </div>
  ),
}

// Enterprise dashboard integration
export const EnterpriseDashboard: Story = {
  render: () => (
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8 rounded-xl">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Enterprise AI Assistant
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Powered by advanced language models with enterprise security
          </p>
        </div>
        
        <ChatInput
          placeholder="Ask about your company data, generate reports, or get insights..."
          showModelSelector={true}
          showActionButtons={true}
          showAttachments={true}
          showVoiceInput={true}
        />
        
        <div className="flex items-center justify-center mt-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-4">🔒 SOC 2 Compliant</span>
          <span className="mr-4">🛡️ Enterprise Grade Security</span>
          <span>⚡ 99.9% Uptime</span>
        </div>
      </div>
    </div>
  ),
}