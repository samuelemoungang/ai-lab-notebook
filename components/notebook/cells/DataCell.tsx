'use client'

import { useRef, useState } from 'react'
import { Upload, Table, Trash2 } from 'lucide-react'
import type { Cell } from '@/types/notebook'
import { loadFileIntoPython, runCell } from '@/lib/pyodide-manager'

interface Props {
  cell:       Cell
  onDelete:   (id: string) => void
  onChange:   (id: string, content: string) => void
  onOutput:   (id: string, output: Cell['output']) => void
}

export default function DataCell({ cell, onDelete, onChange, onOutput }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [preview, setPreview]  = useState<string[][]>([])
  const [headers, setHeaders]  = useState<string[]>([])
  const [loading, setLoading]  = useState(false)
  const [varName, setVarName]  = useState('df')
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setFileName(file.name)

    const text = await file.text()
    // Simple CSV preview (first 5 rows)
    const lines = text.split('\n').filter(Boolean)
    const head  = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows  = lines.slice(1, 6).map(r =>
      r.split(',').map(v => v.trim().replace(/"/g, ''))
    )
    setHeaders(head)
    setPreview(rows)

    // Load into Python
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, '_')
    await loadFileIntoPython(safeName, text)

    // Run a quick describe() to show in output
    const output = await runCell(
      `print(f"Variable '${safeName}' loaded: {${safeName}.shape[0]} rows × {${safeName}.shape[1]} cols")\nprint(${safeName}.dtypes.to_string())`
    )
    onOutput(cell.id, output)
    onChange(cell.id, safeName)
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-data overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <Table size={14} className="text-accent-data" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent-data/20 text-accent-data">
          Data Upload
        </span>
        <button
          onClick={() => onDelete(cell.id)}
          className="ml-auto p-1 rounded text-notebook-muted hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Variable name + upload */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-notebook-muted font-mono">Variable name:</label>
            <input
              value={varName}
              onChange={e => setVarName(e.target.value)}
              className="
                w-24 bg-notebook-bg border border-notebook-border rounded px-2 py-1
                text-xs font-mono text-notebook-text focus:outline-none focus:border-accent-data/60
              "
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded border border-accent-data/40
              text-xs text-accent-data hover:bg-accent-data/10 transition-colors disabled:opacity-50
            "
          >
            <Upload size={13} />
            {loading ? 'Loading into Python…' : 'Upload CSV / TXT'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {fileName && (
          <p className="text-xs text-notebook-muted">
            📄 <span className="font-mono text-accent-data">{fileName}</span>
            {' → '}
            <span className="font-mono text-accent-code">{varName}</span>
          </p>
        )}

        {/* Preview table */}
        {headers.length > 0 && (
          <div className="overflow-x-auto rounded border border-notebook-border">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-notebook-border/30">
                  {headers.map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-mono text-notebook-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
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
              Showing first 5 rows
            </p>
          </div>
        )}

        {/* Output */}
        {cell.output?.stdout && (
          <pre className="text-xs text-emerald-400 font-mono bg-notebook-bg/50 rounded p-2">
            {cell.output.stdout}
          </pre>
        )}
      </div>
    </div>
  )
}
