import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import ApiExtractionLoading, { ExtractionStep } from './ApiExtractionLoading'

const meta: Meta<typeof ApiExtractionLoading> = {
  title: 'API Extraction Tester/Loading',
  component: ApiExtractionLoading,
  parameters: { layout: 'fullscreen' }
}

export default meta

type Story = StoryObj<typeof ApiExtractionLoading>

export const Simulated: Story = {
  render: () => {
    const [progress, setProgress] = React.useState(0)
    const [steps, setSteps] = React.useState<ExtractionStep[]>([
      { id: 'fetch', label: 'Fetching sources', done: false },
      { id: 'parse', label: 'Parsing content', done: false },
      { id: 'chunk', label: 'Chunking & embedding', done: false },
      { id: 'extract', label: 'Extracting endpoints', done: false },
      { id: 'score', label: 'Scoring confidence', done: false },
    ])

    React.useEffect(() => {
      const total = 100
      let value = 0
      const timers: number[] = []

      // progress ticker
      const tick = window.setInterval(() => {
        value = Math.min(total, value + Math.ceil(Math.random() * 6))
        setProgress(value)
      }, 300)
      timers.push(tick)

      // step completions
      const stepTimes = [800, 1800, 3000, 4300, 5600]
      stepTimes.forEach((ms, i) => {
        const t = window.setTimeout(() => {
          setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: true } : s)))
        }, ms)
        timers.push(t as unknown as number)
      })

      // finalize at ~6.5s
      const done = window.setTimeout(() => setProgress(100), 6500)
      timers.push(done as unknown as number)

      return () => { timers.forEach((t) => window.clearInterval(t)); timers.forEach((t) => window.clearTimeout(t)) }
    }, [])

    return (
      <div className="h-screen w-full bg-slate-50 p-6">
        <ApiExtractionLoading progress={progress} steps={steps} estSecondsRemaining={Math.max(0, Math.ceil((100 - progress) / 12))} />
      </div>
    )
  }
}
