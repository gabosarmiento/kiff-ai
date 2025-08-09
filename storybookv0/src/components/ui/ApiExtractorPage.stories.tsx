import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { ApiExtractorPage } from './ApiExtractorPage'

const meta: Meta<typeof ApiExtractorPage> = {
  title: 'API Extraction Tester/ApiExtractorPage',
  component: ApiExtractorPage,
  parameters: {
    docs: { description: { component: 'Enter one or more URLs to infer a basic API shape. Mock UI only.' } },
  },
}
export default meta

type Story = StoryObj<typeof ApiExtractorPage>

export const Default: Story = {
  args: {
    initialUrls: ['https://api.example.com/v1/users', 'https://docs.example.com/reference#list-users'],
    onExtract: (urls) => console.log('Extract called with', urls),
  },
}
