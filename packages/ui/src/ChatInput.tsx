import React, { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { SearchableDropdown } from './SearchableDropdown'
import { 
  Send, Paperclip, Image, Mic, MoreHorizontal, 
  Plus, Search, Sparkles, Code, FileText,
  Camera, Folder, Link, Settings, Zap
} from 'lucide-react'

export interface ChatInputProps {
  value?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string, attachments?: File[]) => void
  placeholder?: string
  disabled?: boolean
  maxLines?: number
  showModelSelector?: boolean
  showActionButtons?: boolean
  showAttachments?: boolean
  showVoiceInput?: boolean
  className?: string
}

const models = [
  { label: 'Claude Sonnet 4', value: 'claude-sonnet-4', group: 'Anthropic' },
  { label: 'Claude Opus 4.1', value: 'claude-opus-4.1', group: 'Anthropic' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo', group: 'OpenAI' },
  { label: 'Gemini Pro', value: 'gemini-pro', group: 'Google' },
]

const quickActions = [
  { icon: Sparkles, label: 'Write', description: 'Creative writing and content' },
  { icon: Code, label: 'Code', description: 'Programming and development' },
  { icon: Search, label: 'Research', description: 'Deep research and analysis' },
  { icon: FileText, label: 'Learn', description: 'Educational content' },
]

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'How can I help you today?',
  disabled = false,
  maxLines = 15,
  showModelSelector = true,
  showActionButtons = true,
  showAttachments = true,
  showVoiceInput = true,
  className,
  ...props
}, ref) => {
  const [inputValue, setInputValue] = useState(value)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4')
  const [attachments, setAttachments] = useState<File[]>([])
  const [showActions, setShowActions] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const lineHeight = 24 // approximate line height
      const maxHeight = lineHeight * maxLines
      
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`
        textareaRef.current.style.overflowY = 'auto'
      } else {
        textareaRef.current.style.height = `${Math.max(scrollHeight, 44)}px` // min height
        textareaRef.current.style.overflowY = 'hidden'
      }
    }
  }, [inputValue, maxLines])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
    }

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange?.(newValue)
  }

  const handleSubmit = () => {
    if (inputValue.trim() && !disabled) {
      onSubmit?.(inputValue.trim(), attachments)
      setInputValue('')
      setAttachments([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleVoiceToggle = () => {
    setIsListening(!isListening)
    // Voice recognition would be implemented here
  }

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Quick Actions */}
      {showActionButtons && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="h-9 px-3 text-sm"
              onClick={() => setInputValue(`${action.label.toLowerCase()}: `)}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Main Input Container */}
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus-within:shadow-md focus-within:border-gray-300 dark:focus-within:border-gray-600 transition-all duration-200">
        
        {/* Model Selector - Top Right */}
        {showModelSelector && (
          <div className="absolute top-4 right-4 z-20" ref={modelDropdownRef}>
            <div className="relative">
              <button 
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <span className="font-medium">
                  {models.find(m => m.value === selectedModel)?.label || 'Claude Sonnet 4'}
                </span>
                <svg className={cn("w-3 h-3 transition-transform", showModelDropdown && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showModelDropdown && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  <div className="p-1">
                    {models.map((model) => (
                      <button
                        key={model.value}
                        onClick={() => {
                          setSelectedModel(model.value)
                          setShowModelDropdown(false)
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                          selectedModel === model.value
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        )}
                      >
                        <div className="font-medium">{model.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{model.group}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5"
                >
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text Input Area */}
        <div className="relative p-4">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full resize-none border-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-0 text-base leading-6",
              showModelSelector ? "pt-8 pr-40" : "pr-40"
            )}
            rows={1}
            style={{ minHeight: '44px' }}
            {...props}
          />

          {/* Action Buttons Container */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1">
            {/* Attachment Button */}
            {showAttachments && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
                />
              </div>
            )}

            {/* Image Upload */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Image className="h-4 w-4" />
            </Button>

            {/* Voice Input */}
            {showVoiceInput && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  isListening 
                    ? "text-red-500 bg-red-50 dark:bg-red-900/20" 
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                onClick={handleVoiceToggle}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}

            {/* More Options */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            {/* Send Button */}
            <Button
              size="sm"
              className="h-8 px-3 ml-2"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || disabled}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Extended Actions Panel */}
        {showActions && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button variant="ghost" size="sm" className="justify-start h-auto p-3">
                <Camera className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Take photo</div>
                  <div className="text-xs text-gray-500">Capture with camera</div>
                </div>
              </Button>
              <Button variant="ghost" size="sm" className="justify-start h-auto p-3">
                <Folder className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Browse files</div>
                  <div className="text-xs text-gray-500">Upload documents</div>
                </div>
              </Button>
              <Button variant="ghost" size="sm" className="justify-start h-auto p-3">
                <Link className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Add link</div>
                  <div className="text-xs text-gray-500">Share URL content</div>
                </div>
              </Button>
              <Button variant="ghost" size="sm" className="justify-start h-auto p-3">
                <Settings className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Preferences</div>
                  <div className="text-xs text-gray-500">Adjust settings</div>
                </div>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
        <div className="flex items-center gap-4">
          <span>Press Enter to send • Shift+Enter for new line</span>
          {inputValue.length > 0 && (
            <span>{inputValue.length} characters</span>
          )}
        </div>
        {showModelSelector && (
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3" />
            <span>Fast mode</span>
          </div>
        )}
      </div>
    </div>
  )
})

ChatInput.displayName = 'ChatInput'