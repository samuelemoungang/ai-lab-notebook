'use client'

import { useState } from 'react'
import { Plus, Code2, FileText, Bot, Table, Atom } from 'lucide-react'
import type { CellType } from '@/types/notebook'

interface Props {
  onAdd:    (type: CellType) => void
  compact?: boolean
}

const CELL_TYPES: { type: CellType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'code',     label: 'Code',       icon: <Code2  size={13} />, color: 'text-accent-code  hover:bg-accent-code/10' },
  { type: 'markdown', label: 'Markdown',   icon: <FileText size={13} />, color: 'text-notebook-muted hover:bg-notebook-border/30' },
  { type: 'ai',       label: 'AI Cell',    icon: <Bot    size={13} />, color: 'text-accent-ai   hover:bg-accent-ai/10' },
  { type: 'data',     label: 'Data',       icon: <Table  size={13} />, color: 'text-accent-data  hover:bg-accent-data/10' },
  { type: 'model',    label: 'Model',      icon: <Atom   size={13} />, color: 'text-accent-model hover:bg-accent-model/10' },
]

export default function AddCellMenu({ onAdd, compact = false }: Props) {
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => setOpen(o => !o)}
          className="
            flex items-center gap-1 px-2 py-0.5 rounded
            text-[10px] text-notebook-muted bg-notebook-cell border border-notebook-border
            hover:text-notebook-text hover:border-notebook-border/80
            transition-all shadow-sm
          "
        >
          <Plus size={10} /> Insert cell
        </button>

        {open && (
          <div className="
            absolute top-full mt-1 z-50
            flex gap-1 bg-notebook-cell border border-notebook-border
            rounded-lg shadow-xl p-1
          ">
            {CELL_TYPES.map(({ type, label, icon, color }) => (
              <button
                key={type}
                onClick={() => { onAdd(type); setOpen(false) }}
                title={label}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${color}`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full end-of-notebook bar
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-notebook-border/30">
      <span className="text-xs text-notebook-muted pl-1">Add cell:</span>
      {CELL_TYPES.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded border border-notebook-border
            text-xs font-medium transition-colors bg-notebook-cell
            ${color}
          `}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  )
}
