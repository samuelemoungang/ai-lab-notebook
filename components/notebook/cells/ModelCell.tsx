'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Atom, ChevronDown, ChevronUp, Trash2, PlusCircle } from 'lucide-react'
import type { Cell } from '@/types/notebook'
import { MODEL_TEMPLATES } from '@/lib/models/templates'

interface Props {
  cell:         Cell
  onChange:     (id: string, content: string) => void
  onDelete:     (id: string) => void
  onInsertCode: (code: string) => void
}

export default function ModelCell({ cell, onChange, onDelete, onInsertCode }: Props) {
  const [showExplanation, setShowExplanation] = useState(true)
  const selectedId = cell.content || MODEL_TEMPLATES[0].id
  const model = MODEL_TEMPLATES.find(m => m.id === selectedId) ?? MODEL_TEMPLATES[0]

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-model overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <Atom size={14} className="text-accent-model" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent-model/20 text-accent-model">
          Model
        </span>
        <select
          value={selectedId}
          onChange={e => onChange(cell.id, e.target.value)}
          className="
            ml-2 bg-notebook-bg border border-notebook-border rounded px-2 py-0.5
            text-xs text-notebook-text focus:outline-none focus:border-accent-model/60
          "
        >
          {MODEL_TEMPLATES.map(m => (
            <option key={m.id} value={m.id}>
              {m.category} — {m.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowExplanation(s => !s)}
            className="p-1 rounded text-notebook-muted hover:text-notebook-text"
            title="Toggle explanation"
          >
            {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => onDelete(cell.id)}
            className="p-1 rounded text-notebook-muted hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description pill */}
        <p className="text-sm text-notebook-text">{model.description}</p>

        {/* Explanation (collapsible) */}
        {showExplanation && (
          <div className="rounded border border-accent-model/20 bg-accent-model/5 p-3">
            <div className="prose-notebook">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {model.explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Parameters table */}
        {model.parameters.length > 0 && (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-notebook-border/20 text-notebook-muted">
                  <th className="px-3 py-1.5 text-left font-mono border border-notebook-border/40">Symbol</th>
                  <th className="px-3 py-1.5 text-left border border-notebook-border/40">Parameter</th>
                  <th className="px-3 py-1.5 text-left border border-notebook-border/40">Unit</th>
                  <th className="px-3 py-1.5 text-left border border-notebook-border/40">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {model.parameters.map(p => (
                  <tr key={p.symbol} className="border-t border-notebook-border/40">
                    <td className="px-3 py-1.5 font-mono text-accent-model">{p.symbol}</td>
                    <td className="px-3 py-1.5 font-medium">{p.name}</td>
                    <td className="px-3 py-1.5 text-notebook-muted">{p.unit}</td>
                    <td className="px-3 py-1.5 text-notebook-muted">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Insert starter code */}
        <button
          onClick={() => onInsertCode(model.code)}
          className="
            flex items-center gap-2 px-4 py-2 rounded border border-accent-model/40
            text-sm text-accent-model hover:bg-accent-model/10 transition-colors
          "
        >
          <PlusCircle size={15} />
          Insert starter code as Python cell
        </button>
      </div>
    </div>
  )
}
