// ─── Cell types ──────────────────────────────────────────────────────────────

export type CellType = 'code' | 'markdown' | 'ai' | 'data' | 'model'

export interface CellOutput {
  stdout:  string
  stderr:  string
  error:   string | null
  plots:   PlotOutput[]
  elapsed: number   // ms
}

export interface PlotOutput {
  type: 'png' | 'plotly'
  data: string  // base64 (png) or JSON string (plotly)
}

export interface Cell {
  id:       string
  type:     CellType
  content:  string         // code / markdown / question / model-id
  output:   CellOutput | null
  running:  boolean
  metadata: Record<string, unknown>
}

// ─── AI message ──────────────────────────────────────────────────────────────

export interface AIMessage {
  role:    'user' | 'assistant'
  content: string
}

// ─── Notebook ─────────────────────────────────────────────────────────────────

export interface Notebook {
  id:          string
  name:        string
  description: string
  cells:       Cell[]
  createdAt:   string
  updatedAt:   string
}

// ─── Model template ───────────────────────────────────────────────────────────

export interface ModelTemplate {
  id:          string
  name:        string
  category:    string
  description: string  // plain text, shown in UI
  explanation: string  // markdown, shown in ModelCell
  code:        string  // Python starter code
  parameters:  ModelParameter[]
}

export interface ModelParameter {
  symbol:      string
  name:        string
  unit:        string
  description: string
}
