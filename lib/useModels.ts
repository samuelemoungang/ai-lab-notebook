'use client'

import { useState, useEffect } from 'react'
import type { HealthResponse } from '@/app/api/lmstudio-health/route'

export interface ModelInfo {
  id:    string
  label: string   // shortened display name
}

interface UseModelsResult {
  models:  ModelInfo[]
  loading: boolean
  error:   boolean
}

/** Fetches the list of models currently loaded in LM Studio. */
export function useModels(): UseModelsResult {
  const [models,  setModels]  = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res  = await fetch('/api/lmstudio-health', { cache: 'no-store' })
        const data = (await res.json()) as HealthResponse
        if (cancelled) return

        if (data.status === 'online' || data.status === 'no_model') {
          setModels(data.models.map(id => ({ id, label: shortLabel(id) })))
          setError(false)
        } else {
          setModels([])
          setError(data.status !== 'not_configured')
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { models, loading, error }
}

/** Strips common suffixes/prefixes to get a readable short name. */
function shortLabel(id: string): string {
  return id
    .replace(/-instruct$/i, '')
    .replace(/-chat$/i, '')
    .replace(/-hf$/i, '')
    .replace(/^lmstudio\//i, '')
}
