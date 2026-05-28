'use client'

/**
 * LMStudioStatus
 *
 * Mostra un indicatore di stato per LM Studio sul PC fisso.
 * Polling automatico ogni 30 secondi. Click per aggiornare manualmente.
 *
 * 🟢 online     — PC acceso, LM Studio attivo, modello caricato
 * 🟡 no_model   — LM Studio attivo ma nessun modello caricato
 * 🔴 offline    — PC spento o LM Studio non avviato
 * ⚪ not_configured — NEXT_PUBLIC_LMSTUDIO_URL non impostato
 */

import { useEffect, useState, useCallback } from 'react'
import { Cpu } from 'lucide-react'

/** Minimal inline refresh/spinner SVG — avoids lucide-react compat issues */
function RefreshIcon({ spinning, className }: { spinning: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={`${spinning ? 'animate-spin' : ''} ${className ?? ''}`}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}
import type { HealthResponse } from '@/app/api/lmstudio-health/route'

const POLL_INTERVAL_MS = 30_000   // 30 secondi

type StatusState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; data: HealthResponse; checkedAt: Date }

export default function LMStudioStatus() {
  const [state, setState] = useState<StatusState>({ phase: 'idle' })

  const check = useCallback(async () => {
    setState({ phase: 'checking' })
    try {
      const res  = await fetch('/api/lmstudio-health', { cache: 'no-store' })
      const data = (await res.json()) as HealthResponse
      setState({ phase: 'done', data, checkedAt: new Date() })
    } catch {
      setState({
        phase: 'done',
        data: { status: 'offline', models: [], latencyMs: 0 },
        checkedAt: new Date(),
      })
    }
  }, [])

  // Primo check all'avvio, poi polling
  useEffect(() => {
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [check])

  // ── Non configurato ──────────────────────────────────────────────────────────
  if (state.phase === 'idle') return null

  if (state.phase === 'done' && state.data.status === 'not_configured') {
    return null   // Nessun LM Studio configurato → non mostrare nulla
  }

  // ── Stato dinamico ───────────────────────────────────────────────────────────
  const isChecking = state.phase === 'checking'
  const status     = state.phase === 'done' ? state.data.status     : null
  const models     = state.phase === 'done' ? state.data.models     : []
  const latency    = state.phase === 'done' ? state.data.latencyMs  : 0
  const checkedAt  = state.phase === 'done' ? state.checkedAt       : null

  const configuredModel = process.env.NEXT_PUBLIC_LMSTUDIO_MODEL ?? ''
  // Mostra il primo modello caricato, o quello configurato come fallback
  const displayModel = models[0] ?? configuredModel

  // Dot color
  const dotClass =
    isChecking           ? 'bg-yellow-400 animate-pulse' :
    status === 'online'  ? 'bg-emerald-400' :
    status === 'no_model'? 'bg-yellow-400' :
    status === 'offline' ? 'bg-red-500' :
                           'bg-notebook-muted'

  // Label
  const label =
    isChecking            ? 'Checking…' :
    status === 'online'   ? (displayModel || 'LM Studio') :
    status === 'no_model' ? 'No model loaded' :
    status === 'offline'  ? 'PC offline' :
                            'Error'

  const iconClass =
    status === 'online'   ? 'text-emerald-400' :
    status === 'no_model' ? 'text-yellow-400' :
    status === 'offline'  ? 'text-red-400' :
                            'text-notebook-muted'

  const checkedStr = checkedAt
    ? checkedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  const title =
    isChecking ? 'Verifica in corso…' :
    status === 'online'
      ? `PC acceso · LM Studio attivo · ${latency} ms\nModello: ${displayModel}\nAggiornato: ${checkedStr}` :
    status === 'no_model'
      ? `LM Studio attivo ma nessun modello caricato.\nApri LM Studio e carica un modello.\nAggiornato: ${checkedStr}` :
    status === 'offline'
      ? `PC spento o LM Studio non avviato.\nAggiornato: ${checkedStr}` :
      `Stato: ${status}\nAggiornato: ${checkedStr}`

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-notebook-muted border border-notebook-border rounded px-2 py-1 select-none"
      title={title}
    >
      {/* Dot */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />

      {/* Icon */}
      <Cpu size={12} className={iconClass} />

      {/* Label */}
      <span className={status === 'online' ? 'text-emerald-400' : status === 'offline' ? 'text-red-400' : 'text-yellow-400'}>
        {label}
      </span>

      {status === 'online' && latency > 0 && (
        <span className="text-notebook-muted/50">{latency} ms</span>
      )}

      {/* Local badge */}
      {status === 'online' && (
        <span className="text-notebook-muted/60">local</span>
      )}

      {/* Refresh button */}
      <button
        onClick={e => { e.stopPropagation(); check() }}
        disabled={isChecking}
        className="ml-0.5 p-0.5 rounded hover:bg-notebook-border/40 text-notebook-muted/60 hover:text-notebook-muted disabled:opacity-40 transition-colors"
        title="Aggiorna ora"
      >
        <RefreshIcon spinning={isChecking} />
      </button>
    </div>
  )
}
