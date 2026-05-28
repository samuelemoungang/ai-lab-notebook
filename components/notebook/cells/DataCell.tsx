'use client'

import { useRef, useState } from 'react'
import { Upload, Table, Trash2 } from 'lucide-react'
import type { Cell } from '@/types/notebook'
import { loadFileIntoPython, runCell } from '@/lib/pyodide-manager'

interface Props {
  cell:     Cell
  onDelete: (id: string) => void
  onChange: (id: string, content: string) => void
  onOutput: (id: string, output: Cell['output']) => void
}

type LoadState = 'idle' | 'reading' | 'python' | 'ready' | 'error'

/** Detect CSV separator from raw text (looks at first line). */
function detectSep(text: string): string {
  const first = text.split('\n')[0] ?? ''
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  for (const ch of first) if (ch in counts) counts[ch]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export default function DataCell({ cell, onDelete, onChange, onOutput }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error,     setError]     = useState<string | null>(null)
  const [varName,   setVarName]   = useState('df')
  const [fileName,  setFileName]  = useState<string | null>(null)
  const [preview,   setPreview]   = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [pyInfo,    setPyInfo]    = useState<{ rows: number; cols: string[] } | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setLoadState('reading')
    setFileName(file.name)

    const text = await file.text()

    // ── JS preview (instant) ─────────────────────────────────────────────────
    const sep   = detectSep(text)
    const lines = text.split('\n').filter(Boolean)
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
    const rows    = lines.slice(1, 6).map(r =>
      r.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    )
    setPreview({ headers, rows })

    // ── Python loading (async) ────────────────────────────────────────────────
    setLoadState('python')
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, '_')

    try {
      const raw    = await loadFileIntoPython(safeName, text)
      const result = JSON.parse(raw) as { ok: boolean; rows?: number; cols?: string[]; error?: string }

      if (!result.ok) {
        setError(result.error ?? 'Unknown error')
        setLoadState('error')
        return
      }

      setPyInfo({ rows: result.rows!, cols: result.cols! })

      // Confirm with a quick describe in the shared namespace
      const output = await runCell(
        `print(f"✓ '{safeName}' ready — {${safeName}.shape[0]} rows × {${safeName}.shape[1]} cols")\n` +
        `print(${safeName}.head(3).to_string())`
      )
      onOutput(cell.id, output)
      onChange(cell.id, safeName)
      setLoadState('ready')

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setLoadState('error')
    }
  }

  const isLoading = loadState === 'reading' || loadState === 'python'

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-data overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <Table size={14} className="text-accent-data" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent-data/20 text-accent-data">
          Data Upload
        </span>

        {/* Status badge */}
        {loadState === 'python' && (
          <span className="text-xs text-yellow-400 animate-pulse">⏳ Loading into Python…</span>
        )}
        {loadState === 'ready' && pyInfo && (
          <span className="text-xs text-emerald-400">
            ✓ <code className="font-mono">{varName}</code> ready
            &nbsp;·&nbsp;{pyInfo.rows} rows × {pyInfo.cols.length} cols
          </span>
        )}
        {loadState === 'error' && (
          <span className="text-xs text-red-400">⚠ Error</span>
        )}

        <button
          onClick={() => onDelete(cell.id)}
          className="ml-auto p-1 rounded text-notebook-muted hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">

        {/* Variable name + upload button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-notebook-muted font-mono">Variable name:</label>
            <input
              value={varName}
              onChange={e => setVarName(e.target.value)}
              disabled={isLoading}
              className="
                w-24 bg-notebook-bg border border-notebook-border rounded px-2 py-1
                text-xs font-mono text-notebook-text focus:outline-none
                focus:border-accent-data/60 disabled:opacity-50
              "
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded border border-accent-data/40
              text-xs text-accent-data hover:bg-accent-data/10 transition-colors disabled:opacity-50
            "
          >
            <Upload size={13} />
            {loadState === 'reading' ? 'Reading file…'
              : loadState === 'python' ? 'Loading into Python…'
              : loadState === 'ready'  ? 'Upload another file'
              : 'Upload CSV / TXT'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* File info */}
        {fileName && loadState !== 'idle' && (
          <p className="text-xs text-notebook-muted">
            📄 <span className="font-mono text-accent-data">{fileName}</span>
            {' → '}
            <span className="font-mono text-accent-code">{varName}</span>
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 font-mono bg-red-500/10 rounded p-2">{error}</p>
        )}

        {/* Preview table */}
        {preview && (
          <div className="overflow-x-auto rounded border border-notebook-border">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-notebook-border/30">
                  {preview.headers.map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-mono text-notebook-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-notebook-border/40">
                    {row.map((val, j) => (
                      <td key={j} className="px-3 py-1 font-mono text-notebook-text whitespace-nowrap">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-notebook-muted px-3 py-1 border-t border-notebook-border/40">
              {loadState === 'ready'
                ? `Preview · ${pyInfo?.rows ?? '?'} total rows`
                : 'Showing first 5 rows'}
            </p>
          </div>
        )}

        {/* Output */}
        {cell.output?.stdout && (
          <pre className="text-xs text-emerald-400 font-mono bg-notebook-bg/50 rounded p-2 whitespace-pre-wrap">
            {cell.output.stdout}
          </pre>
        )}
      </div>
    </div>
  )
}
