import type { Meta, StoryObj } from '@storybook/react'
import { SearchableDropdown } from './SearchableDropdown'
import { useState } from 'react'

const meta: Meta<typeof SearchableDropdown> = {
  title: 'UI/SearchableDropdown',
  component: SearchableDropdown,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Sample data
const simpleOptions = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Date', value: 'date' },
  { label: 'Elderberry', value: 'elderberry' },
]

const aiModelsOptions = [
  { label: 'GPT-4', value: 'gpt-4', group: 'OpenAI' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', group: 'OpenAI' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus', group: 'Anthropic' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet', group: 'Anthropic' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku', group: 'Anthropic' },
  { label: 'Gemini Pro', value: 'gemini-pro', group: 'Google' },
  { label: 'Llama 2 70B', value: 'llama-2-70b', group: 'Meta' },
  { label: 'Llama 2 13B', value: 'llama-2-13b', group: 'Meta' },
  { label: 'Mixtral 8x7B', value: 'mixtral-8x7b', group: 'Mistral AI' },
  { label: 'Mistral 7B', value: 'mistral-7b', group: 'Mistral AI' },
]

const countryOptions = [
  { label: 'United States', value: 'us', group: 'North America' },
  { label: 'Canada', value: 'ca', group: 'North America' },
  { label: 'Mexico', value: 'mx', group: 'North America' },
  { label: 'United Kingdom', value: 'gb', group: 'Europe' },
  { label: 'France', value: 'fr', group: 'Europe' },
  { label: 'Germany', value: 'de', group: 'Europe' },
  { label: 'Spain', value: 'es', group: 'Europe' },
  { label: 'Italy', value: 'it', group: 'Europe' },
  { label: 'Japan', value: 'jp', group: 'Asia' },
  { label: 'China', value: 'cn', group: 'Asia' },
  { label: 'South Korea', value: 'kr', group: 'Asia' },
  { label: 'India', value: 'in', group: 'Asia' },
  { label: 'Australia', value: 'au', group: 'Oceania' },
  { label: 'New Zealand', value: 'nz', group: 'Oceania' },
]

// Basic dropdown
export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('')
    
    return (
      <div className="w-64">
        <SearchableDropdown
          value={value}
          options={simpleOptions}
          onChange={setValue}
          placeholder="Select a fruit..."
        />
      </div>
    )
  },
}

// With label
export const WithLabel: Story = {
  render: () => {
    const [value, setValue] = useState('')
    
    return (
      <div className="w-64">
        <SearchableDropdown
          label="Choose Fruit"
          value={value}
          options={simpleOptions}
          onChange={setValue}
          placeholder="Select a fruit..."
        />
      </div>
    )
  },
}

// With groups (AI Models)
export const WithGroups: Story = {
  render: () => {
    const [value, setValue] = useState('claude-3-sonnet')
    
    return (
      <div className="w-80">
        <SearchableDropdown
          label="AI Model"
          value={value}
          options={aiModelsOptions}
          onChange={setValue}
          placeholder="Select a model..."
        />
      </div>
    )
  },
}

// Large dataset (Countries)
export const LargeDataset: Story = {
  render: () => {
    const [value, setValue] = useState('')
    
    return (
      <div className="w-80">
        <SearchableDropdown
          label="Country"
          value={value}
          options={countryOptions}
          onChange={setValue}
          placeholder="Search countries..."
        />
      </div>
    )
  },
}

// Form example
export const FormExample: Story = {
  render: () => {
    const [model, setModel] = useState('gpt-4')
    const [country, setCountry] = useState('')
    const [fruit, setFruit] = useState('')
    
    return (
      <div className="space-y-4 w-80">
        <h3 className="font-semibold">User Preferences</h3>
        
        <SearchableDropdown
          label="Preferred AI Model"
          value={model}
          options={aiModelsOptions}
          onChange={setModel}
          placeholder="Select model..."
        />
        
        <SearchableDropdown
          label="Country"
          value={country}
          options={countryOptions}
          onChange={setCountry}
          placeholder="Select country..."
        />
        
        <SearchableDropdown
          label="Favorite Fruit"
          value={fruit}
          options={simpleOptions}
          onChange={setFruit}
          placeholder="Select fruit..."
        />
        
        <div className="pt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded text-sm">
          <strong>Selected Values:</strong>
          <div className="mt-2 space-y-1 text-xs">
            <div>Model: {model || 'None'}</div>
            <div>Country: {country || 'None'}</div>
            <div>Fruit: {fruit || 'None'}</div>
          </div>
        </div>
      </div>
    )
  },
}

// Interactive demo
export const InteractiveDemo: Story = {
  render: () => {
    const [selectedModel, setSelectedModel] = useState('claude-3-sonnet')
    
    return (
      <div className="space-y-4 w-80">
        <div>
          <h3 className="font-semibold mb-2">Model Selection</h3>
          <SearchableDropdown
            label="AI Model"
            value={selectedModel}
            options={aiModelsOptions}
            onChange={setSelectedModel}
            placeholder="Search models..."
          />
        </div>
        
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Selected Model Info</h4>
          <div className="text-sm text-blue-700 dark:text-blue-200 mt-1">
            {selectedModel ? (
              <>
                <div>Value: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{selectedModel}</code></div>
                <div>Provider: {aiModelsOptions.find(opt => opt.value === selectedModel)?.group}</div>
                <div>Label: {aiModelsOptions.find(opt => opt.value === selectedModel)?.label}</div>
              </>
            ) : (
              'No model selected'
            )}
          </div>
        </div>
        
        <div className="text-xs text-slate-500">
          <strong>Features demonstrated:</strong>
          <ul className="mt-1 space-y-0.5">
            <li>• Search functionality</li>
            <li>• Grouped options</li>
            <li>• Keyboard navigation (↑↓ Enter Esc)</li>
            <li>• Click outside to close</li>
            <li>• Selected state indication</li>
          </ul>
        </div>
      </div>
    )
  },
}