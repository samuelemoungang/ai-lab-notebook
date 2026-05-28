'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Square, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { OnMount } from '@monaco-editor/react'
import type { Cell } from '@/types/notebook'
import { runCell } from '@/lib/pyodide-manager'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// Plotly is loaded globally via CDN in layout.tsx
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Plotly: any }
}

interface Props {
  cell:       Cell
  index:      number
  onChange:   (id: string, content: string) => void
  onOutput:   (id: string, output: Cell['output']) => void
  onDelete:   (id: string) => void
  running:    boolean
  setRunning: (id: string, v: boolean) => void
  onRunAndNext?:      () => void                          // Shift+Enter → run + focus next
  onRegisterFocus?:   (id: string, fn: () => void) => void  // register focus fn with Notebook
}

export default function CodeCell({
  cell, index, onChange, onOutput, onDelete, setRunning,
  onRunAndNext, onRegisterFocus,
}: Props) {
  const plotRefs  = useRef<Map<string, HTMLDivElement>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const runRef    = useRef<() => void>(() => {})   // stable ref to handleRun
  const [collapsed, setCollapsed] = useState(false)

  // Render Plotly figures whenever output changes
  useEffect(() => {
    if (!cell.output?.plots) return
    cell.output.plots.forEach((plot, i) => {
      if (plot.type === 'plotly') {
        const el = plotRefs.current.get(`${cell.id}-${i}`)
        if (el && window.Plotly) {
          const fig = JSON.parse(plot.data)
          window.Plotly.newPlot(el, fig.data ?? [], {
            ...fig.layout,
            paper_bgcolor: '#161b22',
            plot_bgcolor:  '#0d1117',
            font:          { color: '#e6edf3', size: 11 },
          })
        }
      }
    })
  }, [cell.output, cell.id])

  const handleRun = useCallback(async () => {
    setRunning(cell.id, true)
    onOutput(cell.id, null)
    const output = await runCell(cell.content)
    onOutput(cell.id, output)
    setRunning(cell.id, false)
  }, [cell.id, cell.content, setRunning, onOutput])

  // Keep runRef stable so Monaco keybinding always calls the latest version
  useEffect(() => { runRef.current = handleRun }, [handleRun])

  // Register this cell's focus function with the Notebook
  useEffect(() => {
    onRegisterFocus?.(cell.id, () => editorRef.current?.focus())
  }, [cell.id, onRegisterFocus])

  // Monaco mount: register Shift+Enter keybinding
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addAction({
      id:           'run-cell-and-advance',
      label:        'Run Cell and Advance',
      keybindings:  [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => {
        runRef.current()
        onRunAndNext?.()
      },
    })
  }

  const hasOutput = cell.output !== null

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-code overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <span className="text-xs font-mono text-notebook-muted">
          [{index + 1}]
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent-code/20 text-accent-code font-mono">
          Python
        </span>
        <div className="ml-auto flex items-center gap-1">
          {cell.running ? (
            <button
              onClick={() => setRunning(cell.id, false)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/60"
            >
              <Square size={12} /> Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent-code/20 text-accent-code hover:bg-accent-code/30"
            >
              <Play size={12} /> Run
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded text-notebook-muted hover:text-notebook-text"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={() => onDelete(cell.id)}
            className="p-1 rounded text-notebook-muted hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Editor */}
      {!collapsed && (
        <div className="monaco-container">
          <MonacoEditor
            height={Math.min(400, Math.max(80, cell.content.split('\n').length * 19 + 20))}
            language="python"
            theme="vs-dark"
            value={cell.content}
            onChange={(v: string | undefined) => onChange(cell.id, v ?? '')}
            onMount={handleEditorMount}
            options={{
              minimap:       { enabled: false },
              fontSize:      13,
              lineNumbers:   'on',
              scrollBeyondLastLine: false,
              fontFamily:    'JetBrains Mono, Fira Code, monospace',
              padding:       { top: 8, bottom: 8 },
              renderLineHighlight: 'line',
            }}
          />
        </div>
      )}

      {/* Output */}
      {hasOutput && (
        <div className="border-t border-notebook-border bg-notebook-bg/20 p-3 space-y-2">
          {/* Elapsed time */}
          <span className="text-[10px] text-notebook-muted font-mono">
            ⏱ {cell.output!.elapsed} ms
          </span>

          {/* Error */}
          {cell.output!.error && (
            <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap bg-red-950/20 rounded p-2">
              {cell.output!.error}
            </pre>
          )}

          {/* Stdout */}
          {cell.output!.stdout && (
            <pre className="text-xs text-notebook-text font-mono whitespace-pre-wrap bg-notebook-bg/50 rounded p-2">
              {cell.output!.stdout}
            </pre>
          )}

          {/* Stderr */}
          {cell.output!.stderr && (
            <pre className="text-xs text-yellow-400 font-mono whitespace-pre-wrap opacity-70">
              {cell.output!.stderr}
            </pre>
          )}

          {/* Plots */}
          {cell.output!.plots.map((plot, i) => {
            if (plot.type === 'png') {
              return (
                <img
                  key={i}
                  src={`data:image/png;base64,${plot.data}`}
                  alt="Plot output"
                  className="max-w-full rounded"
                />
              )
            }
            // Plotly — div rendered via useEffect
            return (
              <div
                key={i}
                ref={el => {
                  if (el) plotRefs.current.set(`${cell.id}-${i}`, el)
                }}
                className="w-full min-h-[300px] rounded"
              />
            )
          })}
        </div>
      )}

      {/* Loading state */}
      {cell.running && (
        <div className="border-t border-notebook-border px-3 py-2 flex items-center gap-2">
          <span className="animate-spin text-accent-code">⟳</span>
          <span className="text-xs text-notebook-muted">Running…</span>
        </div>
      )}
    </div>
  )
}
