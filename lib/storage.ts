import { v4 as uuidv4 } from 'uuid'
import type { Notebook, Cell } from '@/types/notebook'

const INDEX_KEY = 'ai-lab-nb-index'
const nbKey     = (id: string) => `ai-lab-nb-${id}`

// ── Serialization helpers ──────────────────────────────────────────────────────

/** Strip plots from output before saving (can be large base64 blobs). */
function serializeCell(cell: Cell): Cell {
  return {
    ...cell,
    running: false,
    output:  cell.output
      ? { ...cell.output, plots: [] }   // keep stdout/stderr/error, drop plots
      : null,
  }
}

// ── Index management ──────────────────────────────────────────────────────────

function readIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids))
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listNotebooks(): Notebook[] {
  const ids = readIndex()
  const notebooks: Notebook[] = []
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(nbKey(id))
      if (raw) notebooks.push(JSON.parse(raw) as Notebook)
    } catch {
      // skip corrupted entries
    }
  }
  return notebooks.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function loadNotebook(id: string): Notebook | null {
  try {
    const raw = localStorage.getItem(nbKey(id))
    return raw ? (JSON.parse(raw) as Notebook) : null
  } catch {
    return null
  }
}

export function saveNotebook(notebook: Notebook): void {
  const toSave: Notebook = {
    ...notebook,
    updatedAt: new Date().toISOString(),
    cells:     notebook.cells.map(serializeCell),
  }
  localStorage.setItem(nbKey(notebook.id), JSON.stringify(toSave))

  // Ensure id is in index
  const ids = readIndex()
  if (!ids.includes(notebook.id)) {
    writeIndex([notebook.id, ...ids])
  }
}

export function deleteNotebook(id: string): void {
  localStorage.removeItem(nbKey(id))
  writeIndex(readIndex().filter(i => i !== id))
}

export function createNotebook(name = 'Untitled Notebook', cells: Cell[] = []): Notebook {
  const now = new Date().toISOString()
  return {
    id:          uuidv4(),
    name,
    description: '',
    cells,
    createdAt:   now,
    updatedAt:   now,
  }
}

/** Rename a notebook (updates stored copy + index). */
export function renameNotebook(id: string, name: string): void {
  const nb = loadNotebook(id)
  if (nb) saveNotebook({ ...nb, name })
}

// ── Import from file ──────────────────────────────────────────────────────────

/**
 * Parse a file and return a Notebook ready to be saved.
 * Supports:
 *   - `.json`  — our own Notebook format
 *   - `.ipynb` — Jupyter Notebook v4
 */
export function importNotebookFromFile(
  fileName: string,
  content: string
): Notebook {
  const raw = JSON.parse(content)

  // ── Already our format ────────────────────────────────────────────────────
  if (raw.cells && raw.id && raw.name) {
    const nb = raw as Notebook
    // Give it a fresh ID so it doesn't overwrite an existing notebook
    return createNotebook(nb.name, nb.cells.map(c => ({
      ...c,
      output:  null,
      running: false,
    })))
  }

  // ── Jupyter .ipynb v4 ─────────────────────────────────────────────────────
  if (raw.nbformat >= 4 && Array.isArray(raw.cells)) {
    const name = fileName.replace(/\.ipynb$/i, '').replace(/[-_]/g, ' ') || 'Imported Notebook'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cells: Cell[] = raw.cells.flatMap((jc: any): Cell[] => {
      const src: string = Array.isArray(jc.source) ? jc.source.join('') : (jc.source ?? '')
      if (!src.trim()) return []

      const id = uuidv4()
      if (jc.cell_type === 'code') {
        return [{ id, type: 'code', content: src, output: null, running: false, metadata: {} }]
      }
      if (jc.cell_type === 'markdown' || jc.cell_type === 'raw') {
        return [{ id, type: 'markdown', content: src, output: null, running: false, metadata: {} }]
      }
      return []
    })

    return createNotebook(name, cells)
  }

  throw new Error(`Unrecognized format in "${fileName}". Expected a .json notebook or a Jupyter .ipynb file.`)
}
