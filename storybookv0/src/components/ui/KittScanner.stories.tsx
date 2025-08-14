import type { Meta, StoryObj } from '@storybook/react';
import KittScanner from './KittScanner';

const meta: Meta<typeof KittScanner> = {
  title: 'UI/KittScanner',
  component: KittScanner,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A KITT-style LED scanner bar with sweeping animation. Perfect for buttons, loading states, or futuristic UI elements.',
      },
    },
  },
  argTypes: {
    color: {
      control: 'color',
      description: 'Color of the LED lights',
    },
    height: {
      control: 'text',
      description: 'Height of the scanner bar (CSS value)',
    },
    ledSize: {
      control: 'text',
      description: 'Width of each LED (CSS value)',
    },
    duration: {
      control: 'text',
      description: 'Duration of one complete sweep cycle (CSS time value)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: (args) => (
    <div style={{ width: '200px', padding: '20px' }}>
      <KittScanner {...args} />
    </div>
  ),
};

export const CustomColor: Story = {
  args: {
    color: '#ff6b35',
  },
  render: (args) => (
    <div style={{ width: '200px', padding: '20px' }}>
      <KittScanner {...args} />
    </div>
  ),
};

export const Larger: Story = {
  args: {
    height: '8px',
    ledSize: '10px',
  },
  render: (args) => (
    <div style={{ width: '300px', padding: '20px' }}>
      <KittScanner {...args} />
    </div>
  ),
};

export const Faster: Story = {
  args: {
    duration: '0.5s',
  },
  render: (args) => (
    <div style={{ width: '200px', padding: '20px' }}>
      <KittScanner {...args} />
    </div>
  ),
};

export const InButton: Story = {
  render: () => (
    <button
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        backgroundColor: '#1a1a1a',
        color: 'white',
        border: '1px solid #333',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
      }}
    >
      <span>Launch System</span>
      <span style={{ width: '120px' }}>
        <KittScanner color="#3895ff" />
      </span>
    </button>
  ),
};

export const InCard: Story = {
  render: () => (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#0a0a0a',
        color: 'white',
        borderRadius: '8px',
        border: '1px solid #333',
        width: '300px',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>System Status</h3>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', marginBottom: '8px', color: '#ccc' }}>
          Scanning for threats...
        </div>
        <KittScanner color="#00ff41" height="3px" />
      </div>
      <div style={{ fontSize: '12px', color: '#888' }}>
        All systems operational
      </div>
    </div>
  ),
};

export const MultipleVariants: Story = {
  render: () => (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Default Blue</h4>
        <div style={{ width: '200px' }}>
          <KittScanner />
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Red Alert</h4>
        <div style={{ width: '200px' }}>
          <KittScanner color="#ff3333" />
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Green Success</h4>
        <div style={{ width: '200px' }}>
          <KittScanner color="#00ff41" />
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Purple</h4>
        <div style={{ width: '200px' }}>
          <KittScanner color="#8b5cf6" />
        </div>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Thin & Fast</h4>
        <div style={{ width: '200px' }}>
          <KittScanner color="#fbbf24" height="2px" ledSize="4px" duration="0.6s" />
        </div>
      </div>
    </div>
  ),
};
