import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : null

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DBNotebook {
  id:          string
  name:        string
  description: string
  cells_json:  string   // JSON.stringify(Cell[])
  created_at:  string
  updated_at:  string
  user_id:     string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Save (upsert) a notebook.
 * Returns { error } — null means success.
 */
export async function saveNotebook(id: string, name: string, description: string, cellsJson: string) {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const { error } = await supabase.from('notebooks').upsert({
    id,
    name,
    description,
    cells_json:  cellsJson,
    updated_at:  new Date().toISOString(),
  })
  return { error }
}

/**
 * Load a notebook by ID.
 * Returns { data, error }.
 */
export async function loadNotebook(id: string) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }

  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as DBNotebook | null, error }
}

/**
 * List all notebooks for the current session (no auth for MVP).
 */
export async function listNotebooks() {
  if (!supabase) return { data: [], error: null }

  const { data, error } = await supabase
    .from('notebooks')
    .select('id, name, description, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  return { data: (data ?? []) as Omit<DBNotebook, 'cells_json' | 'user_id'>[], error }
}
