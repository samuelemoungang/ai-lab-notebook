'use client'

import { useReducer, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Cell, CellType, Notebook as NotebookType } from '@/types/notebook'
import CodeCell     from './cells/CodeCell'
import MarkdownCell from './cells/MarkdownCell'
import AICell       from './cells/AICell'
import DataCell     from './cells/DataCell'
import ModelCell    from './cells/ModelCell'
import AddCellMenu  from './AddCellMenu'

// ── State ────────────────────────────────────────────────────────────────────
type State = { cells: Cell[]; runningIds: Set<string> }

type Action =
  | { type: 'ADD';     cellType: CellType; after?: string; content?: string }
  | { type: 'UPDATE';  id: string; content: string }
  | { type: 'OUTPUT';  id: string; output: Cell['output'] }
  | { type: 'DELETE';  id: string }
  | { type: 'RUNNING'; id: string; value: boolean }
  | { type: 'MOVE';    id: string; dir: 'up' | 'down' }

function makeCell(type: CellType, content = ''): Cell {
  return { id: uuidv4(), type, content, output: null, running: false, metadata: {} }
}

function reducer(state: State, action: Action): State {
  const { cells } = state

  switch (action.type) {
    case 'ADD': {
      const newCell = makeCell(action.cellType, action.content ?? '')
      if (!action.after) return { ...state, cells: [...cells, newCell] }
      const idx = cells.findIndex(c => c.id === action.after)
      const next = [...cells]
      next.splice(idx + 1, 0, newCell)
      return { ...state, cells: next }
    }
    case 'UPDATE':
      return { ...state, cells: cells.map(c => c.id === action.id ? { ...c, content: action.content } : c) }
    case 'OUTPUT':
      return { ...state, cells: cells.map(c => c.id === action.id ? { ...c, output: action.output } : c) }
    case 'DELETE':
      return { ...state, cells: cells.filter(c => c.id !== action.id) }
    case 'RUNNING': {
      const next = new Set(state.runningIds)
      action.value ? next.add(action.id) : next.delete(action.id)
      return {
        ...state,
        runningIds: next,
        cells: cells.map(c => c.id === action.id ? { ...c, running: action.value } : c),
      }
    }
    case 'MOVE': {
      const idx = cells.findIndex(c => c.id === action.id)
      if (action.dir === 'up' && idx === 0) return state
      if (action.dir === 'down' && idx === cells.length - 1) return state
      const next = [...cells]
      const swap = action.dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return { ...state, cells: next }
    }
    default: return state
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  notebook:       NotebookType
  onSave?:        (cells: Cell[]) => void
  onCellsChange?: (cells: Cell[]) => void
}

export default function Notebook({ notebook, onSave, onCellsChange }: Props) {
  const initial: State = {
    cells: notebook.cells.length
      ? notebook.cells
      : [makeCell('markdown', `# ${notebook.name}\n\n${notebook.description}`)],
    runningIds: new Set(),
  }

  const [state, dispatch] = useReducer(reducer, initial)

  // Notify parent when cells change
  useEffect(() => { onCellsChange?.(state.cells) }, [state.cells, onCellsChange])

  // Ctrl+S → save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave?.(state.cells)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave, state.cells])

  const addCell     = useCallback((type: CellType, after?: string, content?: string) =>
    dispatch({ type: 'ADD', cellType: type, after, content }), [])
  const updateCell  = useCallback((id: string, content: string) =>
    dispatch({ type: 'UPDATE', id, content }), [])
  const setOutput   = useCallback((id: string, output: Cell['output']) =>
    dispatch({ type: 'OUTPUT', id, output }), [])
  const deleteCell  = useCallback((id: string) =>
    dispatch({ type: 'DELETE', id }), [])
  const setRunning  = useCallback((id: string, v: boolean) =>
    dispatch({ type: 'RUNNING', id, value: v }), [])
  const insertCode  = useCallback((code: string, after?: string) =>
    addCell('code', after, code), [addCell])

  // ── Focus management for Shift+Enter navigation ──────────────────────────
  const focusFns = useRef(new Map<string, () => void>())
  const registerFocus = useCallback((id: string, fn: () => void) => {
    focusFns.current.set(id, fn)
  }, [])
  const focusNextCell = useCallback((id: string) => {
    const cells = state.cells
    const idx   = cells.findIndex(c => c.id === id)
    if (idx === -1) return
    if (idx < cells.length - 1) {
      // Focus existing next cell
      focusFns.current.get(cells[idx + 1].id)?.()
    } else {
      // Last cell → create a new code cell after it
      dispatch({ type: 'ADD', cellType: 'code', after: id })
      // Focus will auto-register when the new cell mounts
    }
  }, [state.cells])

  let codeIdx = -1

  return (
    <div className="space-y-3 pb-24">
      {state.cells.map(cell => {
        if (cell.type === 'code') codeIdx++
        const codeIndex = codeIdx

        const commonProps = {
          cell,
          onChange: updateCell,
          onDelete: deleteCell,
        }

        return (
          <div key={cell.id} className="group relative">
            {cell.type === 'code' && (
              <CodeCell
                {...commonProps}
                index={codeIndex}
                onOutput={setOutput}
                running={cell.running}
                setRunning={setRunning}
                onRunAndNext={()  => focusNextCell(cell.id)}
                onRegisterFocus={registerFocus}
              />
            )}
            {cell.type === 'markdown' && (
              <MarkdownCell {...commonProps} />
            )}
            {cell.type === 'ai' && (
              <AICell
                {...commonProps}
                onInsertCode={code => insertCode(code, cell.id)}
              />
            )}
            {cell.type === 'data' && (
              <DataCell
                {...commonProps}
                onOutput={setOutput}
              />
            )}
            {cell.type === 'model' && (
              <ModelCell
                {...commonProps}
                onInsertCode={code => insertCode(code, cell.id)}
              />
            )}

            {/* Insert cell between rows */}
            <div className="absolute -bottom-1.5 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <AddCellMenu onAdd={(type) => addCell(type, cell.id)} compact />
            </div>
          </div>
        )
      })}

      {/* End-of-notebook add button */}
      <AddCellMenu onAdd={(type) => addCell(type)} />
    </div>
  )
}
