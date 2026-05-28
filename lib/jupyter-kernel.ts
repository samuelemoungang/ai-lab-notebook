'use client'

import type { CellOutput } from '@/types/notebook'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KernelMessage {
  header:        { msg_id: string; msg_type: string }
  parent_header: { msg_id: string }
  content:       Record<string, unknown>
  channel:       string
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _kernel: JupyterKernelClient | null = null

export function getJupyterConfig(): { url: string; token: string } | null {
  const url   = process.env.NEXT_PUBLIC_JUPYTER_URL?.trim()
  const token = process.env.NEXT_PUBLIC_JUPYTER_TOKEN?.trim() ?? ''
  return url ? { url, token } : null
}

export async function getJupyterKernel(): Promise<JupyterKernelClient> {
  if (_kernel?.isReady()) return _kernel
  const cfg = getJupyterConfig()
  if (!cfg) throw new Error('NEXT_PUBLIC_JUPYTER_URL not set')
  _kernel = new JupyterKernelClient(cfg.url, cfg.token)
  await _kernel.connect()
  return _kernel
}

export function resetJupyterKernel() {
  _kernel?.shutdown()
  _kernel = null
}

// ── Client ────────────────────────────────────────────────────────────────────

export class JupyterKernelClient {
  private ws:        WebSocket | null  = null
  private kernelId:  string   | null  = null
  private sessionId: string           = crypto.randomUUID()
  /** msg_id → ordered list of resolve callbacks */
  private queues = new Map<string, Array<(msg: KernelMessage | null) => void>>()

  constructor(
    private baseUrl: string,
    private token:   string,
  ) {}

  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ── Connect ────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    // 1. Start a Python 3 kernel via REST
    const res = await fetch(`${this.baseUrl}/api/kernels`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify({ name: 'python3' }),
    })
    if (!res.ok) throw new Error(`Jupyter: failed to start kernel (${res.status})`)
    const kernel = await res.json() as { id: string }
    this.kernelId = kernel.id

    // 2. Open the multiplexed WebSocket channel
    const wsBase = this.baseUrl.replace(/^http/, 'ws')
    const wsUrl  = `${wsBase}/api/kernels/${this.kernelId}/channels?token=${this.token}`
    this.ws      = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen  = () => resolve()
      this.ws!.onerror = () => reject(new Error('Jupyter WebSocket connection failed'))
    })

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as KernelMessage
        const parentId = msg.parent_header?.msg_id
        if (!parentId) return
        const queue = this.queues.get(parentId)
        if (queue?.length) {
          const resolve = queue.shift()!
          resolve(msg)
        }
      } catch { /* ignore malformed */ }
    }

    this.ws.onclose = () => { this.ws = null }
  }

  // ── Execute ────────────────────────────────────────────────────────────────

  async runCell(code: string): Promise<CellOutput> {
    if (!this.isReady()) await this.connect()

    const t0    = Date.now()
    const msgId = crypto.randomUUID()

    const request = {
      header: {
        msg_id:   msgId,
        msg_type: 'execute_request',
        session:  this.sessionId,
        username: 'user',
        date:     new Date().toISOString(),
        version:  '5.3',
      },
      parent_header: {},
      metadata:      {},
      content: {
        code,
        silent:           false,
        store_history:    true,
        user_expressions: {},
        allow_stdin:      false,
        stop_on_error:    true,
      },
      buffers: [],
      channel: 'shell',
    }

    this.ws!.send(JSON.stringify(request))

    // Collect all outputs until execute_reply arrives
    let stdout = ''
    let stderr = ''
    let error: string | null = null
    const plots: CellOutput['plots'] = []

    let done = false
    while (!done) {
      const msg = await this.nextMessage(msgId)
      if (!msg) break

      switch (msg.header.msg_type) {

        case 'stream': {
          const c = msg.content as { name: string; text: string }
          if (c.name === 'stderr') stderr += c.text
          else                     stdout += c.text
          break
        }

        case 'execute_result':
        case 'display_data': {
          const data = msg.content.data as Record<string, string>
          if (data['image/png']) {
            plots.push({ type: 'png', data: data['image/png'] })
          } else if (data['image/svg+xml']) {
            // convert SVG to a data URI displayed as img
            const b64 = btoa(unescape(encodeURIComponent(data['image/svg+xml'])))
            plots.push({ type: 'png', data: b64 })
          } else if (data['text/plain']) {
            stdout += data['text/plain'] + '\n'
          }
          break
        }

        case 'error': {
          const c = msg.content as { traceback: string[] }
          // Strip ANSI colour codes for clean display
          error = c.traceback
            .join('\n')
            .replace(/\x1b\[[0-9;]*m/g, '')
          break
        }

        case 'execute_reply':
          done = true
          break
      }
    }

    return { stdout, stderr, error, plots, elapsed: Date.now() - t0 }
  }

  // ── Interrupt ──────────────────────────────────────────────────────────────

  async interrupt(): Promise<void> {
    if (!this.kernelId) return
    await fetch(`${this.baseUrl}/api/kernels/${this.kernelId}/interrupt`, {
      method:  'POST',
      headers: this.headers(),
    })
  }

  // ── Restart ────────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    if (!this.kernelId) return
    await fetch(`${this.baseUrl}/api/kernels/${this.kernelId}/restart`, {
      method:  'POST',
      headers: this.headers(),
    })
  }

  // ── Shutdown ───────────────────────────────────────────────────────────────

  shutdown(): void {
    this.ws?.close()
    this.ws = null
    if (this.kernelId) {
      fetch(`${this.baseUrl}/api/kernels/${this.kernelId}`, {
        method:  'DELETE',
        headers: this.headers(),
      }).catch(() => {})
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private headers() {
    return {
      'Content-Type':  'application/json',
      ...(this.token ? { Authorization: `token ${this.token}` } : {}),
    }
  }

  private nextMessage(msgId: string): Promise<KernelMessage | null> {
    return new Promise(resolve => {
      if (!this.queues.has(msgId)) this.queues.set(msgId, [])
      this.queues.get(msgId)!.push(resolve)
    })
  }
}
