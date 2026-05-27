'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft, Cpu, Cloud } from 'lucide-react'
import Notebook from '@/components/notebook/Notebook'
import type { Notebook as NotebookType } from '@/types/notebook'

// ── Starter notebooks ─────────────────────────────────────────────────────────
const NOTEBOOKS: Record<string, NotebookType> = {
  'cheese-acidification': {
    id:          'cheese-acidification',
    name:        'Cheese Acidification Analysis',
    description: 'pH and temperature analysis pipeline for fresh cheese production — apply Luedeking-Piret and logistic models.',
    cells:       [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  },
  'blank': {
    id:          'blank',
    name:        'Untitled Notebook',
    description: 'A blank notebook — start with code, markdown, or an AI cell.',
    cells:       [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  },
  'numerical-methods': {
    id:          'numerical-methods',
    name:        'Numerical Methods',
    description: 'Interpolation, integration, curve fitting and ODE solving with SciPy.',
    cells:       [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  },
  'data-exploration': {
    id:          'data-exploration',
    name:        'Data Exploration',
    description: 'Upload a CSV, explore distributions, correlations and outliers interactively.',
    cells:       [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  },
}

function getNotebook(id: string): NotebookType {
  return (
    NOTEBOOKS[id] ?? {
      id,
      name:        `Notebook ${id}`,
      description: '',
      cells:       [],
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    }
  )
}

// ── AI provider badge ─────────────────────────────────────────────────────────
function ProviderBadge() {
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL
  const isLocal   = Boolean(ollamaUrl)
  const model     = process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'qwen2.5-coder:14b'

  return (
    <div className="flex items-center gap-1.5 text-xs text-notebook-muted border border-notebook-border rounded px-2 py-1">
      {isLocal ? (
        <>
          <Cpu size={12} className="text-emerald-400" />
          <span className="text-emerald-400">{model}</span>
          <span className="text-notebook-muted/60">local</span>
        </>
      ) : (
        <>
          <Cloud size={12} className="text-accent-ai" />
          <span className="text-accent-ai">Claude</span>
          <span className="text-notebook-muted/60">API</span>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NotebookPage({ params }: { params: { id: string } }) {
  const { id }    = params
  const router    = useRouter()
  const notebook  = getNotebook(id)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // TODO: persist to Supabase — for now just flash the badge
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-notebook-bg text-notebook-text">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-notebook-bg/90 backdrop-blur border-b border-notebook-border">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">
          {/* Back */}
          <button
            onClick={() => router.push('/')}
            className="p-1 rounded hover:bg-notebook-border/40 text-notebook-muted hover:text-notebook-text transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Title */}
          <h1 className="text-sm font-medium truncate flex-1">
            {notebook.name}
          </h1>

          {/* Provider */}
          <ProviderBadge />

          {/* Save */}
          <button
            onClick={handleSave}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all
              ${saved
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                : 'border-notebook-border text-notebook-muted hover:text-notebook-text hover:border-notebook-border/80'
              }
            `}
          >
            <Save size={13} />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </header>

      {/* Notebook content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Notebook notebook={notebook} />
      </main>
    </div>
  )
}
