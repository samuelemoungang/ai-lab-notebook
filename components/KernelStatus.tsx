'use client'

/**
 * KernelStatus — mostra il backend di esecuzione Python attivo:
 *   🟢 Jupyter (PC fisso) — kernel remoto, tutti i pacchetti pip
 *   🔵 Pyodide (browser) — kernel locale WASM
 */

import { useEffect, useState, useCallback } from 'react'
import { Cpu } from 'lucide-react'

interface KernelInfo {
  mode:      'jupyter' | 'pyodide'
  status:    'online' | 'offline' | 'checking'
  latencyMs: number
  kernels:   number   // active kernels on Jupyter server
}

export default function KernelStatus() {
  const [info, setInfo] = useState<KernelInfo>({
    mode: 'pyodide', status: 'checking', latencyMs: 0, kernels: 0,
  })

  const jupyterUrl = process.env.NEXT_PUBLIC_JUPYTER_URL?.trim()

  const check = useCallback(async () => {
    if (!jupyterUrl) {
      setInfo({ mode: 'pyodide', status: 'online', latencyMs: 0, kernels: 0 })
      return
    }

    setInfo(i => ({ ...i, mode: 'jupyter', status: 'checking' }))
    const t0 = Date.now()
    try {
      const res  = await fetch('/api/jupyter-health', { cache: 'no-store' })
      const data = await res.json() as { ok: boolean; kernels: number }
      setInfo({
        mode:      'jupyter',
        status:    data.ok ? 'online' : 'offline',
        latencyMs: Date.now() - t0,
        kernels:   data.kernels ?? 0,
      })
    } catch {
      setInfo({ mode: 'jupyter', status: 'offline', latencyMs: 0, kernels: 0 })
    }
  }, [jupyterUrl])

  useEffect(() => {
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [check])

  const isJupyter = info.mode === 'jupyter'
  const online    = info.status === 'online'
  const checking  = info.status === 'checking'

  const dotClass =
    checking       ? 'bg-yellow-400 animate-pulse' :
    online         ? (isJupyter ? 'bg-violet-400' : 'bg-blue-400') :
                     'bg-red-500'

  const label =
    checking       ? 'Checking…' :
    !online        ? (isJupyter ? 'Jupyter offline' : 'Pyodide error') :
    isJupyter      ? `Jupyter · PC fisso` :
                     'Pyodide · browser'

  const textClass =
    !online        ? 'text-red-400' :
    isJupyter      ? 'text-violet-400' :
                     'text-blue-400'

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-notebook-muted border border-notebook-border rounded px-2 py-1"
      title={
        isJupyter
          ? `Kernel remoto — PC fisso (${info.latencyMs}ms)\n${info.kernels} kernel attivi`
          : 'Pyodide — Python nel browser (WebAssembly)'
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <Cpu size={12} className={textClass} />
      <span className={textClass}>{label}</span>
      {isJupyter && online && info.latencyMs > 0 && (
        <span className="text-notebook-muted/50">{info.latencyMs}ms</span>
      )}
    </div>
  )
}
