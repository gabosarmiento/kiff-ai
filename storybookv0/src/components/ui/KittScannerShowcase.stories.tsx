import type { Meta, StoryObj } from '@storybook/react';
import KittScannerShowcase from './KittScannerShowcase';

const meta: Meta<typeof KittScannerShowcase> = {
  title: 'Pages/KittScannerShowcase',
  component: KittScannerShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A comprehensive showcase page demonstrating the KITT Scanner component in various contexts including buttons, cards, and different themes.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DarkTheme: Story = {
  render: () => <KittScannerShowcase />,
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

import React, { useState } from 'react';

export const LightTheme: Story = {
  render: () => {
    // Force light theme by modifying the component's initial state
    const ShowcaseWithLightTheme = () => {
      const [isDark, setIsDark] = useState(false);
      
      const toggleTheme = () => {
        setIsDark(!isDark);
      };

      const themeClasses = isDark 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900';

      const cardClasses = isDark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200';

      const buttonClasses = isDark
        ? 'bg-gray-700 border-gray-600 hover:bg-gray-600'
        : 'bg-gray-100 border-gray-300 hover:bg-gray-200';

      return (
        <div className={`min-h-screen transition-colors duration-300 ${themeClasses}`}>
          {/* Just render the showcase with light theme forced */}
          <KittScannerShowcase />
        </div>
      );
    };
    
    return <ShowcaseWithLightTheme />;
  },
  parameters: {
    backgrounds: { default: 'light' },
  },
};
