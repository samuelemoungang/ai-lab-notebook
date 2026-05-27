'use client'

import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { FlaskConical, Plus, BookOpen, Cpu, BarChart2 } from 'lucide-react'
import type { Notebook } from '@/types/notebook'

const STARTER_NOTEBOOKS: Array<Omit<Notebook, 'id' | 'createdAt' | 'updatedAt'> & { icon: React.ReactNode }> = [
  {
    name:        'Cheese Acidification Analysis',
    description: 'Load pH/temperature CSV data, apply Nernst correction, fit Luedeking-Piret model.',
    cells:       [],
    icon:        <FlaskConical size={20} className="text-accent-model" />,
  },
  {
    name:        'Blank Notebook',
    description: 'Start from scratch with an empty notebook.',
    cells:       [],
    icon:        <BookOpen size={20} className="text-accent-code" />,
  },
  {
    name:        'Numerical Methods',
    description: 'ODE solving, curve fitting, interpolation — ready-to-use templates.',
    cells:       [],
    icon:        <Cpu size={20} className="text-accent-ai" />,
  },
  {
    name:        'Data Exploration',
    description: 'Upload a CSV, let AI guide you through cleaning and visualization.',
    cells:       [],
    icon:        <BarChart2 size={20} className="text-accent-data" />,
  },
]

export default function HomePage() {
  const router = useRouter()

  function openNotebook() {
    const id = uuidv4()
    router.push(`/notebook/${id}`)
  }

  return (
    <div className="min-h-screen bg-notebook-bg text-notebook-text">
      {/* Header */}
      <header className="border-b border-notebook-border px-6 py-4 flex items-center gap-3">
        <FlaskConical size={24} className="text-accent-model" />
        <h1 className="text-lg font-semibold">AI Lab Notebook</h1>
        <span className="ml-auto text-xs text-notebook-muted">
          Python · Claude · Pyodide
        </span>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-2">
          Your AI-powered scientific notebook
        </h2>
        <p className="text-notebook-muted mb-10 text-base">
          Write Python, run it in the browser, apply mathematical models, and let AI
          guide you — step by step.
        </p>

        {/* New notebook cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STARTER_NOTEBOOKS.map((nb, i) => (
            <button
              key={i}
              onClick={openNotebook}
              className="
                text-left p-5 rounded-lg border border-notebook-border
                bg-notebook-cell hover:border-accent-code/60
                hover:bg-notebook-cell/80 transition-all group
              "
            >
              <div className="flex items-center gap-2 mb-2">
                {nb.icon}
                <span className="font-medium">{nb.name}</span>
              </div>
              <p className="text-sm text-notebook-muted">{nb.description}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-accent-code opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={12} />
                Open
              </div>
            </button>
          ))}
        </div>

        {/* Feature pills */}
        <div className="mt-12 flex flex-wrap gap-2">
          {[
            '🐍 Python (Pyodide)',
            '🤖 Claude AI',
            '📊 Matplotlib · Plotly',
            '🔬 Luedeking-Piret',
            '📈 Gompertz · Logistic',
            '📁 CSV · TXT upload',
            '🚀 Vercel-ready',
          ].map(f => (
            <span
              key={f}
              className="px-3 py-1 rounded-full border border-notebook-border text-xs text-notebook-muted"
            >
              {f}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
