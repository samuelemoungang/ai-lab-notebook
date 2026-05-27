'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil, Eye, Trash2 } from 'lucide-react'
import type { Cell } from '@/types/notebook'

interface Props {
  cell:     Cell
  onChange: (id: string, content: string) => void
  onDelete: (id: string) => void
}

export default function MarkdownCell({ cell, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState(!cell.content)

  return (
    <div className="rounded-lg border border-notebook-border bg-notebook-cell cell-border-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-notebook-border bg-notebook-bg/40">
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-600/30 text-notebook-muted">
          Markdown
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setEditing(e => !e)}
            className="p-1 rounded text-notebook-muted hover:text-notebook-text"
          >
            {editing ? <Eye size={14} /> : <Pencil size={14} />}
          </button>
          <button
            onClick={() => onDelete(cell.id)}
            className="p-1 rounded text-notebook-muted hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Edit or preview */}
      {editing ? (
        <textarea
          value={cell.content}
          onChange={e => onChange(cell.id, e.target.value)}
          onBlur={() => cell.content && setEditing(false)}
          autoFocus
          placeholder="Write markdown here… (click preview icon or blur to render)"
          className="
            w-full bg-notebook-bg text-sm text-notebook-text font-mono
            p-4 resize-none focus:outline-none min-h-[80px]
          "
          rows={Math.max(4, cell.content.split('\n').length)}
        />
      ) : (
        <div
          className="prose-notebook p-4 cursor-text min-h-[40px]"
          onClick={() => setEditing(true)}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {cell.content || '*Empty — click to edit*'}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
