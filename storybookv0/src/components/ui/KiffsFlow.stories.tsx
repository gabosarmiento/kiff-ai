import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { KiffCreatePage } from './KiffCreatePage'
import KiffComposePanel from './KiffComposePanel'
import { SandboxRunningPage } from './SandboxRunningPage'
import KiffResultConfigPage, { GeneratedFile } from './KiffResultConfigPage'

const meta: Meta = {
  title: 'Kiffs/Flow',
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj

export const Default: Story = {
  render: () => {
    const [step, setStep] = React.useState<'create' | 'compose' | 'running' | 'result'>('create')
    const [compose, setCompose] = React.useState<null | { kb: string | null; prompt: string; tools: string[]; mcps: string[]; model: string }>(null)

    React.useEffect(() => {
      let t: number | undefined
      if (step === 'running') {
        t = window.setTimeout(() => setStep('result'), 3000)
      }
      return () => { if (t) window.clearTimeout(t) }
    }, [step])

    const files: GeneratedFile[] = [
      { path: 'app/page.tsx', language: 'tsx', content: `export default function Page(){\n  return (<main className=\"p-8\">Hello from Kiff App</main>)\n}` },
      { path: 'components/Agent.ts', language: 'ts', content: `export async function runAgent(input:string){\n  return 'ok'\n}` },
      { path: 'README.md', language: 'md', content: `# Configure & Run\n- Set env keys\n- Click Run App` }
    ]

    if (step === 'create') {
      return (
        <KiffCreatePage
          mode="auto"
          onCreate={() => setStep('compose')}
        />
      )
    }

    if (step === 'compose') {
      return (
        <KiffComposePanel
          onSubmit={(payload) => { setCompose(payload); setStep('running') }}
        />
      )
    }

    if (step === 'running') {
      return <SandboxRunningPage />
    }

    return (
      <KiffResultConfigPage
        projectName="Unified Kiff Project"
        files={files}
        kb={compose?.kb ?? null}
        model={compose?.model}
        tools={compose?.tools ?? []}
        mcps={compose?.mcps ?? []}
        prompt={compose?.prompt}
        onRun={(env) => console.log('Run with env', env)}
      />
    )
  }
}
