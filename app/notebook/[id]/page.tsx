'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ChevronLeft } from 'lucide-react'
import Notebook       from '@/components/notebook/Notebook'
import LMStudioStatus from '@/components/LMStudioStatus'
import type { Notebook as NotebookType, Cell } from '@/types/notebook'
import { loadNotebook, saveNotebook, createNotebook } from '@/lib/storage'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NotebookPage({ params }: { params: { id: string } }) {
  const { id }   = params
  const router   = useRouter()

  const [notebook,  setNotebook]  = useState<NotebookType | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef    = useRef<HTMLInputElement>(null)
  const notebookRef = useRef<NotebookType | null>(null)  // always-fresh ref, bypasses stale closure

  // Keep ref in sync with state
  useEffect(() => { notebookRef.current = notebook }, [notebook])

  // ── Load notebook on mount ────────────────────────────────────────────────
  useEffect(() => {
    let nb = loadNotebook(id)
    if (!nb) {
      // Brand new ID (e.g. from a direct link): create and persist it
      nb = createNotebook()
      nb = { ...nb, id }
      saveNotebook(nb)
    }
    setNotebook(nb)
  }, [id])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback((cells?: Cell[]) => {
    if (!notebook) return
    const updated = { ...notebook, cells: cells ?? notebook.cells }
    saveNotebook(updated)
    setNotebook(updated)
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }, [notebook])

  // ── Title editing ─────────────────────────────────────────────────────────
  function startEditTitle() {
    setEditingTitle(true)
    setTimeout(() => titleRef.current?.select(), 0)
  }

  function commitTitle(name: string) {
    if (!notebook) return
    const trimmed = name.trim() || 'Untitled Notebook'
    setNotebook(nb => nb ? { ...nb, name: trimmed } : nb)
    setEditingTitle(false)
  }

  // ── Cells change callback (passed to Notebook) ────────────────────────────
  function handleCellsChange(cells: Cell[]) {
    setNotebook(nb => nb ? { ...nb, cells } : nb)
  }

  if (!notebook) {
    return (
      <div className="min-h-screen bg-notebook-bg flex items-center justify-center">
        <span className="text-notebook-muted text-sm animate-pulse">Loading…</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-notebook-bg text-notebook-text">

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-notebook-bg/90 backdrop-blur border-b border-notebook-border">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">

          {/* Back — saves latest state via ref before navigating */}
          <button
            onClick={() => {
              if (notebookRef.current) saveNotebook(notebookRef.current)
              router.push('/')
            }}
            className="p-1 rounded hover:bg-notebook-border/40 text-notebook-muted hover:text-notebook-text transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Editable title */}
          {editingTitle ? (
            <input
              ref={titleRef}
              defaultValue={notebook.name}
              onBlur={e  => commitTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle(e.currentTarget.value)
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              className="
                flex-1 bg-transparent border-b border-accent-code/60 text-sm font-medium
                text-notebook-text focus:outline-none px-0
              "
            />
          ) : (
            <h1
              onClick={startEditTitle}
              title="Click to rename"
              className="text-sm font-medium truncate flex-1 cursor-pointer hover:text-accent-code transition-colors"
            >
              {notebook.name}
            </h1>
          )}

          {/* Provider */}
          <LMStudioStatus />

          {/* Save */}
          <button
            onClick={() => handleSave()}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all
              ${saveState === 'saved'
                ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                : 'border-notebook-border text-notebook-muted hover:text-notebook-text hover:border-notebook-border/80'
              }
            `}
          >
            {saveState === 'saved' ? <>✓ Saved!</> : <><Save size={13} /> Save</>}
          </button>
        </div>
      </header>

      {/* Notebook content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Notebook
          notebook={notebook}
          onSave={handleSave}
          onCellsChange={handleCellsChange}
        />
      </main>
    </div>
  )
}
